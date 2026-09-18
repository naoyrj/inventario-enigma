const pool = require("../config/db");

// =========================================================
// FUNCIONES AUXILIARES
// =========================================================

const esPrincipal = (usuario) => {
  return usuario?.rol === "principal";
};

const esEquipoInterno = (usuario) => {
  return usuario?.rol === "equipo_interno";
};

const esSucursal = (usuario) => {
  return usuario?.rol === "sucursal";
};

const generarSku = () => {
  const fecha = Date.now();

  const aleatorio = Math.floor(
    1000 + Math.random() * 9000
  );

  return `AUTO-${fecha}-${aleatorio}`;
};

// =========================================================
// VALIDAR CATEGORÍA PARA CREAR / EDITAR PRODUCTOS
// =========================================================

const validarCategoriaParaUsuario = async (
  client,
  categoriaId,
  usuario
) => {
  if (!categoriaId) {
    if (esPrincipal(usuario)) {
      return {
        permitido: true,
        categoria: null
      };
    }

    return {
      permitido: false,
      status: 400,
      message:
        "Debes seleccionar una categoría válida"
    };
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
      `,
      [categoriaId]
    );

  if (
    categoriaResult.rows.length === 0
  ) {
    return {
      permitido: false,
      status: 400,
      message:
        "La categoría indicada no existe"
    };
  }

  const categoria =
    categoriaResult.rows[0];

  if (!categoria.activo) {
    return {
      permitido: false,
      status: 400,
      message:
        "La categoría seleccionada está inactiva"
    };
  }

  // -------------------------------------------------------
  // CENTRAL
  // -------------------------------------------------------

  if (esPrincipal(usuario)) {
    if (
      categoria.tipo === "privada"
    ) {
      return {
        permitido: false,
        status: 403,
        message:
          "Central no puede administrar productos de categorías privadas de Equipos Internos"
      };
    }

    return {
      permitido: true,
      categoria
    };
  }

  // -------------------------------------------------------
  // EQUIPO INTERNO
  // -------------------------------------------------------

  if (esEquipoInterno(usuario)) {
    if (
      categoria.tipo !== "privada"
    ) {
      return {
        permitido: false,
        status: 403,
        message:
          "Un Equipo Interno solo puede administrar productos dentro de sus categorías privadas"
      };
    }

    if (
      Number(
        categoria.ubicacion_propietaria_id
      ) !==
      Number(
        usuario.ubicacion_id
      )
    ) {
      return {
        permitido: false,
        status: 403,
        message:
          "No tienes permiso para utilizar una categoría privada de otro Equipo Interno"
      };
    }

    return {
      permitido: true,
      categoria
    };
  }

  // -------------------------------------------------------
  // SUCURSAL
  // -------------------------------------------------------

  if (esSucursal(usuario)) {
    return {
      permitido: false,
      status: 403,
      message:
        "Las sucursales no pueden administrar productos"
    };
  }

  return {
    permitido: false,
    status: 403,
    message:
      "No tienes permiso para administrar productos"
  };
};

// =========================================================
// VALIDAR ACCESO A UN PRODUCTO
// =========================================================

const puedeVerProducto = (
  producto,
  usuario
) => {
  if (
    !producto.categoria_tipo ||
    producto.categoria_tipo ===
      "global"
  ) {
    return true;
  }

  if (
    esEquipoInterno(usuario) &&
    producto.categoria_tipo ===
      "privada" &&
    Number(
      producto
        .categoria_ubicacion_propietaria_id
    ) ===
      Number(
        usuario.ubicacion_id
      )
  ) {
    return true;
  }

  return false;
};

// =========================================================
// OBTENER PRODUCTOS
// =========================================================

const getProductos = async (
  req,
  res
) => {
  try {
    const usuario = req.usuario;

    if (!usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    let query = `
      SELECT
        p.id,
        p.nombre,
        p.descripcion,
        p.sku,
        p.unidad_medida,
        p.punto_reorden,
        p.activo,
        p.created_at,

        CASE
          WHEN p.imagen IS NOT NULL
          THEN TRUE
          ELSE FALSE
        END AS tiene_imagen,

        p.imagen_tipo,

        c.id AS categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,

        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        u.nombre
          AS categoria_ubicacion_propietaria_nombre,

        (
          SELECT
            pp.proveedor_id
          FROM proveedor_productos pp
          INNER JOIN proveedores pr
            ON pr.id = pp.proveedor_id
          WHERE
            pp.producto_id = p.id
            AND pr.activo = TRUE
          ORDER BY
            pr.nombre
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
            WHERE
              pp.producto_id = p.id
              AND pr.activo = TRUE
          ),
          'Sin proveedor'
        ) AS proveedor_nombre

      FROM productos p

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      LEFT JOIN ubicaciones u
        ON c.ubicacion_propietaria_id =
           u.id
    `;

    const parametros = [];

    // -----------------------------------------------------
    // CENTRAL
    // -----------------------------------------------------

    if (esPrincipal(usuario)) {
      query += `
        WHERE
          c.id IS NULL
          OR c.tipo = 'global'

        ORDER BY
          p.nombre
      `;
    }

    // -----------------------------------------------------
    // EQUIPO INTERNO
    // -----------------------------------------------------

    else if (
      esEquipoInterno(usuario)
    ) {
      parametros.push(
        usuario.ubicacion_id
      );

      query += `
        WHERE
          c.id IS NULL

          OR c.tipo = 'global'

          OR (
            c.tipo = 'privada'

            AND
            c.ubicacion_propietaria_id =
              $1
          )

        ORDER BY
          p.nombre
      `;
    }

    // -----------------------------------------------------
    // SUCURSAL
    // -----------------------------------------------------

    else if (
      esSucursal(usuario)
    ) {
      query += `
        WHERE
          c.id IS NULL
          OR c.tipo = 'global'

        ORDER BY
          p.nombre
      `;
    }

    else {
      return res.status(403).json({
        message:
          "No tienes permiso para consultar productos"
      });
    }

    const result =
      await pool.query(
        query,
        parametros
      );

    const productos =
      result.rows.map(
        (producto) => ({
          ...producto,
          solo_lectura: false
        })
      );

    return res.json(
      productos
    );
  } catch (error) {
    console.error(
      "Error getProductos:",
      error
    );

    return res.status(500).json({
      message:
        "Error al obtener los productos",

      error:
        error.message
    });
  }
};

// =========================================================
// OBTENER PRODUCTO POR ID
// ENI-45:
// - INCLUYE PROVEEDOR
// - INCLUYE CATEGORÍA
// - INDICA SI TIENE IMAGEN
// =========================================================

const getProductoById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const usuario =
      req.usuario;

    if (!usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const result =
      await pool.query(
        `
          SELECT
            p.id,
            p.nombre,
            p.descripcion,
            p.sku,
            p.unidad_medida,
            p.punto_reorden,
            p.activo,
            p.created_at,

            CASE
              WHEN p.imagen IS NOT NULL
              THEN TRUE
              ELSE FALSE
            END AS tiene_imagen,

            p.imagen_tipo,

            c.id AS categoria_id,
            c.nombre AS categoria_nombre,
            c.tipo AS categoria_tipo,

            c.ubicacion_propietaria_id
              AS categoria_ubicacion_propietaria_id,

            u.nombre
              AS categoria_ubicacion_propietaria_nombre,

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
                AND pr.activo = TRUE
              ORDER BY
                pr.nombre
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
                  ON pr.id =
                     pp.proveedor_id
                WHERE
                  pp.producto_id =
                    p.id
                  AND pr.activo = TRUE
              ),
              'Sin proveedor'
            ) AS proveedor_nombre

          FROM productos p

          LEFT JOIN categorias c
            ON p.categoria_id = c.id

          LEFT JOIN ubicaciones u
            ON c.ubicacion_propietaria_id =
               u.id

          WHERE
            p.id = $1
        `,
        [id]
      );

    if (
      result.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "Producto no encontrado"
      });
    }

    const producto =
      result.rows[0];

    if (
      !puedeVerProducto(
        producto,
        usuario
      )
    ) {
      return res.status(404).json({
        message:
          "Producto no encontrado"
      });
    }

    producto.solo_lectura =
      false;

    return res.json(
      producto
    );
  } catch (error) {
    console.error(
      "Error getProductoById:",
      error
    );

    return res.status(500).json({
      message:
        "Error al obtener el producto",

      error:
        error.message
    });
  }
};

// =========================================================
// OBTENER IMAGEN DEL PRODUCTO
// =========================================================

const getImagenProducto =
  async (
    req,
    res
  ) => {
    try {
      const { id } =
        req.params;

      const usuario =
        req.usuario;

      if (!usuario) {
        return res.status(401).json({
          message:
            "Usuario no autenticado"
        });
      }

      const result =
        await pool.query(
          `
            SELECT
              p.id,
              p.imagen,
              p.imagen_tipo,

              c.tipo AS categoria_tipo,

              c.ubicacion_propietaria_id
                AS categoria_ubicacion_propietaria_id

            FROM productos p

            LEFT JOIN categorias c
              ON p.categoria_id = c.id

            WHERE
              p.id = $1
          `,
          [id]
        );

      if (
        result.rows.length ===
        0
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      const producto =
        result.rows[0];

      if (
        !puedeVerProducto(
          producto,
          usuario
        )
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      if (!producto.imagen) {
        return res.status(404).json({
          message:
            "El producto no tiene imagen"
        });
      }

      res.set(
        "Content-Type",
        producto.imagen_tipo ||
          "application/octet-stream"
      );

      res.set(
        "Cache-Control",
        "private, max-age=300"
      );

      return res.send(
        producto.imagen
      );
    } catch (error) {
      console.error(
        "Error getImagenProducto:",
        error
      );

      return res.status(500).json({
        message:
          "Error al obtener la imagen del producto",

        error:
          error.message
      });
    }
  };

// =========================================================
// CREAR PRODUCTO
// ENI-45:
// - SKU OPCIONAL
// - IMAGEN OPCIONAL
// =========================================================

const createProducto = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    const usuario =
      req.usuario;

    if (!usuario) {
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
      proveedor_id
    } = req.body;

    if (
      !nombre?.trim() ||
      !unidad_medida?.trim()
    ) {
      return res.status(400).json({
        message:
          "Nombre y unidad de medida son obligatorios"
      });
    }

    const puntoReordenNumero =
      punto_reorden === "" ||
      punto_reorden === null ||
      punto_reorden === undefined
        ? 0
        : Number(
            punto_reorden
          );

    if (
      !Number.isFinite(
        puntoReordenNumero
      ) ||
      puntoReordenNumero < 0
    ) {
      return res.status(400).json({
        message:
          "El punto de reorden debe ser un número mayor o igual a cero"
      });
    }

    const categoriaIdFinal =
      categoria_id === "" ||
      categoria_id === null ||
      categoria_id === undefined
        ? null
        : Number(
            categoria_id
          );

    if (
      categoriaIdFinal !== null &&
      (
        !Number.isInteger(
          categoriaIdFinal
        ) ||
        categoriaIdFinal <= 0
      )
    ) {
      return res.status(400).json({
        message:
          "La categoría seleccionada no es válida"
      });
    }

    const validacion =
      await validarCategoriaParaUsuario(
        client,
        categoriaIdFinal,
        usuario
      );

    if (
      !validacion.permitido
    ) {
      return res
        .status(
          validacion.status
        )
        .json({
          message:
            validacion.message
        });
    }

    let proveedorIdFinal =
      null;

    if (
      proveedor_id !== undefined &&
      proveedor_id !== null &&
      proveedor_id !== ""
    ) {
      if (
        !esPrincipal(
          usuario
        )
      ) {
        return res.status(403).json({
          message:
            "Solo Central puede asignar proveedores a los productos"
        });
      }

      proveedorIdFinal =
        Number(
          proveedor_id
        );

      if (
        !Number.isInteger(
          proveedorIdFinal
        ) ||
        proveedorIdFinal <= 0
      ) {
        return res.status(400).json({
          message:
            "El proveedor seleccionado no es válido"
        });
      }

      const proveedorResult =
        await client.query(
          `
            SELECT
              id
            FROM proveedores
            WHERE
              id = $1
              AND activo = TRUE
          `,
          [
            proveedorIdFinal
          ]
        );

      if (
        !proveedorResult.rows.length
      ) {
        return res.status(400).json({
          message:
            "El proveedor seleccionado no existe o está inactivo"
        });
      }
    }

    const skuFinal =
      sku?.trim() ||
      generarSku();

    const imagen =
      req.file?.buffer ||
      null;

    const imagenTipo =
      req.file?.mimetype ||
      null;

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const result =
      await client.query(
        `
          INSERT INTO productos (
            nombre,
            descripcion,
            sku,
            categoria_id,
            unidad_medida,
            punto_reorden,
            imagen,
            imagen_tipo
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
          RETURNING id
        `,
        [
          nombre.trim(),
          descripcion?.trim() ||
            null,
          skuFinal,
          categoriaIdFinal,
          unidad_medida.trim(),
          puntoReordenNumero,
          imagen,
          imagenTipo
        ]
      );

    const productoId =
      Number(
        result.rows[0].id
      );

    if (proveedorIdFinal) {
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
          proveedorIdFinal,
          productoId
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    return res.status(201).json({
      message:
        "Producto creado correctamente",

      id:
        productoId,

      sku:
        skuFinal,

      tiene_imagen:
        Boolean(imagen)
    });
  } catch (error) {
    if (
      transaccionIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}
    }

    console.error(
      "Error createProducto:",
      error
    );

    if (
      error.code === "23505"
    ) {
      return res.status(409).json({
        message:
          "Ya existe un producto con ese SKU"
      });
    }

    if (
      error.code === "23503"
    ) {
      return res.status(400).json({
        message:
          "La categoría o proveedor indicado no existe"
      });
    }

    return res.status(500).json({
      message:
        "Error al crear el producto",

      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// ACTUALIZAR PRODUCTO
// ENI-45:
// - SKU OPCIONAL
// - PROVEEDOR EDITABLE PARA CENTRAL
// - CATEGORÍA EDITABLE
// - IMAGEN OPCIONAL / REEMPLAZABLE
// =========================================================

const updateProducto =
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

      const usuario =
        req.usuario;

      if (!usuario) {
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
        punto_reorden,
        proveedor_id,
        activo
      } = req.body;

      const productoResult =
        await client.query(
          `
            SELECT
              p.id,
              p.nombre,
              p.descripcion,
              p.sku,
              p.unidad_medida,
              p.punto_reorden,
              p.activo,
              p.categoria_id,

              CASE
                WHEN p.imagen IS NOT NULL
                THEN TRUE
                ELSE FALSE
              END AS tiene_imagen,

              c.tipo
                AS categoria_tipo,

              c.ubicacion_propietaria_id
                AS categoria_ubicacion_propietaria_id

            FROM productos p

            LEFT JOIN categorias c
              ON p.categoria_id = c.id

            WHERE
              p.id = $1
          `,
          [id]
        );

      if (
        productoResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      const productoActual =
        productoResult.rows[0];

      if (
        !puedeVerProducto(
          productoActual,
          usuario
        )
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      // ---------------------------------------------------
      // CENTRAL NO MODIFICA PRODUCTOS PRIVADOS
      // ---------------------------------------------------

      if (
        esPrincipal(usuario) &&
        productoActual.categoria_tipo ===
          "privada"
      ) {
        return res.status(403).json({
          message:
            "Central no puede administrar productos de categorías privadas de Equipos Internos"
        });
      }

      // ---------------------------------------------------
      // EQUIPO INTERNO SOLO MODIFICA PRODUCTOS PRIVADOS PROPIOS
      // ---------------------------------------------------

      if (
        esEquipoInterno(
          usuario
        )
      ) {
        if (
          productoActual.categoria_tipo !==
            "privada" ||
          Number(
            productoActual
              .categoria_ubicacion_propietaria_id
          ) !==
            Number(
              usuario.ubicacion_id
            )
        ) {
          return res.status(403).json({
            message:
              "Solo puedes modificar productos de tus propias categorías privadas"
          });
        }
      }

      // ---------------------------------------------------
      // SUCURSAL
      // ---------------------------------------------------

      if (
        esSucursal(
          usuario
        )
      ) {
        return res.status(403).json({
          message:
            "Las sucursales no pueden modificar productos"
        });
      }

      // ---------------------------------------------------
      // CAMPOS OBLIGATORIOS ENI-45
      // ---------------------------------------------------

      if (
        !nombre?.trim() ||
        !unidad_medida?.trim()
      ) {
        return res.status(400).json({
          message:
            "Nombre y unidad de medida son obligatorios"
        });
      }

      const puntoReordenNumero =
        punto_reorden === "" ||
        punto_reorden === null ||
        punto_reorden === undefined
          ? 0
          : Number(
              punto_reorden
            );

      if (
        !Number.isFinite(
          puntoReordenNumero
        ) ||
        puntoReordenNumero < 0
      ) {
        return res.status(400).json({
          message:
            "El punto de reorden debe ser un número mayor o igual a cero"
        });
      }

      const categoriaIdFinal =
        categoria_id === "" ||
        categoria_id === null ||
        categoria_id === undefined
          ? null
          : Number(
              categoria_id
            );

      if (
        categoriaIdFinal !== null &&
        (
          !Number.isInteger(
            categoriaIdFinal
          ) ||
          categoriaIdFinal <= 0
        )
      ) {
        return res.status(400).json({
          message:
            "La categoría seleccionada no es válida"
        });
      }

      const validacionCategoria =
        await validarCategoriaParaUsuario(
          client,
          categoriaIdFinal,
          usuario
        );

      if (
        !validacionCategoria.permitido
      ) {
        return res
          .status(
            validacionCategoria.status
          )
          .json({
            message:
              validacionCategoria.message
          });
      }

      // ---------------------------------------------------
      // SKU
      // ---------------------------------------------------

      const skuFinal =
        sku?.trim() ||
        productoActual.sku ||
        generarSku();

      // ---------------------------------------------------
      // PROVEEDOR
      // ---------------------------------------------------

      let proveedorIdFinal =
        null;

      let actualizarProveedor =
        false;

      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "proveedor_id"
        )
      ) {
        if (
          !esPrincipal(
            usuario
          )
        ) {
          return res.status(403).json({
            message:
              "Solo Central puede modificar el proveedor de un producto"
          });
        }

        actualizarProveedor =
          true;

        if (
          proveedor_id !== undefined &&
          proveedor_id !== null &&
          proveedor_id !== ""
        ) {
          proveedorIdFinal =
            Number(
              proveedor_id
            );

          if (
            !Number.isInteger(
              proveedorIdFinal
            ) ||
            proveedorIdFinal <= 0
          ) {
            return res.status(400).json({
              message:
                "El proveedor seleccionado no es válido"
            });
          }

          const proveedorResult =
            await client.query(
              `
                SELECT
                  id,
                  nombre
                FROM proveedores
                WHERE
                  id = $1
                  AND activo = TRUE
              `,
              [
                proveedorIdFinal
              ]
            );

          if (
            !proveedorResult.rows.length
          ) {
            return res.status(400).json({
              message:
                "El proveedor seleccionado no existe o está inactivo"
            });
          }
        }
      }

      const activoFinal =
        typeof activo === "boolean"
          ? activo
          : activo === "true"
            ? true
            : activo === "false"
              ? false
              : productoActual.activo;

      const nuevaImagen =
        req.file?.buffer ||
        null;

      const nuevoTipoImagen =
        req.file?.mimetype ||
        null;

      await client.query(
        "BEGIN"
      );

      transaccionIniciada =
        true;

      let result;

      // ---------------------------------------------------
      // SI HAY UNA NUEVA IMAGEN, LA REEMPLAZAMOS.
      // SI NO HAY ARCHIVO, CONSERVAMOS LA ACTUAL.
      // ---------------------------------------------------

      if (nuevaImagen) {
        result =
          await client.query(
            `
              UPDATE productos

              SET
                nombre = $1,
                descripcion = $2,
                sku = $3,
                categoria_id = $4,
                unidad_medida = $5,
                punto_reorden = $6,
                activo = $7,
                imagen = $8,
                imagen_tipo = $9

              WHERE
                id = $10

              RETURNING id
            `,
            [
              nombre.trim(),

              descripcion?.trim() ||
                null,

              skuFinal,

              categoriaIdFinal,

              unidad_medida.trim(),

              puntoReordenNumero,

              activoFinal,

              nuevaImagen,

              nuevoTipoImagen,

              id
            ]
          );
      } else {
        result =
          await client.query(
            `
              UPDATE productos

              SET
                nombre = $1,
                descripcion = $2,
                sku = $3,
                categoria_id = $4,
                unidad_medida = $5,
                punto_reorden = $6,
                activo = $7

              WHERE
                id = $8

              RETURNING id
            `,
            [
              nombre.trim(),

              descripcion?.trim() ||
                null,

              skuFinal,

              categoriaIdFinal,

              unidad_medida.trim(),

              puntoReordenNumero,

              activoFinal,

              id
            ]
          );
      }

      // ---------------------------------------------------
      // PROVEEDOR
      // ---------------------------------------------------

      if (
        actualizarProveedor
      ) {
        await client.query(
          `
            DELETE FROM proveedor_productos

            WHERE
              producto_id = $1
          `,
          [id]
        );

        if (
          proveedorIdFinal
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

              ON CONFLICT (
                proveedor_id,
                producto_id
              )

              DO NOTHING
            `,
            [
              proveedorIdFinal,
              id
            ]
          );
        }
      }

      await client.query(
        "COMMIT"
      );

      transaccionIniciada =
        false;

      return res.json({
        message:
          "Producto actualizado correctamente",

        id:
          result.rows[0].id,

        sku:
          skuFinal,

        tiene_imagen:
          Boolean(
            nuevaImagen ||
            productoActual.tiene_imagen
          )
      });
    } catch (error) {
      if (
        transaccionIniciada
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {}
      }

      console.error(
        "Error updateProducto:",
        error
      );

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          message:
            "Ya existe un producto con ese SKU"
        });
      }

      if (
        error.code === "23503"
      ) {
        return res.status(400).json({
          message:
            "La categoría o proveedor indicado no existe"
        });
      }

      return res.status(500).json({
        message:
          "Error al actualizar el producto",

        error:
          error.message
      });
    } finally {
      client.release();
    }
  };

