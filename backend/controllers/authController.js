const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const generarToken = (usuario) => {
  return jwt.sign(
    {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      nivel_permiso: usuario.nivel_permiso,
      ubicacion_id: usuario.ubicacion_id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h"
    }
  );
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Correo y contraseña son obligatorios"
      });
    }

    const result = await pool.query(
      `
        SELECT
          u.id,
          u.nombre,
          u.email,
          u.password_hash,
          u.rol,
          u.nivel_permiso,
          u.ubicacion_id,
          ub.nombre AS ubicacion_nombre,
          ub.tipo AS ubicacion_tipo,
          u.activo
        FROM usuarios u
        LEFT JOIN ubicaciones ub
          ON ub.id = u.ubicacion_id
        WHERE LOWER(u.email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Credenciales incorrectas"
      });
    }

    const usuario = result.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message:
          "El usuario está desactivado"
      });
    }

    if (
      usuario.rol !== "principal" &&
      usuario.rol !== "equipo_interno"
    ) {
      return res.status(403).json({
        message:
          "Este usuario debe ingresar mediante PIN"
      });
    }

    if (!usuario.password_hash) {
      return res.status(401).json({
        message:
          "El usuario no tiene contraseña configurada"
      });
    }

    const passwordValido =
      await bcrypt.compare(
        password,
        usuario.password_hash
      );

    if (!passwordValido) {
      return res.status(401).json({
        message: "Credenciales incorrectas"
      });
    }

    const token = generarToken(usuario);

    delete usuario.password_hash;

    return res.json({
      message:
        "Inicio de sesión exitoso",
      token,
      usuario
    });
  } catch (error) {
    console.error(
      "Error login:",
      error
    );

    return res.status(500).json({
      message:
        "Error al iniciar sesión"
    });
  }
};

const getSucursales = async (
  req,
  res
) => {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          nombre
        FROM ubicaciones
        WHERE
          tipo = 'sucursal'
          AND activo = TRUE
        ORDER BY nombre ASC
      `
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(
      "Error obteniendo sucursales:",
      error
    );

    return res.status(500).json({
      message:
        "No fue posible obtener las sucursales"
    });
  }
};

const getUsuariosSucursal = async (
  req,
  res
) => {
  try {
    const ubicacionId = Number(
      req.query.ubicacion_id
    );

    if (
      !ubicacionId ||
      Number.isNaN(ubicacionId)
    ) {
      return res.status(400).json({
        message:
          "La sucursal del dispositivo es obligatoria"
      });
    }

    const sucursalResult =
      await pool.query(
        `
          SELECT
            id,
            nombre,
            tipo,
            activo
          FROM ubicaciones
          WHERE
            id = $1
            AND tipo = 'sucursal'
            AND activo = TRUE
          LIMIT 1
        `,
        [ubicacionId]
      );

    if (
      sucursalResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "La sucursal configurada no existe o está inactiva"
      });
    }

    const result = await pool.query(
      `
        SELECT
          u.id,
          u.nombre,
          u.ubicacion_id,
          ub.nombre AS ubicacion_nombre
        FROM usuarios u
        INNER JOIN ubicaciones ub
          ON ub.id = u.ubicacion_id
        WHERE
          u.rol = 'sucursal'
          AND u.activo = TRUE
          AND u.ubicacion_id = $1
          AND ub.tipo = 'sucursal'
          AND ub.activo = TRUE
        ORDER BY
          u.nombre ASC
      `,
      [ubicacionId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(
      "Error obteniendo usuarios de sucursal:",
      error
    );

    return res.status(500).json({
      message:
        "No fue posible obtener usuarios de sucursal"
    });
  }
};

const loginPin = async (
  req,
  res
) => {
  try {
    const {
      usuario_id,
      pin,
      ubicacion_id
    } = req.body;

    const usuarioId = Number(
      usuario_id
    );

    const ubicacionId = Number(
      ubicacion_id
    );

    if (
      !usuarioId ||
      !ubicacionId ||
      !pin
    ) {
      return res.status(400).json({
        message:
          "Usuario, sucursal y PIN son obligatorios"
      });
    }

    if (
      Number.isNaN(usuarioId) ||
      Number.isNaN(ubicacionId)
    ) {
      return res.status(400).json({
        message:
          "Usuario o sucursal inválidos"
      });
    }

    if (
      !/^\d{4,6}$/.test(
        String(pin)
      )
    ) {
      return res.status(400).json({
        message:
          "El PIN debe contener entre 4 y 6 dígitos"
      });
    }

    const result = await pool.query(
      `
        SELECT
          u.id,
          u.nombre,
          u.email,
          u.pin_hash,
          u.rol,
          u.nivel_permiso,
          u.ubicacion_id,
          ub.nombre AS ubicacion_nombre,
          ub.tipo AS ubicacion_tipo,
          u.activo
        FROM usuarios u
        INNER JOIN ubicaciones ub
          ON ub.id = u.ubicacion_id
        WHERE
          u.id = $1
          AND u.ubicacion_id = $2
          AND u.rol = 'sucursal'
          AND ub.tipo = 'sucursal'
        LIMIT 1
      `,
      [
        usuarioId,
        ubicacionId
      ]
    );

    if (
      result.rows.length === 0
    ) {
      return res.status(401).json({
        message:
          "El usuario no pertenece a esta sucursal"
      });
    }

    const usuario =
      result.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message:
          "El usuario está desactivado"
      });
    }

    if (!usuario.pin_hash) {
      return res.status(401).json({
        message:
          "El usuario no tiene un PIN configurado"
      });
    }

    const pinValido =
      await bcrypt.compare(
        String(pin),
        usuario.pin_hash
      );

    if (!pinValido) {
      return res.status(401).json({
        message:
          "PIN incorrecto"
      });
    }

    const token =
      generarToken(usuario);

    delete usuario.pin_hash;

    return res.json({
      message:
        "Acceso autorizado",
      token,
      usuario
    });
  } catch (error) {
    console.error(
      "Error login PIN:",
      error
    );

    return res.status(500).json({
      message:
        "Error al validar el PIN"
    });
  }
};

module.exports = {
  login,
  loginPin,
  getUsuariosSucursal,
  getSucursales
};