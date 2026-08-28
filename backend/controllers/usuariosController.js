const pool = require("../config/db");
const bcrypt = require("bcrypt");

const getUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.nivel_permiso,
        u.activo,
        u.created_at,
        ub.id AS ubicacion_id,
        ub.nombre AS ubicacion_nombre,
        ub.tipo AS ubicacion_tipo
      FROM usuarios u
      LEFT JOIN ubicaciones ub
        ON u.ubicacion_id = ub.id
      ORDER BY u.nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener los usuarios",
      error: error.message
    });
  }
};

const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
        SELECT
          u.id,
          u.nombre,
          u.email,
          u.rol,
          u.nivel_permiso,
          u.activo,
          u.created_at,
          ub.id AS ubicacion_id,
          ub.nombre AS ubicacion_nombre,
          ub.tipo AS ubicacion_tipo
        FROM usuarios u
        LEFT JOIN ubicaciones ub
          ON u.ubicacion_id = ub.id
        WHERE u.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el usuario",
      error: error.message
    });
  }
};

const createUsuario = async (req, res) => {
  try {
    const {
      nombre,
      email,
      password,
      pin,
      rol,
      ubicacion_id,
      nivel_permiso = null
    } = req.body;

    if (
      req.usuario.rol !== "principal" ||
      req.usuario.nivel_permiso !== "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede crear usuarios"
      });
    }

    if (!nombre || !rol || !ubicacion_id) {
      return res.status(400).json({
        message:
          "Nombre, rol y ubicación son obligatorios"
      });
    }

    const rolesValidos = [
      "principal",
      "sucursal",
      "equipo_interno"
    ];

    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        message: "Rol de usuario no válido"
      });
    }

    if (
      rol === "sucursal" &&
      (!pin || !/^\d{4,6}$/.test(pin))
    ) {
      return res.status(400).json({
        message:
          "Los usuarios de sucursal necesitan un PIN de 4 a 6 dígitos"
      });
    }

    if (
      rol !== "sucursal" &&
      (!email || !password)
    ) {
      return res.status(400).json({
        message:
          "Central y Equipos Internos necesitan email y contraseña"
      });
    }

    const permisosValidos = [
      "consulta",
      "operador",
      "aprobador_admin"
    ];

    if (
      rol === "principal" &&
      (!nivel_permiso ||
        !permisosValidos.includes(nivel_permiso))
    ) {
      return res.status(400).json({
        message:
          "El usuario de Central necesita un nivel de permiso válido"
      });
    }

    const [ubicaciones] = await pool.query(
      `
        SELECT id, tipo
        FROM ubicaciones
        WHERE id = ?
          AND activo = TRUE
      `,
      [ubicacion_id]
    );

    if (ubicaciones.length === 0) {
      return res.status(404).json({
        message: "Ubicación no encontrada"
      });
    }

    if (
      rol === "sucursal" &&
      ubicaciones[0].tipo !== "sucursal"
    ) {
      return res.status(400).json({
        message:
          "Un usuario de sucursal debe pertenecer a una ubicación tipo sucursal"
      });
    }

    if (
      rol === "equipo_interno" &&
      ubicaciones[0].tipo !== "equipo_interno"
    ) {
      return res.status(400).json({
        message:
          "El usuario debe pertenecer a un Equipo Interno"
      });
    }

    if (
      rol === "principal" &&
      ubicaciones[0].tipo !== "central"
    ) {
      return res.status(400).json({
        message:
          "Un usuario Principal debe pertenecer a Central"
      });
    }

    let passwordHash = null;
    let pinHash = null;

    if (password) {
      passwordHash = await bcrypt.hash(
        password,
        10
      );
    }

    if (pin) {
      pinHash = await bcrypt.hash(
        pin,
        10
      );
    }

    const [result] = await pool.query(
      `
        INSERT INTO usuarios (
          nombre,
          email,
          password_hash,
          pin_hash,
          rol,
          nivel_permiso,
          ubicacion_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nombre.trim(),
        email
          ? email.trim().toLowerCase()
          : null,
        passwordHash,
        pinHash,
        rol,
        rol === "principal"
          ? nivel_permiso
          : null,
        ubicacion_id
      ]
    );

    res.status(201).json({
      message: "Usuario creado correctamente",
      id: result.insertId
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message:
          "Ya existe un usuario con ese email"
      });
    }

    res.status(500).json({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

const validarPin = async (req, res) => {
  try {
    const {
      usuario_id,
      pin
    } = req.body;

    if (!usuario_id || !pin) {
      return res.status(400).json({
        message:
          "usuario_id y PIN son obligatorios"
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          id,
          nombre,
          pin_hash,
          rol,
          ubicacion_id,
          activo
        FROM usuarios
        WHERE id = ?
          AND rol = 'sucursal'
      `,
      [usuario_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message:
          "Usuario de sucursal no encontrado"
      });
    }

    const usuario = rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message: "Usuario desactivado"
      });
    }

    const correcto = await bcrypt.compare(
      pin,
      usuario.pin_hash
    );

    if (!correcto) {
      return res.status(401).json({
        message: "PIN incorrecto"
      });
    }

    res.json({
      message: "PIN válido",
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        ubicacion_id:
          usuario.ubicacion_id
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al validar PIN",
      error: error.message
    });
  }
};

const deactivateUsuario = async (req, res) => {
  try {
    if (
      req.usuario.rol !== "principal" ||
      req.usuario.nivel_permiso !== "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede desactivar usuarios"
      });
    }

    const { id } = req.params;

    const [result] = await pool.query(
      `
        UPDATE usuarios
        SET activo = FALSE
        WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    res.json({
      message:
        "Usuario desactivado correctamente"
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al desactivar el usuario",
      error: error.message
    });
  }
};

module.exports = {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  validarPin,
  deactivateUsuario
};