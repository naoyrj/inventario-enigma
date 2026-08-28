const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const ubicacionesRoutes =
  require("./routes/ubicacionesRoutes");

const categoriasRoutes =
  require("./routes/categoriasRoutes");

const productosRoutes =
  require("./routes/productosRoutes");

const inventarioRoutes =
  require("./routes/inventarioRoutes");

const usuariosRoutes =
  require("./routes/usuariosRoutes");

const authRoutes =
  require("./routes/authRoutes");

const movimientosRoutes =
  require("./routes/movimientosRoutes");

const solicitudesRoutes =
  require("./routes/solicitudesRoutes");

const enviosRoutes =
  require("./routes/enviosRoutes");

const proveedoresRoutes =
  require("./routes/proveedoresRoutes");

const comprasRoutes =
  require("./routes/comprasRoutes");

const reportesRoutes =
  require("./routes/reportesRoutes");

const {
  verifyToken
} = require("./middlewares/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message:
      "API Sistema de Inventario Enigma Rooms"
  });
});

app.get(
  "/api/test-db",
  async (req, res) => {
    try {
      const connection =
        await pool.getConnection();

      connection.release();

      res.json({
        success: true,
        message:
          "Conexión con MySQL exitosa"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          "No se pudo conectar con MySQL",
        error: error.message
      });
    }
  }
);

app.get(
  "/api/auth/me",
  verifyToken,
  (req, res) => {
    res.json({
      message: "Token válido",
      usuario: req.usuario
    });
  }
);

app.use("/api/auth", authRoutes);
app.use("/api/ubicaciones", ubicacionesRoutes);
app.use("/api/categorias", categoriasRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/movimientos", movimientosRoutes);
app.use("/api/solicitudes", solicitudesRoutes);
app.use("/api/envios", enviosRoutes);
app.use("/api/proveedores", proveedoresRoutes);
app.use("/api/compras", comprasRoutes);
app.use("/api/reportes", reportesRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Servidor ejecutándose en http://localhost:${PORT}`
  );
});