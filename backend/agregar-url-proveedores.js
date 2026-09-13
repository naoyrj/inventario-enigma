const pool = require("./config/db");

const agregarUrlProveedores = async () => {
  const client = await pool.connect();

  try {
    console.log("Actualizando tabla proveedores...");

    await client.query(`
      ALTER TABLE proveedores
      ADD COLUMN IF NOT EXISTS url TEXT;
    `);

    console.log(
      "Campo URL agregado correctamente a proveedores."
    );
  } catch (error) {
    console.error(
      "Error al agregar URL a proveedores:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

agregarUrlProveedores();