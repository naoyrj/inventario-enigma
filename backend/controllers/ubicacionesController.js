const pool = require("../config/db");

const getUbicaciones = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        nombre,
        tipo,
        puede_solicitar_a_nombre_de_otra,
        activo,
        estado,
        created_at
      FROM ubicaciones
      ORDER BY nombre
    `);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener las ubicaciones",
      error: error.message
    });
  }
};

const getUbicacionById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
        SELECT
          id,
          nombre,
          tipo,
          puede_solicitar_a_nombre_de_otra,
          activo,
          estado,
          created_at
        FROM ubicaciones
        WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ubicación no encontrada"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la ubicación",
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
        message:
          "El nombre y el tipo son obligatorios"
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

    const nombreLimpio = nombre.trim();

    if (!nombreLimpio) {
      return res.status(400).json({
        message:
          "El nombre no puede estar vacío"
      });
    }

    const existe = await pool.query(
      `
        SELECT id
        FROM ubicaciones
        WHERE LOWER(nombre) = LOWER($1)
      `,
      [nombreLimpio]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        message:
          "Ya existe una ubicación con ese nombre"
      });
    }

    const result = await pool.query(
      `
        INSERT INTO ubicaciones (
          nombre,
          tipo,
          puede_solicitar_a_nombre_de_otra,
          activo,
          estado
        )
        VALUES (
          $1,
          $2,
          $3,
          TRUE,
          'activa'
        )
        RETURNING
          id,
          nombre,
          tipo,
          puede_solicitar_a_nombre_de_otra,
          activo,
          estado,
          created_at
      `,
      [
        nombreLimpio,
        tipo,
        Boolean(
          puede_solicitar_a_nombre_de_otra
        )
      ]
    );

    res.status(201).json({
      message:
        "Ubicación creada correctamente",
      ubicacion: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al crear la ubicación",
      error: error.message
    });
  }
};

const updateUbicacion = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      tipo,
      puede_solicitar_a_nombre_de_otra,
      activo,
      estado
    } = req.body;

    const existente = await pool.query(
      `
        SELECT *
        FROM ubicaciones
        WHERE id = $1
      `,
      [id]
    );

    if (existente.rows.length === 0) {
      return res.status(404).json({
        message: "Ubicación no encontrada"
      });
    }

    const actual = existente.rows[0];

    const nuevoNombre =
      nombre !== undefined
        ? nombre.trim()
        : actual.nombre;

    const nuevoTipo =
      tipo !== undefined
        ? tipo
        : actual.tipo;

    const nuevoPermiso =
      puede_solicitar_a_nombre_de_otra !==
      undefined
        ? Boolean(
            puede_solicitar_a_nombre_de_otra
          )
        : actual.puede_solicitar_a_nombre_de_otra;

    let nuevoEstado =
      estado !== undefined
        ? estado
        : actual.estado;

    const estadosValidos = [
      "activa",
      "pendiente",
      "inactiva"
    ];

    if (!estadosValidos.includes(nuevoEstado)) {
      return res.status(400).json({
        message:
          "Estado de ubicación no válido"
      });
    }

    if (activo !== undefined) {
      if (Boolean(activo)) {
        nuevoEstado = "activa";
      } else if (nuevoEstado !== "pendiente") {
        nuevoEstado = "inactiva";
      }
    }

    const nuevoActivo =
      nuevoEstado === "activa";

    if (!nuevoNombre) {
      return res.status(400).json({
        message:
          "El nombre no puede estar vacío"
      });
    }

    const tiposValidos = [
      "central",
      "sucursal",
      "equipo_interno"
    ];

    if (!tiposValidos.includes(nuevoTipo)) {
      return res.status(400).json({
        message:
          "Tipo de ubicación no válido"
      });
    }

    const duplicada = await pool.query(
      `
        SELECT id
        FROM ubicaciones
        WHERE LOWER(nombre) = LOWER($1)
          AND id <> $2
      `,
      [nuevoNombre, id]
    );

    if (duplicada.rows.length > 0) {
      return res.status(409).json({
        message:
          "Ya existe otra ubicación con ese nombre"
      });
    }

    const result = await pool.query(
      `
        UPDATE ubicaciones
        SET
          nombre = $1,
          tipo = $2,
          puede_solicitar_a_nombre_de_otra = $3,
          activo = $4,
          estado = $5
        WHERE id = $6
        RETURNING
          id,
          nombre,
          tipo,
          puede_solicitar_a_nombre_de_otra,
          activo,
          estado,
          created_at
      `,
      [
        nuevoNombre,
        nuevoTipo,
        nuevoPermiso,
        nuevoActivo,
        nuevoEstado,
        id
      ]
    );

    res.json({
      message:
        "Ubicación actualizada correctamente",
      ubicacion: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al actualizar la ubicación",
      error: error.message
    });
  }
};

const cambiarEstadoUbicacion = async (
  req,
  res
) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== "boolean") {
      return res.status(400).json({
        message:
          "El campo activo debe ser true o false"
      });
    }

    const nuevoEstado =
      activo
        ? "activa"
        : "inactiva";

    const result = await pool.query(
      `
        UPDATE ubicaciones
        SET
          activo = $1,
          estado = $2
        WHERE id = $3
        RETURNING
          id,
          nombre,
          tipo,
          puede_solicitar_a_nombre_de_otra,
          activo,
          estado,
          created_at
      `,
      [
        activo,
        nuevoEstado,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          "Ubicación no encontrada"
      });
    }

    res.json({
      message: activo
        ? "Ubicación activada correctamente"
        : "Ubicación desactivada correctamente",
      ubicacion: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al cambiar el estado de la ubicación",
      error: error.message
    });
  }
};

module.exports = {
  getUbicaciones,
  getUbicacionById,
  createUbicacion,
  updateUbicacion,
  cambiarEstadoUbicacion
};