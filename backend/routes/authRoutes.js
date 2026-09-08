const express = require("express");

const {
  login,
  loginPin,
  getUsuariosSucursal,
  getSucursales
} = require("../controllers/authController");

const router = express.Router();

router.post(
  "/login",
  login
);

router.get(
  "/sucursales",
  getSucursales
);

router.get(
  "/usuarios-sucursal",
  getUsuariosSucursal
);

router.post(
  "/login-pin",
  loginPin
);

module.exports = router;