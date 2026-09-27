const pool = require("../config/db");
const csv = require("csv-parser");
const { Readable } = require("stream");

const esPrincipal = (req) => req.usuario?.rol === "principal";
const esEquipoInterno = (req) => req.usuario?.rol === "equipo_interno";
const cantidadNoNegativa = (v) => Number.isFinite(Number(v)) && Number(v) >= 0;
const cantidadPositiva = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

const obtenerUbicacionUsuario = async (client, req) => {
  const id = Number(req.usuario?.ubicacion_id);

  if (!id) {
    return null;
  }

  const r = await client.query(
    `SELECT id,nombre,tipo,activo
     FROM ubicaciones
     WHERE id=$1 AND activo=TRUE`,
    [id]
  );

  return r.rows[0] || null;
};

const categoriaVisible = (c, req) => {
  if (!c || !c.tipo || c.tipo === "global") {
    return true;
  }

  if (c.tipo === "privada") {
    return (
      esPrincipal(req) ||
      (
        esEquipoInterno(req) &&
        Number(c.ubicacion_propietaria_id) ===
          Number(req.usuario.ubicacion_id)
      )
    );
  }

  return false;
};

const categoriaPermitidaAlta = (c, req) => {
  if (!c) {
    return esPrincipal(req);
  }

  if (!c.tipo || c.tipo === "global") {
    return true;
  }

  return (
    c.tipo === "privada" &&
    esEquipoInterno(req) &&
    Number(c.ubicacion_propietaria_id) ===
      Number(req.usuario.ubicacion_id)
  );
};

const generarSku = () =>
  `AUTO-${Date.now()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

// =========================================================
// BUSCAR PRODUCTO POR SKU
// =========================================================
// MOU-001 = MOU001 = MOU_001
// También ignora espacios.
// =========================================================

const buscarProductoPorSku = async (
  client,
  sku
) => {
  if (!sku?.trim()) {
    return null;
  }

  const r = await client.query(
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
        ON c.id = p.categoria_id

      WHERE
        LOWER(
          REPLACE(
            REPLACE(
              REPLACE(
                TRIM(p.sku),
                ' ',
                ''
              ),
              '-',
              ''
            ),
            '_',
            ''
          )
        )
        =
        LOWER(
          REPLACE(
            REPLACE(
              REPLACE(
                TRIM($1),
                ' ',
                ''
              ),
              '-',
              ''
            ),
            '_',
            ''
          )
        )

      ORDER BY p.id ASC

      LIMIT 1
    `,
    [sku]
  );

  return r.rows[0] || null;
};

// =========================================================
// INVENTARIO GENERAL
// =========================================================

