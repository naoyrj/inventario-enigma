const pool = require("../config/db");

const getMovimientos = async (req, res) => {
  try {
    const result = await pool.query(`
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

    res.json(result.rows);
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

    const result = await pool.query(
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

        WHERE m.ubicacion_id = $1

        ORDER BY m.created_at DESC
      `,
      [ubicacionId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener los movimientos de la ubicación",
      error: error.message
    });
  }
};

const registrarEntrada = async (req, res) => {
  const client = await pool.connect();

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

    await client.query("BEGIN");

    const ubicacionResult = await client.query(
      `
        SELECT id
        FROM ubicaciones
        WHERE id = $1
          AND activo = TRUE
      `,
      [ubicacion_id]
    );

    if (ubicacionResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "La ubicación no existe"
      });
    }

    const productoResult = await client.query(
      `
        SELECT id
        FROM productos
        WHERE id = $1
          AND activo = TRUE
      `,
      [producto_id]
    );

    if (productoResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "El producto no existe"
      });
    }

    await client.query(
      `
        INSERT INTO inventario (
          ubicacion_id,
          producto_id,
          cantidad
        )
        VALUES ($1, $2, $3)

        ON CONFLICT (ubicacion_id, producto_id)
        DO UPDATE SET
          cantidad = inventario.cantidad + EXCLUDED.cantidad,
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        ubicacion_id,
        producto_id,
        cantidadNumero
      ]
    );

    const movimientoResult = await client.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
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

    await client.query("COMMIT");

    res.status(201).json({
      message: "Entrada registrada correctamente",
      movimiento_id: movimientoResult.rows[0].id,
      ubicacion_id,
      producto_id,
      cantidad: cantidadNumero
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Error al revertir la transacción:",
        rollbackError
      );
    }

    res.status(500).json({
      message: "Error al registrar la entrada",
      error: error.message
    });
  } finally {
    client.release();
  }
};

const registrarSalida = async (req, res) => {
  const client = await pool.connect();

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

    await client.query("BEGIN");

    const inventarioResult = await client.query(
      `
        SELECT
          id,
          cantidad
        FROM inventario
        WHERE ubicacion_id = $1
          AND producto_id = $2
        FOR UPDATE
      `,
      [
        ubicacion_id,
        producto_id
      ]
    );

    if (inventarioResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message:
          "No existe stock de este producto en la ubicación"
      });
    }

    const stockActual = Number(
      inventarioResult.rows[0].cantidad
    );

    if (stockActual < cantidadNumero) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        message: "Stock insuficiente",
        stock_actual: stockActual,
        cantidad_solicitada: cantidadNumero
      });
    }

    await client.query(
      `
        UPDATE inventario
        SET
          cantidad = cantidad - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE ubicacion_id = $2
          AND producto_id = $3
      `,
      [
        cantidadNumero,
        ubicacion_id,
        producto_id
      ]
    );

    const movimientoResult = await client.query(
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
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
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

    await client.query("COMMIT");

    res.status(201).json({
      message: "Salida registrada correctamente",
      movimiento_id: movimientoResult.rows[0].id,
      ubicacion_id,
      producto_id,
      cantidad: cantidadNumero,
      stock_restante:
        stockActual - cantidadNumero
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Error al revertir la transacción:",
        rollbackError
      );
    }

    res.status(500).json({
      message: "Error al registrar la salida",
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getMovimientos,
  getMovimientosByUbicacion,
  registrarEntrada,
  registrarSalida
};