const pool = require("../config/db");
const csv = require("csv-parser");
const { Readable } = require("stream");

const CENTRAL_ID = 1;

const esPrincipal = (req) =>
  req.usuario?.rol === "principal";

const esEquipoInterno = (req) =>
  req.usuario?.rol === "equipo_interno";

const validarCantidadPositiva = (cantidad) => {
  const valor = Number(cantidad);
  return Number.isFinite(valor) && valor > 0;
};

const validarCantidadNoNegativa = (cantidad) => {
  const valor = Number(cantidad);
  return Number.isFinite(valor) && valor >= 0;
};

const obtenerUbicacionUsuario = async (client, req) => {
  const ubicacionId = Number(
    req.usuario?.ubicacion_id
  );

  if (!ubicacionId) {
    return null;
  }

  const result = await client.query(
    `
      SELECT
        id,
        nombre,
        tipo,
        activo
      FROM ubicaciones
      WHERE id = $1
        AND activo = TRUE
    `,
    [ubicacionId]
  );

  return result.rows[0] || null;
};

const puedeVerCategoria = (categoria, req) => {
  if (!categoria) {
    return true;
  }

  if (
    !categoria.tipo ||
    categoria.tipo === "global"
  ) {
    return true;
  }

  if (categoria.tipo === "privada") {
    if (esPrincipal(req)) {
      return true;
    }

    return (
      esEquipoInterno(req) &&
      Number(
        categoria.ubicacion_propietaria_id
      ) ===
        Number(req.usuario.ubicacion_id)
    );
  }

  return false;
};

const puedeUsarCategoriaParaAlta = (
  categoria,
  req
) => {
  if (!categoria) {
    return esPrincipal(req);
  }

  if (
    !categoria.tipo ||
    categoria.tipo === "global"
  ) {
    return true;
  }

  if (categoria.tipo === "privada") {
    return (
      esEquipoInterno(req) &&
      Number(
        categoria.ubicacion_propietaria_id
      ) ===
        Number(req.usuario.ubicacion_id)
    );
  }

  return false;
};

