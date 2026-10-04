const pool = require("./config/db");

const agregarImagenProductos = async () => {
  try {
    console.log("Actualizando tabla productos...");

    await pool.query(`
      ALTER TABLE productos
      ADD COLUMN IF NOT EXISTS imagen BYTEA;
    `);

    await pool.query(`
      ALTER TABLE productos
      ADD COLUMN IF NOT EXISTS imagen_tipo VARCHAR(50);
    `);

    console.log(
      "Columnas imagen e imagen_tipo agregadas correctamente."
    );
  } catch (error) {
    console.error(
      "Error al actualizar la tabla productos:",
      error
    );

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

agregarImagenProductos();