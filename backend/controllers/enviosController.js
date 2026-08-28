const pool = require("../config/db");

const CENTRAL_ID = 1;

const getEnvios = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        e.id,
        e.solicitud_id,
        e.estado,
        e.fecha_envio,
        e.fecha_recepcion,
        e.created_at,

        s.estado AS solicitud_estado,

        destino.id AS destino_ubicacion_id,
        destino.nombre AS destino_ubicacion_nombre,

        u.id AS creado_por_usuario_id,
        u.nombre AS creado_por_usuario_nombre

      FROM envios e

      INNER JOIN solicitudes s
        ON e.solicitud_id = s.id

      INNER JOIN ubicaciones destino
        ON s.destino_ubicacion_id = destino.id

      INNER JOIN usuarios u
        ON e.creado_por_usuario_id = u.id

      ORDER BY e.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener los envíos",
      error: error.message
    });
  }
};

const getEnvioById = async (req, res) => {
  try {
    const { id } = req.params;

    const [envios] = await pool.query(
      `
        SELECT
          e.id,
          e.solicitud_id,
          e.estado,
          e.fecha_envio,
          e.fecha_recepcion,
          e.created_at,

          s.estado AS solicitud_estado,

          destino.id AS destino_ubicacion_id,
          destino.nombre AS destino_ubicacion_nombre,

          u.id AS creado_por_usuario_id,
          u.nombre AS creado_por_usuario_nombre

        FROM envios e

        INNER JOIN solicitudes s
          ON e.solicitud_id = s.id

        INNER JOIN ubicaciones destino
          ON s.destino_ubicacion_id = destino.id

        INNER JOIN usuarios u
          ON e.creado_por_usuario_id = u.id

        WHERE e.id = ?
      `,
      [id]
    );

    if (envios.length === 0) {
      return res.status(404).json({
        message: "Envío no encontrado"
      });
    }

    const [lineas] = await pool.query(
      `
        SELECT
          el.id,
          el.solicitud_linea_id,
          el.cantidad_enviada,

          sl.producto_id,
          sl.cantidad_solicitada,
          sl.cantidad_aprobada,
          sl.cantidad_enviada_acumulada,
          sl.cantidad_recibida_acumulada,

          p.nombre AS producto_nombre,
          p.sku,
          p.unidad_medida

        FROM envio_lineas el

        INNER JOIN solicitud_lineas sl
          ON el.solicitud_linea_id = sl.id

        INNER JOIN productos p
          ON sl.producto_id = p.id

        WHERE el.envio_id = ?

        ORDER BY el.id
      `,
      [id]
    );

    res.json({
      envio: envios[0],
      lineas
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener el envío",
      error: error.message
    });
  }
};

