INSERT INTO usuarios (
  nombre,
  email,
  password_hash,
  pin_hash,
  rol,
  nivel_permiso,
  ubicacion_id,
  activo
)
VALUES (
  'Administrador',
  'admin@enigma.local',
  '$2b$10$lIxdzbkdJO4IcwX5ZHgMLetlCfr3Mit2sDcjX53m0NmWYWK4/8/W2',
  NULL,
  'principal',
  'aprobador_admin',
  1,
  TRUE
);