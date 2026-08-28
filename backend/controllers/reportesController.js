const pool = require("../config/db");

const CENTRAL_ID = 1;

const ubicacionesPermitidas = (req) => {
  if (req.usuario.rol === "principal") {
    return null;
  }

  return [
    CENTRAL_ID,
    Number(req.usuario.ubicacion_id)
  ];
};

const getInventario = async (req, res) => {
  try {
    const { categoria_id, ubicacion_id } = req.query;

    const permitidas = ubicacionesPermitidas(req);

    if (
      permitidas &&
      ubicacion_id &&
      !permitidas.includes(Number(ubicacion_id))
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

      WHERE p.activo = 1
        AND u.activo = 1
    `;

    const params = [];

    if (permitidas) {
      sql += `
        AND i.ubicacion_id IN (?, ?)
      `;

      params.push(
        permitidas[0],
        permitidas[1]
      );
    }

    if (ubicacion_id) {
      sql += `
        AND i.ubicacion_id = ?
      `;

      params.push(Number(ubicacion_id));
    }

    if (categoria_id) {
      sql += `
        AND p.categoria_id = ?
      `;

      params.push(Number(categoria_id));
    }

    sql += `
      ORDER BY
        u.nombre,
        c.nombre,
        p.nombre
    `;

    const [rows] = await pool.query(
      sql,
      params
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener el reporte de inventario",
      error: error.message
    });
  }
};

const getAlertas = async (req, res) => {
  try {
    const permitidas = ubicacionesPermitidas(req);

    let sql = `
      SELECT
        i.ubicacion_id,
        u.nombre AS ubicacion_nombre,

        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,

        i.cantidad AS stock_actual,
        p.punto_reorden,

        (p.punto_reorden - i.cantidad)
          AS faltante_para_reorden

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      WHERE
        p.activo = 1
        AND u.activo = 1
        AND i.cantidad < p.punto_reorden
    `;

    const params = [];

    if (permitidas) {
      sql += `
        AND i.ubicacion_id IN (?, ?)
      `;

      params.push(
        permitidas[0],
        permitidas[1]
      );
    }

    sql += `
      ORDER BY
        faltante_para_reorden DESC
    `;

    const [rows] = await pool.query(
      sql,
      params
    );

    res.json({
      total_alertas: rows.length,
      alertas: rows
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener alertas de stock",
      error: error.message
    });
  }
};

const getKardexProducto = async (req, res) => {
  try {
    const { producto_id } = req.params;

    const permitidas = ubicacionesPermitidas(req);

    let sql = `
      SELECT
        m.id,
        m.producto_id,
        p.nombre AS producto_nombre,
        p.sku,

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

      INNER JOIN ubicaciones u
        ON m.ubicacion_id = u.id

      INNER JOIN usuarios us
        ON m.usuario_id = us.id

      WHERE m.producto_id = ?
    `;

    const params = [
      Number(producto_id)
    ];

    if (permitidas) {
      sql += `
        AND m.ubicacion_id IN (?, ?)
      `;

      params.push(
        permitidas[0],
        permitidas[1]
      );
    }

    sql += `
      ORDER BY m.created_at DESC
    `;

    const [rows] = await pool.query(
      sql,
      params
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el Kardex",
      error: error.message
    });
  }
};

const getConsumo = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    const permitidas = ubicacionesPermitidas(req);

    let sql = `
      SELECT
        m.ubicacion_id,
        u.nombre AS ubicacion_nombre,

        m.producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,

        SUM(m.cantidad) AS consumo_total,
        COUNT(m.id) AS movimientos_salida

      FROM movimientos m

      INNER JOIN ubicaciones u
        ON m.ubicacion_id = u.id

      INNER JOIN productos p
        ON m.producto_id = p.id

      WHERE m.tipo = 'salida'
    `;

    const params = [];

    if (permitidas) {
      sql += `
        AND m.ubicacion_id IN (?, ?)
      `;

      params.push(
        permitidas[0],
        permitidas[1]
      );
    }

    if (desde) {
      sql += `
        AND DATE(m.created_at) >= ?
      `;

      params.push(desde);
    }

    if (hasta) {
      sql += `
        AND DATE(m.created_at) <= ?
      `;

      params.push(hasta);
    }

    sql += `
      GROUP BY
        m.ubicacion_id,
        u.nombre,
        m.producto_id,
        p.nombre,
        p.sku,
        p.unidad_medida

      ORDER BY consumo_total DESC
    `;

    const [rows] = await pool.query(
      sql,
      params
    );

    res.json({
      desde: desde || null,
      hasta: hasta || null,
      consumo: rows
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener el reporte de consumo",
      error: error.message
    });
  }
};

const getSolicitudesReporte = async (
  req,
  res
) => {
  try {
    const permitidas = ubicacionesPermitidas(req);

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
        ON s.destino_ubicacion_id = destino.id

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
      sql += `
        AND (
          s.destino_ubicacion_id = ?
          OR
          s.solicitante_ubicacion_id = ?
        )
      `;

      params.push(
        Number(req.usuario.ubicacion_id),
        Number(req.usuario.ubicacion_id)
      );
    }

    sql += `
      ORDER BY s.created_at DESC
    `;

    const [rows] = await pool.query(
      sql,
      params
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener historial de solicitudes",
      error: error.message
    });
  }
};

const getResumen = async (req, res) => {
  try {
    if (req.usuario.rol !== "principal") {
      return res.status(403).json({
        message:
          "El resumen global es exclusivo de Central"
      });
    }

    const [ubicaciones] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM ubicaciones
      WHERE activo = 1
    `);

    const [productos] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM productos
      WHERE activo = 1
    `);

    const [alertas] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM inventario i

      INNER JOIN productos p
        ON i.producto_id = p.id

      WHERE
        p.activo = 1
        AND i.cantidad < p.punto_reorden
    `);

    const [solicitudes] = await pool.query(`
      SELECT
        estado,
        COUNT(*) AS total
      FROM solicitudes
      GROUP BY estado
    `);

    res.json({
      ubicaciones_activas:
        Number(ubicaciones[0].total),

      productos_activos:
        Number(productos[0].total),

      alertas_stock_bajo:
        Number(alertas[0].total),

      solicitudes
    });
  } catch (error) {
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