const express = require("express");

const {
  login,
  loginPin,
  getUsuariosSucursal
} = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);

router.get(
  "/usuarios-sucursal",
  getUsuariosSucursal
);

router.post(
  "/login-pin",
  loginPin
);

module.exports = router;