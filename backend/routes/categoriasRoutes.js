const express = require("express");

const {
  getCategorias,
  createCategoria,
  updateCategoria,
  toggleCategoria
} = require("../controllers/categoriasController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getCategorias
);

router.post(
  "/",
  verifyToken,
  createCategoria
);

router.put(
  "/:id",
  verifyToken,
  updateCategoria
);

router.patch(
  "/:id/estado",
  verifyToken,
  toggleCategoria
);

module.exports = router;