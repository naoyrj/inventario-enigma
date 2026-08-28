const pool = require("../config/db");

const getProductos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
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
        c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c
        ON p.categoria_id = c.id
      ORDER BY p.nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener los productos",
      error: error.message
    });
  }
};

const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
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
          c.nombre AS categoria_nombre
        FROM productos p
        LEFT JOIN categorias c
          ON p.categoria_id = c.id
        WHERE p.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Producto no encontrado"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el producto",
      error: error.message
    });
  }
};

const createProducto = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      sku,
      categoria_id,
      unidad_medida,
      punto_reorden = 0
    } = req.body;

    if (!nombre || !sku || !unidad_medida) {
      return res.status(400).json({
        message: "Nombre, SKU y unidad de medida son obligatorios"
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO productos (
          nombre,
          descripcion,
          sku,
          categoria_id,
          unidad_medida,
          punto_reorden
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        nombre.trim(),
        descripcion || null,
        sku.trim(),
        categoria_id || null,
        unidad_medida.trim(),
        punto_reorden
      ]
    );

    res.status(201).json({
      message: "Producto creado correctamente",
      id: result.insertId
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Ya existe un producto con ese SKU"
      });
    }

    res.status(500).json({
      message: "Error al crear el producto",
      error: error.message
    });
  }
};

const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      descripcion,
      sku,
      categoria_id,
      unidad_medida,
      punto_reorden,
      activo
    } = req.body;

    const [rows] = await pool.query(
      "SELECT id FROM productos WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Producto no encontrado"
      });
    }

    await pool.query(
      `
        UPDATE productos
        SET
          nombre = ?,
          descripcion = ?,
          sku = ?,
          categoria_id = ?,
          unidad_medida = ?,
          punto_reorden = ?,
          activo = ?
        WHERE id = ?
      `,
      [
        nombre,
        descripcion || null,
        sku,
        categoria_id || null,
        unidad_medida,
        punto_reorden,
        activo,
        id
      ]
    );

    res.json({
      message: "Producto actualizado correctamente"
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar el producto",
      error: error.message
    });
  }
};

const deactivateProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      "UPDATE productos SET activo = FALSE WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Producto no encontrado"
      });
    }

    res.json({
      message: "Producto desactivado correctamente"
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al desactivar el producto",
      error: error.message
    });
  }
};

module.exports = {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deactivateProducto
};