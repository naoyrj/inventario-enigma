const pool = require("../config/db");
const csv = require("csv-parser");
const { Readable } = require("stream");

const CENTRAL_ID = 1;

// =========================================================
// HELPERS
// =========================================================

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
      ) === Number(req.usuario.ubicacion_id)
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
      ) === Number(req.usuario.ubicacion_id)
    );
  }

  return false;
};

const generarSku = () => {
  const fecha = Date.now();

  const aleatorio = Math.floor(
    1000 + Math.random() * 9000
  );

  return `AUTO-${fecha}-${aleatorio}`;
};

// =========================================================
// INVENTARIO GENERAL
// CADA USUARIO SOLO VE SU PROPIO INVENTARIO
// =========================================================

const getInventario = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    const ubicacionUsuario = Number(
      req.usuario.ubicacion_id
    );

    if (!Number.isFinite(ubicacionUsuario)) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    const result = await pool.query(
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
      [ubicacionUsuario]
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

    return res.json(inventarioVisible);
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener inventario",
      error: error.message
    });
  }
};

// =========================================================
// INVENTARIO POR UBICACIÓN
// =========================================================

const getInventarioByUbicacion = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    const ubicacionId = Number(
      req.params.ubicacionId
    );

    const ubicacionUsuario = Number(
      req.usuario.ubicacion_id
    );

    if (!Number.isFinite(ubicacionId)) {
      return res.status(400).json({
        message: "Ubicación inválida"
      });
    }

    if (!Number.isFinite(ubicacionUsuario)) {
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

    if (
      esPrincipal(req) &&
      ubicacionId !== CENTRAL_ID
    ) {
      return res.status(403).json({
        message:
          "Central solo puede consultar su propio inventario"
      });
    }

    const result = await pool.query(
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

    return res.json(inventarioVisible);
  } catch (error) {
    return res.status(500).json({
      message:
        "Error al obtener inventario de la ubicación",
      error: error.message
    });
  }
};

// =========================================================
// STOCK INICIAL
// =========================================================

