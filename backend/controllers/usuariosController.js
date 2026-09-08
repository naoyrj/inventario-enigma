const pool = require("../config/db");
const bcrypt = require("bcrypt");

const PERMISOS_VALIDOS = [
  "consulta",
  "operador",
  "aprobador_admin"
];

const ROLES_VALIDOS = [
  "principal",
  "sucursal",
  "equipo_interno"
];

const esAdministradorCentral = (req) => {
  return (
    req.usuario?.rol === "principal" &&
    req.usuario?.nivel_permiso === "aprobador_admin"
  );
};

const rolPorTipoUbicacion = (tipo) => {
  if (tipo === "central") {
    return "principal";
  }

  if (tipo === "sucursal") {
    return "sucursal";
  }

  if (tipo === "equipo_interno") {
    return "equipo_interno";
  }

  return null;
};

const obtenerUbicacion = async (ubicacionId) => {
  const result = await pool.query(
    `
      SELECT
        id,
        nombre,
        tipo,
        activo
      FROM ubicaciones
      WHERE id = $1
      LIMIT 1
    `,
    [ubicacionId]
  );

  return result.rows[0] || null;
};

const getUsuarios = async (req, res) => {
  try {
    const result = await pool.query(`
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

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener los usuarios",
      error: error.message
    });
  }
};

const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
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
        WHERE u.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener el usuario",
      error: error.message
    });
  }
};

const createUsuario = async (req, res) => {
  try {
    if (!esAdministradorCentral(req)) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede crear usuarios"
      });
    }

    const {
      nombre,
      email,
      password,
      pin,
      rol,
      ubicacion_id,
      nivel_permiso = null
    } = req.body;

    if (!nombre || !ubicacion_id) {
      return res.status(400).json({
        message:
          "Nombre y ubicación son obligatorios"
      });
    }

    const ubicacion = await obtenerUbicacion(
      ubicacion_id
    );

    if (!ubicacion || !ubicacion.activo) {
      return res.status(404).json({
        message:
          "La ubicación no existe o está inactiva"
      });
    }

    const rolEsperado = rolPorTipoUbicacion(
      ubicacion.tipo
    );

    if (!rolEsperado) {
      return res.status(400).json({
        message:
          "El tipo de ubicación no admite usuarios"
      });
    }

    if (
      rol &&
      (
        !ROLES_VALIDOS.includes(rol) ||
        rol !== rolEsperado
      )
    ) {
      return res.status(400).json({
        message:
          "El rol no corresponde al tipo de ubicación seleccionada"
      });
    }

    if (rolEsperado === "sucursal") {
      if (
        !pin ||
        !/^\d{4,6}$/.test(String(pin))
      ) {
        return res.status(400).json({
          message:
            "Los usuarios de Sucursal necesitan un PIN de 4 a 6 dígitos"
        });
      }
    } else {
      if (!email || !password) {
        return res.status(400).json({
          message:
            "Central y Equipos Internos necesitan email y contraseña"
        });
      }
    }

    if (rolEsperado === "principal") {
      if (
        !nivel_permiso ||
        !PERMISOS_VALIDOS.includes(
          nivel_permiso
        )
      ) {
        return res.status(400).json({
          message:
            "El usuario de Central necesita un nivel de permiso válido"
        });
      }
    }

    let passwordHash = null;
    let pinHash = null;

    if (rolEsperado === "sucursal") {
      pinHash = await bcrypt.hash(
        String(pin),
        10
      );
    } else {
      passwordHash = await bcrypt.hash(
        password,
        10
      );
    }

    const result = await pool.query(
      `
        INSERT INTO usuarios (
          nombre,
          email,
          password_hash,
          pin_hash,
          rol,
          nivel_permiso,
          ubicacion_id,
          activo
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          TRUE
        )
        RETURNING id
      `,
      [
        nombre.trim(),
        rolEsperado === "sucursal"
          ? null
          : email.trim().toLowerCase(),
        passwordHash,
        pinHash,
        rolEsperado,
        rolEsperado === "principal"
          ? nivel_permiso
          : null,
        Number(ubicacion_id)
      ]
    );

    return res.status(201).json({
      message: "Usuario creado correctamente",
      id: result.rows[0].id
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message:
          "Ya existe un usuario con ese email"
      });
    }

    return res.status(500).json({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

const updateUsuario = async (req, res) => {
  const client = await pool.connect();

  try {
    if (!esAdministradorCentral(req)) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede editar usuarios"
      });
    }

    const { id } = req.params;

    const {
      nombre,
      email,
      password,
      pin,
      rol,
      ubicacion_id,
      nivel_permiso
    } = req.body;

    if (!nombre || !ubicacion_id) {
      return res.status(400).json({
        message:
          "Nombre y ubicación son obligatorios"
      });
    }

    await client.query("BEGIN");

    const usuarioResult = await client.query(
      `
        SELECT
          id,
          email,
          password_hash,
          pin_hash,
          rol,
          nivel_permiso,
          ubicacion_id,
          activo
        FROM usuarios
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (usuarioResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    const usuarioActual =
      usuarioResult.rows[0];

    const ubicacionResult =
      await client.query(
        `
          SELECT
            id,
            nombre,
            tipo,
            activo
          FROM ubicaciones
          WHERE id = $1
          LIMIT 1
        `,
        [ubicacion_id]
      );

    if (
      ubicacionResult.rows.length === 0 ||
      !ubicacionResult.rows[0].activo
    ) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message:
          "La ubicación no existe o está inactiva"
      });
    }

    const ubicacion =
      ubicacionResult.rows[0];

    const rolEsperado =
      rolPorTipoUbicacion(
        ubicacion.tipo
      );

    if (!rolEsperado) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message:
          "El tipo de ubicación no admite usuarios"
      });
    }

    if (
      rol &&
      (
        !ROLES_VALIDOS.includes(rol) ||
        rol !== rolEsperado
      )
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message:
          "El rol no corresponde al tipo de ubicación seleccionada"
      });
    }

    if (rolEsperado === "principal") {
      if (
        !nivel_permiso ||
        !PERMISOS_VALIDOS.includes(
          nivel_permiso
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          message:
            "El usuario de Central necesita un nivel de permiso válido"
        });
      }
    }

    let emailFinal = null;
    let passwordHashFinal = null;
    let pinHashFinal = null;

    if (rolEsperado === "sucursal") {
      if (
        String(pin || "").trim()
      ) {
        if (
          !/^\d{4,6}$/.test(
            String(pin)
          )
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            message:
              "El PIN debe contener entre 4 y 6 dígitos"
          });
        }

        pinHashFinal =
          await bcrypt.hash(
            String(pin),
            10
          );
      } else if (
        usuarioActual.rol ===
          "sucursal" &&
        usuarioActual.pin_hash
      ) {
        pinHashFinal =
          usuarioActual.pin_hash;
      } else {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Debes configurar un PIN para este usuario de Sucursal"
        });
      }
    } else {
      emailFinal =
        String(email || "")
          .trim()
          .toLowerCase();

      if (!emailFinal) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "El correo es obligatorio para Central y Equipos Internos"
        });
      }

      if (
        String(password || "").trim()
      ) {
        passwordHashFinal =
          await bcrypt.hash(
            password,
            10
          );
      } else if (
        usuarioActual.rol !==
          "sucursal" &&
        usuarioActual.password_hash
      ) {
        passwordHashFinal =
          usuarioActual.password_hash;
      } else {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Debes configurar una contraseña para este usuario"
        });
      }
    }

    await client.query(
      `
        UPDATE usuarios
        SET
          nombre = $1,
          email = $2,
          password_hash = $3,
          pin_hash = $4,
          rol = $5,
          nivel_permiso = $6,
          ubicacion_id = $7
        WHERE id = $8
      `,
      [
        nombre.trim(),
        emailFinal,
        passwordHashFinal,
        pinHashFinal,
        rolEsperado,
        rolEsperado === "principal"
          ? nivel_permiso
          : null,
        Number(ubicacion_id),
        id
      ]
    );

    await client.query("COMMIT");

    return res.json({
      message:
        "Usuario actualizado correctamente"
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      return res.status(409).json({
        message:
          "Ya existe un usuario con ese email"
      });
    }

    return res.status(500).json({
      message:
        "Error al actualizar el usuario",
      error: error.message
    });
  } finally {
    client.release();
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

    const result = await pool.query(
      `
        SELECT
          id,
          nombre,
          pin_hash,
          rol,
          ubicacion_id,
          activo
        FROM usuarios
        WHERE id = $1
          AND rol = 'sucursal'
      `,
      [usuario_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          "Usuario de sucursal no encontrado"
      });
    }

    const usuario = result.rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        message:
          "Usuario desactivado"
      });
    }

    if (!usuario.pin_hash) {
      return res.status(401).json({
        message:
          "El usuario no tiene un PIN configurado"
      });
    }

    const correcto =
      await bcrypt.compare(
        String(pin),
        usuario.pin_hash
      );

    if (!correcto) {
      return res.status(401).json({
        message: "PIN incorrecto"
      });
    }

    return res.json({
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
    return res.status(500).json({
      message: "Error al validar PIN",
      error: error.message
    });
  }
};

const deactivateUsuario = async (
  req,
  res
) => {
  try {
    if (!esAdministradorCentral(req)) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede desactivar usuarios"
      });
    }

    const { id } = req.params;

    const result = await pool.query(
      `
        UPDATE usuarios
        SET activo = FALSE
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message:
          "Usuario no encontrado"
      });
    }

    return res.json({
      message:
        "Usuario desactivado correctamente"
    });
  } catch (error) {
    return res.status(500).json({
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
  updateUsuario,
  validarPin,
  deactivateUsuario
};