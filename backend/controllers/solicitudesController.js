const pool = require("../config/db");

const getSolicitudes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id,
        s.estado,
        s.motivo_cierre,
        s.created_at,
        s.updated_at,

        destino.id AS destino_ubicacion_id,
        destino.nombre AS destino_ubicacion_nombre,

        solicitante.id AS solicitante_ubicacion_id,
        solicitante.nombre AS solicitante_ubicacion_nombre,

        u.id AS creado_por_usuario_id,
        u.nombre AS creado_por_usuario_nombre

      FROM solicitudes s

      INNER JOIN ubicaciones destino
        ON s.destino_ubicacion_id = destino.id

      INNER JOIN ubicaciones solicitante
        ON s.solicitante_ubicacion_id = solicitante.id

      INNER JOIN usuarios u
        ON s.creado_por_usuario_id = u.id

      ORDER BY s.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener las solicitudes",
      error: error.message
    });
  }
};

const getSolicitudById = async (req, res) => {
  try {
    const { id } = req.params;

    const [solicitudes] = await pool.query(
      `
        SELECT
          s.id,
          s.estado,
          s.motivo_cierre,
          s.created_at,
          s.updated_at,

          destino.id AS destino_ubicacion_id,
          destino.nombre AS destino_ubicacion_nombre,

          solicitante.id AS solicitante_ubicacion_id,
          solicitante.nombre AS solicitante_ubicacion_nombre,

          u.id AS creado_por_usuario_id,
          u.nombre AS creado_por_usuario_nombre

        FROM solicitudes s

        INNER JOIN ubicaciones destino
          ON s.destino_ubicacion_id = destino.id

        INNER JOIN ubicaciones solicitante
          ON s.solicitante_ubicacion_id = solicitante.id

        INNER JOIN usuarios u
          ON s.creado_por_usuario_id = u.id

        WHERE s.id = ?
      `,
      [id]
    );

    if (solicitudes.length === 0) {
      return res.status(404).json({
        message: "Solicitud no encontrada"
      });
    }

    const [lineas] = await pool.query(
      `
        SELECT
          sl.id,
          sl.producto_id,

          p.nombre AS producto_nombre,
          p.sku,
          p.unidad_medida,

          sl.cantidad_solicitada,
          sl.cantidad_aprobada,
          sl.cantidad_enviada_acumulada,
          sl.cantidad_recibida_acumulada

        FROM solicitud_lineas sl

        INNER JOIN productos p
          ON sl.producto_id = p.id

        WHERE sl.solicitud_id = ?

        ORDER BY sl.id
      `,
      [id]
    );

    res.json({
      solicitud: solicitudes[0],
      lineas
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la solicitud",
      error: error.message
    });
  }
};

