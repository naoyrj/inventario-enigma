const express = require("express");

const {
  getMovimientos,
  getMovimientosByUbicacion,
  registrarEntrada,
  registrarSalida
} = require("../controllers/movimientosController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getMovimientos
);

router.get(
  "/ubicacion/:ubicacionId",
  verifyToken,
  getMovimientosByUbicacion
);

router.post(
  "/entrada",
  verifyToken,
  registrarEntrada
);

router.post(
  "/salida",
  verifyToken,
  registrarSalida
);

module.exports = router;