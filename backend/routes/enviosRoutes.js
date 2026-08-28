const express = require("express");

const {
  getEnvios,
  getEnvioById,
  createEnvio,
  marcarEnTransito,
  confirmarRecepcion
} = require("../controllers/enviosController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getEnvios
);

router.get(
  "/:id",
  verifyToken,
  getEnvioById
);

router.post(
  "/",
  verifyToken,
  createEnvio
);

router.patch(
  "/:id/transito",
  verifyToken,
  marcarEnTransito
);

router.patch(
  "/:id/recibir",
  verifyToken,
  confirmarRecepcion
);

module.exports = router;