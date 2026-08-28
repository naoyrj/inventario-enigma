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
    const [rows] = await pool.query(`
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

    res.json(rows);
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

    const [proveedores] = await pool.query(
      `
        SELECT *
        FROM proveedores
        WHERE id = ?
      `,
      [id]
    );

    if (proveedores.length === 0) {
      return res.status(404).json({
        message: "Proveedor no encontrado"
      });
    }

    const [productos] = await pool.query(
      `
        SELECT
          p.id,
          p.nombre,
          p.sku,
          p.unidad_medida
        FROM proveedor_productos pp
        INNER JOIN productos p
          ON pp.producto_id = p.id
        WHERE pp.proveedor_id = ?
        ORDER BY p.nombre
      `,
      [id]
    );

    res.json({
      proveedor: proveedores[0],
      productos
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

    const [result] = await pool.query(
      `
        INSERT INTO proveedores (
          nombre,
          contacto,
          telefono,
          email
        )
        VALUES (?, ?, ?, ?)
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
      id: result.insertId
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

    const [proveedor] = await pool.query(
      `
        SELECT id
        FROM proveedores
        WHERE id = ? AND activo = 1
      `,
      [proveedorId]
    );

    if (proveedor.length === 0) {
      return res.status(404).json({
        message: "Proveedor no encontrado o inactivo"
      });
    }

    const [producto] = await pool.query(
      `
        SELECT id
        FROM productos
        WHERE id = ? AND activo = 1
      `,
      [productoId]
    );

    if (producto.length === 0) {
      return res.status(404).json({
        message: "Producto no encontrado o inactivo"
      });
    }

    await pool.query(
      `
        INSERT IGNORE INTO proveedor_productos (
          proveedor_id,
          producto_id
        )
        VALUES (?, ?)
      `,
      [proveedorId, productoId]
    );

    res.json({
      message: "Producto asociado al proveedor correctamente"
    });
  } catch (error) {
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