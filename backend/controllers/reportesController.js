const pool = require("../config/db");

// =========================================================
// HELPERS
// =========================================================

const obtenerUbicacionUsuario = (req) => {
  const ubicacionId = Number(
    req.usuario?.ubicacion_id
  );

  if (
    !Number.isFinite(ubicacionId) ||
    ubicacionId <= 0
  ) {
    return null;
  }

  return ubicacionId;
};

const esPrincipal = (req) => {
  return req.usuario?.rol === "principal";
};

const agregarFiltroCategoriaVisible = (
  sql,
  params,
  req,
  aliasCategoria = "c"
) => {
  // Central puede consultar todas las categorías.
  if (esPrincipal(req)) {
    return sql;
  }

  const ubicacionId =
    obtenerUbicacionUsuario(req);

  if (!ubicacionId) {
    return sql;
  }

  params.push(ubicacionId);

  return `
    ${sql}

    AND (
      ${aliasCategoria}.id IS NULL

      OR
      ${aliasCategoria}.tipo IS NULL

      OR
      ${aliasCategoria}.tipo = 'global'

      OR (
        ${aliasCategoria}.tipo = 'privada'
        AND
        ${aliasCategoria}.ubicacion_propietaria_id =
          $${params.length}
      )
    )
  `;
};

// =========================================================
// INVENTARIO
// =========================================================
// Principal:
//   - Ve inventario de todas las ubicaciones.
//
// Sucursal / Equipo Interno:
//   - Ve únicamente su ubicación.
//
// También permite que Central filtre por una ubicación.
// =========================================================

const getInventario = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const {
      categoria_id,
      ubicacion_id
    } = req.query;

    const params = [];

    let sql = `
      SELECT
        i.ubicacion_id,

        u.nombre
          AS ubicacion_nombre,

        u.tipo
          AS ubicacion_tipo,

        p.id
          AS producto_id,

        p.nombre
          AS producto_nombre,

        p.descripcion,

        p.sku,

        p.unidad_medida,

        p.punto_reorden,

        COALESCE(
          (
            SELECT pp.proveedor_id
            FROM proveedor_productos pp
            INNER JOIN proveedores pr
              ON pr.id = pp.proveedor_id
            WHERE
              pp.producto_id = p.id
              AND pr.activo = TRUE
            ORDER BY pr.nombre
            LIMIT 1
          ),
          NULL
        )
          AS proveedor_id,

        COALESCE(
          (
            SELECT STRING_AGG(
              DISTINCT pr.nombre,
              ', '
              ORDER BY pr.nombre
            )
            FROM proveedor_productos pp
            INNER JOIN proveedores pr
              ON pr.id = pp.proveedor_id
            WHERE
              pp.producto_id = p.id
              AND pr.activo = TRUE
          ),
          'Sin proveedor'
        )
          AS proveedor_nombre,

        c.id
          AS categoria_id,

        c.nombre
          AS categoria_nombre,

        c.tipo
          AS categoria_tipo,

        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        i.cantidad,

        CASE
          WHEN
            p.punto_reorden IS NOT NULL
            AND
            i.cantidad < p.punto_reorden
          THEN TRUE
          ELSE FALSE
        END
          AS stock_bajo

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      WHERE
        u.activo = TRUE

        AND p.activo = TRUE
    `;

    // =====================================================
    // UBICACIÓN
    // =====================================================

    if (esPrincipal(req)) {
      // Central puede consultar todo.
      if (ubicacion_id) {
        const ubicacionId =
          Number(ubicacion_id);

        if (
          !Number.isFinite(
            ubicacionId
          ) ||
          ubicacionId <= 0
        ) {
          return res.status(400).json({
            message:
              "Ubicación inválida"
          });
        }

        params.push(
          ubicacionId
        );

        sql += `
          AND i.ubicacion_id =
            $${params.length}
        `;
      }
    } else {
      const ubicacionUsuario =
        obtenerUbicacionUsuario(req);

      if (!ubicacionUsuario) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      params.push(
        ubicacionUsuario
      );

      sql += `
        AND i.ubicacion_id =
          $${params.length}
      `;
    }

    // =====================================================
    // CATEGORÍAS VISIBLES
    // =====================================================

    sql =
      agregarFiltroCategoriaVisible(
        sql,
        params,
        req,
        "c"
      );

    // =====================================================
    // FILTRO CATEGORÍA
    // =====================================================

    if (categoria_id) {
      const categoriaId =
        Number(categoria_id);

      if (
        !Number.isFinite(
          categoriaId
        )
      ) {
        return res.status(400).json({
          message:
            "Categoría inválida"
        });
      }

      params.push(
        categoriaId
      );

      sql += `
        AND p.categoria_id =
          $${params.length}
      `;
    }

    sql += `
      ORDER BY
        u.nombre,
        c.nombre NULLS LAST,
        p.nombre
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    return res.json(
      result.rows
    );
  } catch (error) {
    console.error(
      "Error getInventario:",
      error
    );

    return res.status(500).json({
      message:
        "Error al obtener el inventario",
      error:
        error.message
    });
  }
};

// =========================================================
// ALERTAS
// =========================================================

const getAlertas = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const params = [];

    let sql = `
      SELECT
        i.ubicacion_id,

        u.nombre
          AS ubicacion_nombre,

        u.tipo
          AS ubicacion_tipo,

        p.id
          AS producto_id,

        p.nombre
          AS producto_nombre,

        p.sku,

        p.unidad_medida,

        c.id
          AS categoria_id,

        c.nombre
          AS categoria_nombre,

        c.tipo
          AS categoria_tipo,

        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        i.cantidad
          AS stock_actual,

        p.punto_reorden,

        (
          p.punto_reorden -
          i.cantidad
        )
          AS faltante_para_reorden

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      WHERE
        u.activo = TRUE

        AND p.activo = TRUE

        AND p.punto_reorden IS NOT NULL

        AND i.cantidad <
          p.punto_reorden
    `;

    if (esPrincipal(req)) {
      // Central ve alertas de todas las ubicaciones.
    } else {
      const ubicacionUsuario =
        obtenerUbicacionUsuario(req);

      if (!ubicacionUsuario) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      params.push(
        ubicacionUsuario
      );

      sql += `
        AND i.ubicacion_id =
          $${params.length}
      `;
    }

    sql =
      agregarFiltroCategoriaVisible(
        sql,
        params,
        req,
        "c"
      );

    sql += `
      ORDER BY
        faltante_para_reorden DESC,
        u.nombre,
        p.nombre
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    return res.json({
      total_alertas:
        result.rows.length,

      alertas:
        result.rows
    });
  } catch (error) {
    console.error(
      "Error getAlertas:",
      error
    );

    return res.status(500).json({
      message:
        "Error al obtener alertas de stock",
      error:
        error.message
    });
  }
};

