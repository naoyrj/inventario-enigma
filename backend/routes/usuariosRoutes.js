const express = require("express");

const {
  getUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  validarPin,
  deactivateUsuario,
  activateUsuario,
  deleteUsuario
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

router.patch(
  "/:id/reactivar",
  verifyToken,
  activateUsuario
);

router.delete(
  "/:id",
  verifyToken,
  deleteUsuario
);

module.exports = router;