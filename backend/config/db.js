const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "enigma_user",
  password: process.env.DB_PASSWORD || "enigma_pass_dev",
  database: process.env.DB_NAME || "inventario_enigma"
});

pool.on("connect", () => {
  console.log("Conectado a PostgreSQL");
});

pool.on("error", (error) => {
  console.error("Error inesperado en PostgreSQL:", error);
});

module.exports = pool;