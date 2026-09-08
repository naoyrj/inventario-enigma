ALTER TABLE categorias
ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);

ALTER TABLE categorias
ADD COLUMN IF NOT EXISTS ubicacion_propietaria_id INTEGER;

UPDATE categorias
SET tipo = 'global'
WHERE tipo IS NULL;

ALTER TABLE categorias
ALTER COLUMN tipo SET DEFAULT 'global';

ALTER TABLE categorias
ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE categorias
ADD CONSTRAINT categorias_tipo_check
CHECK (tipo IN ('global', 'privada'));

ALTER TABLE categorias
ADD CONSTRAINT categorias_ubicacion_propietaria_fk
FOREIGN KEY (ubicacion_propietaria_id)
REFERENCES ubicaciones(id);

ALTER TABLE categorias
ADD CONSTRAINT categorias_propiedad_check
CHECK (
  (tipo = 'global' AND ubicacion_propietaria_id IS NULL)
  OR
  (tipo = 'privada' AND ubicacion_propietaria_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_categorias_tipo
ON categorias(tipo);

CREATE INDEX IF NOT EXISTS idx_categorias_ubicacion_propietaria
ON categorias(ubicacion_propietaria_id);