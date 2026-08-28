const express = require("express");

const {
  getInventario,
  getAlertas,
  getKardexProducto,
  getConsumo,
  getSolicitudesReporte,
  getResumen
} = require("../controllers/reportesController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/inventario",
  verifyToken,
  getInventario
);

router.get(
  "/alertas",
  verifyToken,
  getAlertas
);

router.get(
  "/kardex/:producto_id",
  verifyToken,
  getKardexProducto
);

router.get(
  "/consumo",
  verifyToken,
  getConsumo
);

router.get(
  "/solicitudes",
  verifyToken,
  getSolicitudesReporte
);

router.get(
  "/resumen",
  verifyToken,
  getResumen
);

module.exports = router;