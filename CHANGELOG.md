# Changelog

Todos los cambios importantes del proyecto se documentan en este archivo.

El proyecto utiliza versionado semántico en formato MAJOR.MINOR.PATCH.

## [0.2.0] - 2026-10-03

### Added

- Carga de proveedor desde archivo CSV.
- Soporte para las columnas `proveedor` y `proveedor_nombre`.
- Asociación automática del proveedor existente al producto importado.
- Compatibilidad con `proveedor_id` en archivos CSV existentes.
- Carga de imágenes JPG, JPEG y PNG en los productos.
- Límite de 5 MB para imágenes de producto.
- Vista de la imagen del producto desde su detalle.

### Fixed

- Restauración de la funcionalidad de imágenes de producto existente antes de v0.1.0.
- Corrección de la asociación de proveedores durante la importación CSV.
- Registro de movimientos Kardex cuando la cantidad cambia mediante CSV.

## [0.1.0] - 2026-09-27

### Added

- Filtro de inventario por sucursal/ubicación para usuarios de Almacén Central.
- Versionado semántico del proyecto.
- Archivo `CHANGELOG.md` para documentar los cambios de cada versión.

### Fixed

- Corrección de la detección del usuario de Central en la pantalla de Inventario mediante el rol `principal`.