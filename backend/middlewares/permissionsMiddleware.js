const soloCentral = (req, res, next) => {
  if (req.usuario.rol !== "principal") {
    return res.status(403).json({
      message: "Esta acción es exclusiva de Central"
    });
  }

  next();
};

const operadorCentral = (req, res, next) => {
  if (
    req.usuario.rol !== "principal" ||
    !["operador", "aprobador_admin"].includes(
      req.usuario.nivel_permiso
    )
  ) {
    return res.status(403).json({
      message:
        "Necesitas permisos de Operador o Administrador de Central"
    });
  }

  next();
};

const administradorCentral = (
  req,
  res,
  next
) => {
  if (
    req.usuario.rol !== "principal" ||
    req.usuario.nivel_permiso !==
      "aprobador_admin"
  ) {
    return res.status(403).json({
      message:
        "Esta acción requiere permisos de Aprobador/Administrador"
    });
  }

  next();
};

const puedeModificarUbicacion = (
  req,
  res,
  next
) => {
  const ubicacionObjetivo = Number(
    req.body.ubicacion_id ||
    req.params.ubicacion_id
  );

  if (req.usuario.rol === "principal") {
    return next();
  }

  if (
    ubicacionObjetivo &&
    ubicacionObjetivo !==
      Number(req.usuario.ubicacion_id)
  ) {
    return res.status(403).json({
      message:
        "No puedes modificar el inventario de otra ubicación"
    });
  }

  next();
};

const puedeVerUbicacion = (
  req,
  res,
  next
) => {
  const CENTRAL_ID = 1;

  const ubicacionObjetivo = Number(
    req.params.ubicacion_id ||
    req.query.ubicacion_id
  );

  if (
    !ubicacionObjetivo ||
    req.usuario.rol === "principal"
  ) {
    return next();
  }

  if (
    ubicacionObjetivo === CENTRAL_ID ||
    ubicacionObjetivo ===
      Number(req.usuario.ubicacion_id)
  ) {
    return next();
  }

  return res.status(403).json({
    message:
      "No tienes permiso para consultar el inventario de esa ubicación"
  });
};

module.exports = {
  soloCentral,
  operadorCentral,
  administradorCentral,
  puedeModificarUbicacion,
  puedeVerUbicacion
};