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

const agregarFiltroCategoriaVisible = (
  sql,
  params,
  req,
  aliasCategoria = "c"
) => {
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
        AND ${aliasCategoria}.ubicacion_propietaria_id =
          $${params.length}
      )
    )
  `;
};

// =========================================================
// REPORTE DE INVENTARIO
// Cada usuario consulta exclusivamente su ubicación.
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

    const ubicacionUsuario =
      obtenerUbicacionUsuario(req);

    if (!ubicacionUsuario) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    const {
      categoria_id,
      ubicacion_id
    } = req.query;

    if (
      ubicacion_id &&
      Number(ubicacion_id) !==
        ubicacionUsuario
    ) {
      return res.status(403).json({
        message:
          "Solo puedes consultar el inventario de tu propia ubicación"
      });
    }

    const params = [
      ubicacionUsuario
    ];

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
            SELECT STRING_AGG(
              DISTINCT pr.nombre,
              ', ' ORDER BY pr.nombre
            )
            FROM proveedor_productos pp
            INNER JOIN proveedores pr
              ON pr.id = pp.proveedor_id
            WHERE pp.producto_id = p.id
              AND pr.activo = TRUE
          ),
          'Sin proveedor'
        ) AS proveedor_nombre,

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

          THEN 1

          ELSE 0
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
        i.ubicacion_id = $1

        AND u.activo = TRUE

        AND p.activo = TRUE
    `;

    sql =
      agregarFiltroCategoriaVisible(
        sql,
        params,
        req,
        "c"
      );

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
    return res.status(500).json({
      message:
        "Error al obtener el reporte de inventario",

      error:
        error.message
    });
  }
};

// =========================================================
// ALERTAS DE STOCK
// Solo de la ubicación autenticada.
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

    const ubicacionUsuario =
      obtenerUbicacionUsuario(req);

    if (!ubicacionUsuario) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    const params = [
      ubicacionUsuario
    ];

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
        i.ubicacion_id = $1

        AND p.activo = TRUE

        AND u.activo = TRUE

        AND p.punto_reorden IS NOT NULL

        AND i.cantidad <
          p.punto_reorden
    `;

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
    return res.status(500).json({
      message:
        "Error al obtener alertas de stock",

      error:
        error.message
    });
  }
};

// =========================================================
// KARDEX POR PRODUCTO
// Solo movimientos del producto dentro de la ubicación
// autenticada.
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

      const ubicacionUsuario =
        obtenerUbicacionUsuario(
          req
        );

      if (!ubicacionUsuario) {
        return res.status(400).json({
          message:
            "El usuario no tiene una ubicación válida"
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
        productoId,
        ubicacionUsuario
      ];

      let sql = `
        SELECT
          m.id,

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
          m.producto_id = $1

          AND m.ubicacion_id = $2

          AND p.activo = TRUE

          AND u.activo = TRUE
      `;

      sql =
        agregarFiltroCategoriaVisible(
          sql,
          params,
          req,
          "c"
        );

      sql += `
        ORDER BY
          m.created_at DESC
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
      return res.status(500).json({
        message:
          "Error al obtener el Kardex",

        error:
          error.message
      });
    }
  };

