const express = require("express");

const {
  getSolicitudes,
  getSolicitudById,
  createSolicitud,
  iniciarRevision,
  aprobarSolicitud,
  rechazarSolicitud,
  cerrarSolicitud
} = require("../controllers/solicitudesController");

const {
  verifyToken
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getSolicitudes
);

router.get(
  "/:id",
  verifyToken,
  getSolicitudById
);

router.post(
  "/",
  verifyToken,
  createSolicitud
);

router.patch(
  "/:id/revision",
  verifyToken,
  iniciarRevision
);

router.patch(
  "/:id/aprobar",
  verifyToken,
  aprobarSolicitud
);

router.patch(
  "/:id/rechazar",
  verifyToken,
  rechazarSolicitud
);

router.patch(
  "/:id/cerrar",
  verifyToken,
  cerrarSolicitud
);

module.exports = router;