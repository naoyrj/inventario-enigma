const pool = require("../config/db");

// =========================================================
// HELPERS
// =========================================================

const puedeVerCategoria = (categoria, req) => {
  if (req.usuario.rol === "principal") {
    return true;
  }

  if (!categoria || categoria.tipo === "global") {
    return true;
  }

  if (categoria.tipo === "privada") {
    return (
      req.usuario.rol === "equipo_interno" &&
      Number(categoria.ubicacion_propietaria_id) ===
        Number(req.usuario.ubicacion_id)
    );
  }

  return false;
};

const puedeVerSolicitud = (solicitud, req) => {
  if (req.usuario.rol === "principal") {
    return true;
  }

  const ubicacionUsuario = Number(
    req.usuario.ubicacion_id
  );

  return (
    Number(solicitud.destino_ubicacion_id) ===
      ubicacionUsuario ||
    Number(solicitud.solicitante_ubicacion_id) ===
      ubicacionUsuario
  );
};

// =========================================================
// CATÁLOGO EXCLUSIVO PARA SOLICITUDES
// =========================================================

const getCatalogoSolicitud = async (req, res) => {
  try {
    const rol = req.usuario?.rol;
    const ubicacionId = Number(
      req.usuario?.ubicacion_id
    );

    if (
      ![
        "principal",
        "sucursal",
        "equipo_interno"
      ].includes(rol)
    ) {
      return res.status(403).json({
        message:
          "No tienes permiso para consultar el catálogo de solicitudes"
      });
    }

    if (
      !Number.isFinite(ubicacionId) ||
      ubicacionId <= 0
    ) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    const categoriasParams = [];

    let categoriasSql = `
      SELECT
        c.id,
        c.nombre,
        c.tipo,
        c.ubicacion_propietaria_id,
        c.activo

      FROM categorias c

      WHERE c.activo = TRUE
    `;

    if (rol === "equipo_interno") {
      categoriasParams.push(ubicacionId);

      categoriasSql += `
        AND (
          c.tipo = 'global'
          OR (
            c.tipo = 'privada'
            AND c.ubicacion_propietaria_id = $1
          )
        )
      `;
    } else {
      categoriasSql += `
        AND c.tipo = 'global'
      `;
    }

    categoriasSql += `
      ORDER BY c.nombre
    `;

    const categoriasResult =
      await pool.query(
        categoriasSql,
        categoriasParams
      );

    const productosParams = [];

    let productosSql = `
      SELECT
        p.id,
        p.nombre,
        p.descripcion,
        p.sku,
        p.unidad_medida,
        p.categoria_id,
        p.punto_reorden,
        p.activo,

        c.nombre
          AS categoria_nombre,

        c.tipo
          AS categoria_tipo,

        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id

      FROM productos p

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      WHERE p.activo = TRUE

        AND (
          p.categoria_id IS NULL
          OR c.activo = TRUE
        )
    `;

    if (rol === "equipo_interno") {
      productosParams.push(ubicacionId);

      productosSql += `
        AND (
          c.id IS NULL
          OR c.tipo = 'global'
          OR (
            c.tipo = 'privada'
            AND c.ubicacion_propietaria_id = $1
          )
        )
      `;
    } else {
      productosSql += `
        AND (
          c.id IS NULL
          OR c.tipo = 'global'
        )
      `;
    }

    productosSql += `
      ORDER BY p.nombre
    `;

    const productosResult =
      await pool.query(
        productosSql,
        productosParams
      );

    res.json({
      productos:
        productosResult.rows,

      categorias:
        categoriasResult.rows
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener el catálogo de solicitudes",
      error:
        error.message
    });
  }
};

// =========================================================
// OBTENER SOLICITUDES
// =========================================================

const getSolicitudes = async (req, res) => {
  try {
    const params = [];

    let sql = `
      SELECT
        s.id,
        s.estado,
        s.motivo_cierre,
        s.created_at,
        s.updated_at,

        destino.id AS destino_ubicacion_id,
        destino.nombre AS destino_ubicacion_nombre,
        destino.tipo AS destino_ubicacion_tipo,

        solicitante.id AS solicitante_ubicacion_id,
        solicitante.nombre AS solicitante_ubicacion_nombre,

        u.id AS creado_por_usuario_id,
        u.nombre AS creado_por_usuario_nombre

      FROM solicitudes s

      INNER JOIN ubicaciones destino
        ON s.destino_ubicacion_id = destino.id

      INNER JOIN ubicaciones solicitante
        ON s.solicitante_ubicacion_id =
           solicitante.id

      INNER JOIN usuarios u
        ON s.creado_por_usuario_id = u.id

      WHERE 1 = 1
    `;

    if (req.usuario.rol !== "principal") {
      params.push(
        Number(req.usuario.ubicacion_id)
      );

      sql += `
        AND (
          s.destino_ubicacion_id = $${params.length}
          OR
          s.solicitante_ubicacion_id = $${params.length}
        )
      `;
    }

    sql += `
      ORDER BY s.created_at DESC
    `;

    const result = await pool.query(
      sql,
      params
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener las solicitudes",
      error: error.message
    });
  }
};

// =========================================================
// OBTENER SOLICITUD POR ID
// =========================================================

