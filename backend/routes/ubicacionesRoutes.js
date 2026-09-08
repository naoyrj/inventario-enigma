const express = require("express");

const {
  getUbicaciones,
  getUbicacionById,
  createUbicacion,
  updateUbicacion,
  cambiarEstadoUbicacion
} = require("../controllers/ubicacionesController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const {
  administradorCentral
} = require("../middlewares/permissionsMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getUbicaciones
);

router.get(
  "/:id",
  verifyToken,
  getUbicacionById
);

router.post(
  "/",
  verifyToken,
  administradorCentral,
  createUbicacion
);

router.put(
  "/:id",
  verifyToken,
  administradorCentral,
  updateUbicacion
);

router.patch(
  "/:id/estado",
  verifyToken,
  administradorCentral,
  cambiarEstadoUbicacion
);

module.exports = router;