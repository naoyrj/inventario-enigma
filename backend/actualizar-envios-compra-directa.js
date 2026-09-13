const pool = require("./config/db");

const actualizarBaseDatos = async () => {
  const client = await pool.connect();

  try {
    console.log(
      "Actualizando estructura para el flujo de compra directa y envío..."
    );

    await client.query("BEGIN");

    // =====================================================
    // ENVIO_LINEAS
    // =====================================================

    await client.query(`
      ALTER TABLE envio_lineas

      ADD COLUMN IF NOT EXISTS
        solicitud_producto_nuevo_id INTEGER;
    `);

    await client.query(`
      ALTER TABLE envio_lineas

      ADD COLUMN IF NOT EXISTS
        producto_id INTEGER;
    `);

    /*
     * Antes todas las líneas de envío estaban
     * obligadas a pertenecer a solicitud_lineas.
     *
     * Ahora un producto nuevo comprado al proveedor
     * puede provenir de solicitud_productos_nuevos.
     */
    await client.query(`
      ALTER TABLE envio_lineas

      ALTER COLUMN solicitud_linea_id
      DROP NOT NULL;
    `);

    // =====================================================
    // SOLICITUD_PRODUCTOS_NUEVOS
    // =====================================================

    await client.query(`
      ALTER TABLE solicitud_productos_nuevos

      ADD COLUMN IF NOT EXISTS
        cantidad_enviada_acumulada INTEGER
        NOT NULL
        DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE solicitud_productos_nuevos

      ADD COLUMN IF NOT EXISTS
        cantidad_recibida_acumulada INTEGER
        NOT NULL
        DEFAULT 0;
    `);

    // =====================================================
    // REGISTRO POSTERIOR EN INVENTARIO PERSONAL
    // =====================================================

    await client.query(`
      ALTER TABLE solicitud_lineas

      ADD COLUMN IF NOT EXISTS
        cantidad_registrada_inventario INTEGER
        NOT NULL
        DEFAULT 0;
    `);

    await client.query(`
      ALTER TABLE solicitud_productos_nuevos

      ADD COLUMN IF NOT EXISTS
        cantidad_registrada_inventario INTEGER
        NOT NULL
        DEFAULT 0;
    `);

    // =====================================================
    // COMPLETAR PRODUCTO_ID DE ENVÍOS EXISTENTES
    // =====================================================

    await client.query(`
      UPDATE envio_lineas el

      SET producto_id = sl.producto_id

      FROM solicitud_lineas sl

      WHERE
        el.solicitud_linea_id = sl.id
        AND el.producto_id IS NULL;
    `);

    // =====================================================
    // FOREIGN KEY PRODUCTO NUEVO
    // =====================================================

    const fkProductoNuevo =
      await client.query(`
        SELECT
          1

        FROM pg_constraint

        WHERE conname =
          'envio_lineas_solicitud_producto_nuevo_id_fkey';
      `);

    if (
      fkProductoNuevo.rows.length === 0
    ) {
      await client.query(`
        ALTER TABLE envio_lineas

        ADD CONSTRAINT
          envio_lineas_solicitud_producto_nuevo_id_fkey

        FOREIGN KEY (
          solicitud_producto_nuevo_id
        )

        REFERENCES solicitud_productos_nuevos(id)

        ON DELETE RESTRICT;
      `);
    }

    // =====================================================
    // FOREIGN KEY PRODUCTO REAL
    // =====================================================

    const fkProducto =
      await client.query(`
        SELECT
          1

        FROM pg_constraint

        WHERE conname =
          'envio_lineas_producto_id_fkey';
      `);

    if (
      fkProducto.rows.length === 0
    ) {
      await client.query(`
        ALTER TABLE envio_lineas

        ADD CONSTRAINT
          envio_lineas_producto_id_fkey

        FOREIGN KEY (
          producto_id
        )

        REFERENCES productos(id)

        ON DELETE RESTRICT;
      `);
    }

    // =====================================================
    // CHECK: SOLO UN ORIGEN POR LÍNEA
    // =====================================================

    const checkOrigen =
      await client.query(`
        SELECT
          1

        FROM pg_constraint

        WHERE conname =
          'envio_lineas_origen_check';
      `);

    if (
      checkOrigen.rows.length === 0
    ) {
      await client.query(`
        ALTER TABLE envio_lineas

        ADD CONSTRAINT
          envio_lineas_origen_check

        CHECK (
          (
            solicitud_linea_id
              IS NOT NULL

            AND

            solicitud_producto_nuevo_id
              IS NULL
          )

          OR

          (
            solicitud_linea_id
              IS NULL

            AND

            solicitud_producto_nuevo_id
              IS NOT NULL
          )
        )

        NOT VALID;
      `);
    }

    await client.query("COMMIT");

    console.log(
      "Migración completada correctamente."
    );

    console.log("");
    console.log(
      "La estructura ahora separa:"
    );

    console.log(
      "- cantidad enviada"
    );

    console.log(
      "- cantidad recibida físicamente"
    );

    console.log(
      "- cantidad registrada posteriormente en inventario personal"
    );

    console.log("");
    console.log(
      "También se habilitaron productos nuevos dentro de los envíos."
    );
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (rollbackError) {
      console.error(
        "Error al revertir la migración:",
        rollbackError
      );
    }

    console.error(
      "Error al actualizar la base de datos:",
      error
    );

    process.exitCode = 1;
  } finally {
    client.release();

    await pool.end();
  }
};

actualizarBaseDatos();