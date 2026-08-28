const express = require("express");

const {
  getCategorias,
  createCategoria
} = require("../controllers/categoriasController");

const router = express.Router();

router.get("/", getCategorias);

router.post("/", createCategoria);

module.exports = router;