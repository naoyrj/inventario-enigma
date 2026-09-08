const pool = require("../config/db");

const validarAdminCentral = (req, res) => {
  if (
    req.usuario.rol !== "principal" ||
    req.usuario.nivel_permiso !== "aprobador_admin"
  ) {
    res.status(403).json({
      message:
        "Solo un Aprobador/Administrador de Central puede gestionar proveedores"
    });

    return false;
  }

  return true;
};

const getProveedores = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        nombre,
        contacto,
        telefono,
        email,
        activo,
        created_at
      FROM proveedores
      ORDER BY nombre
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener proveedores",
      error: error.message
    });
  }
};

const getProveedorById = async (req, res) => {
  try {
    const { id } = req.params;

    const proveedorResult = await pool.query(
      `
        SELECT *
        FROM proveedores
        WHERE id = $1
      `,
      [id]
    );

    if (proveedorResult.rows.length === 0) {
      return res.status(404).json({
        message: "Proveedor no encontrado"
      });
    }

    const productosResult = await pool.query(
      `
        SELECT
          p.id,
          p.nombre,
          p.sku,
          p.unidad_medida
        FROM proveedor_productos pp
        INNER JOIN productos p
          ON pp.producto_id = p.id
        WHERE pp.proveedor_id = $1
        ORDER BY p.nombre
      `,
      [id]
    );

    res.json({
      proveedor: proveedorResult.rows[0],
      productos: productosResult.rows
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el proveedor",
      error: error.message
    });
  }
};

const createProveedor = async (req, res) => {
  try {
    if (!validarAdminCentral(req, res)) return;

    const {
      nombre,
      contacto,
      telefono,
      email
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        message: "El nombre del proveedor es obligatorio"
      });
    }

    const result = await pool.query(
      `
        INSERT INTO proveedores (
          nombre,
          contacto,
          telefono,
          email
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        nombre.trim(),
        contacto || null,
        telefono || null,
        email || null
      ]
    );

    res.status(201).json({
      message: "Proveedor creado correctamente",
      id: result.rows[0].id
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear proveedor",
      error: error.message
    });
  }
};

const asociarProducto = async (req, res) => {
  try {
    if (!validarAdminCentral(req, res)) return;

    const proveedorId = Number(req.params.id);
    const productoId = Number(req.body.producto_id);

    if (!productoId) {
      return res.status(400).json({
        message: "producto_id es obligatorio"
      });
    }

    const proveedorResult = await pool.query(
      `
        SELECT id
        FROM proveedores
        WHERE id = $1
          AND activo = TRUE
      `,
      [proveedorId]
    );

    if (proveedorResult.rows.length === 0) {
      return res.status(404).json({
        message: "Proveedor no encontrado o inactivo"
      });
    }

    const productoResult = await pool.query(
      `
        SELECT id
        FROM productos
        WHERE id = $1
          AND activo = TRUE
      `,
      [productoId]
    );

    if (productoResult.rows.length === 0) {
      return res.status(404).json({
        message: "Producto no encontrado o inactivo"
      });
    }

    await pool.query(
      `
        INSERT INTO proveedor_productos (
          proveedor_id,
          producto_id
        )
        VALUES ($1, $2)
        ON CONFLICT (proveedor_id, producto_id)
        DO NOTHING
      `,
      [proveedorId, productoId]
    );

    res.json({
      message: "Producto asociado al proveedor correctamente"
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(400).json({
        message: "Proveedor o producto no válido"
      });
    }

    res.status(500).json({
      message: "Error al asociar el producto",
      error: error.message
    });
  }
};

module.exports = {
  getProveedores,
  getProveedorById,
  createProveedor,
  asociarProducto
};