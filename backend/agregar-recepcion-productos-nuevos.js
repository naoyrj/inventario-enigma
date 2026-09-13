const pool = require("./config/db");

const actualizarBaseDatos = async () => {
  try {
    await pool.query(`
      ALTER TABLE solicitud_productos_nuevos
      ADD COLUMN IF NOT EXISTS
        cantidad_recibida_acumulada INTEGER
        NOT NULL
        DEFAULT 0;
    `);

    console.log(
      "Columna cantidad_recibida_acumulada creada correctamente."
    );
  } catch (error) {
    console.error(
      "Error al actualizar la base de datos:",
      error
    );
  } finally {
    await pool.end();
  }
};

actualizarBaseDatos();