const createSolicitud = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const {
      destino_ubicacion_id,
      lineas
    } = req.body;

    const creado_por_usuario_id =
      req.usuario.id;

    const solicitante_ubicacion_id =
      req.usuario.ubicacion_id;

    if (!destino_ubicacion_id) {
      return res.status(400).json({
        message:
          "destino_ubicacion_id es obligatorio"
      });
    }

    if (
      !Array.isArray(lineas) ||
      lineas.length === 0
    ) {
      return res.status(400).json({
        message:
          "La solicitud debe contener productos"
      });
    }

    const [ubicaciones] =
      await connection.query(
        `
          SELECT
            id,
            puede_solicitar_a_nombre_de_otra
          FROM ubicaciones
          WHERE id = ?
            AND activo = TRUE
        `,
        [solicitante_ubicacion_id]
      );

    if (ubicaciones.length === 0) {
      return res.status(404).json({
        message:
          "Ubicación solicitante no encontrada"
      });
    }

    if (
      Number(destino_ubicacion_id) !==
        Number(solicitante_ubicacion_id) &&
      !ubicaciones[0]
        .puede_solicitar_a_nombre_de_otra
    ) {
      return res.status(403).json({
        message:
          "No puedes solicitar para otra ubicación"
      });
    }

    await connection.beginTransaction();

    const [result] =
      await connection.query(
        `
          INSERT INTO solicitudes (
            destino_ubicacion_id,
            creado_por_usuario_id,
            solicitante_ubicacion_id,
            estado
          )
          VALUES (?, ?, ?, 'solicitada')
        `,
        [
          destino_ubicacion_id,
          creado_por_usuario_id,
          solicitante_ubicacion_id
        ]
      );

    for (const linea of lineas) {
      const cantidad = Number(
        linea.cantidad_solicitada
      );

      if (
        !linea.producto_id ||
        Number.isNaN(cantidad) ||
        cantidad <= 0
      ) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Todas las líneas necesitan producto y cantidad válida"
        });
      }

      await connection.query(
        `
          INSERT INTO solicitud_lineas (
            solicitud_id,
            producto_id,
            cantidad_solicitada,
            cantidad_aprobada,
            cantidad_enviada_acumulada,
            cantidad_recibida_acumulada
          )
          VALUES (?, ?, ?, 0, 0, 0)
        `,
        [
          result.insertId,
          linea.producto_id,
          cantidad
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      message:
        "Solicitud creada correctamente",
      solicitud_id: result.insertId,
      estado: "solicitada"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message:
        "Error al crear la solicitud",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

const iniciarRevision = async (req, res) => {
  try {
    const { id } = req.params;

    if (
      req.usuario.rol !== "principal" ||
      !["operador", "aprobador_admin"]
        .includes(req.usuario.nivel_permiso)
    ) {
      return res.status(403).json({
        message:
          "No tienes permiso para revisar solicitudes"
      });
    }

    const [result] = await pool.query(
      `
        UPDATE solicitudes
        SET estado = 'en_revision'
        WHERE id = ?
          AND estado = 'solicitada'
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message:
          "La solicitud no existe o no está solicitada"
      });
    }

    res.json({
      message:
        "Solicitud marcada en revisión",
      solicitud_id: Number(id),
      estado: "en_revision"
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al iniciar revisión",
      error: error.message
    });
  }
};

const aprobarSolicitud = async (req, res) => {
  const connection =
    await pool.getConnection();

  try {
    const { id } = req.params;
    const { lineas } = req.body;

    if (
      req.usuario.rol !== "principal" ||
      req.usuario.nivel_permiso !==
        "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede aprobar"
      });
    }

    if (
      !Array.isArray(lineas) ||
      lineas.length === 0
    ) {
      return res.status(400).json({
        message:
          "Debes indicar las cantidades aprobadas"
      });
    }

    await connection.beginTransaction();

    const [solicitudes] =
      await connection.query(
        `
          SELECT id, estado
          FROM solicitudes
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (
      solicitudes.length === 0 ||
      solicitudes[0].estado !==
        "en_revision"
    ) {
      await connection.rollback();

      return res.status(400).json({
        message:
          "La solicitud debe estar en revisión"
      });
    }

    const [actuales] =
      await connection.query(
        `
          SELECT
            sl.id,
            sl.producto_id,
            sl.cantidad_solicitada,
            COALESCE(i.cantidad, 0)
              AS stock_central
          FROM solicitud_lineas sl

          LEFT JOIN inventario i
            ON i.producto_id =
               sl.producto_id
            AND i.ubicacion_id = 1

          WHERE sl.solicitud_id = ?
        `,
        [id]
      );

    for (const linea of lineas) {
      const actual = actuales.find(
        (item) =>
          Number(item.id) ===
          Number(linea.linea_id)
      );

      if (!actual) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Una línea no pertenece a la solicitud"
        });
      }

      const cantidad = Number(
        linea.cantidad_aprobada
      );

      if (
        Number.isNaN(cantidad) ||
        cantidad < 0 ||
        cantidad >
          Number(
            actual.cantidad_solicitada
          ) ||
        cantidad >
          Number(actual.stock_central)
      ) {
        await connection.rollback();

        return res.status(400).json({
          message:
            `Cantidad aprobada inválida para el producto ${actual.producto_id}`
        });
      }

      await connection.query(
        `
          UPDATE solicitud_lineas
          SET cantidad_aprobada = ?
          WHERE id = ?
        `,
        [
          cantidad,
          linea.linea_id
        ]
      );
    }

    await connection.query(
      `
        UPDATE solicitudes
        SET estado = 'aprobada'
        WHERE id = ?
      `,
      [id]
    );

    await connection.commit();

    res.json({
      message:
        "Solicitud aprobada correctamente",
      solicitud_id: Number(id),
      estado: "aprobada"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message:
        "Error al aprobar la solicitud",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

const rechazarSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (
      req.usuario.rol !== "principal" ||
      req.usuario.nivel_permiso !==
        "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede rechazar solicitudes"
      });
    }

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({
        message:
          "Debes indicar el motivo del rechazo"
      });
    }

    const [result] = await pool.query(
      `
        UPDATE solicitudes
        SET
          estado = 'rechazada',
          motivo_cierre = ?
        WHERE id = ?
          AND estado IN (
            'solicitada',
            'en_revision'
          )
      `,
      [
        motivo.trim(),
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message:
          "La solicitud no puede rechazarse en su estado actual"
      });
    }

    res.json({
      message:
        "Solicitud rechazada correctamente",
      solicitud_id: Number(id),
      estado: "rechazada"
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al rechazar la solicitud",
      error: error.message
    });
  }
};

