const pool = require("../config/db");


// =========================================================
// HELPERS
// =========================================================

const esPrincipal = (usuario) => {
  return usuario?.rol === "principal";
};

const esEquipoInterno = (usuario) => {
  return usuario?.rol === "equipo_interno";
};

const esSucursal = (usuario) => {
  return usuario?.rol === "sucursal";
};

const puedeVerCategoria = (
  categoria,
  usuario
) => {
  if (!categoria) {
    return false;
  }

  if (
    !categoria.tipo ||
    categoria.tipo === "global"
  ) {
    return true;
  }

  if (
    esEquipoInterno(usuario) &&
    categoria.tipo === "privada" &&
    Number(
      categoria.ubicacion_propietaria_id
    ) ===
      Number(usuario.ubicacion_id)
  ) {
    return true;
  }

  return false;
};


// =========================================================
// OBTENER CATEGORÍAS
// =========================================================

const getCategorias = async (
  req,
  res
) => {
  try {
    const usuario =
      req.usuario;

    if (!usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    let query = "";
    let params = [];

    // -----------------------------------------------------
    // CENTRAL
    // -----------------------------------------------------
    // Solo categorías globales.
    // Las categorías privadas de Equipos Internos no forman
    // parte del catálogo general de Central.
    // -----------------------------------------------------

    if (esPrincipal(usuario)) {
      query = `
        SELECT
          c.id,
          c.nombre,
          c.descripcion,
          c.activo,
          c.tipo,
          c.ubicacion_propietaria_id,
          u.nombre
            AS ubicacion_propietaria_nombre,
          c.created_at

        FROM categorias c

        LEFT JOIN ubicaciones u
          ON u.id =
             c.ubicacion_propietaria_id

        WHERE
          c.tipo = 'global'

        ORDER BY
          c.nombre
      `;
    }

    // -----------------------------------------------------
    // EQUIPO INTERNO
    // -----------------------------------------------------
    // Ve:
    // - categorías globales
    // - sus propias categorías privadas
    // -----------------------------------------------------

    else if (
      esEquipoInterno(usuario)
    ) {
      query = `
        SELECT
          c.id,
          c.nombre,
          c.descripcion,
          c.activo,
          c.tipo,
          c.ubicacion_propietaria_id,
          u.nombre
            AS ubicacion_propietaria_nombre,
          c.created_at

        FROM categorias c

        LEFT JOIN ubicaciones u
          ON u.id =
             c.ubicacion_propietaria_id

        WHERE
          c.tipo = 'global'

          OR (
            c.tipo = 'privada'
            AND
            c.ubicacion_propietaria_id = $1
          )

        ORDER BY
          c.tipo,
          c.nombre
      `;

      params = [
        Number(
          usuario.ubicacion_id
        )
      ];
    }

    // -----------------------------------------------------
    // SUCURSAL
    // -----------------------------------------------------
    // Únicamente categorías globales.
    // -----------------------------------------------------

    else if (
      esSucursal(usuario)
    ) {
      query = `
        SELECT
          c.id,
          c.nombre,
          c.descripcion,
          c.activo,
          c.tipo,
          c.ubicacion_propietaria_id,
          u.nombre
            AS ubicacion_propietaria_nombre,
          c.created_at

        FROM categorias c

        LEFT JOIN ubicaciones u
          ON u.id =
             c.ubicacion_propietaria_id

        WHERE
          c.tipo = 'global'

        ORDER BY
          c.nombre
      `;
    }

    else {
      return res.status(403).json({
        message:
          "No tienes permiso para consultar categorías"
      });
    }

    const result =
      await pool.query(
        query,
        params
      );

    const categoriasVisibles =
      result.rows.filter(
        (categoria) =>
          puedeVerCategoria(
            categoria,
            usuario
          )
      );

    return res.json(
      categoriasVisibles
    );
  } catch (error) {
    return res.status(500).json({
      message:
        "Error al obtener las categorías",

      error:
        error.message
    });
  }
};


// =========================================================
// CREAR CATEGORÍA
// =========================================================

const createCategoria = async (
  req,
  res
) => {
  try {
    const usuario =
      req.usuario;

    const {
      nombre,
      descripcion
    } = req.body;

    if (!usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    if (
      !nombre ||
      !nombre.trim()
    ) {
      return res.status(400).json({
        message:
          "El nombre de la categoría es obligatorio"
      });
    }

    let tipoFinal;
    let ubicacionPropietariaId =
      null;

    // -----------------------------------------------------
    // CENTRAL CREA CATEGORÍAS GLOBALES
    // -----------------------------------------------------

    if (
      esPrincipal(usuario)
    ) {
      tipoFinal =
        "global";

      ubicacionPropietariaId =
        null;
    }

    // -----------------------------------------------------
    // EQUIPO INTERNO CREA CATEGORÍAS PRIVADAS PROPIAS
    // -----------------------------------------------------

    else if (
      esEquipoInterno(usuario)
    ) {
      const ubicacionId =
        Number(
          usuario.ubicacion_id
        );

      if (
        !Number.isFinite(
          ubicacionId
        ) ||
        ubicacionId <= 0
      ) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      tipoFinal =
        "privada";

      ubicacionPropietariaId =
        ubicacionId;
    }

    // -----------------------------------------------------
    // SUCURSALES NO CREAN CATEGORÍAS
    // -----------------------------------------------------

    else {
      return res.status(403).json({
        message:
          "No tienes permiso para crear categorías"
      });
    }

    const result =
      await pool.query(
        `
          INSERT INTO categorias (
            nombre,
            descripcion,
            tipo,
            ubicacion_propietaria_id
          )

          VALUES (
            $1,
            $2,
            $3,
            $4
          )

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

          descripcion?.trim() ||
            null,

          tipoFinal,

          ubicacionPropietariaId
        ]
      );

    return res
      .status(201)
      .json({
        message:
          "Categoría creada correctamente",

        categoria:
          result.rows[0]
      });
  } catch (error) {
    if (
      error.code === "23505"
    ) {
      return res.status(409).json({
        message:
          "Ya existe una categoría con ese nombre"
      });
    }

    return res.status(500).json({
      message:
        "Error al crear la categoría",

      error:
        error.message
    });
  }
};


// =========================================================
// ACTUALIZAR CATEGORÍA
// =========================================================

const updateCategoria = async (
  req,
  res
) => {
  try {
    const usuario =
      req.usuario;

    const {
      id
    } = req.params;

    const {
      nombre,
      descripcion
    } = req.body;

    if (!usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    if (
      !nombre ||
      !nombre.trim()
    ) {
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
            nombre,
            tipo,
            ubicacion_propietaria_id,
            activo

          FROM categorias

          WHERE id = $1
        `,
        [
          id
        ]
      );

    if (
      categoriaResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        message:
          "Categoría no encontrada"
      });
    }

    const categoria =
      categoriaResult.rows[0];

    // -----------------------------------------------------
    // GLOBAL
    // Solo Central.
    // -----------------------------------------------------

    if (
      categoria.tipo ===
      "global"
    ) {
      if (
        !esPrincipal(usuario)
      ) {
        return res.status(403).json({
          message:
            "Solo Central puede modificar categorías globales"
        });
      }
    }

    // -----------------------------------------------------
    // PRIVADA
    // Solo el Equipo Interno propietario.
    // Central no debe poder verla/editarla desde catálogo.
    // -----------------------------------------------------

    else if (
      categoria.tipo ===
      "privada"
    ) {
      if (
        !esEquipoInterno(
          usuario
        ) ||
        Number(
          categoria
            .ubicacion_propietaria_id
        ) !==
          Number(
            usuario.ubicacion_id
          )
      ) {
        return res.status(404).json({
          message:
            "Categoría no encontrada"
        });
      }
    }

    else {
      return res.status(403).json({
        message:
          "No tienes permiso para modificar esta categoría"
      });
    }

    const result =
      await pool.query(
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

          descripcion?.trim() ||
            null,

          id
        ]
      );

    return res.json({
      message:
        "Categoría actualizada correctamente",

      categoria:
        result.rows[0]
    });
  } catch (error) {
    if (
      error.code === "23505"
    ) {
      return res.status(409).json({
        message:
          "Ya existe una categoría con ese nombre"
      });
    }

    return res.status(500).json({
      message:
        "Error al actualizar la categoría",

      error:
        error.message
    });
  }
};


