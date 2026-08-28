const pool = require("../config/db");

const CENTRAL_ID = 1;

const validarAdminCentral = (req, res) => {
  if (
    req.usuario.rol !== "principal" ||
    req.usuario.nivel_permiso !== "aprobador_admin"
  ) {
    res.status(403).json({
      message:
        "Solo un Aprobador/Administrador de Central puede gestionar compras"
    });

    return false;
  }

  return true;
};

const getOrdenes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        oc.id,
        oc.proveedor_id,
        p.nombre AS proveedor_nombre,
        oc.creado_por_usuario_id,
        u.nombre AS creado_por_usuario_nombre,
        oc.estado,
        oc.created_at
      FROM ordenes_compra oc

      INNER JOIN proveedores p
        ON oc.proveedor_id = p.id

      INNER JOIN usuarios u
        ON oc.creado_por_usuario_id = u.id

      ORDER BY oc.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener órdenes de compra",
      error: error.message
    });
  }
};

const getOrdenById = async (req, res) => {
  try {
    const { id } = req.params;

    const [ordenes] = await pool.query(
      `
        SELECT
          oc.id,
          oc.proveedor_id,
          p.nombre AS proveedor_nombre,
          oc.creado_por_usuario_id,
          u.nombre AS creado_por_usuario_nombre,
          oc.estado,
          oc.created_at
        FROM ordenes_compra oc

        INNER JOIN proveedores p
          ON oc.proveedor_id = p.id

        INNER JOIN usuarios u
          ON oc.creado_por_usuario_id = u.id

        WHERE oc.id = ?
      `,
      [id]
    );

    if (ordenes.length === 0) {
      return res.status(404).json({
        message: "Orden de compra no encontrada"
      });
    }

    const [lineas] = await pool.query(
      `
        SELECT
          ocl.id,
          ocl.producto_id,
          p.nombre AS producto_nombre,
          p.sku,
          p.unidad_medida,
          ocl.cantidad_solicitada,
          ocl.cantidad_recibida,
          ocl.costo_unitario
        FROM orden_compra_lineas ocl

        INNER JOIN productos p
          ON ocl.producto_id = p.id

        WHERE ocl.orden_compra_id = ?

        ORDER BY ocl.id
      `,
      [id]
    );

    res.json({
      orden: ordenes[0],
      lineas
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la orden",
      error: error.message
    });
  }
};

const createOrden = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    if (!validarAdminCentral(req, res)) return;

    const {
      proveedor_id,
      lineas
    } = req.body;

    if (!proveedor_id) {
      return res.status(400).json({
        message: "proveedor_id es obligatorio"
      });
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return res.status(400).json({
        message:
          "La orden debe contener al menos un producto"
      });
    }

    const [proveedores] = await connection.query(
      `
        SELECT id
        FROM proveedores
        WHERE id = ?
          AND activo = 1
      `,
      [proveedor_id]
    );

    if (proveedores.length === 0) {
      return res.status(404).json({
        message: "Proveedor no encontrado o inactivo"
      });
    }

    for (const linea of lineas) {
      const cantidad = Number(
        linea.cantidad_solicitada
      );

      if (
        !linea.producto_id ||
        Number.isNaN(cantidad) ||
        cantidad <= 0
      ) {
        return res.status(400).json({
          message:
            "Cada línea necesita producto_id y una cantidad mayor a 0"
        });
      }

      const [asociaciones] =
        await connection.query(
          `
            SELECT proveedor_id
            FROM proveedor_productos
            WHERE proveedor_id = ?
              AND producto_id = ?
          `,
          [
            proveedor_id,
            linea.producto_id
          ]
        );

      if (asociaciones.length === 0) {
        return res.status(400).json({
          message:
            `El producto ${linea.producto_id} no está asociado a este proveedor`
        });
      }
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO ordenes_compra (
          proveedor_id,
          creado_por_usuario_id,
          estado
        )
        VALUES (?, ?, 'borrador')
      `,
      [
        proveedor_id,
        req.usuario.id
      ]
    );

    const ordenId = result.insertId;

    for (const linea of lineas) {
      await connection.query(
        `
          INSERT INTO orden_compra_lineas (
            orden_compra_id,
            producto_id,
            cantidad_solicitada,
            cantidad_recibida,
            costo_unitario
          )
          VALUES (?, ?, ?, 0, ?)
        `,
        [
          ordenId,
          linea.producto_id,
          Number(linea.cantidad_solicitada),
          linea.costo_unitario ?? null
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Orden de compra creada correctamente",
      orden_compra_id: ordenId,
      estado: "borrador"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al crear la orden de compra",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

const enviarOrden = async (req, res) => {
  try {
    if (!validarAdminCentral(req, res)) return;

    const { id } = req.params;

    const [result] = await pool.query(
      `
        UPDATE ordenes_compra
        SET estado = 'enviada'
        WHERE id = ?
          AND estado = 'borrador'
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message:
          "La orden no existe o no está en borrador"
      });
    }

    res.json({
      message: "Orden enviada al proveedor",
      orden_compra_id: Number(id),
      estado: "enviada"
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al enviar la orden",
      error: error.message
    });
  }
};

