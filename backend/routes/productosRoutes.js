const express = require("express");

const {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deactivateProducto
} = require("../controllers/productosController");

const router = express.Router();

router.get("/", getProductos);
router.get("/:id", getProductoById);
router.post("/", createProducto);
router.put("/:id", updateProducto);
router.patch("/:id/desactivar", deactivateProducto);

module.exports = router;