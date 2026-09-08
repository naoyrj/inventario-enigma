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

  const categoriaResult = await client.query(
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

  if (categoriaResult.rows.length === 0) {
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
  // Central puede administrar únicamente productos
  // pertenecientes a categorías globales.
  //
  // Las categorías privadas son visibles para Central,
  // pero son de solo lectura.
  // -------------------------------------------------------

  if (esPrincipal(usuario)) {
    if (categoria.tipo === "privada") {
      return {
        permitido: false,
        status: 403,
        message:
          "Central solo puede consultar productos de categorías privadas"
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
  // Puede administrar productos únicamente dentro de sus
  // propias categorías privadas.
  // -------------------------------------------------------

  if (esEquipoInterno(usuario)) {
    if (categoria.tipo !== "privada") {
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
      Number(usuario.ubicacion_id)
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
  if (esPrincipal(usuario)) {
    return true;
  }

  if (
    !producto.categoria_tipo ||
    producto.categoria_tipo === "global"
  ) {
    return true;
  }

  if (
    esEquipoInterno(usuario) &&
    producto.categoria_tipo === "privada" &&
    Number(
      producto.categoria_ubicacion_propietaria_id
    ) ===
      Number(usuario.ubicacion_id)
  ) {
    return true;
  }

  return false;
};


// =========================================================
// OBTENER PRODUCTOS
// =========================================================

const getProductos = async (req, res) => {
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

        c.id AS categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,
        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        u.nombre
          AS categoria_ubicacion_propietaria_nombre

      FROM productos p

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      LEFT JOIN ubicaciones u
        ON c.ubicacion_propietaria_id = u.id
    `;

    const parametros = [];

    // -----------------------------------------------------
    // CENTRAL
    // -----------------------------------------------------
    // Ve todos los productos.
    // -----------------------------------------------------

    if (esPrincipal(usuario)) {
      query += `
        ORDER BY p.nombre
      `;
    }

    // -----------------------------------------------------
    // EQUIPO INTERNO
    // -----------------------------------------------------
    // Ve:
    // - productos sin categoría
    // - categorías globales
    // - sus propias categorías privadas
    // -----------------------------------------------------

    else if (esEquipoInterno(usuario)) {
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
            c.ubicacion_propietaria_id = $1
          )

        ORDER BY p.nombre
      `;
    }

    // -----------------------------------------------------
    // SUCURSAL
    // -----------------------------------------------------
    // Ve únicamente catálogo global.
    // -----------------------------------------------------

    else if (esSucursal(usuario)) {
      query += `
        WHERE
          c.id IS NULL
          OR c.tipo = 'global'

        ORDER BY p.nombre
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

          solo_lectura:
            producto.categoria_tipo ===
              "privada" &&
            esPrincipal(usuario)
        })
      );

    res.json(productos);
  } catch (error) {
    console.error(
      "Error getProductos:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener los productos",
      error:
        error.message
    });
  }
};


// =========================================================
// OBTENER PRODUCTO POR ID
// =========================================================

const getProductoById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

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

            c.id AS categoria_id,
            c.nombre AS categoria_nombre,
            c.tipo AS categoria_tipo,

            c.ubicacion_propietaria_id
              AS categoria_ubicacion_propietaria_id,

            u.nombre
              AS categoria_ubicacion_propietaria_nombre

          FROM productos p

          LEFT JOIN categorias c
            ON p.categoria_id = c.id

          LEFT JOIN ubicaciones u
            ON c.ubicacion_propietaria_id = u.id

          WHERE p.id = $1
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
      producto.categoria_tipo ===
        "privada" &&
      esPrincipal(usuario);

    res.json(producto);
  } catch (error) {
    console.error(
      "Error getProductoById:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener el producto",
      error:
        error.message
    });
  }
};


// =========================================================
// CREAR PRODUCTO
// =========================================================

const createProducto = async (
  req,
  res
) => {
  const client =
    await pool.connect();

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
      punto_reorden = 0
    } = req.body;

    if (
      !nombre?.trim() ||
      !sku?.trim() ||
      !unidad_medida?.trim()
    ) {
      return res.status(400).json({
        message:
          "Nombre, SKU y unidad de medida son obligatorios"
      });
    }

    const puntoReordenNumero =
      Number(punto_reorden);

    if (
      Number.isNaN(
        puntoReordenNumero
      ) ||
      puntoReordenNumero < 0
    ) {
      return res.status(400).json({
        message:
          "El punto de reorden debe ser un número mayor o igual a cero"
      });
    }

    const validacion =
      await validarCategoriaParaUsuario(
        client,
        categoria_id,
        usuario
      );

    if (!validacion.permitido) {
      return res
        .status(
          validacion.status
        )
        .json({
          message:
            validacion.message
        });
    }

    const result =
      await client.query(
        `
          INSERT INTO productos (
            nombre,
            descripcion,
            sku,
            categoria_id,
            unidad_medida,
            punto_reorden
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          RETURNING id
        `,
        [
          nombre.trim(),

          descripcion?.trim() ||
            null,

          sku.trim(),

          categoria_id ||
            null,

          unidad_medida.trim(),

          puntoReordenNumero
        ]
      );

    res.status(201).json({
      message:
        "Producto creado correctamente",

      id:
        result.rows[0].id
    });
  } catch (error) {
    console.error(
      "Error createProducto:",
      error
    );

    if (
      error.code === "23505"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Ya existe un producto con ese SKU"
        });
    }

    if (
      error.code === "23503"
    ) {
      return res
        .status(400)
        .json({
          message:
            "La categoría indicada no existe"
        });
    }

    res.status(500).json({
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
// =========================================================

const updateProducto = async (
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

    const {
      nombre,
      descripcion,
      sku,
      categoria_id,
      unidad_medida,
      punto_reorden,
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

            c.tipo AS categoria_tipo,
            c.ubicacion_propietaria_id
              AS categoria_ubicacion_propietaria_id

          FROM productos p

          LEFT JOIN categorias c
            ON p.categoria_id = c.id

          WHERE p.id = $1
        `,
        [id]
      );

    if (
      productoResult.rows.length === 0
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

    // -----------------------------------------------------
    // CENTRAL NO MODIFICA PRODUCTOS PRIVADOS
    // -----------------------------------------------------

    if (
      esPrincipal(usuario) &&
      productoActual.categoria_tipo ===
        "privada"
    ) {
      return res.status(403).json({
        message:
          "Central solo puede consultar productos de categorías privadas"
      });
    }

    // -----------------------------------------------------
    // EQUIPO INTERNO SOLO MODIFICA PRODUCTOS PRIVADOS PROPIOS
    // -----------------------------------------------------

    if (
      esEquipoInterno(usuario)
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

    if (
      esSucursal(usuario)
    ) {
      return res.status(403).json({
        message:
          "Las sucursales no pueden modificar productos"
      });
    }

    if (
      !nombre?.trim() ||
      !sku?.trim() ||
      !unidad_medida?.trim()
    ) {
      return res.status(400).json({
        message:
          "Nombre, SKU y unidad de medida son obligatorios"
      });
    }

    const puntoReordenNumero =
      Number(punto_reorden);

    if (
      Number.isNaN(
        puntoReordenNumero
      ) ||
      puntoReordenNumero < 0
    ) {
      return res.status(400).json({
        message:
          "El punto de reorden debe ser un número mayor o igual a cero"
      });
    }

    const validacionCategoria =
      await validarCategoriaParaUsuario(
        client,
        categoria_id,
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

    const activoFinal =
      typeof activo === "boolean"
        ? activo
        : productoActual.activo;

    const result =
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

          WHERE id = $8

          RETURNING id
        `,
        [
          nombre.trim(),

          descripcion?.trim() ||
            null,

          sku.trim(),

          categoria_id ||
            null,

          unidad_medida.trim(),

          puntoReordenNumero,

          activoFinal,

          id
        ]
      );

    res.json({
      message:
        "Producto actualizado correctamente",

      id:
        result.rows[0].id
    });
  } catch (error) {
    console.error(
      "Error updateProducto:",
      error
    );

    if (
      error.code === "23505"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Ya existe un producto con ese SKU"
        });
    }

    if (
      error.code === "23503"
    ) {
      return res
        .status(400)
        .json({
          message:
            "La categoría indicada no existe"
        });
    }

    res.status(500).json({
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

const deactivateProducto = async (
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

          WHERE p.id = $1
        `,
        [id]
      );

    if (
      productoResult.rows.length === 0
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

    // -----------------------------------------------------
    // CENTRAL
    // -----------------------------------------------------

    if (
      esPrincipal(usuario) &&
      producto.categoria_tipo ===
        "privada"
    ) {
      return res.status(403).json({
        message:
          "Central solo puede consultar productos de categorías privadas"
      });
    }

    // -----------------------------------------------------
    // EQUIPO INTERNO
    // -----------------------------------------------------

    if (
      esEquipoInterno(usuario)
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

    // -----------------------------------------------------
    // SUCURSAL
    // -----------------------------------------------------

    if (
      esSucursal(usuario)
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

          SET activo = FALSE

          WHERE id = $1

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

    res.json({
      message:
        "Producto desactivado correctamente"
    });
  } catch (error) {
    console.error(
      "Error deactivateProducto:",
      error
    );

    res.status(500).json({
      message:
        "Error al desactivar el producto",

      error:
        error.message
    });
  } finally {
    client.release();
  }
};


module.exports = {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deactivateProducto
};