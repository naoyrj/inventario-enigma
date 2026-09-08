const { Pool } = require("pg");
require("dotenv").config();

const config = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL
    }
  : {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    };

const pool = new Pool(config);

pool
  .connect()
  .then((client) => {
    console.log("Conexión a PostgreSQL establecida");
    client.release();
  })
  .catch((error) => {
    console.error(
      "Error al conectar con PostgreSQL:",
      error.message
    );
  });

module.exports = pool;