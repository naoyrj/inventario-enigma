# Changelog

Todos los cambios importantes del proyecto se documentan en este archivo.

El proyecto utiliza versionado semántico en formato:

MAJOR.MINOR.PATCH

## [0.1.0] - 2026-09-30

### Added

- Filtro de inventario por sucursal/ubicación para usuarios de Almacén Central.
- Versionado semántico del proyecto.
- Archivo CHANGELOG.md para documentar los cambios de cada versión.

### Fixed

- Corrección de la detección del usuario de Almacén Central en la pantalla de Inventario mediante el rol `principal`.
- Corrección de la importación CSV para cargar y relacionar el proveedor indicado por nombre o mediante `proveedor_id`.