// =========================================================
// DESACTIVAR PRODUCTO
// =========================================================

const deactivateProducto =
  async (
    req,
    res
  ) => {
    const client =
      await pool.connect();

    try {
      const { id } =
        req.params;

      const usuario =
        req.usuario;

      if (!usuario) {
        return res.status(401).json({
          message:
            "Usuario no autenticado"
        });
      }

      const productoResult =
        await client.query(
          `
            SELECT
              p.id,
              p.categoria_id,

              c.tipo
                AS categoria_tipo,

              c.ubicacion_propietaria_id
                AS categoria_ubicacion_propietaria_id

            FROM productos p

            LEFT JOIN categorias c
              ON p.categoria_id = c.id

            WHERE
              p.id = $1
          `,
          [id]
        );

      if (
        productoResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      const producto =
        productoResult.rows[0];

      if (
        !puedeVerProducto(
          producto,
          usuario
        )
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      // ---------------------------------------------------
      // CENTRAL
      // ---------------------------------------------------

      if (
        esPrincipal(usuario) &&
        producto.categoria_tipo ===
          "privada"
      ) {
        return res.status(403).json({
          message:
            "Central no puede administrar productos de categorías privadas de Equipos Internos"
        });
      }

      // ---------------------------------------------------
      // EQUIPO INTERNO
      // ---------------------------------------------------

      if (
        esEquipoInterno(
          usuario
        )
      ) {
        if (
          producto.categoria_tipo !==
            "privada" ||
          Number(
            producto
              .categoria_ubicacion_propietaria_id
          ) !==
            Number(
              usuario.ubicacion_id
            )
        ) {
          return res.status(403).json({
            message:
              "Solo puedes desactivar productos de tus propias categorías privadas"
          });
        }
      }

      // ---------------------------------------------------
      // SUCURSAL
      // ---------------------------------------------------

      if (
        esSucursal(
          usuario
        )
      ) {
        return res.status(403).json({
          message:
            "Las sucursales no pueden desactivar productos"
        });
      }

      const result =
        await client.query(
          `
            UPDATE productos

            SET
              activo = FALSE

            WHERE
              id = $1

            RETURNING id
          `,
          [id]
        );

      if (
        result.rowCount === 0
      ) {
        return res.status(404).json({
          message:
            "Producto no encontrado"
        });
      }

      return res.json({
        message:
          "Producto desactivado correctamente"
      });
    } catch (error) {
      console.error(
        "Error deactivateProducto:",
        error
      );

      return res.status(500).json({
        message:
          "Error al desactivar el producto",

        error:
          error.message
      });
    } finally {
      client.release();
    }
  };

// =========================================================
// EXPORTACIONES
// =========================================================

module.exports = {
  getProductos,
  getProductoById,
  getImagenProducto,
  createProducto,
  updateProducto,
  deactivateProducto
};