const getInventario = async (
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
          SELECT
            pp.proveedor_id
          FROM proveedor_productos pp
          INNER JOIN proveedores pr
            ON pr.id = pp.proveedor_id
          WHERE
            pp.producto_id = p.id
            AND pr.activo = TRUE
          ORDER BY pr.nombre
          LIMIT 1
        ) AS proveedor_id,

        COALESCE(
          (
            SELECT
              STRING_AGG(
                DISTINCT pr.nombre,
                ', ' ORDER BY pr.nombre
              )
            FROM proveedor_productos pp
            INNER JOIN proveedores pr
              ON pr.id = pp.proveedor_id
            WHERE
              pp.producto_id = p.id
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
        ON u.id = i.ubicacion_id

      INNER JOIN productos p
        ON p.id = i.producto_id

      LEFT JOIN categorias c
        ON c.id = p.categoria_id

      WHERE
        u.activo = TRUE
        AND p.activo = TRUE
    `;

    if (!esPrincipal(req)) {
      const ubicacionId = Number(
        req.usuario.ubicacion_id
      );

      if (
        !Number.isInteger(
          ubicacionId
        ) ||
        ubicacionId <= 0
      ) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      params.push(
        ubicacionId
      );

      sql += `
        AND i.ubicacion_id =
          $${params.length}
      `;
    }

    sql += `
      ORDER BY
        u.nombre,
        p.nombre
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    const inventarioVisible =
      result.rows.filter(
        (item) =>
          categoriaVisible(
            {
              tipo:
                item.categoria_tipo,

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

// =========================================================
// INVENTARIO POR UBICACIÓN
// =========================================================

const getInventarioByUbicacion =
  async (
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

      const ubicacionId =
        Number(
          req.params.ubicacionId
        );

      const ubicacionPropia =
        Number(
          req.usuario.ubicacion_id
        );

      if (
        !Number.isInteger(
          ubicacionId
        ) ||
        ubicacionId <= 0
      ) {
        return res.status(400).json({
          message:
            "Ubicación inválida"
        });
      }

      if (
        !esPrincipal(req) &&
        ubicacionId !==
          ubicacionPropia
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
                SELECT
                  pp.proveedor_id
                FROM proveedor_productos pp
                INNER JOIN proveedores pr
                  ON pr.id =
                    pp.proveedor_id
                WHERE
                  pp.producto_id =
                    p.id
                  AND pr.activo =
                    TRUE
                ORDER BY pr.nombre
                LIMIT 1
              ) AS proveedor_id,

              COALESCE(
                (
                  SELECT
                    STRING_AGG(
                      DISTINCT pr.nombre,
                      ', '
                      ORDER BY pr.nombre
                    )
                  FROM proveedor_productos pp
                  INNER JOIN proveedores pr
                    ON pr.id =
                      pp.proveedor_id
                  WHERE
                    pp.producto_id =
                      p.id
                    AND pr.activo =
                      TRUE
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
              ON u.id =
                i.ubicacion_id

            INNER JOIN productos p
              ON p.id =
                i.producto_id

            LEFT JOIN categorias c
              ON c.id =
                p.categoria_id

            WHERE
              i.ubicacion_id =
                $1
              AND u.activo =
                TRUE
              AND p.activo =
                TRUE

            ORDER BY
              p.nombre
          `,
          [ubicacionId]
        );

      const inventarioVisible =
        result.rows.filter(
          (item) =>
            categoriaVisible(
              {
                tipo:
                  item.categoria_tipo,

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
        error:
          error.message
      });
    }
  };

// =========================================================
// STOCK INICIAL
// =========================================================

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
      !cantidadPositiva(
        cantidad
      )
    ) {
      return res.status(400).json({
        message:
          "Ubicación, producto y una cantidad mayor a 0 son obligatorios"
      });
    }

    const ubicacionId =
      Number(
        ubicacion_id
      );

    await client.query(
      "BEGIN"
    );

    const ubicacion =
      await client.query(
        `
          SELECT
            id,
            nombre
          FROM ubicaciones
          WHERE
            id = $1
            AND activo = TRUE
        `,
        [ubicacionId]
      );

    if (
      !ubicacion.rows.length
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        message:
          "La ubicación no existe o está inactiva"
      });
    }

    const inventario =
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
              EXCLUDED.cantidad,
            updated_at =
              CURRENT_TIMESTAMP

          RETURNING *
        `,
        [
          ubicacionId,
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
        ubicacionId,
        Number(producto_id),
        Number(req.usuario.id),
        Number(cantidad),
        inventario.rows[0].id,
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
        inventario.rows[0]
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

// =========================================================
// AGREGAR PRODUCTO EXISTENTE
// =========================================================

const agregarProductoExistentePropio =
  async (
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
        cantidad
      } = req.body;

      if (!producto_id) {
        return res.status(400).json({
          message:
            "Debes seleccionar un producto"
        });
      }

      if (
        !cantidadPositiva(
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

              c.tipo
                AS categoria_tipo,

              c.ubicacion_propietaria_id

            FROM productos p

            LEFT JOIN categorias c
              ON c.id =
                p.categoria_id

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
        !categoriaPermitidaAlta(
          {
            tipo:
              producto.categoria_tipo,

            ubicacion_propietaria_id:
              producto.ubicacion_propietaria_id
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

      const inventario =
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
            ubicacion.id,
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
          ubicacion.id,
          Number(producto_id),
          Number(req.usuario.id),
          Number(cantidad),
          inventario.rows[0].id,
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
          inventario.rows[0]
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
        error:
          error.message
      });
    } finally {
      client.release();
    }
  };

// =========================================================
// CREAR PRODUCTO NUEVO
// =========================================================

const agregarProductoNuevoPropio =
  async (
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
        !cantidadPositiva(
          cantidad
        )
      ) {
        return res.status(400).json({
          message:
            "La cantidad inicial debe ser mayor a 0"
        });
      }

      const punto =
        Number(
          punto_reorden
        );

      if (
        !Number.isFinite(
          punto
        ) ||
        punto < 0
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

      const categoria =
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
              id = $1
              AND activo = TRUE
          `,
          [categoria_id]
        );

      if (
        !categoria.rows.length
      ) {
        return res.status(404).json({
          message:
            "La categoría no existe o está inactiva"
        });
      }

      if (
        !categoriaPermitidaAlta(
          categoria.rows[0],
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

      const productoExistente =
        await buscarProductoPorSku(
          client,
          skuFinal
        );

      if (productoExistente) {
        return res.status(409).json({
          message:
            `El SKU ${skuFinal} ya existe y pertenece al artículo "${productoExistente.nombre}"`
        });
      }

      await client.query(
        "BEGIN"
      );

      const producto =
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
            punto
          ]
        );

      const inventario =
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
            ubicacion.id,
            producto.rows[0].id,
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
          ubicacion.id,
          producto.rows[0].id,
          Number(req.usuario.id),
          Number(cantidad),
          inventario.rows[0].id,
          "Producto nuevo agregado al stock"
        ]
      );

      await client.query(
        "COMMIT"
      );

      return res.status(201).json({
        message:
          "Producto creado y agregado a tu stock correctamente",

        producto:
          producto.rows[0],

        inventario:
          inventario.rows[0]
      });
    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}

      if (
        error.code ===
        "23505"
      ) {
        return res.status(409).json({
          message:
            "Ya existe un producto con ese SKU"
        });
      }

      return res.status(500).json({
        message:
          "Error al crear el producto y agregarlo al stock",
        error:
          error.message
      });
    } finally {
      client.release();
    }
  };

// =========================================================
// LEER CSV
// =========================================================

const leerCsv = async (
  buffer
) => {
  const filas = [];

  await new Promise(
    (
      resolve,
      reject
    ) => {
      Readable
        .from([buffer])
        .pipe(
          csv({
            mapHeaders:
              ({
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
            filas.push(
              fila
            )
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

  return filas;
};

// =========================================================
// IMPORTAR CSV
// =========================================================

const importarInventarioCsv =
  async (
    req,
    res
  ) => {
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

    let filas;

    try {
      filas =
        await leerCsv(
          req.file.buffer
        );
    } catch {
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

    const obligatorias = [
      "nombre",
      "unidad_medida",
      "cantidad"
    ];

    const columnas =
      Object.keys(
        filas[0]
      );

    const faltantes =
      obligatorias.filter(
        (campo) =>
          !columnas.includes(
            campo
          )
      );

    if (
      faltantes.length
    ) {
      return res.status(400).json({
        message:
          `Error en ${faltantes.length} campo(s) obligatorio(s) del CSV`,

        columnas_faltantes:
          faltantes,

        campos_obligatorios:
          obligatorias,

        campos_opcionales: [
          "descripcion",
          "sku",
          "categoria",
          "categoria_nombre",
          "categoria_id",
          "punto_reorden",
          "proveedor_id"
        ]
      });
    }

    const client =
      await pool.connect();

    const resumen = {
      total:
        filas.length,

      procesadas:
        0,

      productos_creados:
        0,

      productos_existentes:
        0,

      inventarios_creados:
        0,

      inventarios_actualizados:
        0,

      movimientos_creados:
        0,

      categorias_creadas:
        0,

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
        indice <
          filas.length;
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

        const unidad =
          fila.unidad_medida?.trim();

        const cantidad =
          Number(
            fila.cantidad
          );

        const categoriaNombre =
          fila.categoria?.trim() ||
          fila.categoria_nombre?.trim() ||
          null;

        const categoriaIdCsv =
          fila.categoria_id?.trim() ||
          null;

        const punto =
          fila.punto_reorden ===
            "" ||
          fila.punto_reorden ===
            undefined
            ? 0
            : Number(
                fila.punto_reorden
              );

        const proveedorId =
          fila.proveedor_id?.trim() ||
          null;

        try {
          if (!nombre) {
            throw new Error(
              "El nombre del artículo es obligatorio"
            );
          }

          if (!unidad) {
            throw new Error(
              "La unidad de medida es obligatoria"
            );
          }

          if (
            !cantidadNoNegativa(
              cantidad
            )
          ) {
            throw new Error(
              "La cantidad debe ser un número mayor o igual a 0"
            );
          }

          if (
            !Number.isFinite(
              punto
            ) ||
            punto < 0
          ) {
            throw new Error(
              "El punto de reorden debe ser mayor o igual a 0"
            );
          }

          await client.query(
            "BEGIN"
          );

          // =============================================
          // CATEGORÍA
          // =============================================

          let categoriaId =
            null;

          if (
            categoriaIdCsv
          ) {
            const categoria =
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
                    id = $1
                    AND activo = TRUE
                `,
                [
                  Number(
                    categoriaIdCsv
                  )
                ]
              );

            if (
              !categoria.rows.length
            ) {
              throw new Error(
                "La categoría indicada no existe o está inactiva"
              );
            }

            if (
              !categoriaPermitidaAlta(
                categoria.rows[0],
                req
              )
            ) {
              throw new Error(
                "No tienes permiso para utilizar esta categoría"
              );
            }

            categoriaId =
              Number(
                categoria.rows[0].id
              );
          } else if (
            categoriaNombre
          ) {
            const categoria =
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
                    LOWER(
                      TRIM(nombre)
                    ) =
                    LOWER(
                      TRIM($1)
                    )
                    AND activo = TRUE
                  ORDER BY
                    CASE
                      WHEN tipo =
                        'global'
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
              categoria.rows.length
            ) {
              if (
                !categoriaPermitidaAlta(
                  categoria.rows[0],
                  req
                )
              ) {
                throw new Error(
                  "No tienes permiso para utilizar esta categoría"
                );
              }

              categoriaId =
                Number(
                  categoria.rows[0].id
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

              resumen
                .categorias_creadas++;
            }
          }

          // =============================================
          // BUSCAR SKU
          // =============================================

          let producto =
            await buscarProductoPorSku(
              client,
              skuCsv
            );

          let productoId;

          // =============================================
          // SKU EXISTENTE
          // =============================================

          if (producto) {
            if (
              !producto.activo
            ) {
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
              !categoriaPermitidaAlta(
                {
                  tipo:
                    producto.categoria_tipo,

                  ubicacion_propietaria_id:
                    producto.ubicacion_propietaria_id
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
                categoriaId
            ) {
              throw new Error(
                `El SKU ${producto.sku} ya está asociado a otra categoría`
              );
            }

            productoId =
              Number(
                producto.id
              );

            resumen
              .productos_existentes++;
          } else {
            // =========================================
            // PRODUCTO NUEVO
            // =========================================

            const skuFinal =
              skuCsv ||
              generarSku();

            // Segunda búsqueda antes del INSERT.
            // Esto evita que una carrera termine creando
            // otro artículo con el mismo SKU.
            const repetido =
              await buscarProductoPorSku(
                client,
                skuFinal
              );

            if (repetido) {
              if (
                repetido.nombre
                  .trim()
                  .toLowerCase() !==
                nombre
                  .trim()
                  .toLowerCase()
              ) {
                throw new Error(
                  `El SKU ${repetido.sku} ya pertenece al artículo "${repetido.nombre}" y no coincide con "${nombre}"`
                );
              }

              productoId =
                Number(
                  repetido.id
                );

              resumen
                .productos_existentes++;
            } else {
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
                    unidad,
                    punto
                  ]
                );

              productoId =
                Number(
                  productoCreado
                    .rows[0]
                    .id
                );

              resumen
                .productos_creados++;
            }
          }

          // =============================================
          // PROVEEDOR
          // =============================================

          if (
            proveedorId
          ) {
            const proveedor =
              await client.query(
                `
                  SELECT id
                  FROM proveedores
                  WHERE
                    id = $1
                    AND activo = TRUE
                  LIMIT 1
                `,
                [
                  Number(
                    proveedorId
                  )
                ]
              );

            if (
              !proveedor.rows.length
            ) {
              throw new Error(
                "El proveedor indicado no existe o está inactivo"
              );
            }

            const relacion =
              await client.query(
                `
                  SELECT 1
                  FROM proveedor_productos
                  WHERE
                    proveedor_id =
                      $1
                    AND producto_id =
                      $2
                  LIMIT 1
                `,
                [
                  Number(
                    proveedorId
                  ),
                  productoId
                ]
              );

            if (
              !relacion.rows.length
            ) {
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
                `,
                [
                  Number(
                    proveedorId
                  ),
                  productoId
                ]
              );
            }
          }

          // =============================================
          // INVENTARIO
          // CSV = EXISTENCIA FINAL
          // =============================================

          const anterior =
            await client.query(
              `
                SELECT
                  id,
                  cantidad
                FROM inventario
                WHERE
                  ubicacion_id =
                    $1
                  AND producto_id =
                    $2
                FOR UPDATE
              `,
              [
                ubicacion.id,
                productoId
              ]
            );

          const existe =
            anterior.rows.length >
            0;

          const cantidadAnterior =
            existe
              ? Number(
                  anterior
                    .rows[0]
                    .cantidad
                )
              : 0;

          const diferencia =
            cantidad -
            cantidadAnterior;

          let inventarioId;

          if (existe) {
            const actualizado =
              await client.query(
                `
                  UPDATE inventario
                  SET
                    cantidad =
                      $1,

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
                  anterior.rows[0]
                    .id
                ]
              );

            inventarioId =
              actualizado.rows[0]
                .id;

            resumen
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
                  ubicacion.id,
                  productoId,
                  cantidad
                ]
              );

            inventarioId =
              creado.rows[0]
                .id;

            resumen
              .inventarios_creados++;
          }

          // =============================================
          // KARDEX
          // =============================================

          if (
            diferencia !==
            0
          ) {
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
                ubicacion.id,

                productoId,

                Number(
                  req.usuario.id
                ),

                diferencia > 0
                  ? "ajuste_positivo"
                  : "ajuste_negativo",

                Math.abs(
                  diferencia
                ),

                inventarioId,

                `Importación CSV. Fila ${numeroFila}. Existencia anterior: ${cantidadAnterior}. Existencia nueva: ${cantidad}.`
              ]
            );

            resumen
              .movimientos_creados++;
          }

          await client.query(
            "COMMIT"
          );

          resumen.procesadas++;
        } catch (error) {
          try {
            await client.query(
              "ROLLBACK"
            );
          } catch {}

          resumen.errores.push({
            fila:
              numeroFila,

            sku:
              skuCsv,

            error:
              error.code ===
              "23505"
                ? "El artículo ya existe con ese SKU"
                : error.message
          });
        }
      }

      const hayErrores =
        resumen.errores.length >
        0;

      return res.json({
        message:
          hayErrores
            ? `Archivo cargado con revisión: ${resumen.procesadas} de ${resumen.total} filas procesadas`
            : "Archivo cargado con éxito",

        ubicacion: {
          id:
            ubicacion.id,

          nombre:
            ubicacion.nombre
        },

        resumen: {
          total_filas:
            resumen.total,

          filas_procesadas:
            resumen.procesadas,

          filas_con_error:
            resumen.errores.length,

          productos_creados:
            resumen.productos_creados,

          productos_existentes:
            resumen.productos_existentes,

          inventarios_creados:
            resumen.inventarios_creados,

          inventarios_actualizados:
            resumen.inventarios_actualizados,

          categorias_creadas:
            resumen.categorias_creadas,

          movimientos_kardex:
            resumen.movimientos_creados
        },

        errores:
          resumen.errores
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

// =========================================================
// AJUSTAR STOCK
// =========================================================

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
      !cantidadNoNegativa(
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

    const ubicacionPropia =
      Number(
        req.usuario.ubicacion_id
      );

    const destino =
      Number(
        ubicacion_id ??
        ubicacionPropia
      );

    if (
      !Number.isInteger(
        destino
      ) ||
      destino <= 0
    ) {
      return res.status(400).json({
        message:
          "La ubicación indicada no es válida"
      });
    }

    if (
      !esPrincipal(req) &&
      destino !==
        ubicacionPropia
    ) {
      return res.status(403).json({
        message:
          "Solo puedes modificar el inventario de tu propia ubicación"
      });
    }

    const ubicacion =
      await client.query(
        `
          SELECT
            id,
            nombre,
            tipo
          FROM ubicaciones
          WHERE
            id = $1
            AND activo = TRUE
        `,
        [destino]
      );

    if (
      !ubicacion.rows.length
    ) {
      return res.status(404).json({
        message:
          "La ubicación no existe o está inactiva"
      });
    }

    await client.query(
      "BEGIN"
    );

    const inventario =
      await client.query(
        `
          SELECT
            i.id,
            i.ubicacion_id,
            i.producto_id,
            i.cantidad,

            p.nombre
              AS producto_nombre,

            p.sku,

            u.nombre
              AS ubicacion_nombre

          FROM inventario i

          INNER JOIN productos p
            ON p.id =
              i.producto_id

          INNER JOIN ubicaciones u
            ON u.id =
              i.ubicacion_id

          WHERE
            i.ubicacion_id =
              $1

            AND i.producto_id =
              $2

            AND p.activo =
              TRUE

            AND u.activo =
              TRUE

          FOR UPDATE
        `,
        [
          destino,
          Number(
            producto_id
          )
        ]
      );

    if (
      !inventario.rows.length
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
      inventario.rows[0];

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

    const tipo =
      diferencia > 0
        ? "ajuste_positivo"
        : "ajuste_negativo";

    const actualizado =
      await client.query(
        `
          UPDATE inventario

          SET
            cantidad =
              $1,

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
        destino,

        Number(
          producto_id
        ),

        Number(
          req.usuario.id
        ),

        tipo,

        Math.abs(
          diferencia
        ),

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
          destino,

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

        tipo,

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
  getInventario,
  getInventarioByUbicacion,
  setStockInicial,
  agregarProductoExistentePropio,
  agregarProductoNuevoPropio,
  importarInventarioCsv,
  ajustarStock
};