const cerrarSolicitud = async (req, res) => {
  const connection =
    await pool.getConnection();

  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (
      req.usuario.rol !== "principal" ||
      req.usuario.nivel_permiso !==
        "aprobador_admin"
    ) {
      return res.status(403).json({
        message:
          "Solo un Aprobador/Administrador puede cerrar solicitudes"
      });
    }

    await connection.beginTransaction();

    const [solicitudes] =
      await connection.query(
        `
          SELECT id, estado
          FROM solicitudes
          WHERE id = ?
          FOR UPDATE
        `,
        [id]
      );

    if (solicitudes.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message:
          "Solicitud no encontrada"
      });
    }

    const estado =
      solicitudes[0].estado;

    if (
      ![
        "aprobada",
        "en_transito",
        "recibida"
      ].includes(estado)
    ) {
      await connection.rollback();

      return res.status(400).json({
        message:
          "La solicitud no puede cerrarse en su estado actual"
      });
    }

    const [lineas] =
      await connection.query(
        `
          SELECT
            cantidad_aprobada,
            cantidad_recibida_acumulada
          FROM solicitud_lineas
          WHERE solicitud_id = ?
        `,
        [id]
      );

    const tienePendientes =
      lineas.some(
        (linea) =>
          Number(
            linea.cantidad_recibida_acumulada
          ) <
          Number(
            linea.cantidad_aprobada
          )
      );

    if (
      tienePendientes &&
      (!motivo || !motivo.trim())
    ) {
      await connection.rollback();

      return res.status(400).json({
        message:
          "Hay un remanente pendiente. Debes indicar el motivo del cierre"
      });
    }

    await connection.query(
      `
        UPDATE solicitudes
        SET
          estado = 'cerrada',
          motivo_cierre = ?
        WHERE id = ?
      `,
      [
        motivo?.trim() ||
          "Solicitud completada",
        id
      ]
    );

    await connection.commit();

    res.json({
      message:
        "Solicitud cerrada correctamente",
      solicitud_id: Number(id),
      estado: "cerrada",
      remanente_cancelado:
        tienePendientes
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message:
        "Error al cerrar la solicitud",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getSolicitudes,
  getSolicitudById,
  createSolicitud,
  iniciarRevision,
  aprobarSolicitud,
  rechazarSolicitud,
  cerrarSolicitud
};