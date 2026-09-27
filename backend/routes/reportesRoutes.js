const express = require("express");

const {
  getInventario,
  getAlertas,
  getKardex,
  getKardexProducto,
  getConsumo,
  getSolicitudesReporte,
  getResumen
} = require("../controllers/reportesController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router =
  express.Router();

// =========================================================
// INVENTARIO
// =========================================================

router.get(
  "/inventario",
  verifyToken,
  getInventario
);

// =========================================================
// ALERTAS
// =========================================================

router.get(
  "/alertas",
  verifyToken,
  getAlertas
);

// =========================================================
// KARDEX GENERAL
// =========================================================

router.get(
  "/kardex",
  verifyToken,
  getKardex
);

// =========================================================
// KARDEX POR PRODUCTO
// =========================================================

router.get(
  "/kardex/:producto_id",
  verifyToken,
  getKardexProducto
);

// =========================================================
// CONSUMO
// =========================================================

router.get(
  "/consumo",
  verifyToken,
  getConsumo
);

// =========================================================
// SOLICITUDES
// =========================================================

router.get(
  "/solicitudes",
  verifyToken,
  getSolicitudesReporte
);

// =========================================================
// RESUMEN
// =========================================================

router.get(
  "/resumen",
  verifyToken,
  getResumen
);

module.exports = router;