// =========================================================
// KARDEX GENERAL
// Permite buscar por:
// nombre, SKU, proveedor y rango de fechas.
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

    const ubicacionUsuario =
      obtenerUbicacionUsuario(req);

    if (!ubicacionUsuario) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    const {
      nombre,
      sku,
      proveedor,
      desde,
      hasta
    } = req.query;

    const params = [
      ubicacionUsuario
    ];

    let sql = `
      SELECT
        m.id,

        m.producto_id,

        p.nombre
          AS producto_nombre,

        p.sku,

        p.unidad_medida,

        COALESCE(
          (
            SELECT STRING_AGG(
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
        m.ubicacion_id =
          $1

        AND p.activo = TRUE

        AND u.activo = TRUE
    `;

    sql =
      agregarFiltroCategoriaVisible(
        sql,
        params,
        req,
        "c"
      );

    // =====================================================
    // FILTRO POR NOMBRE
    // =====================================================

    if (nombre?.trim()) {
      params.push(
        `%${nombre.trim()}%`
      );

      sql += `
        AND LOWER(
          p.nombre
        ) LIKE LOWER(
          $${params.length}
        )
      `;
    }

    // =====================================================
    // FILTRO POR SKU
    // =====================================================

    if (sku?.trim()) {
      params.push(
        `%${sku.trim()}%`
      );

      sql += `
        AND LOWER(
          p.sku
        ) LIKE LOWER(
          $${params.length}
        )
      `;
    }

    // =====================================================
    // FILTRO POR PROVEEDOR
    // =====================================================

    if (proveedor?.trim()) {
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

            AND LOWER(
              pr_filtro.nombre
            ) LIKE LOWER(
              $${params.length}
            )
        )
      `;
    }

    // =====================================================
    // FILTRO DESDE
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
    // FILTRO HASTA
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

    sql += `
      ORDER BY
        m.created_at DESC
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
// Solo movimientos de salida de la ubicación propia.
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

    const ubicacionUsuario =
      obtenerUbicacionUsuario(req);

    if (!ubicacionUsuario) {
      return res.status(400).json({
        message:
          "El usuario no tiene una ubicación válida"
      });
    }

    const {
      desde,
      hasta
    } = req.query;

    const params = [
      ubicacionUsuario
    ];

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
        m.tipo = 'salida'

        AND m.ubicacion_id =
          $1

        AND u.activo = TRUE

        AND p.activo = TRUE
    `;

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
    return res.status(500).json({
      message:
        "Error al obtener el reporte de consumo",

      error:
        error.message
    });
  }
};

// =========================================================
// HISTORIAL DE SOLICITUDES
// Central puede administrar solicitudes.
// Sucursales / Equipos Internos solo ven solicitudes donde
// participan como solicitante o destino.
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

        WHERE 1 = 1
      `;

      const params = [];

      if (
        req.usuario.rol !==
        "principal"
      ) {
        const ubicacionUsuario =
          obtenerUbicacionUsuario(
            req
          );

        if (!ubicacionUsuario) {
          return res.status(400).json({
            message:
              "El usuario no tiene una ubicación válida"
          });
        }

        params.push(
          ubicacionUsuario,
          ubicacionUsuario
        );

        sql += `
          AND (
            s.destino_ubicacion_id =
              $${params.length - 1}

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
// Sigue siendo administrativo y exclusivo de Central.
// No expone stock ni productos de ubicaciones individuales.
// =========================================================

const getResumen = async (
  req,
  res
) => {
  try {
    if (
      req.usuario?.rol !==
      "principal"
    ) {
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

        WHERE activo = TRUE
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
          p.activo = TRUE

          AND (
            c.id IS NULL

            OR c.tipo IS NULL

            OR c.tipo = 'global'
          )
      `);

    const alertasResult =
      await pool.query(
        `
          SELECT
            COUNT(*)
              AS total

          FROM inventario i

          INNER JOIN productos p
            ON i.producto_id =
               p.id

          LEFT JOIN categorias c
            ON p.categoria_id =
               c.id

          WHERE
            i.ubicacion_id =
              $1

            AND p.activo =
              TRUE

            AND p.punto_reorden
              IS NOT NULL

            AND i.cantidad <
              p.punto_reorden

            AND (
              c.id IS NULL

              OR c.tipo IS NULL

              OR c.tipo =
                'global'
            )
        `,
        [
          Number(
            req.usuario
              .ubicacion_id
          )
        ]
      );

    const solicitudesResult =
      await pool.query(`
        SELECT
          estado,

          COUNT(*)
            AS total

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
    return res.status(500).json({
      message:
        "Error al obtener el resumen",

      error:
        error.message
    });
  }
};

module.exports = {
  getInventario,
  getAlertas,
  getKardexProducto,
  getKardex,
  getConsumo,
  getSolicitudesReporte,
  getResumen
};