const createEnvio = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { solicitud_id, lineas } = req.body;

    if (
      req.usuario.rol !== "principal" ||
      !["operador", "aprobador_admin"].includes(
        req.usuario.nivel_permiso
      )
    ) {
      return res.status(403).json({
        message: "No tienes permiso para crear envíos"
      });
    }

    if (!solicitud_id) {
      return res.status(400).json({
        message: "solicitud_id es obligatorio"
      });
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return res.status(400).json({
        message: "El envío debe contener productos"
      });
    }

    await connection.beginTransaction();

    const [solicitudes] = await connection.query(
      `
        SELECT id, estado
        FROM solicitudes
        WHERE id = ?
        FOR UPDATE
      `,
      [solicitud_id]
    );

    if (solicitudes.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    if (
      !["aprobada", "en_transito"].includes(
        solicitudes[0].estado
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        message:
          "La solicitud no está disponible para generar envíos"
      });
    }

    const [lineasSolicitud] = await connection.query(
      `
        SELECT
          id,
          producto_id,
          cantidad_aprobada,
          cantidad_enviada_acumulada
        FROM solicitud_lineas
        WHERE solicitud_id = ?
        FOR UPDATE
      `,
      [solicitud_id]
    );

    const preparadas = [];

    for (const linea of lineas) {
      const original = lineasSolicitud.find(
        (item) =>
          Number(item.id) ===
          Number(linea.solicitud_linea_id)
      );

      if (!original) {
        await connection.rollback();

        return res.status(400).json({
          message:
            `La línea ${linea.solicitud_linea_id} no pertenece a la solicitud`
        });
      }

      const cantidad = Number(linea.cantidad_enviada);

      if (Number.isNaN(cantidad) || cantidad <= 0) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Las cantidades deben ser mayores a 0"
        });
      }

      const pendiente =
        Number(original.cantidad_aprobada) -
        Number(original.cantidad_enviada_acumulada);

      if (cantidad > pendiente) {
        await connection.rollback();

        return res.status(400).json({
          message:
            `Cantidad superior a la pendiente del producto ${original.producto_id}`,
          cantidad_pendiente: pendiente
        });
      }

      preparadas.push({
        solicitud_linea_id: original.id,
        cantidad_enviada: cantidad
      });
    }

    const [result] = await connection.query(
      `
        INSERT INTO envios (
          solicitud_id,
          creado_por_usuario_id,
          estado
        )
        VALUES (?, ?, 'preparacion')
      `,
      [solicitud_id, req.usuario.id]
    );

    for (const linea of preparadas) {
      await connection.query(
        `
          INSERT INTO envio_lineas (
            envio_id,
            solicitud_linea_id,
            cantidad_enviada
          )
          VALUES (?, ?, ?)
        `,
        [
          result.insertId,
          linea.solicitud_linea_id,
          linea.cantidad_enviada
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Envío creado correctamente",
      envio_id: result.insertId,
      estado: "preparacion"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al crear el envío",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

const marcarEnTransito = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    if (
      req.usuario.rol !== "principal" ||
      !["operador", "aprobador_admin"].includes(
        req.usuario.nivel_permiso
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permiso para despachar envíos"
      });
    }

    const { id } = req.params;

    await connection.beginTransaction();

    const [envios] = await connection.query(
      `
        SELECT
          e.id,
          e.solicitud_id,
          e.estado
        FROM envios e
        WHERE e.id = ?
        FOR UPDATE
      `,
      [id]
    );

    if (envios.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Envío no encontrado"
      });
    }

    const envio = envios[0];

    if (envio.estado !== "preparacion") {
      await connection.rollback();

      return res.status(400).json({
        message:
          "Solo un envío en preparación puede pasar a tránsito"
      });
    }

    const [lineas] = await connection.query(
      `
        SELECT
          el.solicitud_linea_id,
          el.cantidad_enviada,
          sl.producto_id

        FROM envio_lineas el

        INNER JOIN solicitud_lineas sl
          ON el.solicitud_linea_id = sl.id

        WHERE el.envio_id = ?
      `,
      [id]
    );

    for (const linea of lineas) {
      const cantidad = Number(linea.cantidad_enviada);

      const [inventario] = await connection.query(
        `
          SELECT cantidad
          FROM inventario
          WHERE ubicacion_id = ?
            AND producto_id = ?
          FOR UPDATE
        `,
        [CENTRAL_ID, linea.producto_id]
      );

      const stock =
        inventario.length > 0
          ? Number(inventario[0].cantidad)
          : 0;

      if (stock < cantidad) {
        await connection.rollback();

        return res.status(400).json({
          message:
            `Stock insuficiente en Central para el producto ${linea.producto_id}`,
          stock_actual: stock,
          cantidad_envio: cantidad
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
          cantidad,
          CENTRAL_ID,
          linea.producto_id
        ]
      );

      await connection.query(
        `
          UPDATE solicitud_lineas
          SET cantidad_enviada_acumulada =
              cantidad_enviada_acumulada + ?
          WHERE id = ?
        `,
        [
          cantidad,
          linea.solicitud_linea_id
        ]
      );

      await connection.query(
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
          CENTRAL_ID,
          linea.producto_id,
          req.usuario.id,
          "salida",
          cantidad,
          "envio",
          Number(id),
          `Salida por envío #${id}`
        ]
      );
    }

    await connection.query(
      `
        UPDATE envios
        SET
          estado = 'en_transito',
          fecha_envio = NOW()
        WHERE id = ?
      `,
      [id]
    );

    await connection.query(
      `
        UPDATE solicitudes
        SET estado = 'en_transito'
        WHERE id = ?
      `,
      [envio.solicitud_id]
    );

    await connection.commit();

    res.json({
      message: "Envío marcado en tránsito",
      envio_id: Number(id),
      estado: "en_transito"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message:
        "Error al marcar el envío en tránsito",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

const confirmarRecepcion = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [envios] = await connection.query(
      `
        SELECT
          e.id,
          e.solicitud_id,
          e.estado,
          s.destino_ubicacion_id

        FROM envios e

        INNER JOIN solicitudes s
          ON e.solicitud_id = s.id

        WHERE e.id = ?

        FOR UPDATE
      `,
      [id]
    );

    if (envios.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Envío no encontrado"
      });
    }

    const envio = envios[0];

    if (envio.estado !== "en_transito") {
      await connection.rollback();

      return res.status(400).json({
        message:
          "Solo un envío en tránsito puede recibirse"
      });
    }

    const destinoId = Number(
      envio.destino_ubicacion_id
    );

    if (
      req.usuario.rol !== "principal" &&
      Number(req.usuario.ubicacion_id) !== destinoId
    ) {
      await connection.rollback();

      return res.status(403).json({
        message:
          "Solo la ubicación destino puede confirmar la recepción"
      });
    }

    const [lineas] = await connection.query(
      `
        SELECT
          el.solicitud_linea_id,
          el.cantidad_enviada,
          sl.producto_id

        FROM envio_lineas el

        INNER JOIN solicitud_lineas sl
          ON el.solicitud_linea_id = sl.id

        WHERE el.envio_id = ?
      `,
      [id]
    );

    for (const linea of lineas) {
      const cantidad = Number(linea.cantidad_enviada);

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
          destinoId,
          linea.producto_id,
          cantidad
        ]
      );

      await connection.query(
        `
          UPDATE solicitud_lineas
          SET cantidad_recibida_acumulada =
              cantidad_recibida_acumulada + ?
          WHERE id = ?
        `,
        [
          cantidad,
          linea.solicitud_linea_id
        ]
      );

      await connection.query(
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
          destinoId,
          linea.producto_id,
          req.usuario.id,
          "entrada",
          cantidad,
          "envio",
          Number(id),
          `Recepción del envío #${id}`
        ]
      );
    }

    await connection.query(
      `
        UPDATE envios
        SET
          estado = 'recibido',
          fecha_recepcion = NOW()
        WHERE id = ?
      `,
      [id]
    );

    const [pendientes] = await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM solicitud_lineas
        WHERE solicitud_id = ?
          AND cantidad_recibida_acumulada <
              cantidad_aprobada
      `,
      [envio.solicitud_id]
    );

    const completamenteRecibida =
      Number(pendientes[0].total) === 0;

    if (completamenteRecibida) {
      await connection.query(
        `
          UPDATE solicitudes
          SET estado = 'recibida'
          WHERE id = ?
        `,
        [envio.solicitud_id]
      );
    }

    await connection.commit();

    res.json({
      message: "Recepción confirmada correctamente",
      envio_id: Number(id),
      estado: "recibido",
      solicitud_completamente_recibida:
        completamenteRecibida
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al confirmar la recepción",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getEnvios,
  getEnvioById,
  createEnvio,
  marcarEnTransito,
  confirmarRecepcion
};