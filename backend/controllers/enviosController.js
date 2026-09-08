const pool = require("../config/db");

const CENTRAL_ID = 1;

const validarPermisoCentral = (req, res) => {
  if (
    req.usuario.rol !== "principal" ||
    !["operador", "aprobador_admin"].includes(
      req.usuario.nivel_permiso
    )
  ) {
    res.status(403).json({
      message:
        "No tienes permiso para gestionar envíos"
    });

    return false;
  }

  return true;
};

const getEnvios = async (req, res) => {
  try {
    const result = await pool.query(`
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
        destino.tipo AS destino_ubicacion_tipo,

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

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener los envíos",
      error: error.message
    });
  }
};

const getEnvioById = async (req, res) => {
  try {
    const { id } = req.params;

    const enviosResult =
      await pool.query(
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
            destino.tipo AS destino_ubicacion_tipo,

            u.id AS creado_por_usuario_id,
            u.nombre AS creado_por_usuario_nombre

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id = s.id

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id = destino.id

          INNER JOIN usuarios u
            ON e.creado_por_usuario_id = u.id

          WHERE e.id = $1
        `,
        [id]
      );

    if (
      enviosResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          "Envío no encontrado"
      });
    }

    const lineasResult =
      await pool.query(
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

          WHERE el.envio_id = $1

          ORDER BY el.id
        `,
        [id]
      );

    res.json({
      envio: enviosResult.rows[0],
      lineas: lineasResult.rows
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener el envío",
      error: error.message
    });
  }
};

const createEnvio = async (req, res) => {
  const client =
    await pool.connect();

  let transaccionIniciada = false;

  try {
    if (
      !validarPermisoCentral(req, res)
    ) {
      return;
    }

    const {
      solicitud_id,
      lineas
    } = req.body;

    if (!solicitud_id) {
      return res.status(400).json({
        message:
          "solicitud_id es obligatorio"
      });
    }

    if (
      !Array.isArray(lineas) ||
      lineas.length === 0
    ) {
      return res.status(400).json({
        message:
          "El envío debe contener productos"
      });
    }

    await client.query("BEGIN");

    transaccionIniciada = true;

    const solicitudesResult =
      await client.query(
        `
          SELECT
            s.id,
            s.estado,
            s.destino_ubicacion_id,

            destino.nombre
              AS destino_ubicacion_nombre,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM solicitudes s

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE s.id = $1

          FOR UPDATE
        `,
        [solicitud_id]
      );

    if (
      solicitudesResult.rows.length ===
      0
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(404).json({
        message:
          "Solicitud no encontrada"
      });
    }

    const solicitud =
      solicitudesResult.rows[0];

    /*
     * ISSUE 7
     *
     * Solo las Sucursales se abastecen
     * mediante envíos desde el stock
     * de Central.
     *
     * Los Equipos Internos se resuelven
     * mediante Compras.
     */
    if (
      !["sucursal", "equipo_interno"].includes(
        solicitud.destino_ubicacion_tipo
      )
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(400).json({
        message:
          "El destino de la solicitud no admite envíos desde Central."
      });
    }

    if (
      ![
        "aprobada",
        "en_transito"
      ].includes(
        solicitud.estado
      )
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(400).json({
        message:
          "La solicitud no está disponible para generar envíos"
      });
    }

    const lineasSolicitudResult =
      await client.query(
        `
          SELECT
            id,
            producto_id,
            cantidad_aprobada,
            cantidad_enviada_acumulada

          FROM solicitud_lineas

          WHERE solicitud_id = $1

          FOR UPDATE
        `,
        [solicitud_id]
      );

    const lineasSolicitud =
      lineasSolicitudResult.rows;

    const preparadas = [];

    for (const linea of lineas) {
      const original =
        lineasSolicitud.find(
          (item) =>
            Number(item.id) ===
            Number(
              linea.solicitud_linea_id
            )
        );

      if (!original) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada = false;

        return res.status(400).json({
          message:
            `La línea ${linea.solicitud_linea_id} no pertenece a la solicitud`
        });
      }

      const cantidad =
        Number(
          linea.cantidad_enviada
        );

      if (
        Number.isNaN(cantidad) ||
        cantidad <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada = false;

        return res.status(400).json({
          message:
            "Las cantidades deben ser mayores a 0"
        });
      }

      const pendiente =
        Number(
          original.cantidad_aprobada
        ) -
        Number(
          original
            .cantidad_enviada_acumulada
        );

      if (
        cantidad > pendiente
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada = false;

        return res.status(400).json({
          message:
            `Cantidad superior a la pendiente del producto ${original.producto_id}`,
          cantidad_pendiente:
            pendiente
        });
      }

      preparadas.push({
        solicitud_linea_id:
          original.id,

        cantidad_enviada:
          cantidad
      });
    }

    const envioResult =
      await client.query(
        `
          INSERT INTO envios (
            solicitud_id,
            creado_por_usuario_id,
            estado
          )

          VALUES (
            $1,
            $2,
            'preparacion'
          )

          RETURNING id
        `,
        [
          solicitud_id,
          req.usuario.id
        ]
      );

    const envioId =
      envioResult.rows[0].id;

    for (
      const linea of preparadas
    ) {
      await client.query(
        `
          INSERT INTO envio_lineas (
            envio_id,
            solicitud_linea_id,
            cantidad_enviada
          )

          VALUES (
            $1,
            $2,
            $3
          )
        `,
        [
          envioId,
          linea.solicitud_linea_id,
          linea.cantidad_enviada
        ]
      );
    }

    await client.query("COMMIT");

    transaccionIniciada = false;

    res.status(201).json({
      message:
        "Envío creado correctamente",
      envio_id: envioId,
      estado: "preparacion"
    });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    res.status(500).json({
      message:
        "Error al crear el envío",
      error: error.message
    });
  } finally {
    client.release();
  }
};

const marcarEnTransito = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada = false;

  try {
    if (
      !validarPermisoCentral(req, res)
    ) {
      return;
    }

    const { id } = req.params;

    await client.query("BEGIN");

    transaccionIniciada = true;

    const enviosResult =
      await client.query(
        `
          SELECT
            e.id,
            e.solicitud_id,
            e.estado,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id = s.id

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE e.id = $1

          FOR UPDATE
        `,
        [id]
      );

    if (
      enviosResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(404).json({
        message:
          "Envío no encontrado"
      });
    }

    const envio =
      enviosResult.rows[0];

    if (
      !["sucursal", "equipo_interno"].includes(
        envio.destino_ubicacion_tipo
      )
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(400).json({
        message:
          "El destino de este envío no es válido."
      });
    }

    if (
      envio.estado !==
      "preparacion"
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(400).json({
        message:
          "Solo un envío en preparación puede pasar a tránsito"
      });
    }

    const lineasResult =
      await client.query(
        `
          SELECT
            el.solicitud_linea_id,
            el.cantidad_enviada,
            sl.producto_id

          FROM envio_lineas el

          INNER JOIN solicitud_lineas sl
            ON el.solicitud_linea_id =
               sl.id

          WHERE el.envio_id = $1
        `,
        [id]
      );

    for (
      const linea of lineasResult.rows
    ) {
      const cantidad =
        Number(
          linea.cantidad_enviada
        );

      const inventarioResult =
        await client.query(
          `
            SELECT cantidad

            FROM inventario

            WHERE ubicacion_id = $1
              AND producto_id = $2

            FOR UPDATE
          `,
          [
            CENTRAL_ID,
            linea.producto_id
          ]
        );

      const stock =
        inventarioResult.rows.length > 0
          ? Number(
              inventarioResult.rows[0]
                .cantidad
            )
          : 0;

      if (stock < cantidad) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada = false;

        return res.status(400).json({
          message:
            `Stock insuficiente en Central para el producto ${linea.producto_id}`,
          stock_actual: stock,
          cantidad_envio:
            cantidad
        });
      }

      await client.query(
        `
          UPDATE inventario

          SET
            cantidad =
              cantidad - $1,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE ubicacion_id = $2
            AND producto_id = $3
        `,
        [
          cantidad,
          CENTRAL_ID,
          linea.producto_id
        ]
      );

      await client.query(
        `
          UPDATE solicitud_lineas

          SET
            cantidad_enviada_acumulada =
              cantidad_enviada_acumulada +
              $1

          WHERE id = $2
        `,
        [
          cantidad,
          linea.solicitud_linea_id
        ]
      );

      await client.query(
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

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
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

    await client.query(
      `
        UPDATE envios

        SET
          estado =
            'en_transito',

          fecha_envio =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [id]
    );

    await client.query(
      `
        UPDATE solicitudes

        SET
          estado =
            'en_transito',

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [envio.solicitud_id]
    );

    await client.query("COMMIT");

    transaccionIniciada = false;

    res.json({
      message:
        "Envío marcado en tránsito",
      envio_id: Number(id),
      estado: "en_transito"
    });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    res.status(500).json({
      message:
        "Error al marcar el envío en tránsito",
      error: error.message
    });
  } finally {
    client.release();
  }
};

const confirmarRecepcion = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada = false;

  try {
    const { id } = req.params;

    await client.query("BEGIN");

    transaccionIniciada = true;

    const enviosResult =
      await client.query(
        `
          SELECT
            e.id,
            e.solicitud_id,
            e.estado,

            s.destino_ubicacion_id,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id = s.id

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE e.id = $1

          FOR UPDATE
        `,
        [id]
      );

    if (
      enviosResult.rows.length === 0
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(404).json({
        message:
          "Envío no encontrado"
      });
    }

    const envio =
      enviosResult.rows[0];

    if (
      !["sucursal", "equipo_interno"].includes(
        envio.destino_ubicacion_tipo
      )
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(400).json({
        message:
          "El destino de este envío no admite confirmación de recepción."
      });
    }

    if (
      envio.estado !==
      "en_transito"
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(400).json({
        message:
          "Solo un envío en tránsito puede recibirse"
      });
    }

    const destinoId =
      Number(
        envio.destino_ubicacion_id
      );

    if (
      req.usuario.rol !==
        "principal" &&
      Number(
        req.usuario.ubicacion_id
      ) !== destinoId
    ) {
      await client.query("ROLLBACK");

      transaccionIniciada = false;

      return res.status(403).json({
        message:
          "Solo la ubicación destino puede confirmar la recepción"
      });
    }

    const lineasResult =
      await client.query(
        `
          SELECT
            el.solicitud_linea_id,
            el.cantidad_enviada,
            sl.producto_id

          FROM envio_lineas el

          INNER JOIN solicitud_lineas sl
            ON el.solicitud_linea_id =
               sl.id

          WHERE el.envio_id = $1
        `,
        [id]
      );

    for (
      const linea of lineasResult.rows
    ) {
      const cantidad =
        Number(
          linea.cantidad_enviada
        );

      await client.query(
        `
          INSERT INTO inventario (
            ubicacion_id,
            producto_id,
            cantidad
          )

          VALUES (
            $1,
            $2,
            $3
          )

          ON CONFLICT (
            ubicacion_id,
            producto_id
          )

          DO UPDATE SET
            cantidad =
              inventario.cantidad +
              EXCLUDED.cantidad,

            updated_at =
              CURRENT_TIMESTAMP
        `,
        [
          destinoId,
          linea.producto_id,
          cantidad
        ]
      );

      await client.query(
        `
          UPDATE solicitud_lineas

          SET
            cantidad_recibida_acumulada =
              cantidad_recibida_acumulada +
              $1

          WHERE id = $2
        `,
        [
          cantidad,
          linea.solicitud_linea_id
        ]
      );

      await client.query(
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

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
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

    await client.query(
      `
        UPDATE envios

        SET
          estado = 'recibido',

          fecha_recepcion =
            CURRENT_TIMESTAMP,

          confirmado_por_usuario_id =
            $1

        WHERE id = $2
      `,
      [
        req.usuario.id,
        id
      ]
    );

    const pendientesResult =
      await client.query(
        `
          SELECT COUNT(*) AS total

          FROM solicitud_lineas

          WHERE solicitud_id = $1

            AND
            cantidad_recibida_acumulada <
            cantidad_aprobada
        `,
        [envio.solicitud_id]
      );

    const completamenteRecibida =
      Number(
        pendientesResult.rows[0].total
      ) === 0;

    if (completamenteRecibida) {
      await client.query(
        `
          UPDATE solicitudes

          SET
            estado = 'recibida',

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
        `,
        [envio.solicitud_id]
      );
    }

    await client.query("COMMIT");

    transaccionIniciada = false;

    res.json({
      message:
        "Recepción confirmada correctamente",

      envio_id: Number(id),

      estado:
        "recibido",

      solicitud_completamente_recibida:
        completamenteRecibida
    });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    res.status(500).json({
      message:
        "Error al confirmar la recepción",
      error: error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getEnvios,
  getEnvioById,
  createEnvio,
  marcarEnTransito,
  confirmarRecepcion
};