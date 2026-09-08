-- =========================================================
-- ISSUE 9
-- UNICIDAD DE CATEGORÍAS GLOBALES Y PRIVADAS
-- =========================================================

-- Eliminar la restricción anterior que hacía que
-- el nombre fuera único para todas las categorías.
ALTER TABLE categorias
DROP CONSTRAINT IF EXISTS categorias_nombre_key;


-- =========================================================
-- CATEGORÍAS GLOBALES
-- =========================================================
-- No puede haber dos categorías globales con el mismo
-- nombre, ignorando mayúsculas y minúsculas.

CREATE UNIQUE INDEX IF NOT EXISTS
  categorias_global_nombre_unique
ON categorias (
  LOWER(nombre)
)
WHERE tipo = 'global';


-- =========================================================
-- CATEGORÍAS PRIVADAS
-- =========================================================
-- Cada Equipo Interno puede tener sus propios nombres.
--
-- Ejemplo:
--
-- Mantenimiento:
--   Herramientas
--
-- Desarrollo:
--   Herramientas
--
-- Esto es válido.
--
-- Pero Mantenimiento no puede crear dos veces:
--   Herramientas

CREATE UNIQUE INDEX IF NOT EXISTS
  categorias_privada_propietario_nombre_unique
ON categorias (
  ubicacion_propietaria_id,
  LOWER(nombre)
)
WHERE tipo = 'privada';