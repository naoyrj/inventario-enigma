const express = require("express");
const multer = require("multer");

const {
  getProductos,
  getProductoById,
  getImagenProducto,
  updateImagenProducto,
  createProducto,
  updateProducto,
  deactivateProducto
} = require("../controllers/productosController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

// =========================================================
// CONFIGURACIÓN DE MULTER PARA IMÁGENES DE PRODUCTOS
// =========================================================

const almacenamiento = multer.memoryStorage();

const tiposPermitidos = [
  "image/png",
  "image/jpeg"
];

const filtroImagen = (
  req,
  file,
  callback
) => {
  if (
    tiposPermitidos.includes(
      file.mimetype
    )
  ) {
    callback(null, true);
    return;
  }

  const error = new Error(
    "Formato de imagen no permitido. Solo se aceptan archivos PNG, JPG y JPEG."
  );

  error.status = 400;

  callback(error);
};

const subirImagen = multer({
  storage: almacenamiento,

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: filtroImagen
});

// =========================================================
// MIDDLEWARE PARA PROCESAR IMAGEN
// =========================================================

const procesarImagen = (
  req,
  res,
  next
) => {
  subirImagen.single("imagen")(
    req,
    res,
    (error) => {
      if (!error) {
        next();
        return;
      }

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
              "La imagen no puede superar los 5 MB."
          });
        }

        return res.status(400).json({
          message:
            "No fue posible procesar la imagen.",
          error:
            error.message
        });
      }

      return res
        .status(
          error.status || 400
        )
        .json({
          message:
            error.message ||
            "La imagen seleccionada no es válida."
        });
    }
  );
};

// =========================================================
// OBTENER PRODUCTOS
// =========================================================

router.get(
  "/",
  verifyToken,
  getProductos
);

// =========================================================
// OBTENER IMAGEN DEL PRODUCTO
//
// IMPORTANTE:
// Debe estar antes de "/:id".
// =========================================================

router.get(
  "/:id/imagen",
  verifyToken,
  getImagenProducto
);

// =========================================================
// ACTUALIZAR IMAGEN DEL PRODUCTO
//
// Solo procesa multipart/form-data.
// Campo del archivo: "imagen"
// =========================================================

router.put(
  "/:id/imagen",
  verifyToken,
  procesarImagen,
  updateImagenProducto
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
// CREAR PRODUCTO
//
// Permite imagen opcional durante la creación.
// =========================================================

router.post(
  "/",
  verifyToken,
  procesarImagen,
  createProducto
);

// =========================================================
// ACTUALIZAR DATOS DEL PRODUCTO
//
// Este endpoint trabaja con JSON.
// Proveedor, categoría y demás especificaciones se actualizan
// independientemente de la imagen.
// =========================================================

router.put(
  "/:id",
  verifyToken,
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

module.exports = router;