const setStockInicial = async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    if (!esPrincipal(req)) {
      return res.status(403).json({
        message:
          "Solo Central puede establecer stock inicial manualmente"
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
      !validarCantidadPositiva(cantidad)
    ) {
      return res.status(400).json({
        message:
          "ubicacion_id, producto_id y una cantidad mayor a 0 son obligatorios"
      });
    }

    const ubicacionObjetivo =
      Number(ubicacion_id);

    if (
      !Number.isFinite(ubicacionObjetivo) ||
      ubicacionObjetivo !== CENTRAL_ID
    ) {
      return res.status(403).json({
        message:
          "Central solo puede establecer stock inicial en su propio inventario"
      });
    }

    const result = await pool.query(
      `
        INSERT INTO inventario (
          ubicacion_id,
          producto_id,
          cantidad,
          updated_at
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)

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
        CENTRAL_ID,
        Number(producto_id),
        Number(cantidad)
      ]
    );

    return res.json({
      message:
        "Stock inicial actualizado correctamente",
      inventario: result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Error al establecer stock inicial",
      error: error.message
    });
  }
};

// =========================================================
// AGREGAR PRODUCTO EXISTENTE AL PROPIO STOCK
// =========================================================

const agregarProductoExistentePropio =
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!req.usuario) {
        return res.status(401).json({
          message: "Usuario no autenticado"
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

      if (!validarCantidadPositiva(cantidad)) {
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

      if (!productoResult.rows.length) {
        return res.status(404).json({
          message:
            "Producto no encontrado o inactivo"
        });
      }

      const producto =
        productoResult.rows[0];

      const categoria = {
        tipo: producto.categoria_tipo,
        ubicacion_propietaria_id:
          producto.ubicacion_propietaria_id
      };

      if (
        !puedeUsarCategoriaParaAlta(
          categoria,
          req
        )
      ) {
        return res.status(403).json({
          message:
            "No tienes permiso para agregar este producto a tu stock"
        });
      }

      await client.query("BEGIN");

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

      await client.query("COMMIT");

      return res.json({
        message:
          "Producto agregado al stock correctamente",
        producto,
        inventario:
          inventarioResult.rows[0]
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
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

// =========================================================
// CREAR PRODUCTO NUEVO + STOCK
// =========================================================

const agregarProductoNuevoPropio =
  async (req, res) => {
    const client = await pool.connect();

    try {
      if (!req.usuario) {
        return res.status(401).json({
          message: "Usuario no autenticado"
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

      if (!validarCantidadPositiva(cantidad)) {
        return res.status(400).json({
          message:
            "La cantidad inicial debe ser mayor a 0"
        });
      }

      const puntoReorden =
        Number(punto_reorden);

      if (
        !Number.isFinite(puntoReorden) ||
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

      if (!categoriaResult.rows.length) {
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
        sku?.trim() || generarSku();

      await client.query("BEGIN");

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
            descripcion?.trim() || null,
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

      await client.query("COMMIT");

      return res.status(201).json({
        message:
          "Producto creado y agregado a tu stock correctamente",
        producto,
        inventario:
          inventarioResult.rows[0]
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      if (error.code === "23505") {
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

// =========================================================
// IMPORTAR INVENTARIO DESDE CSV
//
// COLUMNAS:
// nombre
// descripcion
// sku
// categoria_id
// unidad_medida
// punto_reorden
// cantidad
//
// REGLAS:
// - Siempre importa al inventario del usuario autenticado.
// - Nunca acepta ubicacion_id desde el CSV.
// - Si el SKU ya existe, utiliza ese producto.
// - Si el SKU no existe, crea el producto.
// - Si ya existe en el inventario, suma la cantidad.
// - Una fila incorrecta no cancela las demás.
// =========================================================

const importarInventarioCsv = async (
  req,
  res
) => {
  if (!req.usuario) {
    return res.status(401).json({
      message: "Usuario no autenticado"
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
    await new Promise((resolve, reject) => {
      const bufferCsv = req.file.buffer;

let contenidoCsv;

const tieneBomUtf8 =
  bufferCsv.length >= 3 &&
  bufferCsv[0] === 0xef &&
  bufferCsv[1] === 0xbb &&
  bufferCsv[2] === 0xbf;

if (tieneBomUtf8) {
  contenidoCsv = iconv.decode(
    bufferCsv,
    "utf8"
  );
} else {
  try {
    const decoder = new TextDecoder(
      "utf-8",
      { fatal: true }
    );

    contenidoCsv =
      decoder.decode(bufferCsv);
  } catch {
    contenidoCsv = iconv.decode(
      bufferCsv,
      "win1252"
    );
  }
}

Readable.from([contenidoCsv])
  .pipe(
    csv({
      mapHeaders: ({ header }) =>
        header
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
    })
  )
  .on("data", (fila) => {
    filas.push(fila);
  })
  .on("end", resolve)
  .on("error", reject);
    });
  } catch (error) {
    return res.status(400).json({
      message:
        "No se pudo leer el archivo CSV",
      error: error.message
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
    "sku",
    "categoria_id",
    "unidad_medida",
    "cantidad"
  ];

  const columnasArchivo =
    Object.keys(filas[0]);

  const columnasFaltantes =
    columnasObligatorias.filter(
      (columna) =>
        !columnasArchivo.includes(columna)
    );

  if (columnasFaltantes.length) {
    return res.status(400).json({
      message:
        "El archivo CSV no contiene todas las columnas obligatorias",
      columnas_faltantes:
        columnasFaltantes
    });
  }

  const client = await pool.connect();

  const resultados = {
    total: filas.length,
    agregados: 0,
    productos_creados: 0,
    productos_existentes: 0,
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
      const fila = filas[indice];

      const numeroFila = indice + 2;

      const nombre =
        fila.nombre?.trim();

      const descripcion =
        fila.descripcion?.trim() || null;

      const sku =
        fila.sku?.trim();

      const categoriaId =
        Number(fila.categoria_id);

      const unidadMedida =
        fila.unidad_medida?.trim();

      const puntoReorden =
        fila.punto_reorden === undefined ||
        fila.punto_reorden === ""
          ? 0
          : Number(fila.punto_reorden);

      const cantidad =
        Number(fila.cantidad);

      if (!nombre) {
        resultados.errores.push({
          fila: numeroFila,
          sku: sku || null,
          error:
            "El nombre es obligatorio"
        });

        continue;
      }

      if (!sku) {
        resultados.errores.push({
          fila: numeroFila,
          sku: null,
          error:
            "El SKU es obligatorio"
        });

        continue;
      }

      if (
        !Number.isInteger(categoriaId) ||
        categoriaId <= 0
      ) {
        resultados.errores.push({
          fila: numeroFila,
          sku,
          error:
            "categoria_id debe ser un número válido"
        });

        continue;
      }

      if (!unidadMedida) {
        resultados.errores.push({
          fila: numeroFila,
          sku,
          error:
            "La unidad de medida es obligatoria"
        });

        continue;
      }

      if (
        !Number.isFinite(puntoReorden) ||
        puntoReorden < 0
      ) {
        resultados.errores.push({
          fila: numeroFila,
          sku,
          error:
            "El punto de reorden debe ser mayor o igual a 0"
        });

        continue;
      }

      if (
        !Number.isFinite(cantidad) ||
        cantidad <= 0
      ) {
        resultados.errores.push({
          fila: numeroFila,
          sku,
          error:
            "La cantidad debe ser mayor a 0"
        });

        continue;
      }

      try {
        await client.query("BEGIN");

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
            [categoriaId]
          );

        if (!categoriaResult.rows.length) {
          await client.query("ROLLBACK");

          resultados.errores.push({
            fila: numeroFila,
            sku,
            error:
              "La categoría no existe o está inactiva"
          });

          continue;
        }

        const categoria =
          categoriaResult.rows[0];

        if (
          !puedeUsarCategoriaParaAlta(
            categoria,
            req
          )
        ) {
          await client.query("ROLLBACK");

          resultados.errores.push({
            fila: numeroFila,
            sku,
            error:
              "No tienes permiso para utilizar esta categoría"
          });

          continue;
        }

        const productoExistente =
          await client.query(
            `
              SELECT
                p.id,
                p.nombre,
                p.sku,
                p.categoria_id,
                p.activo,

                c.tipo AS categoria_tipo,
                c.ubicacion_propietaria_id

              FROM productos p

              LEFT JOIN categorias c
                ON p.categoria_id = c.id

              WHERE LOWER(p.sku) =
                    LOWER($1)
              LIMIT 1
            `,
            [sku]
          );

        let productoId;

        if (productoExistente.rows.length) {
          const producto =
            productoExistente.rows[0];

          if (!producto.activo) {
            await client.query("ROLLBACK");

            resultados.errores.push({
              fila: numeroFila,
              sku,
              error:
                "El SKU corresponde a un producto inactivo"
            });

            continue;
          }

          const categoriaProducto = {
            tipo:
              producto.categoria_tipo,
            ubicacion_propietaria_id:
              producto.ubicacion_propietaria_id
          };

          if (
            !puedeUsarCategoriaParaAlta(
              categoriaProducto,
              req
            )
          ) {
            await client.query("ROLLBACK");

            resultados.errores.push({
              fila: numeroFila,
              sku,
              error:
                "No tienes permiso para agregar este producto"
            });

            continue;
          }

          productoId =
            Number(producto.id);

          resultados.productos_existentes++;
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
                sku,
                categoriaId,
                unidadMedida,
                puntoReorden
              ]
            );

          productoId =
            Number(
              productoCreado.rows[0].id
            );

          resultados.productos_creados++;
        }

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
          `,
          [
            Number(ubicacion.id),
            productoId,
            cantidad
          ]
        );

        await client.query("COMMIT");

        resultados.agregados++;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {}

        resultados.errores.push({
          fila: numeroFila,
          sku,
          error:
            error.code === "23505"
              ? "El SKU ya existe y no pudo ser procesado"
              : error.message
        });
      }
    }

    return res.status(200).json({
      message:
        "Importación CSV procesada",
      ubicacion: {
        id: ubicacion.id,
        nombre: ubicacion.nombre
      },
      resumen: {
        total_filas:
          resultados.total,

        agregados:
          resultados.agregados,

        productos_creados:
          resultados.productos_creados,

        productos_existentes:
          resultados.productos_existentes,

        filas_con_error:
          resultados.errores.length
      },
      errores:
        resultados.errores
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Error al importar el inventario desde CSV",
      error: error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// AJUSTE DESCENTRALIZADO DE STOCK
// CADA USUARIO MODIFICA SU PROPIO INVENTARIO
// =========================================================

const ajustarStock = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!req.usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    const {
      producto_id,
      cantidad_nueva,
      motivo
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

    const ubicacionObjetivo = Number(
      req.usuario.ubicacion_id
    );

    if (!Number.isFinite(ubicacionObjetivo)) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    if (
      esPrincipal(req) &&
      ubicacionObjetivo !== CENTRAL_ID
    ) {
      return res.status(403).json({
        message:
          "Central solo puede modificar el inventario de Central"
      });
    }

    await client.query("BEGIN");

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

    if (!inventarioResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message:
          "El artículo no existe actualmente en el inventario de esta ubicación. Usa 'Agregar artículo' para darlo de alta."
      });
    }

    const registro =
      inventarioResult.rows[0];

    const cantidadAnterior =
      Number(registro.cantidad);

    const cantidadNueva =
      Number(cantidad_nueva);

    if (
      cantidadAnterior ===
      cantidadNueva
    ) {
      await client.query("ROLLBACK");

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
          $6,
          $7,
          $8
        )
      `,
      [
        ubicacionObjetivo,
        Number(producto_id),
        Number(req.usuario.id),
        tipoMovimiento,
        cantidadMovimiento,
        "ajuste_stock",
        registro.id,
        motivo.trim()
      ]
    );

    await client.query("COMMIT");

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
      await client.query("ROLLBACK");
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