CREATE DATABASE IF NOT EXISTS inventario_enigma
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
USE inventario_enigma;

CREATE TABLE categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion VARCHAR(255),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ubicaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  tipo ENUM('central', 'sucursal', 'equipo_interno') NOT NULL,
  puede_solicitar_a_nombre_de_otra BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE,
  password_hash VARCHAR(255),
  pin_hash VARCHAR(255),
  rol ENUM('principal', 'sucursal', 'equipo_interno') NOT NULL,
  nivel_permiso ENUM(
    'consulta',
    'operador',
    'aprobador_admin'
  ) NULL,
  ubicacion_id INT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usuario_ubicacion
    FOREIGN KEY (ubicacion_id)
    REFERENCES ubicaciones(id)
);

CREATE TABLE productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  sku VARCHAR(100) NOT NULL UNIQUE,
  categoria_id INT,
  unidad_medida VARCHAR(50) NOT NULL,
  punto_reorden DECIMAL(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_producto_categoria
    FOREIGN KEY (categoria_id)
    REFERENCES categorias(id)
);

CREATE TABLE inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ubicacion_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uk_inventario_ubicacion_producto
    UNIQUE (ubicacion_id, producto_id),

  CONSTRAINT fk_inventario_ubicacion
    FOREIGN KEY (ubicacion_id)
    REFERENCES ubicaciones(id),

  CONSTRAINT fk_inventario_producto
    FOREIGN KEY (producto_id)
    REFERENCES productos(id)
);

CREATE TABLE proveedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  contacto VARCHAR(150),
  telefono VARCHAR(30),
  email VARCHAR(150),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE proveedor_productos (
  proveedor_id INT NOT NULL,
  producto_id INT NOT NULL,

  PRIMARY KEY (proveedor_id, producto_id),

  CONSTRAINT fk_proveedor_producto_proveedor
    FOREIGN KEY (proveedor_id)
    REFERENCES proveedores(id),

  CONSTRAINT fk_proveedor_producto_producto
    FOREIGN KEY (producto_id)
    REFERENCES productos(id)
);

CREATE TABLE solicitudes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  destino_ubicacion_id INT NOT NULL,
  creado_por_usuario_id INT NOT NULL,
  solicitante_ubicacion_id INT NOT NULL,
  estado ENUM(
    'solicitada',
    'en_revision',
    'aprobada',
    'en_transito',
    'recibida',
    'cerrada',
    'rechazada'
  ) NOT NULL DEFAULT 'solicitada',
  motivo_cierre TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_solicitud_destino
    FOREIGN KEY (destino_ubicacion_id)
    REFERENCES ubicaciones(id),

  CONSTRAINT fk_solicitud_usuario
    FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuarios(id),

  CONSTRAINT fk_solicitud_solicitante
    FOREIGN KEY (solicitante_ubicacion_id)
    REFERENCES ubicaciones(id)
);

CREATE TABLE solicitud_lineas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad_solicitada DECIMAL(12,2) NOT NULL,
  cantidad_aprobada DECIMAL(12,2) NOT NULL DEFAULT 0,
  cantidad_enviada_acumulada DECIMAL(12,2) NOT NULL DEFAULT 0,
  cantidad_recibida_acumulada DECIMAL(12,2) NOT NULL DEFAULT 0,

  CONSTRAINT fk_solicitud_linea_solicitud
    FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_solicitud_linea_producto
    FOREIGN KEY (producto_id)
    REFERENCES productos(id)
);

CREATE TABLE envios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  solicitud_id INT NOT NULL,
  estado ENUM(
    'preparacion',
    'en_transito',
    'recibido',
    'cancelado'
  ) NOT NULL DEFAULT 'preparacion',
  creado_por_usuario_id INT NOT NULL,
  confirmado_por_usuario_id INT NULL,
  fecha_envio DATETIME NULL,
  fecha_recepcion DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_envio_solicitud
    FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes(id),

  CONSTRAINT fk_envio_creado_por
    FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuarios(id),

  CONSTRAINT fk_envio_confirmado_por
    FOREIGN KEY (confirmado_por_usuario_id)
    REFERENCES usuarios(id)
);

CREATE TABLE envio_lineas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  envio_id INT NOT NULL,
  solicitud_linea_id INT NOT NULL,
  cantidad_enviada DECIMAL(12,2) NOT NULL,

  CONSTRAINT fk_envio_linea_envio
    FOREIGN KEY (envio_id)
    REFERENCES envios(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_envio_linea_solicitud_linea
    FOREIGN KEY (solicitud_linea_id)
    REFERENCES solicitud_lineas(id)
);

CREATE TABLE movimientos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ubicacion_id INT NOT NULL,
  producto_id INT NOT NULL,
  usuario_id INT NOT NULL,
  tipo ENUM(
    'entrada',
    'salida',
    'transferencia_salida',
    'transferencia_entrada',
    'ajuste_positivo',
    'ajuste_negativo',
    'merma',
    'consumo'
  ) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  referencia_tipo VARCHAR(50),
  referencia_id INT,
  motivo TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_movimiento_ubicacion
    FOREIGN KEY (ubicacion_id)
    REFERENCES ubicaciones(id),

  CONSTRAINT fk_movimiento_producto
    FOREIGN KEY (producto_id)
    REFERENCES productos(id),

  CONSTRAINT fk_movimiento_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES usuarios(id)
);

CREATE TABLE ordenes_compra (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proveedor_id INT NOT NULL,
  creado_por_usuario_id INT NOT NULL,
  estado ENUM(
    'borrador',
    'enviada',
    'parcial',
    'recibida',
    'cancelada'
  ) NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_orden_proveedor
    FOREIGN KEY (proveedor_id)
    REFERENCES proveedores(id),

  CONSTRAINT fk_orden_usuario
    FOREIGN KEY (creado_por_usuario_id)
    REFERENCES usuarios(id)
);

CREATE TABLE orden_compra_lineas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_compra_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad_solicitada DECIMAL(12,2) NOT NULL,
  cantidad_recibida DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_unitario DECIMAL(12,2),

  CONSTRAINT fk_orden_linea_orden
    FOREIGN KEY (orden_compra_id)
    REFERENCES ordenes_compra(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_orden_linea_producto
    FOREIGN KEY (producto_id)
    REFERENCES productos(id)
);