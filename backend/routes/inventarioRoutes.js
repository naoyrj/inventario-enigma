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

  fileFilter: (
    req,
    file,
    cb
  ) => {
    const nombreArchivo =
      file.originalname.toLowerCase();

    if (
      !nombreArchivo.endsWith(".csv")
    ) {
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
// AGREGAR PRODUCTO EXISTENTE
// =========================================================

router.post(
  "/propio/existente",
  verifyToken,
  agregarProductoExistentePropio
);

// =========================================================
// CREAR PRODUCTO NUEVO
// =========================================================

router.post(
  "/propio/nuevo",
  verifyToken,
  agregarProductoNuevoPropio
);

// =========================================================
// IMPORTAR INVENTARIO CSV
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
//
// El frontend actual utiliza:
//
// POST /inventario/ajuste
//
// enviando:
//
// {
//   producto_id,
//   cantidad,
//   motivo,
//   ubicacion_id
// }
//
// El controlador utiliza:
//
// cantidad_nueva
//
// Esta ruta adapta ambos formatos.
//
// =========================================================

router.post(
  "/ajuste",
  verifyToken,
  (req, res, next) => {
    req.body = {
      ...req.body,

      cantidad_nueva:
        req.body.cantidad_nueva ??
        req.body.cantidad
    };

    ajustarStock(
      req,
      res,
      next
    );
  }
);

// =========================================================
// AJUSTAR STOCK - FORMATO PATCH
// =========================================================
//
// Se mantiene también PATCH para no romper
// llamadas existentes.
//
// =========================================================

router.patch(
  "/ajuste",
  verifyToken,
  (req, res, next) => {
    req.body = {
      ...req.body,

      cantidad_nueva:
        req.body.cantidad_nueva ??
        req.body.cantidad
    };

    ajustarStock(
      req,
      res,
      next
    );
  }
);

// =========================================================
// MANEJO DE ERRORES DE ARCHIVOS
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
            "El archivo CSV no puede superar los 5 MB"
        });
      }

      return res.status(400).json({
        message:
          "Error al procesar el archivo"
      });
    }

    if (error) {
      return res.status(400).json({
        message:
          error.message ||
          "Error al procesar la solicitud"
      });
    }

    next();
  }
);

module.exports = router;