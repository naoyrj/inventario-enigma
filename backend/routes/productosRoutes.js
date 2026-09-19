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
// CONFIGURACIÓN PARA IMÁGENES DE PRODUCTOS
// =========================================================
//
// Las imágenes se reciben directamente en memoria porque
// el controlador guarda el contenido en PostgreSQL.
//
// Campo esperado desde el frontend:
// "imagen"
//
// Tamaño máximo:
// 5 MB
// =========================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize:
      5 * 1024 * 1024
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {
    const tiposPermitidos = [
      "image/png",
      "image/jpeg"
    ];

    if (
      !tiposPermitidos.includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          "Solo se permiten imágenes PNG, JPG o JPEG"
        )
      );
    }

    cb(null, true);
  }
});

// =========================================================
// OBTENER TODOS LOS PRODUCTOS
// =========================================================

router.get(
  "/",
  verifyToken,
  getProductos
);

// =========================================================
// OBTENER PRODUCTO POR ID
// =========================================================

router.get(
  "/:id",
  verifyToken,
  getProductoById
);

// =========================================================
// OBTENER IMAGEN DEL PRODUCTO
// =========================================================

router.get(
  "/:id/imagen",
  verifyToken,
  getImagenProducto
);

// =========================================================
// CREAR PRODUCTO
// =========================================================
//
// upload.single("imagen") permite:
//
// - Crear producto sin imagen
// - Crear producto con imagen
//
// Si no se envía imagen, req.file simplemente será undefined.
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
//
// Esta es la corrección importante.
//
// Inventario.jsx envía FormData cuando actualiza
// las especificaciones del producto.
//
// Ahora multer procesa:
//
// nombre
// descripcion
// sku
// categoria_id
// unidad_medida
// punto_reorden
// proveedor_id
// activo
// imagen
//
// El controlador recibe:
//
// req.body
// req.file
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
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          message:
            "La imagen no puede superar los 5 MB"
        });
      }

      return res.status(400).json({
        message:
          "Error al procesar la imagen",
        error:
          error.message
      });
    }

    if (
      error?.message ===
      "Solo se permiten imágenes PNG, JPG o JPEG"
    ) {
      return res.status(400).json({
        message:
          "Solo se permiten imágenes PNG, JPG o JPEG"
      });
    }

    next(error);
  }
);

module.exports = router;