// =========================================================
// KARDEX GENERAL
// =========================================================
//
// Central:
//   Todos los movimientos.
//
// Sucursal / Equipo Interno:
//   Central + su propia ubicación.
//
// Filtros:
//   nombre
//   sku
//   proveedor
//   desde
//   hasta
//
// IMPORTANTE:
// Los proveedores se relacionan mediante
// proveedor_productos.
// =========================================================

const getKardex = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const {
      nombre,
      sku,
      proveedor,
      desde,
      hasta
    } = req.query;

    const params = [];

    let sql = `
      SELECT
        m.id,

        m.producto_id,

        p.nombre
          AS producto_nombre,

        p.sku,

        p.unidad_medida,

        (
          SELECT
            pp.proveedor_id

          FROM proveedor_productos pp

          INNER JOIN proveedores pr
            ON pr.id =
               pp.proveedor_id

          WHERE
            pp.producto_id =
              p.id

            AND pr.activo =
              TRUE

          ORDER BY
            pr.nombre

          LIMIT 1
        )
          AS proveedor_id,

        COALESCE(
          (
            SELECT
              STRING_AGG(
                DISTINCT pr.nombre,
                ', '
                ORDER BY pr.nombre
              )

            FROM proveedor_productos pp

            INNER JOIN proveedores pr
              ON pr.id =
                 pp.proveedor_id

            WHERE
              pp.producto_id =
                p.id

              AND pr.activo =
                TRUE
          ),
          'Sin proveedor'
        )
          AS proveedor_nombre,

        c.id
          AS categoria_id,

        c.nombre
          AS categoria_nombre,

        c.tipo
          AS categoria_tipo,

        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        m.ubicacion_id,

        u.nombre
          AS ubicacion_nombre,

        u.tipo
          AS ubicacion_tipo,

        m.tipo,

        m.cantidad,

        m.motivo,

        m.referencia_tipo,

        m.referencia_id,

        m.usuario_id,

        us.nombre
          AS usuario_nombre,

        m.created_at

      FROM movimientos m

      INNER JOIN productos p
        ON m.producto_id =
           p.id

      INNER JOIN ubicaciones u
        ON m.ubicacion_id =
           u.id

      INNER JOIN usuarios us
        ON m.usuario_id =
           us.id

      LEFT JOIN categorias c
        ON p.categoria_id =
           c.id

      WHERE
        p.activo =
          TRUE

        AND u.activo =
          TRUE
    `;

    // =====================================================
    // UBICACIONES VISIBLES
    // =====================================================

    if (!esPrincipal(req)) {
      const ubicacionUsuario =
        obtenerUbicacionUsuario(req);

      if (!ubicacionUsuario) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      // 1 = Almacén Central
      // + ubicación del usuario

      if (
        ubicacionUsuario === 1
      ) {
        params.push(
          1
        );

        sql += `
          AND m.ubicacion_id =
            $${params.length}
        `;
      } else {
        params.push(
          1,
          ubicacionUsuario
        );

        sql += `
          AND m.ubicacion_id IN (
            $${params.length - 1},
            $${params.length}
          )
        `;
      }
    }

    // =====================================================
    // CATEGORÍAS
    // =====================================================

    sql =
      agregarFiltroCategoriaVisible(
        sql,
        params,
        req,
        "c"
      );

    // =====================================================
    // PRODUCTO
    // =====================================================

    if (
      nombre &&
      nombre.trim()
    ) {
      params.push(
        `%${nombre.trim()}%`
      );

      sql += `
        AND p.nombre ILIKE
          $${params.length}
      `;
    }

    // =====================================================
    // SKU
    // =====================================================

    if (
      sku &&
      sku.trim()
    ) {
      params.push(
        `%${sku.trim()}%`
      );

      sql += `
        AND p.sku ILIKE
          $${params.length}
      `;
    }

    // =====================================================
    // PROVEEDOR
    // =====================================================

    if (
      proveedor &&
      proveedor.trim()
    ) {
      params.push(
        `%${proveedor.trim()}%`
      );

      sql += `
        AND EXISTS (
          SELECT 1

          FROM proveedor_productos pp_filtro

          INNER JOIN proveedores pr_filtro
            ON pr_filtro.id =
               pp_filtro.proveedor_id

          WHERE
            pp_filtro.producto_id =
              p.id

            AND pr_filtro.activo =
              TRUE

            AND pr_filtro.nombre ILIKE
              $${params.length}
        )
      `;
    }

    // =====================================================
    // FECHA DESDE
    // =====================================================

    if (desde) {
      params.push(
        desde
      );

      sql += `
        AND DATE(
          m.created_at
        ) >=
          $${params.length}
      `;
    }

    // =====================================================
    // FECHA HASTA
    // =====================================================

    if (hasta) {
      params.push(
        hasta
      );

      sql += `
        AND DATE(
          m.created_at
        ) <=
          $${params.length}
      `;
    }

    // =====================================================
    // ORDEN
    // =====================================================

    sql += `
      ORDER BY
        m.created_at DESC,
        m.id DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    return res.json(
      result.rows
    );
  } catch (error) {
    console.error(
      "Error getKardex:",
      error
    );

    return res.status(500).json({
      message:
        "No fue posible consultar el Kardex",
      error:
        error.message
    });
  }
};

// =========================================================
// KARDEX POR PRODUCTO
// =========================================================

const getKardexProducto =
  async (
    req,
    res
  ) => {
    try {
      if (!req.usuario) {
        return res.status(401).json({
          message:
            "Usuario no autenticado"
        });
      }

      const productoId =
        Number(
          req.params.producto_id
        );

      if (
        !Number.isFinite(
          productoId
        ) ||
        productoId <= 0
      ) {
        return res.status(400).json({
          message:
            "Producto inválido"
        });
      }

      const params = [
        productoId
      ];

      let sql = `
        SELECT
          m.id,

          m.producto_id,

          p.nombre
            AS producto_nombre,

          p.sku,

          p.unidad_medida,

          (
            SELECT
              STRING_AGG(
                DISTINCT pr.nombre,
                ', '
                ORDER BY pr.nombre
              )

            FROM proveedor_productos pp

            INNER JOIN proveedores pr
              ON pr.id =
                 pp.proveedor_id

            WHERE
              pp.producto_id =
                p.id

              AND pr.activo =
                TRUE
          )
            AS proveedor_nombre,

          c.id
            AS categoria_id,

          c.nombre
            AS categoria_nombre,

          c.tipo
            AS categoria_tipo,

          c.ubicacion_propietaria_id
            AS categoria_ubicacion_propietaria_id,

          m.ubicacion_id,

          u.nombre
            AS ubicacion_nombre,

          u.tipo
            AS ubicacion_tipo,

          m.tipo,

          m.cantidad,

          m.motivo,

          m.referencia_tipo,

          m.referencia_id,

          m.usuario_id,

          us.nombre
            AS usuario_nombre,

          m.created_at

        FROM movimientos m

        INNER JOIN productos p
          ON m.producto_id =
             p.id

        INNER JOIN ubicaciones u
          ON m.ubicacion_id =
             u.id

        INNER JOIN usuarios us
          ON m.usuario_id =
             us.id

        LEFT JOIN categorias c
          ON p.categoria_id =
             c.id

        WHERE
          m.producto_id =
            $1

          AND p.activo =
            TRUE

          AND u.activo =
            TRUE
      `;

      // ===================================================
      // UBICACIONES
      // ===================================================

      if (!esPrincipal(req)) {
        const ubicacionUsuario =
          obtenerUbicacionUsuario(req);

        if (!ubicacionUsuario) {
          return res.status(400).json({
            message:
              "El usuario no tiene una ubicación válida"
          });
        }

        params.push(
          ubicacionUsuario
        );

        if (
          ubicacionUsuario === 1
        ) {
          sql += `
            AND m.ubicacion_id =
              $${params.length}
          `;
        } else {
          params.push(
            1
          );

          sql += `
            AND m.ubicacion_id IN (
              $${params.length - 1},
              $${params.length}
            )
          `;
        }
      }

      sql =
        agregarFiltroCategoriaVisible(
          sql,
          params,
          req,
          "c"
        );

      sql += `
        ORDER BY
          m.created_at DESC,
          m.id DESC
      `;

      const result =
        await pool.query(
          sql,
          params
        );

      return res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "Error getKardexProducto:",
        error
      );

      return res.status(500).json({
        message:
          "Error al obtener el Kardex",
        error:
          error.message
      });
    }
  };

// =========================================================
// CONSUMO
// =========================================================

const getConsumo = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    const {
      desde,
      hasta
    } = req.query;

    const params = [];

    let sql = `
      SELECT
        m.ubicacion_id,

        u.nombre
          AS ubicacion_nombre,

        u.tipo
          AS ubicacion_tipo,

        m.producto_id,

        p.nombre
          AS producto_nombre,

        p.sku,

        p.unidad_medida,

        c.id
          AS categoria_id,

        c.nombre
          AS categoria_nombre,

        c.tipo
          AS categoria_tipo,

        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        SUM(
          m.cantidad
        )
          AS consumo_total,

        COUNT(
          m.id
        )
          AS movimientos_salida

      FROM movimientos m

      INNER JOIN ubicaciones u
        ON m.ubicacion_id =
           u.id

      INNER JOIN productos p
        ON m.producto_id =
           p.id

      LEFT JOIN categorias c
        ON p.categoria_id =
           c.id

      WHERE
        m.tipo =
          'salida'

        AND u.activo =
          TRUE

        AND p.activo =
          TRUE
    `;

    if (!esPrincipal(req)) {
      const ubicacionUsuario =
        obtenerUbicacionUsuario(req);

      if (!ubicacionUsuario) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
        });
      }

      params.push(
        ubicacionUsuario
      );

      sql += `
        AND m.ubicacion_id =
          $${params.length}
      `;
    }

    sql =
      agregarFiltroCategoriaVisible(
        sql,
        params,
        req,
        "c"
      );

    if (desde) {
      params.push(
        desde
      );

      sql += `
        AND DATE(
          m.created_at
        ) >=
          $${params.length}
      `;
    }

    if (hasta) {
      params.push(
        hasta
      );

      sql += `
        AND DATE(
          m.created_at
        ) <=
          $${params.length}
      `;
    }

    sql += `
      GROUP BY
        m.ubicacion_id,

        u.nombre,

        u.tipo,

        m.producto_id,

        p.nombre,

        p.sku,

        p.unidad_medida,

        c.id,

        c.nombre,

        c.tipo,

        c.ubicacion_propietaria_id

      ORDER BY
        consumo_total DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    return res.json({
      desde:
        desde || null,

      hasta:
        hasta || null,

      consumo:
        result.rows
    });
  } catch (error) {
    console.error(
      "Error getConsumo:",
      error
    );

    return res.status(500).json({
      message:
        "Error al obtener el reporte de consumo",
      error:
        error.message
    });
  }
};

