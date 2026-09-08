const express = require("express");

const {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deactivateProducto
} = require("../controllers/productosController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getProductos
);

router.get(
  "/:id",
  verifyToken,
  getProductoById
);

router.post(
  "/",
  verifyToken,
  createProducto
);

router.put(
  "/:id",
  verifyToken,
  updateProducto
);

router.patch(
  "/:id/desactivar",
  verifyToken,
  deactivateProducto
);

module.exports = router;