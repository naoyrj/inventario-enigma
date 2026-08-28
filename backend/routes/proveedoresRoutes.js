const express = require("express");

const {
  getProveedores,
  getProveedorById,
  createProveedor,
  asociarProducto
} = require("../controllers/proveedoresController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", verifyToken, getProveedores);

router.get("/:id", verifyToken, getProveedorById);

router.post("/", verifyToken, createProveedor);

router.post(
  "/:id/productos",
  verifyToken,
  asociarProducto
);

module.exports = router;