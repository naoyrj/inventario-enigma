ALTER TABLE orden_compra_lineas
ADD COLUMN IF NOT EXISTS solicitud_linea_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_orden_linea_solicitud_linea'
  ) THEN
    ALTER TABLE orden_compra_lineas
    ADD CONSTRAINT fk_orden_linea_solicitud_linea
    FOREIGN KEY (solicitud_linea_id)
    REFERENCES solicitud_lineas(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS
idx_orden_compra_lineas_solicitud_linea
ON orden_compra_lineas(solicitud_linea_id);