// =========================================================
// SOLICITUDES
// =========================================================

const getSolicitudesReporte =
  async (
    req,
    res
  ) => {
    try {
      if (!req.usuario) {
        return res.status(401).json({
          message:
            "Usuario no autenticado"
        });
      }

      const params = [];

      let sql = `
        SELECT
          s.id,

          s.estado,

          s.destino_ubicacion_id,

          destino.nombre
            AS destino_ubicacion_nombre,

          destino.tipo
            AS destino_ubicacion_tipo,

          s.solicitante_ubicacion_id,

          solicitante.nombre
            AS solicitante_ubicacion_nombre,

          solicitante.tipo
            AS solicitante_ubicacion_tipo,

          creador.nombre
            AS creado_por_usuario_nombre,

          s.created_at,

          s.updated_at

        FROM solicitudes s

        INNER JOIN ubicaciones destino
          ON s.destino_ubicacion_id =
             destino.id

        INNER JOIN ubicaciones solicitante
          ON s.solicitante_ubicacion_id =
             solicitante.id

        INNER JOIN usuarios creador
          ON s.creado_por_usuario_id =
             creador.id

        WHERE
          1 = 1
      `;

      if (!esPrincipal(req)) {
        const ubicacionUsuario =
          obtenerUbicacionUsuario(req);

        if (!ubicacionUsuario) {
          return res.status(400).json({
            message:
              "El usuario no tiene una ubicación válida"
          });
        }

        params.push(
          ubicacionUsuario
        );

        sql += `
          AND (
            s.destino_ubicacion_id =
              $${params.length}

            OR

            s.solicitante_ubicacion_id =
              $${params.length}
          )
        `;
      }

      sql += `
        ORDER BY
          s.created_at DESC
      `;

      const result =
        await pool.query(
          sql,
          params
        );

      return res.json(
        result.rows
      );
    } catch (error) {
      console.error(
        "Error getSolicitudesReporte:",
        error
      );

      return res.status(500).json({
        message:
          "Error al obtener historial de solicitudes",
        error:
          error.message
      });
    }
  };

