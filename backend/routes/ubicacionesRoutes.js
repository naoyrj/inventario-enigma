const express = require("express");

const {
  getUbicaciones,
  createUbicacion
} = require("../controllers/ubicacionesController");

const router = express.Router();

router.get("/", getUbicaciones);
router.post("/", createUbicacion);

module.exports = router;