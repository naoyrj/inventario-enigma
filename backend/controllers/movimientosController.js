const pool = require("../config/db");

const getMovimientos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        m.id,
        m.tipo,
        m.cantidad,
        m.motivo,
        m.referencia_tipo,
        m.referencia_id,
        m.created_at,

        u.id AS ubicacion_id,
        u.nombre AS ubicacion_nombre,

        p.id AS producto_id,
        p.nombre AS producto_nombre,
        p.sku,
        p.unidad_medida,

        us.id AS usuario_id,
        us.nombre AS usuario_nombre

      FROM movimientos m

      INNER JOIN ubicaciones u
        ON m.ubicacion_id = u.id

      INNER JOIN productos p
        ON m.producto_id = p.id

      INNER JOIN usuarios us
        ON m.usuario_id = us.id

      ORDER BY m.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener los movimientos",
      error: error.message
    });
  }
};

const getMovimientosByUbicacion = async (req, res) => {
  try {
    const { ubicacionId } = req.params;

    const [rows] = await pool.query(
      `
        SELECT
          m.id,
          m.tipo,
          m.cantidad,
          m.motivo,
          m.referencia_tipo,
          m.referencia_id,
          m.created_at,

          p.id AS producto_id,
          p.nombre AS producto_nombre,
          p.sku,
          p.unidad_medida,

          us.id AS usuario_id,
          us.nombre AS usuario_nombre

        FROM movimientos m

        INNER JOIN productos p
          ON m.producto_id = p.id

        INNER JOIN usuarios us
          ON m.usuario_id = us.id

        WHERE m.ubicacion_id = ?

        ORDER BY m.created_at DESC
      `,
      [ubicacionId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener los movimientos de la ubicación",
      error: error.message
    });
  }
};

const registrarEntrada = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      ubicacion_id,
      producto_id,
      cantidad,
      motivo
    } = req.body;

    const usuario_id = req.usuario.id;

    if (
      !ubicacion_id ||
      !producto_id ||
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
      cantidadNumero <= 0
    ) {
      return res.status(400).json({
        message:
          "La cantidad debe ser un número mayor a 0"
      });
    }

    await connection.beginTransaction();

    const [ubicaciones] = await connection.query(
      `
        SELECT id
        FROM ubicaciones
        WHERE id = ? AND activo = TRUE
      `,
      [ubicacion_id]
    );

    if (ubicaciones.length === 0) {
      await connection.rollback();

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
      await connection.rollback();

      return res.status(404).json({
        message: "El producto no existe"
      });
    }

    await connection.query(
      `
        INSERT INTO inventario (
          ubicacion_id,
          producto_id,
          cantidad
        )
        VALUES (?, ?, ?)

        ON DUPLICATE KEY UPDATE
          cantidad = cantidad + VALUES(cantidad)
      `,
      [
        ubicacion_id,
        producto_id,
        cantidadNumero
      ]
    );

    const [movimiento] = await connection.query(
      `
        INSERT INTO movimientos (
          ubicacion_id,
          producto_id,
          usuario_id,
          tipo,
          cantidad,
          referencia_tipo,
          referencia_id,
          motivo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ubicacion_id,
        producto_id,
        usuario_id,
        "entrada",
        cantidadNumero,
        "manual",
        null,
        motivo || "Entrada manual de inventario"
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: "Entrada registrada correctamente",
      movimiento_id: movimiento.insertId,
      ubicacion_id,
      producto_id,
      cantidad: cantidadNumero
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al registrar la entrada",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

const registrarSalida = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      ubicacion_id,
      producto_id,
      cantidad,
      motivo
    } = req.body;

    const usuario_id = req.usuario.id;

    if (
      !ubicacion_id ||
      !producto_id ||
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
      cantidadNumero <= 0
    ) {
      return res.status(400).json({
        message:
          "La cantidad debe ser un número mayor a 0"
      });
    }

    await connection.beginTransaction();

    const [inventario] = await connection.query(
      `
        SELECT
          id,
          cantidad
        FROM inventario
        WHERE ubicacion_id = ?
          AND producto_id = ?
        FOR UPDATE
      `,
      [
        ubicacion_id,
        producto_id
      ]
    );

    if (inventario.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message:
          "No existe stock de este producto en la ubicación"
      });
    }

    const stockActual = Number(
      inventario[0].cantidad
    );

    if (stockActual < cantidadNumero) {
      await connection.rollback();

      return res.status(400).json({
        message: "Stock insuficiente",
        stock_actual: stockActual,
        cantidad_solicitada: cantidadNumero
      });
    }

    await connection.query(
      `
        UPDATE inventario
        SET cantidad = cantidad - ?
        WHERE ubicacion_id = ?
          AND producto_id = ?
      `,
      [
        cantidadNumero,
        ubicacion_id,
        producto_id
      ]
    );

    const [movimiento] = await connection.query(
      `
        INSERT INTO movimientos (
          ubicacion_id,
          producto_id,
          usuario_id,
          tipo,
          cantidad,
          referencia_tipo,
          referencia_id,
          motivo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        ubicacion_id,
        producto_id,
        usuario_id,
        "salida",
        cantidadNumero,
        "manual",
        null,
        motivo || "Salida manual de inventario"
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: "Salida registrada correctamente",
      movimiento_id: movimiento.insertId,
      ubicacion_id,
      producto_id,
      cantidad: cantidadNumero,
      stock_restante:
        stockActual - cantidadNumero
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al registrar la salida",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getMovimientos,
  getMovimientosByUbicacion,
  registrarEntrada,
  registrarSalida
};