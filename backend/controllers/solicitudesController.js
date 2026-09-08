const pool = require("../config/db");

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
        ON s.solicitante_ubicacion_id = solicitante.id

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
      message: "Error al obtener las solicitudes",
      error: error.message
    });
  }
};

const getSolicitudById = async (req, res) => {
  try {
    const { id } = req.params;

    const solicitudesResult = await pool.query(
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
          ON s.destino_ubicacion_id = destino.id

        INNER JOIN ubicaciones solicitante
          ON s.solicitante_ubicacion_id =
             solicitante.id

        INNER JOIN usuarios u
          ON s.creado_por_usuario_id = u.id

        WHERE s.id = $1
      `,
      [id]
    );

    if (solicitudesResult.rows.length === 0) {
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    const solicitud =
      solicitudesResult.rows[0];

    if (!puedeVerSolicitud(solicitud, req)) {
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    const lineasResult = await pool.query(
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
          sl.cantidad_recibida_acumulada

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
      lineasResult.rows.filter((linea) =>
        puedeVerCategoria(
          {
            tipo: linea.categoria_tipo,
            ubicacion_propietaria_id:
              linea.categoria_ubicacion_propietaria_id
          },
          req
        )
      );

    const productosNuevosVisibles =
      productosNuevosResult.rows.filter(
        (producto) =>
          puedeVerCategoria(
            {
              tipo: producto.categoria_tipo,
              ubicacion_propietaria_id:
                producto.categoria_ubicacion_propietaria_id
            },
            req
          )
      );

    res.json({
      solicitud,
      lineas: lineasVisibles,
      productos_nuevos:
        productosNuevosVisibles
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener la solicitud",
      error: error.message
    });
  }
};

const createSolicitud = async (req, res) => {
  const client = await pool.connect();

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
      nueva_franquicia?.nombre?.trim() || "";

    const quiereCrearFranquicia =
      Boolean(nombreNuevaFranquicia);

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
      !Array.isArray(productos_nuevos)
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
        [solicitante_ubicacion_id]
      );

    if (
      ubicacionesResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "Ubicación solicitante no encontrada o no está activa"
      });
    }

    const ubicacionSolicitante =
      ubicacionesResult.rows[0];

    if (quiereCrearFranquicia) {
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

    let destinoExistente = null;

    if (destino_ubicacion_id) {
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
          [destino_ubicacion_id]
        );

      if (
        destinoResult.rows.length === 0
      ) {
        return res.status(404).json({
          message:
            "Ubicación destino no encontrada o no está activa"
        });
      }

      destinoExistente =
        destinoResult.rows[0];

      const solicitaParaSiMisma =
        Number(destino_ubicacion_id) ===
        Number(
          solicitante_ubicacion_id
        );

      if (!solicitaParaSiMisma) {
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

    for (const linea of lineas) {
      const cantidad = Number(
        linea.cantidad_solicitada
      );

      const productoId = Number(
        linea.producto_id
      );

      if (
        !linea.producto_id ||
        Number.isNaN(productoId) ||
        Number.isNaN(cantidad) ||
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

              c.activo AS categoria_activa

            FROM productos p

            LEFT JOIN categorias c
              ON p.categoria_id = c.id

            WHERE p.id = $1
          `,
          [productoId]
        );

      if (
        productoResult.rows.length === 0 ||
        productoResult.rows[0].activo !==
          true
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
        producto.categoria_activa !== true
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

    for (
      const productoNuevo of
        productos_nuevos
    ) {
      const cantidad = Number(
        productoNuevo.cantidad_solicitada
      );

      const categoriaId = Number(
        productoNuevo.categoria_id
      );

      if (
        !productoNuevo.nombre?.trim() ||
        !productoNuevo.descripcion?.trim() ||
        !productoNuevo.categoria_id ||
        Number.isNaN(categoriaId) ||
        Number.isNaN(cantidad) ||
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
            .proveedor_sugerido?.trim()
        ) ||
        Boolean(
          productoNuevo
            .proveedor_link?.trim()
        ) ||
        Boolean(
          productoNuevo
            .sku_sugerido?.trim()
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

    await client.query("BEGIN");

    let destinoFinalId =
      destino_ubicacion_id
        ? Number(destino_ubicacion_id)
        : null;

    let ubicacionPendiente = null;

    if (quiereCrearFranquicia) {
      const duplicadaResult =
        await client.query(
          `
            SELECT
              id,
              nombre,
              estado

            FROM ubicaciones

            WHERE LOWER(TRIM(nombre)) =
                  LOWER(TRIM($1))

            LIMIT 1
          `,
          [nombreNuevaFranquicia]
        );

      if (
        duplicadaResult.rows.length > 0
      ) {
        await client.query(
          "ROLLBACK"
        );

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
          [nombreNuevaFranquicia]
        );

      ubicacionPendiente =
        nuevaUbicacionResult.rows[0];

      destinoFinalId =
        Number(
          ubicacionPendiente.id
        );
    }

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

    for (const linea of lineas) {
      const cantidad = Number(
        linea.cantidad_solicitada
      );

      await client.query(
        `
          INSERT INTO solicitud_lineas (
            solicitud_id,
            producto_id,
            cantidad_solicitada,
            cantidad_aprobada,
            cantidad_enviada_acumulada,
            cantidad_recibida_acumulada
          )

          VALUES (
            $1,
            $2,
            $3,
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
            productoNuevo.categoria_id
          ]
        );

      if (
        categoriaResult.rows.length ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            `La categoría ${productoNuevo.categoria_id} no existe o está inactiva`
        });
      }

      const categoria =
        categoriaResult.rows[0];

      if (
        categoria.tipo === "privada"
      ) {
        const puedeUsarCategoriaPrivada =
          ubicacionSolicitante.tipo ===
            "equipo_interno" &&
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

          return res
            .status(403)
            .json({
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
            sku_sugerido
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
        `,
        [
          solicitudId,

          productoNuevo.nombre.trim(),

          productoNuevo.descripcion.trim(),

          productoNuevo.categoria_id,

          Number(
            productoNuevo
              .cantidad_solicitada
          ),

          ubicacionSolicitante.tipo ===
          "equipo_interno"
            ? productoNuevo
                .proveedor_sugerido
                ?.trim() || null
            : null,

          ubicacionSolicitante.tipo ===
          "equipo_interno"
            ? productoNuevo
                .proveedor_link
                ?.trim() || null
            : null,

          ubicacionSolicitante.tipo ===
          "equipo_interno"
            ? productoNuevo
                .sku_sugerido
                ?.trim() || null
            : null
        ]
      );
    }

    await client.query("COMMIT");

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
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (rollbackError) {
      console.error(
        "Error al revertir la transacción:",
        rollbackError
      );
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

const iniciarRevision = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

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
      return res
        .status(403)
        .json({
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
            AND estado = 'solicitada'
        `,
        [id]
      );

    if (
      result.rowCount === 0
    ) {
      return res
        .status(400)
        .json({
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

const aprobarSolicitud = async (
  req,
  res
) => {
  const client =
    await pool.connect();

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
      return res
        .status(403)
        .json({
          message:
            "Solo un Aprobador/Administrador puede aprobar"
        });
    }

    if (!Array.isArray(lineas)) {
      return res
        .status(400)
        .json({
          message:
            "Las líneas de aprobación deben ser un arreglo"
        });
    }

    await client.query(
      "BEGIN"
    );

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
      solicitudesResult.rows
        .length === 0 ||
      solicitudesResult.rows[0]
        .estado !==
        "en_revision"
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res
        .status(400)
        .json({
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
            Number(item.id) ===
            Number(
              linea.linea_id
            )
        );

      if (!actual) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            message:
              "Una línea no pertenece a la solicitud"
          });
      }

      const cantidad =
        Number(
          linea.cantidad_aprobada
        );

      if (
        Number.isNaN(cantidad) ||
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
              actual.stock_central
            )
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res
          .status(400)
          .json({
            message:
              destinoEsSucursal
                ? `Cantidad aprobada inválida para el producto ${actual.producto_id}. La aprobación de una Sucursal no puede superar el stock disponible en Central.`
                : `Cantidad aprobada inválida para el producto ${actual.producto_id}. La cantidad no puede ser negativa ni superar lo solicitado.`
          });
      }

      await client.query(
        `
          UPDATE solicitud_lineas

          SET cantidad_aprobada = $1

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
          : "compra_a_proveedor"
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (rollbackError) {
      console.error(
        "Error al revertir la transacción:",
        rollbackError
      );
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
      return res
        .status(403)
        .json({
          message:
            "Solo un Aprobador/Administrador puede rechazar solicitudes"
        });
    }

    if (
      !motivo ||
      !motivo.trim()
    ) {
      return res
        .status(400)
        .json({
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
      return res
        .status(400)
        .json({
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

const cerrarSolicitud = async (
  req,
  res
) => {
  const client =
    await pool.connect();

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
      return res
        .status(403)
        .json({
          message:
            "Solo un Aprobador/Administrador puede cerrar solicitudes"
        });
    }

    await client.query(
      "BEGIN"
    );

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
      solicitudesResult.rows
        .length === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res
        .status(404)
        .json({
          message:
            "Solicitud no encontrada"
        });
    }

    const estado =
      solicitudesResult.rows[0]
        .estado;

    if (
      ![
        "aprobada",
        "en_transito",
        "recibida"
      ].includes(estado)
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res
        .status(400)
        .json({
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

    const tienePendientes =
      lineasResult.rows.some(
        (linea) =>
          Number(
            linea
              .cantidad_recibida_acumulada
          ) <
          Number(
            linea
              .cantidad_aprobada
          )
      );

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

      return res
        .status(400)
        .json({
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
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (rollbackError) {
      console.error(
        "Error al revertir la transacción:",
        rollbackError
      );
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

module.exports = {
  getSolicitudes,
  getSolicitudById,
  createSolicitud,
  iniciarRevision,
  aprobarSolicitud,
  rechazarSolicitud,
  cerrarSolicitud
};