// =========================================================
// RESUMEN
// =========================================================

const getResumen = async (
  req,
  res
) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({
        message:
          "Usuario no autenticado"
      });
    }

    if (!esPrincipal(req)) {
      return res.status(403).json({
        message:
          "El resumen global es exclusivo de Central"
      });
    }

    const ubicacionesResult =
      await pool.query(`
        SELECT
          COUNT(*) AS total

        FROM ubicaciones

        WHERE
          activo = TRUE
      `);

    const productosResult =
      await pool.query(`
        SELECT
          COUNT(DISTINCT p.id)
            AS total

        FROM productos p

        LEFT JOIN categorias c
          ON p.categoria_id =
             c.id

        WHERE
          p.activo =
            TRUE
      `);

    const alertasResult =
      await pool.query(`
        SELECT
          COUNT(*) AS total

        FROM inventario i

        INNER JOIN productos p
          ON i.producto_id =
             p.id

        INNER JOIN ubicaciones u
          ON i.ubicacion_id =
             u.id

        WHERE
          u.activo =
            TRUE

          AND p.activo =
            TRUE

          AND p.punto_reorden
            IS NOT NULL

          AND i.cantidad <
            p.punto_reorden
      `);

    const solicitudesResult =
      await pool.query(`
        SELECT
          estado,

          COUNT(*) AS total

        FROM solicitudes

        GROUP BY
          estado
      `);

    return res.json({
      ubicaciones_activas:
        Number(
          ubicacionesResult
            .rows[0]
            .total
        ),

      productos_activos:
        Number(
          productosResult
            .rows[0]
            .total
        ),

      alertas_stock_bajo:
        Number(
          alertasResult
            .rows[0]
            .total
        ),

      solicitudes:
        solicitudesResult.rows
    });
  } catch (error) {
    console.error(
      "Error getResumen:",
      error
    );

    return res.status(500).json({
      message:
        "Error al obtener el resumen",
      error:
        error.message
    });
  }
};

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  getInventario,
  getAlertas,
  getKardex,
  getKardexProducto,
  getConsumo,
  getSolicitudesReporte,
  getResumen
};