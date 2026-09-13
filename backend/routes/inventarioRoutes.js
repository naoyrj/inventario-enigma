const express = require("express");
const multer = require("multer");

const {
  getInventario,
  getInventarioByUbicacion,
  setStockInicial,
  agregarProductoExistentePropio,
  agregarProductoNuevoPropio,
  ajustarStock,
  importarInventarioCsv
} = require("../controllers/inventarioController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

// =========================================================
// CONFIGURACIÓN PARA ARCHIVOS CSV
// =========================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const nombreArchivo =
      file.originalname.toLowerCase();

    if (!nombreArchivo.endsWith(".csv")) {
      return cb(
        new Error(
          "Solo se permiten archivos CSV"
        )
      );
    }

    cb(null, true);
  }
});

// =========================================================
// INVENTARIO
// =========================================================

router.get(
  "/",
  verifyToken,
  getInventario
);

// =========================================================
// INVENTARIO POR UBICACIÓN
// =========================================================

router.get(
  "/ubicacion/:ubicacionId",
  verifyToken,
  getInventarioByUbicacion
);

// =========================================================
// STOCK INICIAL
// =========================================================

router.post(
  "/stock-inicial",
  verifyToken,
  setStockInicial
);

// =========================================================
// AGREGAR PRODUCTO EXISTENTE AL INVENTARIO PROPIO
// =========================================================

router.post(
  "/propio/existente",
  verifyToken,
  agregarProductoExistentePropio
);

// =========================================================
// CREAR PRODUCTO NUEVO EN INVENTARIO PROPIO
// =========================================================

router.post(
  "/propio/nuevo",
  verifyToken,
  agregarProductoNuevoPropio
);

// =========================================================
// IMPORTAR PRODUCTOS MEDIANTE CSV
// =========================================================

router.post(
  "/importar-csv",
  verifyToken,
  upload.single("archivo"),
  importarInventarioCsv
);

// =========================================================
// AJUSTAR STOCK
// =========================================================

router.patch(
  "/ajuste",
  verifyToken,
  ajustarStock
);

// =========================================================
// MANEJO DE ERRORES DE ARCHIVOS
// =========================================================

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message:
          "El archivo CSV no puede superar los 5 MB"
      });
    }

    return res.status(400).json({
      message:
        "Error al procesar el archivo",
      error: error.message
    });
  }

  if (
    error?.message ===
    "Solo se permiten archivos CSV"
  ) {
    return res.status(400).json({
      message:
        "Solo se permiten archivos con extensión .csv"
    });
  }

  next(error);
});

module.exports = router;