const getSolicitudById = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitudesResult =
      await pool.query(
        `
          SELECT
            s.id,
            s.estado,
            s.motivo_cierre,
            s.created_at,
            s.updated_at,

            destino.id AS destino_ubicacion_id,
            destino.nombre AS destino_ubicacion_nombre,
            destino.tipo AS destino_ubicacion_tipo,

            solicitante.id AS solicitante_ubicacion_id,
            solicitante.nombre AS solicitante_ubicacion_nombre,

            u.id AS creado_por_usuario_id,
            u.nombre AS creado_por_usuario_nombre

          FROM solicitudes s

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          INNER JOIN ubicaciones solicitante
            ON s.solicitante_ubicacion_id =
               solicitante.id

          INNER JOIN usuarios u
            ON s.creado_por_usuario_id =
               u.id

          WHERE s.id = $1
        `,
        [id]
      );

    if (
      solicitudesResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "Solicitud no encontrada"
      });
    }

    const solicitud =
      solicitudesResult.rows[0];

    if (
      !puedeVerSolicitud(
        solicitud,
        req
      )
    ) {
      return res.status(404).json({
        message:
          "Solicitud no encontrada"
      });
    }

    const lineasResult =
      await pool.query(
        `
          SELECT
            sl.id,
            sl.producto_id,

            p.nombre AS producto_nombre,
            p.sku,
            p.unidad_medida,

            c.tipo AS categoria_tipo,

            c.ubicacion_propietaria_id
              AS categoria_ubicacion_propietaria_id,

            sl.cantidad_solicitada,
            sl.cantidad_aprobada,
            sl.cantidad_enviada_acumulada,
            sl.cantidad_recibida_acumulada,
            sl.cantidad_registrada_inventario

          FROM solicitud_lineas sl

          INNER JOIN productos p
            ON sl.producto_id = p.id

          LEFT JOIN categorias c
            ON p.categoria_id = c.id

          WHERE sl.solicitud_id = $1

          ORDER BY sl.id
        `,
        [id]
      );

    const productosNuevosResult =
      await pool.query(
        `
          SELECT
            spn.id,
            spn.nombre,
            spn.descripcion,
            spn.categoria_id,

            c.nombre AS categoria_nombre,
            c.tipo AS categoria_tipo,

            c.ubicacion_propietaria_id
              AS categoria_ubicacion_propietaria_id,

            spn.cantidad_solicitada,
            spn.cantidad_enviada_acumulada,
            spn.cantidad_recibida_acumulada,
            spn.cantidad_registrada_inventario,

            spn.proveedor_sugerido,
            spn.proveedor_link,
            spn.sku_sugerido,
            spn.created_at

          FROM solicitud_productos_nuevos spn

          INNER JOIN categorias c
            ON spn.categoria_id = c.id

          WHERE spn.solicitud_id = $1

          ORDER BY spn.id
        `,
        [id]
      );

    const lineasVisibles =
      lineasResult.rows.filter(
        (linea) =>
          puedeVerCategoria(
            {
              tipo:
                linea.categoria_tipo,

              ubicacion_propietaria_id:
                linea
                  .categoria_ubicacion_propietaria_id
            },
            req
          )
      );

    const productosNuevosVisibles =
      productosNuevosResult.rows.filter(
        (producto) =>
          puedeVerCategoria(
            {
              tipo:
                producto.categoria_tipo,

              ubicacion_propietaria_id:
                producto
                  .categoria_ubicacion_propietaria_id
            },
            req
          )
      );

    const lineasConDisponibilidad =
      lineasVisibles.map(
        (linea) => ({
          ...linea,

          cantidad_disponible_registro:
            Math.max(
              Number(
                linea
                  .cantidad_recibida_acumulada ||
                  0
              ) -
                Number(
                  linea
                    .cantidad_registrada_inventario ||
                    0
                ),
              0
            )
        })
      );

    const productosNuevosConDisponibilidad =
      productosNuevosVisibles.map(
        (producto) => ({
          ...producto,

          cantidad_disponible_registro:
            Math.max(
              Number(
                producto
                  .cantidad_recibida_acumulada ||
                  0
              ) -
                Number(
                  producto
                    .cantidad_registrada_inventario ||
                    0
                ),
              0
            )
        })
      );

    res.json({
      solicitud,

      lineas:
        lineasConDisponibilidad,

      productos_nuevos:
        productosNuevosConDisponibilidad
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener la solicitud",
      error:
        error.message
    });
  }
};

// =========================================================
// CREAR SOLICITUD
// =========================================================

