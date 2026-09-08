const express = require("express");

const {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  validarPin,
  deactivateUsuario
} = require("../controllers/usuariosController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getUsuarios
);

router.get(
  "/:id",
  verifyToken,
  getUsuarioById
);

router.post(
  "/",
  verifyToken,
  createUsuario
);

router.patch(
  "/:id",
  verifyToken,
  updateUsuario
);

router.post(
  "/validar-pin",
  validarPin
);

router.patch(
  "/:id/desactivar",
  verifyToken,
  deactivateUsuario
);

module.exports = router;