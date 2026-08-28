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
        message: "Correo y contraseña son obligatorios"
      });
    }

    const [usuarios] = await pool.query(
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
        WHERE u.email = ?
        LIMIT 1
      `,
      [email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        message: "Credenciales incorrectas"
      });
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message: "El usuario está desactivado"
      });
    }

    if (!usuario.password_hash) {
      return res.status(401).json({
        message: "Este usuario debe ingresar mediante PIN"
      });
    }

    const passwordValido = await bcrypt.compare(
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
      message: "Inicio de sesión exitoso",
      token,
      usuario
    });
  } catch (error) {
    console.error("Error login:", error);

    return res.status(500).json({
      message: "Error al iniciar sesión"
    });
  }
};

const getUsuariosSucursal = async (req, res) => {
  try {
    const [usuarios] = await pool.query(
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
          AND u.activo = 1
        ORDER BY
          ub.nombre ASC,
          u.nombre ASC
      `
    );

    return res.json(usuarios);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "No fue posible obtener usuarios de sucursal"
    });
  }
};

const loginPin = async (req, res) => {
  try {
    const { usuario_id, pin } = req.body;

    if (!usuario_id || !pin) {
      return res.status(400).json({
        message: "Usuario y PIN son obligatorios"
      });
    }

    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({
        message: "El PIN debe contener entre 4 y 6 dígitos"
      });
    }

    const [usuarios] = await pool.query(
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
        LEFT JOIN ubicaciones ub
          ON ub.id = u.ubicacion_id
        WHERE u.id = ?
        LIMIT 1
      `,
      [usuario_id]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        message: "Usuario no encontrado"
      });
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message: "El usuario está desactivado"
      });
    }

    if (usuario.rol !== "sucursal") {
      return res.status(403).json({
        message: "El acceso por PIN es exclusivo para sucursales"
      });
    }

    if (!usuario.pin_hash) {
      return res.status(401).json({
        message: "El usuario no tiene un PIN configurado"
      });
    }

    const pinValido = await bcrypt.compare(
      String(pin),
      usuario.pin_hash
    );

    if (!pinValido) {
      return res.status(401).json({
        message: "PIN incorrecto"
      });
    }

    const token = generarToken(usuario);

    delete usuario.pin_hash;

    return res.json({
      message: "Acceso autorizado",
      token,
      usuario
    });
  } catch (error) {
    console.error("Error login PIN:", error);

    return res.status(500).json({
      message: "Error al validar el PIN"
    });
  }
};

module.exports = {
  login,
  loginPin,
  getUsuariosSucursal
};