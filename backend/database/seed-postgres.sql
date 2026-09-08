INSERT INTO ubicaciones (
  nombre,
  tipo,
  puede_solicitar_a_nombre_de_otra
)
VALUES
(
  'Almacén Central',
  'central',
  FALSE
),
(
  'Mantenimiento',
  'equipo_interno',
  TRUE
),
(
  'Instalación / Franquicias',
  'equipo_interno',
  TRUE
),
(
  'Desarrollo',
  'equipo_interno',
  TRUE
),
(
  'Sucursal Demo',
  'sucursal',
  FALSE
);