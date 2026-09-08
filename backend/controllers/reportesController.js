const pool = require("../config/db");

const CENTRAL_ID = 1;


// =========================================================
// UBICACIONES PERMITIDAS
// =========================================================

const ubicacionesPermitidas = (req) => {
  if (req.usuario.rol === "principal") {
    return null;
  }

  return [
    CENTRAL_ID,
    Number(req.usuario.ubicacion_id)
  ];
};


// =========================================================
// FILTRO DE PRIVACIDAD DE CATEGORÍAS / PRODUCTOS
// =========================================================

const agregarFiltroCategorias = (
  sql,
  params,
  req,
  aliasCategoria = "c"
) => {
  // Central puede consultar todo.
  if (req.usuario.rol === "principal") {
    return sql;
  }

  // Equipo Interno:
  // - categorías globales
  // - sus propias categorías privadas
  if (req.usuario.rol === "equipo_interno") {
    params.push(
      Number(req.usuario.ubicacion_id)
    );

    sql += `
      AND (
        ${aliasCategoria}.tipo = 'global'
        OR (
          ${aliasCategoria}.tipo = 'privada'
          AND
          ${aliasCategoria}.ubicacion_propietaria_id =
            $${params.length}
        )
      )
    `;

    return sql;
  }

  // Sucursal:
  // únicamente categorías globales.
  if (req.usuario.rol === "sucursal") {
    sql += `
      AND ${aliasCategoria}.tipo = 'global'
    `;

    return sql;
  }

  // Cualquier rol desconocido no obtiene información.
  sql += `
    AND 1 = 0
  `;

  return sql;
};


// =========================================================
// INVENTARIO
// =========================================================

