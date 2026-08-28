const pool = require("../config/db");

const getCategorias = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        nombre,
        descripcion,
        activo,
        created_at
      FROM categorias
      ORDER BY nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener las categorías",
      error: error.message
    });
  }
};

const createCategoria = async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        message: "El nombre de la categoría es obligatorio"
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO categorias (
          nombre,
          descripcion
        )
        VALUES (?, ?)
      `,
      [
        nombre.trim(),
        descripcion || null
      ]
    );

    res.status(201).json({
      message: "Categoría creada correctamente",
      id: result.insertId
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "Ya existe una categoría con ese nombre"
      });
    }

    res.status(500).json({
      message: "Error al crear la categoría",
      error: error.message
    });
  }
};

module.exports = {
  getCategorias,
  createCategoria
};