const createSolicitud = async (req, res) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    const {
      destino_ubicacion_id,
      nueva_franquicia,
      lineas = [],
      productos_nuevos = []
    } = req.body;

    const creado_por_usuario_id =
      req.usuario.id;

    const solicitante_ubicacion_id =
      req.usuario.ubicacion_id;

    const nombreNuevaFranquicia =
      nueva_franquicia
        ?.nombre
        ?.trim() || "";

    const quiereCrearFranquicia =
      Boolean(
        nombreNuevaFranquicia
      );

    if (
      !destino_ubicacion_id &&
      !quiereCrearFranquicia
    ) {
      return res.status(400).json({
        message:
          "Debes indicar una ubicación destino o una franquicia nueva"
      });
    }

    if (
      destino_ubicacion_id &&
      quiereCrearFranquicia
    ) {
      return res.status(400).json({
        message:
          "Indica una ubicación destino o una franquicia nueva, no ambas"
      });
    }

    if (
      !Array.isArray(lineas) ||
      !Array.isArray(
        productos_nuevos
      )
    ) {
      return res.status(400).json({
        message:
          "lineas y productos_nuevos deben ser arreglos"
      });
    }

    if (
      lineas.length === 0 &&
      productos_nuevos.length === 0
    ) {
      return res.status(400).json({
        message:
          "La solicitud debe contener al menos un producto existente o un producto nuevo"
      });
    }

    const ubicacionesResult =
      await client.query(
        `
          SELECT
            id,
            tipo,
            puede_solicitar_a_nombre_de_otra,
            activo,
            estado

          FROM ubicaciones

          WHERE id = $1
            AND activo = TRUE
            AND estado = 'activa'
        `,
        [
          solicitante_ubicacion_id
        ]
      );

    if (
      ubicacionesResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        message:
          "Ubicación solicitante no encontrada o no está activa"
      });
    }

    const ubicacionSolicitante =
      ubicacionesResult.rows[0];

    if (
      quiereCrearFranquicia
    ) {
      if (
        ubicacionSolicitante.tipo !==
          "equipo_interno" ||
        ubicacionSolicitante
          .puede_solicitar_a_nombre_de_otra !==
          true
      ) {
        return res.status(403).json({
          message:
            "Solo un Equipo Interno autorizado puede solicitar para una franquicia nueva"
        });
      }
    }

    let destinoExistente =
      null;

    if (
      destino_ubicacion_id
    ) {
      const destinoResult =
        await client.query(
          `
            SELECT
              id,
              nombre,
              tipo,
              activo,
              estado

            FROM ubicaciones

            WHERE id = $1
              AND activo = TRUE
              AND estado = 'activa'
          `,
          [
            destino_ubicacion_id
          ]
        );

      if (
        destinoResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          message:
            "Ubicación destino no encontrada o no está activa"
        });
      }

      destinoExistente =
        destinoResult.rows[0];

      const solicitaParaSiMisma =
        Number(
          destino_ubicacion_id
        ) ===
        Number(
          solicitante_ubicacion_id
        );

      if (
        !solicitaParaSiMisma
      ) {
        if (
          ubicacionSolicitante.tipo !==
            "equipo_interno" ||
          ubicacionSolicitante
            .puede_solicitar_a_nombre_de_otra !==
            true
        ) {
          return res.status(403).json({
            message:
              "No puedes solicitar para otra ubicación"
          });
        }

        if (
          destinoExistente.tipo !==
          "sucursal"
        ) {
          return res.status(403).json({
            message:
              "Un Equipo Interno solo puede solicitar para sí mismo o a nombre de una sucursal/franquicia"
          });
        }
      }
    }

    // =====================================================
    // VALIDAR PRODUCTOS EXISTENTES
    // =====================================================

    for (
      const linea of lineas
    ) {
      const cantidad =
        Number(
          linea
            .cantidad_solicitada
        );

      const productoId =
        Number(
          linea.producto_id
        );

      if (
        !linea.producto_id ||
        Number.isNaN(
          productoId
        ) ||
        Number.isNaN(
          cantidad
        ) ||
        cantidad <= 0
      ) {
        return res.status(400).json({
          message:
            "Todas las líneas de productos existentes necesitan producto y cantidad válida"
        });
      }

      const productoResult =
        await client.query(
          `
            SELECT
              p.id,
              p.nombre,
              p.activo,

              c.id AS categoria_id,
              c.nombre AS categoria_nombre,
              c.tipo AS categoria_tipo,

              c.ubicacion_propietaria_id
                AS categoria_ubicacion_propietaria_id,

              c.activo
                AS categoria_activa

            FROM productos p

            LEFT JOIN categorias c
              ON p.categoria_id =
                 c.id

            WHERE p.id = $1
          `,
          [
            productoId
          ]
        );

      if (
        productoResult.rows.length ===
          0 ||
        productoResult.rows[0]
          .activo !== true
      ) {
        return res.status(400).json({
          message:
            `El producto ${productoId} no existe o está inactivo`
        });
      }

      const producto =
        productoResult.rows[0];

      if (
        producto.categoria_id &&
        producto.categoria_activa !==
          true
      ) {
        return res.status(400).json({
          message:
            `La categoría del producto "${producto.nombre}" está inactiva`
        });
      }

      if (
        producto.categoria_tipo ===
        "privada"
      ) {
        const puedeUsarProductoPrivado =
          ubicacionSolicitante.tipo ===
            "equipo_interno" &&
          destinoExistente?.tipo ===
            "equipo_interno" &&
          Number(
            destino_ubicacion_id
          ) ===
            Number(
              solicitante_ubicacion_id
            ) &&
          Number(
            producto
              .categoria_ubicacion_propietaria_id
          ) ===
            Number(
              solicitante_ubicacion_id
            );

        if (
          !puedeUsarProductoPrivado
        ) {
          return res.status(403).json({
            message:
              `No tienes permiso para solicitar el producto privado "${producto.nombre}"`
          });
        }
      }
    }

    // =====================================================
    // VALIDAR PRODUCTOS NUEVOS
    // =====================================================

    for (
      const productoNuevo of
      productos_nuevos
    ) {
      const cantidad =
        Number(
          productoNuevo
            .cantidad_solicitada
        );

      const categoriaId =
        Number(
          productoNuevo
            .categoria_id
        );

      if (
        !productoNuevo
          .nombre
          ?.trim() ||
        !productoNuevo
          .descripcion
          ?.trim() ||
        !productoNuevo
          .categoria_id ||
        Number.isNaN(
          categoriaId
        ) ||
        Number.isNaN(
          cantidad
        ) ||
        cantidad <= 0
      ) {
        return res.status(400).json({
          message:
            "Cada producto nuevo necesita nombre, descripción, categoría y cantidad válida"
        });
      }

      const tieneDatosProveedor =
        Boolean(
          productoNuevo
            .proveedor_sugerido
            ?.trim()
        ) ||
        Boolean(
          productoNuevo
            .proveedor_link
            ?.trim()
        ) ||
        Boolean(
          productoNuevo
            .sku_sugerido
            ?.trim()
        );

      if (
        tieneDatosProveedor &&
        ubicacionSolicitante.tipo !==
          "equipo_interno"
      ) {
        return res.status(403).json({
          message:
            "Solo un Equipo Interno puede sugerir proveedor, link o SKU para un producto nuevo"
        });
      }
    }

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    let destinoFinalId =
      destino_ubicacion_id
        ? Number(
            destino_ubicacion_id
          )
        : null;

    let ubicacionPendiente =
      null;

    // =====================================================
    // CREAR FRANQUICIA PENDIENTE
    // =====================================================

    if (
      quiereCrearFranquicia
    ) {
      const duplicadaResult =
        await client.query(
          `
            SELECT
              id,
              nombre,
              estado

            FROM ubicaciones

            WHERE LOWER(
              TRIM(nombre)
            ) =
            LOWER(
              TRIM($1)
            )

            LIMIT 1
          `,
          [
            nombreNuevaFranquicia
          ]
        );

      if (
        duplicadaResult.rows.length >
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(409).json({
          message:
            `Ya existe una ubicación con el nombre "${nombreNuevaFranquicia}"`
        });
      }

      const nuevaUbicacionResult =
        await client.query(
          `
            INSERT INTO ubicaciones (
              nombre,
              tipo,
              puede_solicitar_a_nombre_de_otra,
              activo,
              estado
            )

            VALUES (
              $1,
              'sucursal',
              FALSE,
              FALSE,
              'pendiente'
            )

            RETURNING
              id,
              nombre,
              tipo,
              activo,
              estado
          `,
          [
            nombreNuevaFranquicia
          ]
        );

      ubicacionPendiente =
        nuevaUbicacionResult
          .rows[0];

      destinoFinalId =
        Number(
          ubicacionPendiente.id
        );
    }

    // =====================================================
    // CREAR SOLICITUD
    // =====================================================

    const solicitudResult =
      await client.query(
        `
          INSERT INTO solicitudes (
            destino_ubicacion_id,
            creado_por_usuario_id,
            solicitante_ubicacion_id,
            estado
          )

          VALUES (
            $1,
            $2,
            $3,
            'solicitada'
          )

          RETURNING id
        `,
        [
          destinoFinalId,
          creado_por_usuario_id,
          solicitante_ubicacion_id
        ]
      );

    const solicitudId =
      solicitudResult.rows[0].id;

    // =====================================================
    // GUARDAR PRODUCTOS EXISTENTES
    // =====================================================

    for (
      const linea of lineas
    ) {
      const cantidad =
        Number(
          linea
            .cantidad_solicitada
        );

      await client.query(
        `
          INSERT INTO solicitud_lineas (
            solicitud_id,
            producto_id,
            cantidad_solicitada,
            cantidad_aprobada,
            cantidad_enviada_acumulada,
            cantidad_recibida_acumulada,
            cantidad_registrada_inventario
          )

          VALUES (
            $1,
            $2,
            $3,
            0,
            0,
            0,
            0
          )
        `,
        [
          solicitudId,
          linea.producto_id,
          cantidad
        ]
      );
    }

    // =====================================================
    // GUARDAR PRODUCTOS NUEVOS
    // =====================================================

    for (
      const productoNuevo of
      productos_nuevos
    ) {
      const categoriaResult =
        await client.query(
          `
            SELECT
              id,
              nombre,
              tipo,
              ubicacion_propietaria_id

            FROM categorias

            WHERE id = $1
              AND activo = TRUE
          `,
          [
            productoNuevo
              .categoria_id
          ]
        );

      if (
        categoriaResult.rows.length ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            `La categoría ${productoNuevo.categoria_id} no existe o está inactiva`
        });
      }

      const categoria =
        categoriaResult.rows[0];

      if (
        categoria.tipo ===
        "privada"
      ) {
        const puedeUsarCategoriaPrivada =
          ubicacionSolicitante.tipo ===
            "equipo_interno" &&
          destinoExistente?.tipo ===
            "equipo_interno" &&
          Number(
            destino_ubicacion_id
          ) ===
            Number(
              solicitante_ubicacion_id
            ) &&
          Number(
            categoria
              .ubicacion_propietaria_id
          ) ===
            Number(
              solicitante_ubicacion_id
            );

        if (
          !puedeUsarCategoriaPrivada
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(403).json({
            message:
              `No tienes permiso para usar la categoría privada "${categoria.nombre}" en esta solicitud`
          });
        }
      }

      await client.query(
        `
          INSERT INTO solicitud_productos_nuevos (
            solicitud_id,
            nombre,
            descripcion,
            categoria_id,
            cantidad_solicitada,
            proveedor_sugerido,
            proveedor_link,
            sku_sugerido,
            cantidad_enviada_acumulada,
            cantidad_recibida_acumulada,
            cantidad_registrada_inventario
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            0,
            0,
            0
          )
        `,
        [
          solicitudId,

          productoNuevo
            .nombre
            .trim(),

          productoNuevo
            .descripcion
            .trim(),

          productoNuevo
            .categoria_id,

          Number(
            productoNuevo
              .cantidad_solicitada
          ),

          ubicacionSolicitante.tipo ===
          "equipo_interno"
            ? productoNuevo
                .proveedor_sugerido
                ?.trim() ||
              null
            : null,

          ubicacionSolicitante.tipo ===
          "equipo_interno"
            ? productoNuevo
                .proveedor_link
                ?.trim() ||
              null
            : null,

          ubicacionSolicitante.tipo ===
          "equipo_interno"
            ? productoNuevo
                .sku_sugerido
                ?.trim() ||
              null
            : null
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.status(201).json({
      message:
        quiereCrearFranquicia
          ? "Solicitud creada y franquicia registrada como pendiente"
          : "Solicitud creada correctamente",

      solicitud_id:
        solicitudId,

      estado:
        "solicitada",

      destino_ubicacion_id:
        destinoFinalId,

      ubicacion_pendiente:
        ubicacionPendiente,

      productos_existentes:
        lineas.length,

      productos_nuevos:
        productos_nuevos.length
    });
  } catch (error) {
    if (
      transaccionIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    if (
      error.code === "23503"
    ) {
      return res
        .status(400)
        .json({
          message:
            "Algún producto, categoría, ubicación o usuario relacionado no existe"
        });
    }

    if (
      error.code === "23505"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Ya existe un registro con esos datos"
        });
    }

    res.status(500).json({
      message:
        "Error al crear la solicitud",
      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// INICIAR REVISIÓN
// =========================================================

const iniciarRevision = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    if (
      req.usuario.rol !==
        "principal" ||
      ![
        "operador",
        "aprobador_admin"
      ].includes(
        req.usuario.nivel_permiso
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permiso para revisar solicitudes"
      });
    }

    const result =
      await pool.query(
        `
          UPDATE solicitudes

          SET
            estado = 'en_revision',
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
            AND estado =
                'solicitada'
        `,
        [id]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(400).json({
        message:
          "La solicitud no existe o no está solicitada"
      });
    }

    res.json({
      message:
        "Solicitud marcada en revisión",

      solicitud_id:
        Number(id),

      estado:
        "en_revision"
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al iniciar revisión",
      error:
        error.message
    });
  }
};