const getInventario = async (req, res) => {
  try {
    const {
      categoria_id,
      ubicacion_id
    } = req.query;

    const permitidas =
      ubicacionesPermitidas(req);

    if (
      permitidas &&
      ubicacion_id &&
      !permitidas.includes(
        Number(ubicacion_id)
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permiso para consultar esa ubicación"
      });
    }

    let sql = `
      SELECT
        i.ubicacion_id,
        u.nombre AS ubicacion_nombre,
        u.tipo AS ubicacion_tipo,

        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,
        p.punto_reorden,

        c.id AS categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,
        c.ubicacion_propietaria_id
          AS categoria_ubicacion_propietaria_id,

        i.cantidad,

        CASE
          WHEN i.cantidad < p.punto_reorden
          THEN 1
          ELSE 0
        END AS stock_bajo

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      INNER JOIN categorias c
        ON p.categoria_id = c.id

      WHERE p.activo = TRUE
        AND u.activo = TRUE
        AND c.activo = TRUE
    `;

    const params = [];

    if (permitidas) {
      params.push(
        permitidas[0],
        permitidas[1]
      );

      sql += `
        AND i.ubicacion_id IN (
          $${params.length - 1},
          $${params.length}
        )
      `;
    }

    sql = agregarFiltroCategorias(
      sql,
      params,
      req,
      "c"
    );

    if (ubicacion_id) {
      params.push(
        Number(ubicacion_id)
      );

      sql += `
        AND i.ubicacion_id =
          $${params.length}
      `;
    }

    if (categoria_id) {
      params.push(
        Number(categoria_id)
      );

      sql += `
        AND p.categoria_id =
          $${params.length}
      `;
    }

    sql += `
      ORDER BY
        u.nombre,
        c.nombre,
        p.nombre
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Error getInventario:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener el reporte de inventario",
      error: error.message
    });
  }
};


// =========================================================
// ALERTAS
// =========================================================

const getAlertas = async (req, res) => {
  try {
    const permitidas =
      ubicacionesPermitidas(req);

    let sql = `
      SELECT
        i.ubicacion_id,
        u.nombre AS ubicacion_nombre,

        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,

        c.id AS categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,

        i.cantidad AS stock_actual,
        p.punto_reorden,

        (
          p.punto_reorden -
          i.cantidad
        ) AS faltante_para_reorden

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      INNER JOIN categorias c
        ON p.categoria_id = c.id

      WHERE
        p.activo = TRUE
        AND c.activo = TRUE
        AND u.activo = TRUE
        AND i.cantidad < p.punto_reorden
    `;

    const params = [];

    if (permitidas) {
      params.push(
        permitidas[0],
        permitidas[1]
      );

      sql += `
        AND i.ubicacion_id IN (
          $${params.length - 1},
          $${params.length}
        )
      `;
    }

    sql = agregarFiltroCategorias(
      sql,
      params,
      req,
      "c"
    );

    sql += `
      ORDER BY
        faltante_para_reorden DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    res.json({
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

    res.status(500).json({
      message:
        "Error al obtener alertas de stock",
      error: error.message
    });
  }
};


// =========================================================
// KARDEX
// =========================================================

const getKardexProducto = async (
  req,
  res
) => {
  try {
    const { producto_id } =
      req.params;

    const permitidas =
      ubicacionesPermitidas(req);

    const params = [
      Number(producto_id)
    ];

    let sql = `
      SELECT
        m.id,
        m.producto_id,

        p.nombre AS producto_nombre,
        p.sku,

        c.id AS categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,

        m.ubicacion_id,
        u.nombre AS ubicacion_nombre,

        m.tipo,
        m.cantidad,
        m.motivo,
        m.referencia_tipo,
        m.referencia_id,

        m.usuario_id,
        us.nombre AS usuario_nombre,

        m.created_at

      FROM movimientos m

      INNER JOIN productos p
        ON m.producto_id = p.id

      INNER JOIN categorias c
        ON p.categoria_id = c.id

      INNER JOIN ubicaciones u
        ON m.ubicacion_id = u.id

      INNER JOIN usuarios us
        ON m.usuario_id = us.id

      WHERE m.producto_id = $1
    `;

    if (permitidas) {
      params.push(
        permitidas[0],
        permitidas[1]
      );

      sql += `
        AND m.ubicacion_id IN (
          $${params.length - 1},
          $${params.length}
        )
      `;
    }

    sql = agregarFiltroCategorias(
      sql,
      params,
      req,
      "c"
    );

    sql += `
      ORDER BY m.created_at DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Error getKardexProducto:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener el Kardex",
      error: error.message
    });
  }
};


// =========================================================
// CONSUMO
// =========================================================

const getConsumo = async (req, res) => {
  try {
    const {
      desde,
      hasta
    } = req.query;

    const permitidas =
      ubicacionesPermitidas(req);

    let sql = `
      SELECT
        m.ubicacion_id,
        u.nombre AS ubicacion_nombre,

        m.producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,

        c.id AS categoria_id,
        c.nombre AS categoria_nombre,
        c.tipo AS categoria_tipo,

        SUM(m.cantidad)
          AS consumo_total,

        COUNT(m.id)
          AS movimientos_salida

      FROM movimientos m

      INNER JOIN ubicaciones u
        ON m.ubicacion_id = u.id

      INNER JOIN productos p
        ON m.producto_id = p.id

      INNER JOIN categorias c
        ON p.categoria_id = c.id

      WHERE m.tipo = 'salida'
    `;

    const params = [];

    if (permitidas) {
      params.push(
        permitidas[0],
        permitidas[1]
      );

      sql += `
        AND m.ubicacion_id IN (
          $${params.length - 1},
          $${params.length}
        )
      `;
    }

    sql = agregarFiltroCategorias(
      sql,
      params,
      req,
      "c"
    );

    if (desde) {
      params.push(desde);

      sql += `
        AND DATE(m.created_at) >=
          $${params.length}
      `;
    }

    if (hasta) {
      params.push(hasta);

      sql += `
        AND DATE(m.created_at) <=
          $${params.length}
      `;
    }

    sql += `
      GROUP BY
        m.ubicacion_id,
        u.nombre,
        m.producto_id,
        p.nombre,
        p.sku,
        p.unidad_medida,
        c.id,
        c.nombre,
        c.tipo

      ORDER BY
        consumo_total DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    res.json({
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

    res.status(500).json({
      message:
        "Error al obtener el reporte de consumo",
      error: error.message
    });
  }
};


// =========================================================
// HISTORIAL DE SOLICITUDES
// =========================================================

const getSolicitudesReporte = async (
  req,
  res
) => {
  try {
    const permitidas =
      ubicacionesPermitidas(req);

    let sql = `
      SELECT
        s.id,
        s.estado,
        s.destino_ubicacion_id,

        destino.nombre
          AS destino_ubicacion_nombre,

        s.solicitante_ubicacion_id,

        solicitante.nombre
          AS solicitante_ubicacion_nombre,

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

    if (permitidas) {
      params.push(
        Number(
          req.usuario.ubicacion_id
        ),
        Number(
          req.usuario.ubicacion_id
        )
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
      ORDER BY s.created_at DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Error getSolicitudesReporte:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener historial de solicitudes",
      error: error.message
    });
  }
};


// =========================================================
// RESUMEN GLOBAL
// =========================================================

const getResumen = async (req, res) => {
  try {
    if (
      req.usuario.rol !==
      "principal"
    ) {
      return res.status(403).json({
        message:
          "El resumen global es exclusivo de Central"
      });
    }

    const ubicacionesResult =
      await pool.query(`
        SELECT COUNT(*) AS total
        FROM ubicaciones
        WHERE activo = TRUE
      `);

    const productosResult =
      await pool.query(`
        SELECT COUNT(*) AS total
        FROM productos
        WHERE activo = TRUE
      `);

    const alertasResult =
      await pool.query(`
        SELECT COUNT(*) AS total

        FROM inventario i

        INNER JOIN productos p
          ON i.producto_id = p.id

        WHERE
          p.activo = TRUE
          AND
          i.cantidad <
          p.punto_reorden
      `);

    const solicitudesResult =
      await pool.query(`
        SELECT
          estado,
          COUNT(*) AS total

        FROM solicitudes

        GROUP BY estado
      `);

    res.json({
      ubicaciones_activas:
        Number(
          ubicacionesResult
            .rows[0].total
        ),

      productos_activos:
        Number(
          productosResult
            .rows[0].total
        ),

      alertas_stock_bajo:
        Number(
          alertasResult
            .rows[0].total
        ),

      solicitudes:
        solicitudesResult.rows
    });
  } catch (error) {
    console.error(
      "Error getResumen:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener el resumen",
      error: error.message
    });
  }
};


module.exports = {
  getInventario,
  getAlertas,
  getKardexProducto,
  getConsumo,
  getSolicitudesReporte,
  getResumen
};