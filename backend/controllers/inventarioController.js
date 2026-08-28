const pool = require("../config/db");

const getInventario = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        i.id,
        i.cantidad,
        i.updated_at,

        u.id AS ubicacion_id,
        u.nombre AS ubicacion_nombre,
        u.tipo AS ubicacion_tipo,

        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,
        p.punto_reorden,

        c.id AS categoria_id,
        c.nombre AS categoria_nombre

      FROM inventario i

      INNER JOIN ubicaciones u
        ON i.ubicacion_id = u.id

      INNER JOIN productos p
        ON i.producto_id = p.id

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      ORDER BY
        u.nombre,
        p.nombre
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el inventario",
      error: error.message
    });
  }
};

const getInventarioByUbicacion = async (req, res) => {
  try {
    const { ubicacionId } = req.params;

    const [ubicaciones] = await pool.query(
      `
        SELECT id, nombre, tipo
        FROM ubicaciones
        WHERE id = ? AND activo = TRUE
      `,
      [ubicacionId]
    );

    if (ubicaciones.length === 0) {
      return res.status(404).json({
        message: "Ubicación no encontrada"
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          i.id,
          i.cantidad,
          i.updated_at,

          p.id AS producto_id,
          p.nombre AS producto_nombre,
          p.descripcion,
          p.sku,
          p.unidad_medida,
          p.punto_reorden,

          c.id AS categoria_id,
          c.nombre AS categoria_nombre

        FROM inventario i

        INNER JOIN productos p
          ON i.producto_id = p.id

        LEFT JOIN categorias c
          ON p.categoria_id = c.id

        WHERE i.ubicacion_id = ?

        ORDER BY p.nombre
      `,
      [ubicacionId]
    );

    res.json({
      ubicacion: ubicaciones[0],
      inventario: rows
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el inventario de la ubicación",
      error: error.message
    });
  }
};

const setStockInicial = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      ubicacion_id,
      producto_id,
      cantidad
    } = req.body;

    if (
      ubicacion_id === undefined ||
      producto_id === undefined ||
      cantidad === undefined
    ) {
      return res.status(400).json({
        message:
          "ubicacion_id, producto_id y cantidad son obligatorios"
      });
    }

    const cantidadNumero = Number(cantidad);

    if (
      Number.isNaN(cantidadNumero) ||
      cantidadNumero < 0
    ) {
      return res.status(400).json({
        message:
          "La cantidad debe ser un número mayor o igual a 0"
      });
    }

    const [ubicaciones] = await connection.query(
      `
        SELECT id
        FROM ubicaciones
        WHERE id = ? AND activo = TRUE
      `,
      [ubicacion_id]
    );

    if (ubicaciones.length === 0) {
      return res.status(404).json({
        message: "La ubicación no existe"
      });
    }

    const [productos] = await connection.query(
      `
        SELECT id
        FROM productos
        WHERE id = ? AND activo = TRUE
      `,
      [producto_id]
    );

    if (productos.length === 0) {
      return res.status(404).json({
        message: "El producto no existe"
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO inventario (
          ubicacion_id,
          producto_id,
          cantidad
        )
        VALUES (?, ?, ?)

        ON DUPLICATE KEY UPDATE
          cantidad = VALUES(cantidad)
      `,
      [
        ubicacion_id,
        producto_id,
        cantidadNumero
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: "Stock inicial registrado correctamente",
      ubicacion_id,
      producto_id,
      cantidad: cantidadNumero
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al registrar el stock inicial",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getInventario,
  getInventarioByUbicacion,
  setStockInicial
};