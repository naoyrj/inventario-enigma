const express = require("express");
const multer = require("multer");

const {
  getProductos,
  getProductoById,
  getImagenProducto,
  createProducto,
  updateProducto,
  deactivateProducto
} = require("../controllers/productosController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

// =========================================================
// CONFIGURACIÓN DE MULTER PARA IMÁGENES
// =========================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const tiposPermitidos = [
      "image/jpeg",
      "image/png"
    ];

    if (
      !tiposPermitidos.includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          "Solo se permiten imágenes JPG, JPEG o PNG"
        )
      );
    }

    cb(null, true);
  }
});

// =========================================================
// PRODUCTOS
// =========================================================

router.get(
  "/",
  verifyToken,
  getProductos
);

// =========================================================
// IMAGEN DEL PRODUCTO
// =========================================================

router.get(
  "/:id/imagen",
  verifyToken,
  getImagenProducto
);

// =========================================================
// PRODUCTO POR ID
// =========================================================

router.get(
  "/:id",
  verifyToken,
  getProductoById
);

// =========================================================
// CREAR PRODUCTO
// =========================================================

router.post(
  "/",
  verifyToken,
  upload.single("imagen"),
  createProducto
);

// =========================================================
// ACTUALIZAR PRODUCTO
// =========================================================

router.put(
  "/:id",
  verifyToken,
  upload.single("imagen"),
  updateProducto
);

// =========================================================
// DESACTIVAR PRODUCTO
// =========================================================

router.patch(
  "/:id/desactivar",
  verifyToken,
  deactivateProducto
);

// =========================================================
// MANEJO DE ERRORES DE MULTER
// =========================================================

router.use(
  (error, req, res, next) => {
    if (
      error instanceof multer.MulterError
    ) {
      if (
        error.code === "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          message:
            "La imagen no puede superar los 5 MB."
        });
      }

      return res.status(400).json({
        message:
          "Error al procesar la imagen."
      });
    }

    if (
      error &&
      error.message ===
        "Solo se permiten imágenes JPG, JPEG o PNG"
    ) {
      return res.status(400).json({
        message: error.message
      });
    }

    next(error);
  }
);

module.exports = router;