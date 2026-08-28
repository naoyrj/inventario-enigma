const express = require("express");

const {
  getInventario,
  getInventarioByUbicacion,
  setStockInicial
} = require("../controllers/inventarioController");

const router = express.Router();

router.get("/", getInventario);

router.get(
  "/ubicacion/:ubicacionId",
  getInventarioByUbicacion
);

router.post(
  "/stock-inicial",
  setStockInicial
);

module.exports = router;