const express = require("express");

const {
  getInventario,
  getInventarioByUbicacion,
  setStockInicial,
  agregarProductoExistentePropio,
  agregarProductoNuevoPropio,
  ajustarStock
} = require("../controllers/inventarioController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getInventario
);

router.get(
  "/ubicacion/:ubicacionId",
  verifyToken,
  getInventarioByUbicacion
);

router.post(
  "/stock-inicial",
  verifyToken,
  setStockInicial
);

router.post(
  "/propio/existente",
  verifyToken,
  agregarProductoExistentePropio
);

router.post(
  "/propio/nuevo",
  verifyToken,
  agregarProductoNuevoPropio
);

// ISSUE 11
router.patch(
  "/ajuste",
  verifyToken,
  ajustarStock
);

module.exports = router;