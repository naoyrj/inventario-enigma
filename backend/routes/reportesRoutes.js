const express = require("express");

const {
  getInventario,
  getAlertas,
  getKardexProducto,
  getKardex,
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

// =========================================================
// KARDEX GENERAL
// Debe ir antes de /kardex/:producto_id
// =========================================================

router.get(
  "/kardex",
  verifyToken,
  getKardex
);

// =========================================================
// KARDEX POR PRODUCTO
// Ruta anterior conservada para compatibilidad
// =========================================================

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