// =========================================================
// ACTIVAR / DESACTIVAR CATEGORÍA
// =========================================================

const toggleCategoria = async (
  req,
  res
) => {
  try {
    const usuario =
      req.usuario;

    const {
      id
    } = req.params;

    if (!usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const categoriaResult =
      await pool.query(
        `
          SELECT
            id,
            nombre,
            tipo,
            ubicacion_propietaria_id,
            activo

          FROM categorias

          WHERE id = $1
        `,
        [
          id
        ]
      );

    if (
      categoriaResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        message:
          "Categoría no encontrada"
      });
    }

    const categoria =
      categoriaResult.rows[0];

    // -----------------------------------------------------
    // GLOBAL
    // Solo Central.
    // -----------------------------------------------------

    if (
      categoria.tipo ===
      "global"
    ) {
      if (
        !esPrincipal(usuario)
      ) {
        return res.status(403).json({
          message:
            "Solo Central puede cambiar el estado de categorías globales"
        });
      }
    }

    // -----------------------------------------------------
    // PRIVADA
    // Solo su Equipo Interno propietario.
    // -----------------------------------------------------

    else if (
      categoria.tipo ===
      "privada"
    ) {
      if (
        !esEquipoInterno(
          usuario
        ) ||
        Number(
          categoria
            .ubicacion_propietaria_id
        ) !==
          Number(
            usuario.ubicacion_id
          )
      ) {
        return res.status(404).json({
          message:
            "Categoría no encontrada"
        });
      }
    }

    else {
      return res.status(403).json({
        message:
          "No tienes permiso para cambiar el estado de esta categoría"
      });
    }

    const result =
      await pool.query(
        `
          UPDATE categorias

          SET
            activo =
              NOT activo

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
        [
          id
        ]
      );

    return res.json({
      message:
        result.rows[0].activo
          ? "Categoría activada correctamente"
          : "Categoría desactivada correctamente",

      categoria:
        result.rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Error al cambiar el estado de la categoría",

      error:
        error.message
    });
  }
};


module.exports = {
  getCategorias,
  createCategoria,
  updateCategoria,
  toggleCategoria
};