const generarSku = () => {
  return `AUTO-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
};

const getInventario = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    const params = [];

    let sql = `
      SELECT
        i.id,
        i.ubicacion_id,
        u.nombre AS ubicacion_nombre,
        u.tipo AS ubicacion_tipo,

        i.producto_id,
        p.nombre AS producto_nombre,
        p.descripcion,
        p.sku,
        p.unidad_medida,
        p.punto_reorden,

        (
          SELECT pp.proveedor_id
          FROM proveedor_productos pp
          INNER JOIN proveedores pr
            ON pr.id = pp.proveedor_id
          WHERE pp.producto_id = p.id
            AND pr.activo = TRUE
          ORDER BY pr.nombre
          LIMIT 1
        ) AS proveedor_id,

        COALESCE(
          (
            SELECT STRING_AGG(
              DISTINCT pr.nombre,
              ', ' ORDER BY pr.nombre
            )
            FROM proveedor_productos pp
            INNER JOIN proveedores pr
              ON pr.id = pp.proveedor_id
            WHERE pp.producto_id = p.id
              AND pr.activo = TRUE
          ),
          'Sin proveedor'
        ) AS proveedor_nombre,

        p.categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,
        c.ubicacion_propietaria_id,

        i.cantidad,
        i.updated_at

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      WHERE
        u.activo = TRUE
        AND p.activo = TRUE
    `;

    if (!esPrincipal(req)) {
      const ubicacionUsuario = Number(
        req.usuario.ubicacion_id
      );

      if (
        !Number.isInteger(ubicacionUsuario) ||
        ubicacionUsuario <= 0
      ) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      params.push(ubicacionUsuario);

      sql += `
        AND i.ubicacion_id = $${params.length}
      `;
    }

    sql += `
      ORDER BY
        u.nombre,
        p.nombre
    `;

    const result = await pool.query(
      sql,
      params
    );

    const inventarioVisible =
      result.rows.filter((item) =>
        puedeVerCategoria(
          {
            tipo: item.categoria_tipo,
            ubicacion_propietaria_id:
              item.ubicacion_propietaria_id
          },
          req
        )
      );

    return res.json(
      inventarioVisible
    );
  } catch (error) {
    console.error(
      "Error getInventario:",
      error
    );

    return res.status(500).json({
      message:
        "No fue posible consultar el inventario"
    });
  }
};

const getInventarioByUbicacion = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const ubicacionId = Number(
      req.params.ubicacionId
    );

    const ubicacionUsuario = Number(
      req.usuario.ubicacion_id
    );

    if (
      !Number.isInteger(ubicacionId) ||
      ubicacionId <= 0
    ) {
      return res.status(400).json({
        message:
          "Ubicación inválida"
      });
    }

    if (
      !Number.isInteger(
        ubicacionUsuario
      ) ||
      ubicacionUsuario <= 0
    ) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    if (
      !esPrincipal(req) &&
      ubicacionId !== ubicacionUsuario
    ) {
      return res.status(403).json({
        message:
          "Solo puedes consultar el inventario de tu propia ubicación"
      });
    }

    const result =
      await pool.query(
        `
          SELECT
            i.id,
            i.ubicacion_id,
            u.nombre AS ubicacion_nombre,
            u.tipo AS ubicacion_tipo,

            i.producto_id,
            p.nombre AS producto_nombre,
            p.descripcion,
            p.sku,
            p.unidad_medida,
            p.punto_reorden,

            (
              SELECT pp.proveedor_id
              FROM proveedor_productos pp
              INNER JOIN proveedores pr
                ON pr.id = pp.proveedor_id
              WHERE pp.producto_id = p.id
                AND pr.activo = TRUE
              ORDER BY pr.nombre
              LIMIT 1
            ) AS proveedor_id,

            COALESCE(
              (
                SELECT STRING_AGG(
                  DISTINCT pr.nombre,
                  ', ' ORDER BY pr.nombre
                )
                FROM proveedor_productos pp
                INNER JOIN proveedores pr
                  ON pr.id = pp.proveedor_id
                WHERE pp.producto_id = p.id
                  AND pr.activo = TRUE
              ),
              'Sin proveedor'
            ) AS proveedor_nombre,

            p.categoria_id,
            c.nombre AS categoria_nombre,
            c.tipo AS categoria_tipo,
            c.ubicacion_propietaria_id,

            i.cantidad,
            i.updated_at

          FROM inventario i

          INNER JOIN ubicaciones u
            ON i.ubicacion_id = u.id

          INNER JOIN productos p
            ON i.producto_id = p.id

          LEFT JOIN categorias c
            ON p.categoria_id = c.id

          WHERE
            i.ubicacion_id = $1
            AND u.activo = TRUE
            AND p.activo = TRUE

          ORDER BY p.nombre
        `,
        [ubicacionId]
      );

    const inventarioVisible =
      result.rows.filter((item) =>
        puedeVerCategoria(
          {
            tipo: item.categoria_tipo,
            ubicacion_propietaria_id:
              item.ubicacion_propietaria_id
          },
          req
        )
      );

    return res.json(
      inventarioVisible
    );
  } catch (error) {
    return res.status(500).json({
      message:
        "Error al obtener inventario de la ubicación",
      error: error.message
    });
  }
};

const setStockInicial = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    if (!esPrincipal(req)) {
      return res.status(403).json({
        message:
          "Solo Central puede establecer stock inicial"
      });
    }

    const {
      ubicacion_id,
      producto_id,
      cantidad
    } = req.body;

    if (
      !ubicacion_id ||
      !producto_id ||
      !validarCantidadPositiva(
        cantidad
      )
    ) {
      return res.status(400).json({
        message:
          "Ubicación, producto y una cantidad mayor a 0 son obligatorios"
      });
    }

    const ubicacionObjetivo =
      Number(ubicacion_id);

    if (
      !Number.isInteger(
        ubicacionObjetivo
      ) ||
      ubicacionObjetivo <= 0
    ) {
      return res.status(400).json({
        message:
          "La ubicación indicada no es válida"
      });
    }

    await client.query(
      "BEGIN"
    );

    const ubicacionResult =
      await client.query(
        `
          SELECT id, nombre
          FROM ubicaciones
          WHERE id = $1
            AND activo = TRUE
          LIMIT 1
        `,
        [ubicacionObjetivo]
      );

    if (
      !ubicacionResult.rows.length
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        message:
          "La ubicación no existe o está inactiva"
      });
    }

    const result =
      await client.query(
        `
          INSERT INTO inventario (
            ubicacion_id,
            producto_id,
            cantidad,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            CURRENT_TIMESTAMP
          )

          ON CONFLICT (
            ubicacion_id,
            producto_id
          )

          DO UPDATE SET
            cantidad = EXCLUDED.cantidad,
            updated_at = CURRENT_TIMESTAMP

          RETURNING *
        `,
        [
          ubicacionObjetivo,
          Number(producto_id),
          Number(cantidad)
        ]
      );

    await client.query(
      `
        INSERT INTO movimientos (
          ubicacion_id,
          producto_id,
          usuario_id,
          tipo,
          cantidad,
          referencia_tipo,
          referencia_id,
          motivo
        )
        VALUES (
          $1,
          $2,
          $3,
          'entrada',
          $4,
          'stock_inicial',
          $5,
          $6
        )
      `,
      [
        ubicacionObjetivo,
        Number(producto_id),
        Number(req.usuario.id),
        Number(cantidad),
        result.rows[0].id,
        "Carga de stock inicial"
      ]
    );

    await client.query(
      "COMMIT"
    );

    return res.json({
      message:
        "Stock inicial actualizado correctamente",
      inventario:
        result.rows[0]
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    return res.status(500).json({
      message:
        "No fue posible establecer el stock inicial"
    });
  } finally {
    client.release();
  }
};

const agregarProductoExistentePropio =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      if (!req.usuario) {
        return res.status(401).json({
          message:
            "Usuario no autenticado"
        });
      }

      const {
        producto_id,
        cantidad
      } = req.body;

      if (!producto_id) {
        return res.status(400).json({
          message:
            "Debes seleccionar un producto"
        });
      }

      if (
        !validarCantidadPositiva(
          cantidad
        )
      ) {
        return res.status(400).json({
          message:
            "La cantidad debe ser mayor a 0"
        });
      }

      const ubicacion =
        await obtenerUbicacionUsuario(
          client,
          req
        );

      if (!ubicacion) {
        return res.status(404).json({
          message:
            "La ubicación del usuario no existe o está inactiva"
        });
      }

      const productoResult =
        await client.query(
          `
            SELECT
              p.id,
              p.nombre,
              p.sku,
              p.categoria_id,

              c.tipo AS categoria_tipo,
              c.ubicacion_propietaria_id

            FROM productos p

            LEFT JOIN categorias c
              ON p.categoria_id = c.id

            WHERE
              p.id = $1
              AND p.activo = TRUE
          `,
          [producto_id]
        );

      if (
        !productoResult.rows.length
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado o inactivo"
        });
      }

      const producto =
        productoResult.rows[0];

      if (
        !puedeUsarCategoriaParaAlta(
          {
            tipo:
              producto.categoria_tipo,
            ubicacion_propietaria_id:
              producto
                .ubicacion_propietaria_id
          },
          req
        )
      ) {
        return res.status(403).json({
          message:
            "No tienes permiso para agregar este producto a tu stock"
        });
      }

      await client.query(
        "BEGIN"
      );

      const inventarioResult =
        await client.query(
          `
            INSERT INTO inventario (
              ubicacion_id,
              producto_id,
              cantidad,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              CURRENT_TIMESTAMP
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

            RETURNING *
          `,
          [
            Number(ubicacion.id),
            Number(producto_id),
            Number(cantidad)
          ]
        );

      await client.query(
        `
          INSERT INTO movimientos (
            ubicacion_id,
            producto_id,
            usuario_id,
            tipo,
            cantidad,
            referencia_tipo,
            referencia_id,
            motivo
          )
          VALUES (
            $1,
            $2,
            $3,
            'entrada',
            $4,
            'alta_producto',
            $5,
            $6
          )
        `,
        [
          Number(ubicacion.id),
          Number(producto_id),
          Number(req.usuario.id),
          Number(cantidad),
          inventarioResult
            .rows[0].id,
          "Producto agregado al stock"
        ]
      );

      await client.query(
        "COMMIT"
      );

      return res.json({
        message:
          "Producto agregado al stock correctamente",
        producto,
        inventario:
          inventarioResult.rows[0]
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      return res.status(500).json({
        message:
          "Error al agregar el producto al stock",
        error: error.message
      });
    } finally {
      client.release();
    }
  };

const agregarProductoNuevoPropio =
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      if (!req.usuario) {
        return res.status(401).json({
          message:
            "Usuario no autenticado"
        });
      }

      const {
        nombre,
        descripcion,
        sku,
        categoria_id,
        unidad_medida,
        punto_reorden = 0,
        cantidad
      } = req.body;

      if (!nombre?.trim()) {
        return res.status(400).json({
          message:
            "El nombre del producto es obligatorio"
        });
      }

      if (!categoria_id) {
        return res.status(400).json({
          message:
            "La categoría es obligatoria"
        });
      }

      if (!unidad_medida?.trim()) {
        return res.status(400).json({
          message:
            "La unidad de medida es obligatoria"
        });
      }

      if (
        !validarCantidadPositiva(
          cantidad
        )
      ) {
        return res.status(400).json({
          message:
            "La cantidad inicial debe ser mayor a 0"
        });
      }

      const puntoReorden =
        Number(punto_reorden);

      if (
        !Number.isFinite(
          puntoReorden
        ) ||
        puntoReorden < 0
      ) {
        return res.status(400).json({
          message:
            "El punto de reorden no puede ser negativo"
        });
      }

      const ubicacion =
        await obtenerUbicacionUsuario(
          client,
          req
        );

      if (!ubicacion) {
        return res.status(404).json({
          message:
            "La ubicación del usuario no existe o está inactiva"
        });
      }

      const categoriaResult =
        await client.query(
          `
            SELECT
              id,
              nombre,
              tipo,
              ubicacion_propietaria_id,
              activo
            FROM categorias
            WHERE id = $1
              AND activo = TRUE
          `,
          [categoria_id]
        );

      if (
        !categoriaResult.rows.length
      ) {
        return res.status(404).json({
          message:
            "La categoría no existe o está inactiva"
        });
      }

      const categoria =
        categoriaResult.rows[0];

      if (
        !puedeUsarCategoriaParaAlta(
          categoria,
          req
        )
      ) {
        return res.status(403).json({
          message:
            "No tienes permiso para utilizar esta categoría"
        });
      }

      const skuFinal =
        sku?.trim() ||
        generarSku();

      await client.query(
        "BEGIN"
      );

      const productoResult =
        await client.query(
          `
            INSERT INTO productos (
              nombre,
              descripcion,
              sku,
              categoria_id,
              unidad_medida,
              punto_reorden,
              activo
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              TRUE
            )
            RETURNING *
          `,
          [
            nombre.trim(),
            descripcion?.trim() ||
              null,
            skuFinal,
            Number(categoria_id),
            unidad_medida.trim(),
            puntoReorden
          ]
        );

      const producto =
        productoResult.rows[0];

      const inventarioResult =
        await client.query(
          `
            INSERT INTO inventario (
              ubicacion_id,
              producto_id,
              cantidad,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              CURRENT_TIMESTAMP
            )
            RETURNING *
          `,
          [
            Number(ubicacion.id),
            Number(producto.id),
            Number(cantidad)
          ]
        );

      await client.query(
        `
          INSERT INTO movimientos (
            ubicacion_id,
            producto_id,
            usuario_id,
            tipo,
            cantidad,
            referencia_tipo,
            referencia_id,
            motivo
          )
          VALUES (
            $1,
            $2,
            $3,
            'entrada',
            $4,
            'alta_producto',
            $5,
            $6
          )
        `,
        [
          Number(ubicacion.id),
          Number(producto.id),
          Number(req.usuario.id),
          Number(cantidad),
          inventarioResult
            .rows[0].id,
          "Producto nuevo agregado al stock"
        ]
      );

      await client.query(
        "COMMIT"
      );

      return res.status(201).json({
        message:
          "Producto creado y agregado a tu stock correctamente",
        producto,
        inventario:
          inventarioResult.rows[0]
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          message:
            "Ya existe un producto con ese SKU"
        });
      }

      return res.status(500).json({
        message:
          "Error al crear el producto y agregarlo al stock",
        error: error.message
      });
    } finally {
      client.release();
    }
  };

const importarInventarioCsv =
  async (req, res) => {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message:
          "Debes seleccionar un archivo CSV"
      });
    }

    const filas = [];

    try {
      await new Promise(
        (resolve, reject) => {
          Readable.from([
            req.file.buffer
          ])
            .pipe(
              csv({
                mapHeaders: ({
                  header
                }) =>
                  header
                    .replace(
                      /^\uFEFF/,
                      ""
                    )
                    .trim()
                    .toLowerCase()
              })
            )
            .on(
              "data",
              (fila) =>
                filas.push(fila)
            )
            .on(
              "end",
              resolve
            )
            .on(
              "error",
              reject
            );
        }
      );
    } catch (error) {
      return res.status(400).json({
        message:
          "Error de formato: no se pudo leer el archivo CSV"
      });
    }

    if (!filas.length) {
      return res.status(400).json({
        message:
          "El archivo CSV está vacío"
      });
    }

    const columnasObligatorias = [
      "nombre",
      "unidad_medida",
      "cantidad"
    ];

    const columnasArchivo =
      Object.keys(
        filas[0]
      );

    const columnasFaltantes =
      columnasObligatorias.filter(
        (columna) =>
          !columnasArchivo.includes(
            columna
          )
      );

    if (
      columnasFaltantes.length
    ) {
      return res.status(400).json({
        message:
          `Error en ${columnasFaltantes.length} campo(s) obligatorio(s) del CSV`,
        columnas_faltantes:
          columnasFaltantes,
        campos_obligatorios:
          columnasObligatorias,
        campos_opcionales: [
          "descripcion",
          "sku",
          "categoria",
          "categoria_nombre",
          "categoria_id",
          "punto_reorden",
          "proveedor",
          "proveedor_nombre",
          "proveedor_id"
        ]
      });
    }

    const client =
      await pool.connect();

    const resultados = {
      total: filas.length,
      procesadas: 0,

      productos_creados: 0,
      productos_existentes: 0,

      inventarios_creados: 0,
      inventarios_actualizados: 0,

      movimientos_creados: 0,

      categorias_creadas: 0,

      proveedores_asociados: 0,

      errores: []
    };

    try {
      const ubicacion =
        await obtenerUbicacionUsuario(
          client,
          req
        );

      if (!ubicacion) {
        return res.status(404).json({
          message:
            "La ubicación del usuario no existe o está inactiva"
        });
      }

      for (
        let indice = 0;
        indice < filas.length;
        indice++
      ) {
        const fila =
          filas[indice];

        const numeroFila =
          indice + 2;

        const nombre =
          fila.nombre?.trim();

        const descripcion =
          fila.descripcion?.trim() ||
          null;

        const skuCsv =
          fila.sku?.trim() ||
          null;

        const categoriaNombre =
          fila.categoria?.trim() ||
          fila.categoria_nombre?.trim() ||
          null;

        const categoriaIdCsv =
          fila.categoria_id?.trim() ||
          null;

        const unidadMedida =
          fila.unidad_medida?.trim();

        const cantidad =
          Number(fila.cantidad);

        const puntoReorden =
          fila.punto_reorden ===
            undefined ||
          fila.punto_reorden === ""
            ? null
            : Number(
                fila.punto_reorden
              );

        const proveedorNombre =
          fila.proveedor?.trim() ||
          fila.proveedor_nombre?.trim() ||
          null;

        const proveedorIdCsv =
          fila.proveedor_id?.trim() ||
          null;

        if (!nombre) {
          resultados.errores.push({
            fila: numeroFila,
            error:
              "El nombre del artículo es obligatorio"
          });

          continue;
        }

        if (!unidadMedida) {
          resultados.errores.push({
            fila: numeroFila,
            error:
              "La unidad de medida es obligatoria"
          });

          continue;
        }

        if (
          !Number.isFinite(
            cantidad
          ) ||
          cantidad < 0
        ) {
          resultados.errores.push({
            fila: numeroFila,
            sku: skuCsv,
            error:
              "La cantidad debe ser un número mayor o igual a 0"
          });

          continue;
        }

        if (
          puntoReorden !== null &&
          (
            !Number.isFinite(
              puntoReorden
            ) ||
            puntoReorden < 0
          )
        ) {
          resultados.errores.push({
            fila: numeroFila,
            sku: skuCsv,
            error:
              "El punto de reorden debe ser mayor o igual a 0"
          });

          continue;
        }

        if (
          proveedorIdCsv &&
          (
            !Number.isInteger(
              Number(
                proveedorIdCsv
              )
            ) ||
            Number(
              proveedorIdCsv
            ) <= 0
          )
        ) {
          resultados.errores.push({
            fila: numeroFila,
            sku: skuCsv,
            error:
              "El proveedor indicado no es válido"
          });

          continue;
        }

        try {
          await client.query(
            "BEGIN"
          );

          let categoriaId =
            null;

          if (categoriaIdCsv) {
            const categoriaIdNumero =
              Number(
                categoriaIdCsv
              );

            if (
              !Number.isInteger(
                categoriaIdNumero
              ) ||
              categoriaIdNumero <= 0
            ) {
              throw new Error(
                "El ID de categoría indicado no es válido"
              );
            }

            const categoriaResult =
              await client.query(
                `
                  SELECT
                    id,
                    nombre,
                    tipo,
                    ubicacion_propietaria_id,
                    activo
                  FROM categorias
                  WHERE id = $1
                    AND activo = TRUE
                  LIMIT 1
                `,
                [
                  categoriaIdNumero
                ]
              );

            if (
              !categoriaResult
                .rows.length
            ) {
              throw new Error(
                "La categoría indicada no existe o está inactiva"
              );
            }

            const categoria =
              categoriaResult
                .rows[0];

            if (
              !puedeUsarCategoriaParaAlta(
                categoria,
                req
              )
            ) {
              throw new Error(
                "No tienes permiso para utilizar esta categoría"
              );
            }

            categoriaId =
              Number(
                categoria.id
              );
          } else if (
            categoriaNombre
          ) {
            const categoriaResult =
              await client.query(
                `
                  SELECT
                    id,
                    nombre,
                    tipo,
                    ubicacion_propietaria_id,
                    activo
                  FROM categorias
                  WHERE
                    LOWER(TRIM(nombre)) =
                    LOWER(TRIM($1))
                    AND activo = TRUE
                  ORDER BY
                    CASE
                      WHEN tipo = 'global'
                      THEN 0
                      ELSE 1
                    END,
                    id
                  LIMIT 1
                `,
                [
                  categoriaNombre
                ]
              );

            if (
              categoriaResult
                .rows.length
            ) {
              const categoria =
                categoriaResult
                  .rows[0];

              if (
                !puedeUsarCategoriaParaAlta(
                  categoria,
                  req
                )
              ) {
                throw new Error(
                  "No tienes permiso para utilizar esta categoría"
                );
              }

              categoriaId =
                Number(
                  categoria.id
                );
            } else {
              const nuevaCategoria =
                await client.query(
                  `
                    INSERT INTO categorias (
                      nombre,
                      descripcion,
                      tipo,
                      ubicacion_propietaria_id,
                      activo
                    )
                    VALUES (
                      $1,
                      NULL,
                      'global',
                      NULL,
                      TRUE
                    )
                    RETURNING id
                  `,
                  [
                    categoriaNombre
                  ]
                );

              categoriaId =
                Number(
                  nuevaCategoria
                    .rows[0]
                    .id
                );

              resultados
                .categorias_creadas++;
            }
          }

          let producto = null;

          if (skuCsv) {
            const productoResult =
              await client.query(
                `
                  SELECT
                    p.id,
                    p.nombre,
                    p.sku,
                    p.categoria_id,
                    p.activo,

                    c.nombre AS categoria_nombre,
                    c.tipo AS categoria_tipo,
                    c.ubicacion_propietaria_id

                  FROM productos p

                  LEFT JOIN categorias c
                    ON p.categoria_id = c.id

                  WHERE
                    LOWER(TRIM(p.sku)) =
                    LOWER(TRIM($1))

                  LIMIT 1
                `,
                [skuCsv]
              );

            if (
              productoResult
                .rows.length
            ) {
              producto =
                productoResult
                  .rows[0];
            }
          }

          let productoId;

          if (producto) {
            if (!producto.activo) {
              throw new Error(
                "El SKU corresponde a un artículo inactivo"
              );
            }

            if (
              producto.nombre
                .trim()
                .toLowerCase() !==
              nombre
                .trim()
                .toLowerCase()
            ) {
              throw new Error(
                `El SKU ${producto.sku} ya pertenece al artículo "${producto.nombre}" y no coincide con "${nombre}"`
              );
            }

            if (
              !puedeUsarCategoriaParaAlta(
                {
                  tipo:
                    producto.categoria_tipo,
                  ubicacion_propietaria_id:
                    producto
                      .ubicacion_propietaria_id
                },
                req
              )
            ) {
              throw new Error(
                "No tienes permiso para utilizar este artículo"
              );
            }

            if (
              categoriaId !==
                null &&
              producto.categoria_id !==
                null &&
              Number(
                producto.categoria_id
              ) !==
                Number(
                  categoriaId
                )
            ) {
              throw new Error(
                `El SKU ${producto.sku} ya está asociado a otra categoría`
              );
            }

            productoId =
              Number(
                producto.id
              );

            resultados
              .productos_existentes++;
          } else {
            const skuFinal =
              skuCsv ||
              generarSku();

            const skuCheck =
              await client.query(
                `
                  SELECT id
                  FROM productos
                  WHERE
                    LOWER(TRIM(sku)) =
                    LOWER(TRIM($1))
                  LIMIT 1
                `,
                [skuFinal]
              );

            if (
              skuCheck.rows.length
            ) {
              throw new Error(
                `El SKU ${skuFinal} ya existe`
              );
            }

            const productoCreado =
              await client.query(
                `
                  INSERT INTO productos (
                    nombre,
                    descripcion,
                    sku,
                    categoria_id,
                    unidad_medida,
                    punto_reorden,
                    activo
                  )
                  VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    TRUE
                  )
                  RETURNING id
                `,
                [
                  nombre,
                  descripcion,
                  skuFinal,
                  categoriaId,
                  unidadMedida,
                  puntoReorden ===
                  null
                    ? 0
                    : puntoReorden
                ]
              );

            productoId =
              Number(
                productoCreado
                  .rows[0]
                  .id
              );

            resultados
              .productos_creados++;
          }

          let proveedorId =
            null;

          if (proveedorNombre) {
            const proveedorResult =
              await client.query(
                `
                  SELECT
                    id,
                    nombre,
                    activo
                  FROM proveedores
                  WHERE
                    LOWER(TRIM(nombre)) =
                    LOWER(TRIM($1))
                    AND activo = TRUE
                  LIMIT 1
                `,
                [
                  proveedorNombre
                ]
              );

            if (
              !proveedorResult
                .rows.length
            ) {
              throw new Error(
                `El proveedor "${proveedorNombre}" no existe o está inactivo`
              );
            }

            proveedorId =
              Number(
                proveedorResult
                  .rows[0]
                  .id
              );
          } else if (
            proveedorIdCsv
          ) {
            const proveedorResult =
              await client.query(
                `
                  SELECT
                    id,
                    nombre,
                    activo
                  FROM proveedores
                  WHERE
                    id = $1
                    AND activo = TRUE
                  LIMIT 1
                `,
                [
                  Number(
                    proveedorIdCsv
                  )
                ]
              );

            if (
              !proveedorResult
                .rows.length
            ) {
              throw new Error(
                "El proveedor indicado no existe o está inactivo"
              );
            }

            proveedorId =
              Number(
                proveedorResult
                  .rows[0]
                  .id
              );
          }

          if (proveedorId) {
            await client.query(
              `
                INSERT INTO proveedor_productos (
                  proveedor_id,
                  producto_id
                )
                VALUES (
                  $1,
                  $2
                )
                ON CONFLICT (
                  proveedor_id,
                  producto_id
                )
                DO NOTHING
              `,
              [
                proveedorId,
                productoId
              ]
            );

            resultados
              .proveedores_asociados++;
          }

          const inventarioAnterior =
            await client.query(
              `
                SELECT
                  id,
                  cantidad
                FROM inventario
                WHERE
                  ubicacion_id = $1
                  AND producto_id = $2
                FOR UPDATE
              `,
              [
                Number(
                  ubicacion.id
                ),
                productoId
              ]
            );

          const existeInventario =
            inventarioAnterior
              .rows.length > 0;

          const cantidadAnterior =
            existeInventario
              ? Number(
                  inventarioAnterior
                    .rows[0]
                    .cantidad
                )
              : 0;

          const diferencia =
            cantidad -
            cantidadAnterior;

          let inventarioId;

          if (existeInventario) {
            const actualizado =
              await client.query(
                `
                  UPDATE inventario
                  SET
                    cantidad = $1,
                    updated_at =
                      CURRENT_TIMESTAMP
                  WHERE id = $2
                  RETURNING
                    id,
                    cantidad,
                    updated_at
                `,
                [
                  cantidad,
                  inventarioAnterior
                    .rows[0]
                    .id
                ]
              );

            inventarioId =
              actualizado.rows[0]
                .id;

            resultados
              .inventarios_actualizados++;
          } else {
            const creado =
              await client.query(
                `
                  INSERT INTO inventario (
                    ubicacion_id,
                    producto_id,
                    cantidad,
                    updated_at
                  )
                  VALUES (
                    $1,
                    $2,
                    $3,
                    CURRENT_TIMESTAMP
                  )
                  RETURNING
                    id,
                    cantidad,
                    updated_at
                `,
                [
                  Number(
                    ubicacion.id
                  ),
                  productoId,
                  cantidad
                ]
              );

            inventarioId =
              creado.rows[0]
                .id;

            resultados
              .inventarios_creados++;
          }

          if (
            diferencia !== 0
          ) {
            const tipoMovimiento =
              diferencia > 0
                ? "ajuste_positivo"
                : "ajuste_negativo";

            await client.query(
              `
                INSERT INTO movimientos (
                  ubicacion_id,
                  producto_id,
                  usuario_id,
                  tipo,
                  cantidad,
                  referencia_tipo,
                  referencia_id,
                  motivo
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  'importacion_csv',
                  $6,
                  $7
                )
              `,
              [
                Number(
                  ubicacion.id
                ),
                productoId,
                Number(
                  req.usuario.id
                ),
                tipoMovimiento,
                Math.abs(
                  diferencia
                ),
                inventarioId,
                `Importación CSV. Fila ${numeroFila}. Existencia anterior: ${cantidadAnterior}. Existencia nueva: ${cantidad}.`
              ]
            );

            resultados
              .movimientos_creados++;
          }

          await client.query(
            "COMMIT"
          );

          resultados.procesadas++;
        } catch (error) {
          try {
            await client.query(
              "ROLLBACK"
            );
          } catch {}

          resultados.errores.push({
            fila: numeroFila,
            sku: skuCsv,
            error:
              error.code === "23505"
                ? "El artículo ya existe con ese SKU"
                : error.message
          });
        }
      }

      const huboErrores =
        resultados.errores.length >
        0;

      return res.status(200).json({
        message: huboErrores
          ? `Archivo cargado con revisión: ${resultados.procesadas} de ${resultados.total} filas procesadas`
          : "Archivo cargado con éxito",

        ubicacion: {
          id: ubicacion.id,
          nombre: ubicacion.nombre
        },

        resumen: {
          total_filas:
            resultados.total,

          filas_procesadas:
            resultados.procesadas,

          filas_con_error:
            resultados.errores.length,

          productos_creados:
            resultados.productos_creados,

          productos_existentes:
            resultados.productos_existentes,

          inventarios_creados:
            resultados.inventarios_creados,

          inventarios_actualizados:
            resultados.inventarios_actualizados,

          categorias_creadas:
            resultados.categorias_creadas,

          proveedores_asociados:
            resultados.proveedores_asociados,

          movimientos_kardex:
            resultados.movimientos_creados
        },

        errores:
          resultados.errores
      });
    } catch (error) {
      console.error(
        "Error importarInventarioCsv:",
        error
      );

      return res.status(500).json({
        message:
          "No fue posible completar la importación del CSV"
      });
    } finally {
      client.release();
    }
  };

const ajustarStock = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const {
      producto_id,
      cantidad_nueva,
      motivo,
      ubicacion_id
    } = req.body;

    if (!producto_id) {
      return res.status(400).json({
        message:
          "El producto es obligatorio"
      });
    }

    if (
      !validarCantidadNoNegativa(
        cantidad_nueva
      )
    ) {
      return res.status(400).json({
        message:
          "La nueva cantidad debe ser un número mayor o igual a cero"
      });
    }

    if (!motivo?.trim()) {
      return res.status(400).json({
        message:
          "Debes indicar el motivo del ajuste"
      });
    }

    const ubicacionUsuario =
      Number(
        req.usuario.ubicacion_id
      );

    const ubicacionObjetivo =
      Number(
        ubicacion_id ??
          ubicacionUsuario
      );

    if (
      !Number.isInteger(
        ubicacionObjetivo
      ) ||
      ubicacionObjetivo <= 0
    ) {
      return res.status(400).json({
        message:
          "La ubicación indicada no es válida"
      });
    }

    if (
      !esPrincipal(req) &&
      ubicacionObjetivo !==
        ubicacionUsuario
    ) {
      return res.status(403).json({
        message:
          "Solo puedes modificar el inventario de tu propia ubicación"
      });
    }

    const ubicacionResult =
      await client.query(
        `
          SELECT
            id,
            nombre,
            tipo
          FROM ubicaciones
          WHERE id = $1
            AND activo = TRUE
          LIMIT 1
        `,
        [ubicacionObjetivo]
      );

    if (
      !ubicacionResult.rows.length
    ) {
      return res.status(404).json({
        message:
          "La ubicación no existe o está inactiva"
      });
    }

    await client.query(
      "BEGIN"
    );

    const inventarioResult =
      await client.query(
        `
          SELECT
            i.id,
            i.ubicacion_id,
            i.producto_id,
            i.cantidad,

            p.nombre AS producto_nombre,
            p.sku,

            u.nombre AS ubicacion_nombre

          FROM inventario i

          INNER JOIN productos p
            ON i.producto_id = p.id

          INNER JOIN ubicaciones u
            ON i.ubicacion_id = u.id

          WHERE
            i.ubicacion_id = $1
            AND i.producto_id = $2
            AND p.activo = TRUE
            AND u.activo = TRUE

          FOR UPDATE
        `,
        [
          ubicacionObjetivo,
          Number(producto_id)
        ]
      );

    if (
      !inventarioResult.rows.length
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        message:
          "El artículo no existe actualmente en el inventario de esta ubicación. Usa 'Agregar artículo' para darlo de alta."
      });
    }

    const registro =
      inventarioResult.rows[0];

    const cantidadAnterior =
      Number(
        registro.cantidad
      );

    const cantidadNueva =
      Number(
        cantidad_nueva
      );

    if (
      cantidadAnterior ===
      cantidadNueva
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        message:
          "La nueva cantidad es igual a la existencia actual; no hay ningún ajuste que registrar"
      });
    }

    const diferencia =
      cantidadNueva -
      cantidadAnterior;

    const tipoMovimiento =
      diferencia > 0
        ? "ajuste_positivo"
        : "ajuste_negativo";

    const cantidadMovimiento =
      Math.abs(diferencia);

    const actualizado =
      await client.query(
        `
          UPDATE inventario
          SET
            cantidad = $1,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $2

          RETURNING
            id,
            ubicacion_id,
            producto_id,
            cantidad,
            updated_at
        `,
        [
          cantidadNueva,
          registro.id
        ]
      );

    await client.query(
      `
        INSERT INTO movimientos (
          ubicacion_id,
          producto_id,
          usuario_id,
          tipo,
          cantidad,
          referencia_tipo,
          referencia_id,
          motivo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'ajuste_stock',
          $6,
          $7
        )
      `,
      [
        ubicacionObjetivo,
        Number(producto_id),
        Number(req.usuario.id),
        tipoMovimiento,
        cantidadMovimiento,
        registro.id,
        motivo.trim()
      ]
    );

    await client.query(
      "COMMIT"
    );

    return res.json({
      message:
        "Stock ajustado correctamente",

      ajuste: {
        ubicacion_id:
          ubicacionObjetivo,

        ubicacion_nombre:
          registro.ubicacion_nombre,

        producto_id:
          registro.producto_id,

        producto_nombre:
          registro.producto_nombre,

        sku:
          registro.sku,

        cantidad_anterior:
          cantidadAnterior,

        cantidad_nueva:
          cantidadNueva,

        diferencia,

        tipo:
          tipoMovimiento,

        motivo:
          motivo.trim()
      },

      inventario:
        actualizado.rows[0]
    });
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    return res.status(500).json({
      message:
        "Error al realizar el ajuste de stock",
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getInventario,
  getInventarioByUbicacion,
  setStockInicial,
  agregarProductoExistentePropio,
  agregarProductoNuevoPropio,
  importarInventarioCsv,
  ajustarStock
};