const pool = require("./config/db");

async function verUsuarios() {
  try {
    const resultado = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.activo,
        ub.id AS ubicacion_id,
        ub.nombre AS ubicacion,
        ub.tipo AS tipo_ubicacion
      FROM usuarios u
      LEFT JOIN ubicaciones ub
        ON ub.id = u.ubicacion_id
      ORDER BY u.id
    `);

    console.table(resultado.rows);
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    await pool.end();
  }
}

verUsuarios();