// =========================================================
// APROBAR SOLICITUD
// =========================================================

const aprobarSolicitud = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    const { id } =
      req.params;

    const {
      lineas = []
    } = req.body;

    if (
      req.usuario.rol !==
        "principal" ||
      req.usuario.nivel_permiso !==
        "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede aprobar"
      });
    }

    if (
      !Array.isArray(
        lineas
      )
    ) {
      return res.status(400).json({
        message:
          "Las líneas de aprobación deben ser un arreglo"
      });
    }

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const solicitudesResult =
      await client.query(
        `
          SELECT
            s.id,
            s.estado,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM solicitudes s

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE s.id = $1

          FOR UPDATE
        `,
        [id]
      );

    if (
      solicitudesResult.rows.length ===
        0 ||
      solicitudesResult.rows[0]
        .estado !==
        "en_revision"
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "La solicitud debe estar en revisión"
      });
    }

    const solicitudAprobacion =
      solicitudesResult.rows[0];

    const destinoEsSucursal =
      solicitudAprobacion
        .destino_ubicacion_tipo ===
      "sucursal";

    const actualesResult =
      await client.query(
        `
          SELECT
            sl.id,
            sl.producto_id,
            sl.cantidad_solicitada,

            COALESCE(
              i.cantidad,
              0
            ) AS stock_central

          FROM solicitud_lineas sl

          LEFT JOIN inventario i
            ON i.producto_id =
               sl.producto_id

            AND i.ubicacion_id = 1

          WHERE sl.solicitud_id = $1
        `,
        [id]
      );

    const actuales =
      actualesResult.rows;

    for (
      const linea of lineas
    ) {
      const actual =
        actuales.find(
          (item) =>
            Number(
              item.id
            ) ===
            Number(
              linea.linea_id
            )
        );

      if (
        !actual
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Una línea no pertenece a la solicitud"
        });
      }

      const cantidad =
        Number(
          linea
            .cantidad_aprobada
        );

      if (
        Number.isNaN(
          cantidad
        ) ||
        cantidad < 0 ||
        cantidad >
          Number(
            actual
              .cantidad_solicitada
          ) ||
        (
          destinoEsSucursal &&
          cantidad >
            Number(
              actual
                .stock_central
            )
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            destinoEsSucursal
              ? `Cantidad aprobada inválida para el producto ${actual.producto_id}. La aprobación de una Sucursal no puede superar el stock disponible en Central.`
              : `Cantidad aprobada inválida para el producto ${actual.producto_id}. La cantidad no puede ser negativa ni superar lo solicitado.`
        });
      }

      await client.query(
        `
          UPDATE solicitud_lineas

          SET
            cantidad_aprobada = $1

          WHERE id = $2
        `,
        [
          cantidad,
          linea.linea_id
        ]
      );
    }

    await client.query(
      `
        UPDATE solicitudes

        SET
          estado = 'aprobada',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [id]
    );

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.json({
      message:
        "Solicitud aprobada correctamente",

      solicitud_id:
        Number(id),

      estado:
        "aprobada",

      flujo_abastecimiento:
        destinoEsSucursal
          ? "envio_desde_central"
          : "compra_a_proveedor_y_envio"
    });
  } catch (error) {
    if (
      transaccionIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    res.status(500).json({
      message:
        "Error al aprobar la solicitud",
      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// RECHAZAR SOLICITUD
// =========================================================

const rechazarSolicitud = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const { motivo } =
      req.body;

    if (
      req.usuario.rol !==
        "principal" ||
      req.usuario.nivel_permiso !==
        "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede rechazar solicitudes"
      });
    }

    if (
      !motivo ||
      !motivo.trim()
    ) {
      return res.status(400).json({
        message:
          "Debes indicar el motivo del rechazo"
      });
    }

    const result =
      await pool.query(
        `
          UPDATE solicitudes

          SET
            estado = 'rechazada',
            motivo_cierre = $1,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $2

            AND estado IN (
              'solicitada',
              'en_revision'
            )
        `,
        [
          motivo.trim(),
          id
        ]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(400).json({
        message:
          "La solicitud no puede rechazarse en su estado actual"
      });
    }

    res.json({
      message:
        "Solicitud rechazada correctamente",

      solicitud_id:
        Number(id),

      estado:
        "rechazada"
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al rechazar la solicitud",
      error:
        error.message
    });
  }
};

// =========================================================
// REGISTRAR PEDIDO RECIBIDO EN INVENTARIO PERSONAL
// =========================================================

const registrarPedidoEnInventario =
  async (
    req,
    res
  ) => {
    const client =
      await pool.connect();

    let transaccionIniciada =
      false;

    try {
      const { id } =
        req.params;

      const solicitudId =
        Number(id);

      const ubicacionUsuarioId =
        Number(
          req.usuario
            .ubicacion_id
        );

      if (
        !solicitudId ||
        !Number.isFinite(
          solicitudId
        )
      ) {
        return res.status(400).json({
          message:
            "El id de la solicitud no es válido"
        });
      }

      if (
        req.usuario.rol !==
        "equipo_interno"
      ) {
        return res.status(403).json({
          message:
            "Solo un Equipo Interno puede registrar este pedido en su inventario personal"
        });
      }

      if (
        !ubicacionUsuarioId ||
        !Number.isFinite(
          ubicacionUsuarioId
        )
      ) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      await client.query(
        "BEGIN"
      );

      transaccionIniciada =
        true;

      const solicitudResult =
        await client.query(
          `
            SELECT
              s.id,
              s.estado,
              s.solicitante_ubicacion_id,
              s.destino_ubicacion_id,

              destino.nombre
                AS destino_ubicacion_nombre,

              destino.tipo
                AS destino_ubicacion_tipo

            FROM solicitudes s

            INNER JOIN ubicaciones destino
              ON s.destino_ubicacion_id =
                 destino.id

            WHERE s.id = $1

            FOR UPDATE OF s
          `,
          [
            solicitudId
          ]
        );

      if (
        solicitudResult.rows.length ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(404).json({
          message:
            "Solicitud no encontrada"
        });
      }

      const solicitud =
        solicitudResult.rows[0];

      if (
        solicitud
          .destino_ubicacion_tipo !==
        "equipo_interno"
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Esta solicitud no pertenece al flujo de inventario personal de un Equipo Interno"
        });
      }

      if (
        Number(
          solicitud
            .solicitante_ubicacion_id
        ) !==
          ubicacionUsuarioId ||
        Number(
          solicitud
            .destino_ubicacion_id
        ) !==
          ubicacionUsuarioId
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(403).json({
          message:
            "Solo el Equipo Interno solicitante puede registrar estos productos en su inventario"
        });
      }

      if (
        ![
          "en_transito",
          "recibida"
        ].includes(
          solicitud.estado
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "El pedido debe haber sido recibido mediante el flujo de envío antes de registrarlo en el inventario"
        });
      }

      // ===================================================
      // DEBE EXISTIR UN ENVÍO FÍSICAMENTE RECIBIDO
      // ===================================================

      const enviosRecibidosResult =
        await client.query(
          `
            SELECT
              COUNT(*) AS total

            FROM envios

            WHERE solicitud_id = $1
              AND destino_ubicacion_id =
                  $2
              AND estado = 'recibido'
          `,
          [
            solicitudId,
            ubicacionUsuarioId
          ]
        );

      const totalEnviosRecibidos =
        Number(
          enviosRecibidosResult
            .rows[0]
            .total
        );

      if (
        totalEnviosRecibidos ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Todavía no existe ningún envío recibido para esta solicitud"
        });
      }

      // ===================================================
      // PRODUCTOS EXISTENTES
      // ===================================================

      const lineasResult =
        await client.query(
          `
            SELECT
              sl.id,
              sl.producto_id,
              sl.cantidad_recibida_acumulada,
              sl.cantidad_registrada_inventario,

              p.nombre
                AS producto_nombre

            FROM solicitud_lineas sl

            INNER JOIN productos p
              ON sl.producto_id =
                 p.id

            WHERE sl.solicitud_id =
                  $1

            ORDER BY sl.id

            FOR UPDATE OF sl
          `,
          [
            solicitudId
          ]
        );

      // ===================================================
      // PRODUCTOS NUEVOS
      // ===================================================

      const productosNuevosResult =
        await client.query(
          `
            SELECT
              spn.id,
              spn.nombre,
              spn.cantidad_recibida_acumulada,
              spn.cantidad_registrada_inventario

            FROM solicitud_productos_nuevos spn

            WHERE spn.solicitud_id =
                  $1

            ORDER BY spn.id

            FOR UPDATE OF spn
          `,
          [
            solicitudId
          ]
        );

      let totalProductosRegistrados =
        0;

      let totalUnidadesRegistradas =
        0;

      const productosRegistrados =
        [];

      // ===================================================
      // REGISTRAR PRODUCTOS EXISTENTES
      // ===================================================

      for (
        const linea of
        lineasResult.rows
      ) {
        const cantidadRecibida =
          Number(
            linea
              .cantidad_recibida_acumulada ||
              0
          );

        const cantidadRegistrada =
          Number(
            linea
              .cantidad_registrada_inventario ||
              0
          );

        const cantidadDisponible =
          Math.max(
            cantidadRecibida -
              cantidadRegistrada,
            0
          );

        if (
          cantidadDisponible <=
          0
        ) {
          continue;
        }

        const recibidoEnviosResult =
          await client.query(
            `
              SELECT
                COALESCE(
                  SUM(
                    el.cantidad_enviada
                  ),
                  0
                ) AS total_recibido

              FROM envio_lineas el

              INNER JOIN envios e
                ON el.envio_id =
                   e.id

              WHERE e.solicitud_id =
                    $1

                AND e.destino_ubicacion_id =
                    $2

                AND e.estado =
                    'recibido'

                AND el.solicitud_linea_id =
                    $3
            `,
            [
              solicitudId,
              ubicacionUsuarioId,
              linea.id
            ]
          );

        const cantidadFisicamenteRecibida =
          Number(
            recibidoEnviosResult
              .rows[0]
              .total_recibido ||
              0
          );

        const disponibleConfirmado =
          Math.max(
            cantidadFisicamenteRecibida -
              cantidadRegistrada,
            0
          );

        const cantidadARegistrar =
          Math.min(
            cantidadDisponible,
            disponibleConfirmado
          );

        if (
          cantidadARegistrar <=
          0
        ) {
          continue;
        }

        await client.query(
          `
            INSERT INTO inventario (
              ubicacion_id,
              producto_id,
              cantidad
            )

            VALUES (
              $1,
              $2,
              $3
            )

            ON CONFLICT (
              ubicacion_id,
              producto_id
            )

            DO UPDATE SET
              cantidad =
                inventario.cantidad +
                EXCLUDED.cantidad,
              updated_at =
                CURRENT_TIMESTAMP
          `,
          [
            ubicacionUsuarioId,

            Number(
              linea.producto_id
            ),

            cantidadARegistrar
          ]
        );

        await client.query(
          `
            UPDATE solicitud_lineas

            SET
              cantidad_registrada_inventario =
                cantidad_registrada_inventario +
                $1

            WHERE id = $2
          `,
          [
            cantidadARegistrar,
            linea.id
          ]
        );

        totalProductosRegistrados +=
          1;

        totalUnidadesRegistradas +=
          cantidadARegistrar;

        productosRegistrados.push({
          tipo:
            "producto_existente",

          solicitud_linea_id:
            Number(
              linea.id
            ),

          producto_id:
            Number(
              linea.producto_id
            ),

          producto_nombre:
            linea.producto_nombre,

          cantidad:
            cantidadARegistrar
        });
      }

      // ===================================================
      // REGISTRAR PRODUCTOS NUEVOS
      // ===================================================

      for (
        const productoNuevo of
        productosNuevosResult.rows
      ) {
        const cantidadRecibida =
          Number(
            productoNuevo
              .cantidad_recibida_acumulada ||
              0
          );

        const cantidadRegistrada =
          Number(
            productoNuevo
              .cantidad_registrada_inventario ||
              0
          );

        const cantidadDisponible =
          Math.max(
            cantidadRecibida -
              cantidadRegistrada,
            0
          );

        if (
          cantidadDisponible <=
          0
        ) {
          continue;
        }

        const productosRealesResult =
          await client.query(
            `
              SELECT
                el.producto_id,

                p.nombre
                  AS producto_nombre,

                COALESCE(
                  SUM(
                    el.cantidad_enviada
                  ),
                  0
                ) AS cantidad_recibida

              FROM envio_lineas el

              INNER JOIN envios e
                ON el.envio_id =
                   e.id

              INNER JOIN productos p
                ON el.producto_id =
                   p.id

              WHERE e.solicitud_id =
                    $1

                AND e.destino_ubicacion_id =
                    $2

                AND e.estado =
                    'recibido'

                AND el.solicitud_producto_nuevo_id =
                    $3

                AND el.producto_id
                    IS NOT NULL

              GROUP BY
                el.producto_id,
                p.nombre

              ORDER BY
                el.producto_id
            `,
            [
              solicitudId,
              ubicacionUsuarioId,
              productoNuevo.id
            ]
          );

        if (
          productosRealesResult
            .rows.length === 0
        ) {
          continue;
        }

        if (
          productosRealesResult
            .rows.length > 1
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(409).json({
            message:
              `El producto nuevo "${productoNuevo.nombre}" está vinculado a más de un producto real. Debe revisarse antes de registrarlo en inventario.`
          });
        }

        const productoReal =
          productosRealesResult
            .rows[0];

        const cantidadFisicamenteRecibida =
          Number(
            productoReal
              .cantidad_recibida ||
              0
          );

        const disponibleConfirmado =
          Math.max(
            cantidadFisicamenteRecibida -
              cantidadRegistrada,
            0
          );

        const cantidadARegistrar =
          Math.min(
            cantidadDisponible,
            disponibleConfirmado
          );

        if (
          cantidadARegistrar <=
          0
        ) {
          continue;
        }

        const productoId =
          Number(
            productoReal
              .producto_id
          );

        await client.query(
          `
            INSERT INTO inventario (
              ubicacion_id,
              producto_id,
              cantidad
            )

            VALUES (
              $1,
              $2,
              $3
            )

            ON CONFLICT (
              ubicacion_id,
              producto_id
            )

            DO UPDATE SET
              cantidad =
                inventario.cantidad +
                EXCLUDED.cantidad,
              updated_at =
                CURRENT_TIMESTAMP
          `,
          [
            ubicacionUsuarioId,
            productoId,
            cantidadARegistrar
          ]
        );

        await client.query(
          `
            UPDATE solicitud_productos_nuevos

            SET
              cantidad_registrada_inventario =
                cantidad_registrada_inventario +
                $1

            WHERE id = $2
          `,
          [
            cantidadARegistrar,
            productoNuevo.id
          ]
        );

        totalProductosRegistrados +=
          1;

        totalUnidadesRegistradas +=
          cantidadARegistrar;

        productosRegistrados.push({
          tipo:
            "producto_nuevo",

          solicitud_producto_nuevo_id:
            Number(
              productoNuevo.id
            ),

          producto_id:
            productoId,

          producto_nombre:
            productoReal
              .producto_nombre,

          cantidad:
            cantidadARegistrar
        });
      }

      if (
        totalUnidadesRegistradas ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "No hay productos recibidos pendientes de registrar en tu inventario"
        });
      }

      await client.query(
        "COMMIT"
      );

      transaccionIniciada =
        false;

      res.json({
        message:
          "Productos recibidos registrados correctamente en tu inventario",

        solicitud_id:
          solicitudId,

        ubicacion_id:
          ubicacionUsuarioId,

        productos_registrados:
          totalProductosRegistrados,

        unidades_registradas:
          totalUnidadesRegistradas,

        detalle:
          productosRegistrados
      });
    } catch (error) {
      if (
        transaccionIniciada
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch (
          rollbackError
        ) {
          console.error(
            "Error al revertir la transacción:",
            rollbackError
          );
        }
      }

      res.status(500).json({
        message:
          "Error al registrar el pedido en el inventario",
        error:
          error.message
      });
    } finally {
      client.release();
    }
  };

// =========================================================
// CERRAR SOLICITUD
// =========================================================

const cerrarSolicitud = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    const { id } =
      req.params;

    const { motivo } =
      req.body;

    if (
      req.usuario.rol !==
        "principal" ||
      req.usuario.nivel_permiso !==
        "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede cerrar solicitudes"
      });
    }

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const solicitudesResult =
      await client.query(
        `
          SELECT
            id,
            estado

          FROM solicitudes

          WHERE id = $1

          FOR UPDATE
        `,
        [id]
      );

    if (
      solicitudesResult.rows.length ===
      0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(404).json({
        message:
          "Solicitud no encontrada"
      });
    }

    const estado =
      solicitudesResult
        .rows[0]
        .estado;

    if (
      ![
        "aprobada",
        "en_transito",
        "recibida"
      ].includes(
        estado
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "La solicitud no puede cerrarse en su estado actual"
      });
    }

    const lineasResult =
      await client.query(
        `
          SELECT
            cantidad_aprobada,
            cantidad_recibida_acumulada

          FROM solicitud_lineas

          WHERE solicitud_id = $1
        `,
        [id]
      );

    const productosNuevosResult =
      await client.query(
        `
          SELECT
            cantidad_solicitada,
            cantidad_recibida_acumulada

          FROM solicitud_productos_nuevos

          WHERE solicitud_id = $1
        `,
        [id]
      );

    const tienePendientesExistentes =
      lineasResult.rows.some(
        (linea) =>
          Number(
            linea
              .cantidad_recibida_acumulada ||
              0
          ) <
          Number(
            linea
              .cantidad_aprobada ||
              0
          )
      );

    const tienePendientesNuevos =
      productosNuevosResult
        .rows.some(
          (producto) =>
            Number(
              producto
                .cantidad_recibida_acumulada ||
                0
            ) <
            Number(
              producto
                .cantidad_solicitada ||
                0
            )
        );

    const tienePendientes =
      tienePendientesExistentes ||
      tienePendientesNuevos;

    if (
      tienePendientes &&
      (
        !motivo ||
        !motivo.trim()
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "Hay un remanente pendiente. Debes indicar el motivo del cierre"
      });
    }

    await client.query(
      `
        UPDATE solicitudes

        SET
          estado = 'cerrada',
          motivo_cierre = $1,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $2
      `,
      [
        motivo?.trim() ||
          "Solicitud completada",

        id
      ]
    );

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.json({
      message:
        "Solicitud cerrada correctamente",

      solicitud_id:
        Number(id),

      estado:
        "cerrada",

      remanente_cancelado:
        tienePendientes
    });
  } catch (error) {
    if (
      transaccionIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    res.status(500).json({
      message:
        "Error al cerrar la solicitud",
      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  getSolicitudes,
  getCatalogoSolicitud,
  getSolicitudById,
  createSolicitud,
  iniciarRevision,
  aprobarSolicitud,
  rechazarSolicitud,
  registrarPedidoEnInventario,
  cerrarSolicitud
};