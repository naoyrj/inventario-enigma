const express = require("express");

const {
  getOrdenes,
  getOrdenById,
  createOrden,
  editarOrden,
  enviarOrden,
  recibirCompra
} = require("../controllers/comprasController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getOrdenes
);

router.get(
  "/:id",
  verifyToken,
  getOrdenById
);

router.post(
  "/",
  verifyToken,
  createOrden
);

router.put(
  "/:id",
  verifyToken,
  editarOrden
);

router.patch(
  "/:id/enviar",
  verifyToken,
  enviarOrden
);

router.patch(
  "/:id/recibir",
  verifyToken,
  recibirCompra
);

module.exports = router;