const pool = require("../config/db");

const getUbicaciones = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        nombre,
        tipo,
        puede_solicitar_a_nombre_de_otra,
        activo,
        created_at
      FROM ubicaciones
      ORDER BY nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener las ubicaciones",
      error: error.message
    });
  }
};

const createUbicacion = async (req, res) => {
  try {
    const {
      nombre,
      tipo,
      puede_solicitar_a_nombre_de_otra = false
    } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({
        message: "El nombre y el tipo son obligatorios"
      });
    }

    const tiposValidos = [
      "central",
      "sucursal",
      "equipo_interno"
    ];

    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        message: "Tipo de ubicación no válido"
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO ubicaciones (
          nombre,
          tipo,
          puede_solicitar_a_nombre_de_otra
        )
        VALUES (?, ?, ?)
      `,
      [
        nombre,
        tipo,
        puede_solicitar_a_nombre_de_otra
      ]
    );

    res.status(201).json({
      message: "Ubicación creada correctamente",
      id: result.insertId
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al crear la ubicación",
      error: error.message
    });
  }
};

module.exports = {
  getUbicaciones,
  createUbicacion
};