const pool = require("../config/db");

const getCategorias = async (req, res) => {
  try {
    const usuario = req.usuario;

    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    let query = "";
    let params = [];

    if (usuario.rol === "principal") {
      query = `
        SELECT
          c.id,
          c.nombre,
          c.descripcion,
          c.activo,
          c.tipo,
          c.ubicacion_propietaria_id,
          u.nombre AS ubicacion_propietaria_nombre,
          c.created_at
        FROM categorias c
        LEFT JOIN ubicaciones u
          ON u.id = c.ubicacion_propietaria_id
        ORDER BY
          c.tipo,
          c.nombre
      `;
    } else if (usuario.rol === "equipo_interno") {
      query = `
        SELECT
          c.id,
          c.nombre,
          c.descripcion,
          c.activo,
          c.tipo,
          c.ubicacion_propietaria_id,
          u.nombre AS ubicacion_propietaria_nombre,
          c.created_at
        FROM categorias c
        LEFT JOIN ubicaciones u
          ON u.id = c.ubicacion_propietaria_id
        WHERE
          c.tipo = 'global'
          OR (
            c.tipo = 'privada'
            AND c.ubicacion_propietaria_id = $1
          )
        ORDER BY
          c.tipo,
          c.nombre
      `;

      params = [usuario.ubicacion_id];
    } else {
      query = `
        SELECT
          c.id,
          c.nombre,
          c.descripcion,
          c.activo,
          c.tipo,
          c.ubicacion_propietaria_id,
          u.nombre AS ubicacion_propietaria_nombre,
          c.created_at
        FROM categorias c
        LEFT JOIN ubicaciones u
          ON u.id = c.ubicacion_propietaria_id
        WHERE c.tipo = 'global'
        ORDER BY c.nombre
      `;
    }

    const result = await pool.query(
      query,
      params
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener las categorías",
      error: error.message
    });
  }
};

const createCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    const {
      nombre,
      descripcion,
      tipo
    } = req.body;

    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        message:
          "El nombre de la categoría es obligatorio"
      });
    }

    let tipoFinal = tipo;
    let ubicacionPropietariaId = null;

    if (usuario.rol === "principal") {
      tipoFinal = "global";
      ubicacionPropietariaId = null;
    } else if (
      usuario.rol === "equipo_interno"
    ) {
      tipoFinal = "privada";
      ubicacionPropietariaId =
        Number(usuario.ubicacion_id);
    } else {
      return res.status(403).json({
        message:
          "No tienes permiso para crear categorías"
      });
    }

    const result = await pool.query(
      `
        INSERT INTO categorias (
          nombre,
          descripcion,
          tipo,
          ubicacion_propietaria_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          nombre,
          descripcion,
          activo,
          tipo,
          ubicacion_propietaria_id,
          created_at
      `,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        tipoFinal,
        ubicacionPropietariaId
      ]
    );

    res.status(201).json({
      message:
        "Categoría creada correctamente",
      categoria: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message:
          "Ya existe una categoría con ese nombre"
      });
    }

    res.status(500).json({
      message: "Error al crear la categoría",
      error: error.message
    });
  }
};

const updateCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;
    const {
      nombre,
      descripcion
    } = req.body;

    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({
        message:
          "El nombre de la categoría es obligatorio"
      });
    }

    const categoriaResult =
      await pool.query(
        `
          SELECT
            id,
            tipo,
            ubicacion_propietaria_id
          FROM categorias
          WHERE id = $1
        `,
        [id]
      );

    if (
      categoriaResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "Categoría no encontrada"
      });
    }

    const categoria =
      categoriaResult.rows[0];

    if (categoria.tipo === "global") {
      if (usuario.rol !== "principal") {
        return res.status(403).json({
          message:
            "Solo Central puede modificar categorías globales"
        });
      }
    }

    if (categoria.tipo === "privada") {
      if (
        usuario.rol === "principal"
      ) {
        return res.status(403).json({
          message:
            "Central solo puede consultar categorías privadas"
        });
      }

      if (
        usuario.rol !==
          "equipo_interno" ||
        Number(
          categoria.ubicacion_propietaria_id
        ) !==
          Number(usuario.ubicacion_id)
      ) {
        return res.status(403).json({
          message:
            "Solo el Equipo Interno propietario puede modificar esta categoría"
        });
      }
    }

    const result = await pool.query(
      `
        UPDATE categorias
        SET
          nombre = $1,
          descripcion = $2
        WHERE id = $3
        RETURNING
          id,
          nombre,
          descripcion,
          activo,
          tipo,
          ubicacion_propietaria_id,
          created_at
      `,
      [
        nombre.trim(),
        descripcion?.trim() || null,
        id
      ]
    );

    res.json({
      message:
        "Categoría actualizada correctamente",
      categoria: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message:
          "Ya existe una categoría con ese nombre"
      });
    }

    res.status(500).json({
      message:
        "Error al actualizar la categoría",
      error: error.message
    });
  }
};

const toggleCategoria = async (req, res) => {
  try {
    const usuario = req.usuario;
    const { id } = req.params;

    if (!usuario) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

    const categoriaResult =
      await pool.query(
        `
          SELECT
            id,
            tipo,
            ubicacion_propietaria_id,
            activo
          FROM categorias
          WHERE id = $1
        `,
        [id]
      );

    if (
      categoriaResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "Categoría no encontrada"
      });
    }

    const categoria =
      categoriaResult.rows[0];

    if (categoria.tipo === "global") {
      if (usuario.rol !== "principal") {
        return res.status(403).json({
          message:
            "Solo Central puede cambiar el estado de categorías globales"
        });
      }
    }

    if (categoria.tipo === "privada") {
      if (
        usuario.rol === "principal"
      ) {
        return res.status(403).json({
          message:
            "Central solo puede consultar categorías privadas"
        });
      }

      if (
        usuario.rol !==
          "equipo_interno" ||
        Number(
          categoria.ubicacion_propietaria_id
        ) !==
          Number(usuario.ubicacion_id)
      ) {
        return res.status(403).json({
          message:
            "Solo el Equipo Interno propietario puede cambiar el estado de esta categoría"
        });
      }
    }

    const result = await pool.query(
      `
        UPDATE categorias
        SET activo = NOT activo
        WHERE id = $1
        RETURNING
          id,
          nombre,
          descripcion,
          activo,
          tipo,
          ubicacion_propietaria_id,
          created_at
      `,
      [id]
    );

    res.json({
      message:
        result.rows[0].activo
          ? "Categoría activada correctamente"
          : "Categoría desactivada correctamente",
      categoria: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al cambiar el estado de la categoría",
      error: error.message
    });
  }
};

module.exports = {
  getCategorias,
  createCategoria,
  updateCategoria,
  toggleCategoria
};