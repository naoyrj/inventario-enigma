ALTER TABLE ubicaciones
ADD COLUMN IF NOT EXISTS estado VARCHAR(20);

UPDATE ubicaciones
SET estado = CASE
  WHEN activo = TRUE THEN 'activa'
  ELSE 'inactiva'
END
WHERE estado IS NULL;

ALTER TABLE ubicaciones
ALTER COLUMN estado SET DEFAULT 'activa';

ALTER TABLE ubicaciones
ALTER COLUMN estado SET NOT NULL;

ALTER TABLE ubicaciones
DROP CONSTRAINT IF EXISTS ubicaciones_estado_check;

ALTER TABLE ubicaciones
ADD CONSTRAINT ubicaciones_estado_check
CHECK (
  estado IN (
    'activa',
    'pendiente',
    'inactiva'
  )
);