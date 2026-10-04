const pool = require("./config/db");

const verificarColumnas = async () => {
  try {
    const resultado = await pool.query(`
      SELECT
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'productos'
        AND column_name IN (
          'descripcion',
          'categoria_id'
        )
      ORDER BY column_name;
    `);

    console.table(resultado.rows);
  } catch (error) {
    console.error(
      "Error al consultar la base de datos:",
      error
    );
  } finally {
    await pool.end();
  }
};

verificarColumnas();