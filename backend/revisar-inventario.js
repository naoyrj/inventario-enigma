require("dotenv").config();

const { Client } = require("pg");

const connectionString =
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "No existe DATABASE_URL."
  );

  process.exit(1);
}

const usaSsl =
  connectionString.includes(
    "railway"
  ) ||
  connectionString.includes(
    "proxy.rlwy.net"
  );

const client = new Client({
  connectionString,
  ssl: usaSsl
    ? {
        rejectUnauthorized: false
      }
    : false
});

const solicitudId = 16;

async function revisar() {
  let transaccion = false;

  try {
    await client.connect();

    console.log(
      "Conectado a PostgreSQL"
    );

    console.log(
      "SSL:",
      usaSsl
        ? "activado"
        : "desactivado"
    );

    await client.query(
      "BEGIN"
    );

    transaccion = true;

    const solicitudResult =
      await client.query(
        `
          SELECT
            s.id,
            s.estado,
            s.solicitante_ubicacion_id,
            s.destino_ubicacion_id,
            u.nombre AS destino_nombre,
            u.tipo AS destino_tipo

          FROM solicitudes s

          INNER JOIN ubicaciones u
            ON s.destino_ubicacion_id =
               u.id

          WHERE s.id = $1

          FOR UPDATE OF s
        `,
        [
          solicitudId
        ]
      );

    if (
      solicitudResult.rows.length ===
      0
    ) {
      throw new Error(
        `Solicitud #${solicitudId} no encontrada`
      );
    }

    const solicitud =
      solicitudResult.rows[0];

    console.log(
      "\nSOLICITUD:"
    );

    console.table(
      solicitudResult.rows
    );

    const ubicacionId =
      Number(
        solicitud
          .destino_ubicacion_id
      );

    const enviosResult =
      await client.query(
        `
          SELECT
            COUNT(*) AS total

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id =
               s.id

          WHERE e.solicitud_id =
                $1

            AND s.destino_ubicacion_id =
                $2

            AND e.estado =
                'recibido'
        `,
        [
          solicitudId,
          ubicacionId
        ]
      );

    console.log(
      "\nENVÍOS RECIBIDOS:",
      enviosResult.rows[0].total
    );

    const lineasResult =
      await client.query(
        `
          SELECT
            sl.id,
            sl.producto_id,
            p.nombre AS producto_nombre,
            sl.cantidad_recibida_acumulada,
            sl.cantidad_registrada_inventario

          FROM solicitud_lineas sl

          INNER JOIN productos p
            ON sl.producto_id =
               p.id

          WHERE sl.solicitud_id =
                $1

          ORDER BY sl.id

          FOR UPDATE OF sl
        `,
        [
          solicitudId
        ]
      );

    console.log(
      "\nLÍNEAS:"
    );

    console.table(
      lineasResult.rows
    );

    for (
      const linea of
      lineasResult.rows
    ) {
      console.log(
        `\nProcesando: ${linea.producto_nombre}`
      );

      const recibida =
        Number(
          linea
            .cantidad_recibida_acumulada ||
            0
        );

      const registrada =
        Number(
          linea
            .cantidad_registrada_inventario ||
            0
        );

      const disponible =
        Math.max(
          recibida -
            registrada,
          0
        );

      console.log(
        "Cantidad recibida:",
        recibida
      );

      console.log(
        "Cantidad registrada:",
        registrada
      );

      console.log(
        "Cantidad disponible:",
        disponible
      );

      if (
        disponible <= 0
      ) {
        console.log(
          "Nada pendiente para esta línea."
        );

        continue;
      }

      const fisicoResult =
        await client.query(
          `
            SELECT
              COALESCE(
                SUM(
                  el.cantidad_enviada
                ),
                0
              ) AS total_recibido

            FROM envio_lineas el

            INNER JOIN envios e
              ON el.envio_id =
                 e.id

            INNER JOIN solicitudes s
              ON e.solicitud_id =
                 s.id

            WHERE e.solicitud_id =
                  $1

              AND s.destino_ubicacion_id =
                  $2

              AND e.estado =
                  'recibido'

              AND el.solicitud_linea_id =
                  $3
          `,
          [
            solicitudId,
            ubicacionId,
            linea.id
          ]
        );

      const fisicamenteRecibida =
        Number(
          fisicoResult
            .rows[0]
            .total_recibido ||
            0
        );

      console.log(
        "Físicamente recibida:",
        fisicamenteRecibida
      );

      const disponibleConfirmado =
        Math.max(
          fisicamenteRecibida -
            registrada,
          0
        );

      const cantidadARegistrar =
        Math.min(
          disponible,
          disponibleConfirmado
        );

      console.log(
        "Cantidad a registrar:",
        cantidadARegistrar
      );

      if (
        cantidadARegistrar <=
        0
      ) {
        console.log(
          "No hay cantidad confirmada para registrar."
        );

        continue;
      }

      const inventarioAntes =
        await client.query(
          `
            SELECT
              id,
              ubicacion_id,
              producto_id,
              cantidad

            FROM inventario

            WHERE ubicacion_id =
                  $1

              AND producto_id =
                  $2
          `,
          [
            ubicacionId,
            linea.producto_id
          ]
        );

      console.log(
        "\nINVENTARIO ANTES:"
      );

      console.table(
        inventarioAntes.rows
      );

      const inventarioResult =
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

            RETURNING
              id,
              ubicacion_id,
              producto_id,
              cantidad
          `,
          [
            ubicacionId,

            Number(
              linea.producto_id
            ),

            cantidadARegistrar
          ]
        );

      console.log(
        "\nINSERT/UPDATE INVENTARIO OK:"
      );

      console.table(
        inventarioResult.rows
      );

      const actualizarLinea =
        await client.query(
          `
            UPDATE solicitud_lineas

            SET
              cantidad_registrada_inventario =
                cantidad_registrada_inventario +
                $1

            WHERE id = $2

            RETURNING
              id,
              cantidad_registrada_inventario
          `,
          [
            cantidadARegistrar,
            linea.id
          ]
        );

      console.log(
        "\nUPDATE SOLICITUD_LINEAS OK:"
      );

      console.table(
        actualizarLinea.rows
      );
    }

    await client.query(
      "ROLLBACK"
    );

    transaccion = false;

    console.log(
      "\n===================================="
    );

    console.log(
      "PRUEBA COMPLETADA CORRECTAMENTE"
    );

    console.log(
      "Todo el SQL del registro funciona."
    );

    console.log(
      "Se ejecutó ROLLBACK: no se guardaron cambios."
    );

    console.log(
      "===================================="
    );
  } catch (error) {
    console.error(
      "\n===================================="
    );

    console.error(
      "ERROR EXACTO:"
    );

    console.error(error);

    console.error(
      "===================================="
    );

    if (transaccion) {
      try {
        await client.query(
          "ROLLBACK"
        );

        console.log(
          "\nSe ejecutó ROLLBACK: no se conservaron cambios."
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "También falló el ROLLBACK:",
          rollbackError
        );
      }
    }
  } finally {
    await client.end();
  }
}

revisar();