const recibirCompra = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    if (!validarAdminCentral(req, res)) return;

    const { id } = req.params;
    const { lineas } = req.body;

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return res.status(400).json({
        message:
          "Debes indicar los productos recibidos"
      });
    }

    await connection.beginTransaction();

    const [ordenes] = await connection.query(
      `
        SELECT id, estado
        FROM ordenes_compra
        WHERE id = ?
        FOR UPDATE
      `,
      [id]
    );

    if (ordenes.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Orden de compra no encontrada"
      });
    }

    if (
      !["enviada", "parcial"].includes(
        ordenes[0].estado
      )
    ) {
      await connection.rollback();

      return res.status(400).json({
        message:
          "Solo pueden recibirse órdenes enviadas o parcialmente recibidas"
      });
    }

    const [lineasOrden] = await connection.query(
      `
        SELECT
          id,
          producto_id,
          cantidad_solicitada,
          cantidad_recibida
        FROM orden_compra_lineas
        WHERE orden_compra_id = ?
        FOR UPDATE
      `,
      [id]
    );

    for (const recibida of lineas) {
      const lineaOrden = lineasOrden.find(
        (linea) =>
          Number(linea.id) ===
          Number(recibida.linea_id)
      );

      if (!lineaOrden) {
        await connection.rollback();

        return res.status(400).json({
          message:
            `La línea ${recibida.linea_id} no pertenece a esta orden`
        });
      }

      const cantidad = Number(
        recibida.cantidad_recibida
      );

      if (
        Number.isNaN(cantidad) ||
        cantidad <= 0
      ) {
        await connection.rollback();

        return res.status(400).json({
          message:
            "Las cantidades recibidas deben ser mayores a 0"
        });
      }

      const pendiente =
        Number(lineaOrden.cantidad_solicitada) -
        Number(lineaOrden.cantidad_recibida);

      if (cantidad > pendiente) {
        await connection.rollback();

        return res.status(400).json({
          message:
            `La recepción supera lo pendiente del producto ${lineaOrden.producto_id}`,
          cantidad_pendiente: pendiente
        });
      }

      await connection.query(
        `
          UPDATE orden_compra_lineas
          SET cantidad_recibida =
              cantidad_recibida + ?
          WHERE id = ?
        `,
        [
          cantidad,
          lineaOrden.id
        ]
      );

      await connection.query(
        `
          INSERT INTO inventario (
            ubicacion_id,
            producto_id,
            cantidad
          )
          VALUES (?, ?, ?)

          ON DUPLICATE KEY UPDATE
            cantidad = cantidad + VALUES(cantidad)
        `,
        [
          CENTRAL_ID,
          lineaOrden.producto_id,
          cantidad
        ]
      );

      await connection.query(
        `
          INSERT INTO movimientos (
            ubicacion_id,
            producto_id,
            usuario_id,
            tipo,
            cantidad,
            referencia_tipo,
            referencia_id,
            motivo
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          CENTRAL_ID,
          lineaOrden.producto_id,
          req.usuario.id,
          "entrada",
          cantidad,
          "orden_compra",
          Number(id),
          `Recepción de orden de compra #${id}`
        ]
      );
    }

    const [pendientes] = await connection.query(
      `
        SELECT COUNT(*) AS total
        FROM orden_compra_lineas
        WHERE orden_compra_id = ?
          AND cantidad_recibida <
              cantidad_solicitada
      `,
      [id]
    );

    const completa =
      Number(pendientes[0].total) === 0;

    await connection.query(
      `
        UPDATE ordenes_compra
        SET estado = ?
        WHERE id = ?
      `,
      [
        completa ? "recibida" : "parcial",
        id
      ]
    );

    await connection.commit();

    res.json({
      message:
        completa
          ? "Orden recibida completamente"
          : "Recepción parcial registrada",
      orden_compra_id: Number(id),
      estado:
        completa ? "recibida" : "parcial"
    });
  } catch (error) {
    await connection.rollback();

    res.status(500).json({
      message: "Error al recibir la compra",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getOrdenes,
  getOrdenById,
  createOrden,
  enviarOrden,
  recibirCompra
};