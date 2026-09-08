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

const validarNumeroPositivo = (valor) => {
  const numero = Number(valor);

  return (
    Number.isFinite(numero) &&
    numero > 0
  );
};

const validarNumeroNoNegativo = (valor) => {
  const numero = Number(valor);

  return (
    Number.isFinite(numero) &&
    numero >= 0
  );
};

const getOrdenes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        oc.id,
        oc.proveedor_id,
        p.nombre AS proveedor_nombre,
        oc.creado_por_usuario_id,
        u.nombre AS creado_por_usuario_nombre,
        oc.estado,
        oc.created_at,

        STRING_AGG(
          DISTINCT COALESCE(
            sl.solicitud_id,
            spn.solicitud_id
          )::text,
          ', '
        ) FILTER (
          WHERE COALESCE(
            sl.solicitud_id,
            spn.solicitud_id
          ) IS NOT NULL
        ) AS solicitudes_origen

      FROM ordenes_compra oc

      INNER JOIN proveedores p
        ON oc.proveedor_id = p.id

      INNER JOIN usuarios u
        ON oc.creado_por_usuario_id = u.id

      LEFT JOIN orden_compra_lineas ocl
        ON ocl.orden_compra_id = oc.id

      LEFT JOIN solicitud_lineas sl
        ON ocl.solicitud_linea_id = sl.id

      LEFT JOIN solicitud_productos_nuevos spn
        ON ocl.solicitud_producto_nuevo_id = spn.id

      GROUP BY
        oc.id,
        oc.proveedor_id,
        p.nombre,
        oc.creado_por_usuario_id,
        u.nombre,
        oc.estado,
        oc.created_at

      ORDER BY oc.created_at DESC
    `);

    const ordenes = result.rows.map((orden) => ({
      ...orden,
      origen: orden.solicitudes_origen
        ? `Solicitud #${orden.solicitudes_origen
            .split(", ")
            .join(", #")}`
        : "Reorden Central"
    }));

    res.json(ordenes);
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

    const ordenesResult = await pool.query(
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

        WHERE oc.id = $1
      `,
      [id]
    );

    if (ordenesResult.rows.length === 0) {
      return res.status(404).json({
        message: "Orden de compra no encontrada"
      });
    }

    const lineasResult = await pool.query(
      `
        SELECT
          ocl.id,
          ocl.producto_id,
          p.nombre AS producto_nombre,
          p.sku,
          p.unidad_medida,
          ocl.cantidad_solicitada,
          ocl.cantidad_recibida,
          ocl.costo_unitario,
          ocl.solicitud_linea_id,
          ocl.solicitud_producto_nuevo_id,

          COALESCE(
            sl.solicitud_id,
            spn.solicitud_id
          ) AS solicitud_id,

          s.destino_ubicacion_id,
          destino.nombre AS destino_ubicacion_nombre,
          destino.tipo AS destino_ubicacion_tipo,
          solicitante.nombre AS solicitante_ubicacion_nombre,
          solicitante.tipo AS solicitante_ubicacion_tipo,

          spn.proveedor_sugerido,
          spn.proveedor_link,
          spn.sku_sugerido

        FROM orden_compra_lineas ocl

        INNER JOIN productos p
          ON ocl.producto_id = p.id

        LEFT JOIN solicitud_lineas sl
          ON ocl.solicitud_linea_id = sl.id

        LEFT JOIN solicitud_productos_nuevos spn
          ON ocl.solicitud_producto_nuevo_id = spn.id

        LEFT JOIN solicitudes s
          ON s.id = COALESCE(
            sl.solicitud_id,
            spn.solicitud_id
          )

        LEFT JOIN ubicaciones destino
          ON s.destino_ubicacion_id = destino.id

        LEFT JOIN ubicaciones solicitante
          ON s.solicitante_ubicacion_id = solicitante.id

        WHERE ocl.orden_compra_id = $1

        ORDER BY ocl.id
      `,
      [id]
    );

    const solicitudesOrigen = [
      ...new Set(
        lineasResult.rows
          .filter((linea) => linea.solicitud_id)
          .map((linea) => Number(linea.solicitud_id))
      )
    ];

    res.json({
      orden: {
        ...ordenesResult.rows[0],
        solicitudes_origen: solicitudesOrigen,
        origen:
          solicitudesOrigen.length > 0
            ? solicitudesOrigen
                .map((solicitudId) => `Solicitud #${solicitudId}`)
                .join(", ")
            : "Reorden Central"
      },
      lineas: lineasResult.rows
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener la orden",
      error: error.message
    });
  }
};

const validarProductoExistente = async (
  client,
  proveedorId,
  linea
) => {
  const productoId = Number(linea.producto_id);
  const cantidad = Number(linea.cantidad_solicitada);

  if (
    !productoId ||
    !Number.isFinite(productoId) ||
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    return {
      valido: false,
      status: 400,
      message:
        "Cada línea necesita producto y una cantidad mayor a 0"
    };
  }

  if (
    linea.costo_unitario !== null &&
    linea.costo_unitario !== undefined &&
    linea.costo_unitario !== "" &&
    !validarNumeroNoNegativo(linea.costo_unitario)
  ) {
    return {
      valido: false,
      status: 400,
      message: "El costo unitario no puede ser negativo"
    };
  }

  const productoResult = await client.query(
    `
      SELECT
        p.id,
        p.nombre,
        p.activo,
        p.categoria_id,
        c.tipo AS categoria_tipo,
        c.activo AS categoria_activa,
        c.ubicacion_propietaria_id

      FROM productos p

      LEFT JOIN categorias c
        ON p.categoria_id = c.id

      WHERE p.id = $1
    `,
    [productoId]
  );

  if (
    productoResult.rows.length === 0 ||
    productoResult.rows[0].activo !== true
  ) {
    return {
      valido: false,
      status: 400,
      message: `El producto ${productoId} no existe o está inactivo`
    };
  }

  const producto = productoResult.rows[0];

  if (
    producto.categoria_id &&
    producto.categoria_activa !== true
  ) {
    return {
      valido: false,
      status: 400,
      message:
        `La categoría del producto "${producto.nombre}" está inactiva`
    };
  }

  let solicitudLinea = null;
  let vinculadaEquipoInterno = false;

  if (linea.solicitud_linea_id) {
    const solicitudLineaResult = await client.query(
      `
        SELECT
          sl.id,
          sl.solicitud_id,
          sl.producto_id,
          sl.cantidad_solicitada,
          sl.cantidad_aprobada,
          s.estado,
          s.solicitante_ubicacion_id,
          s.destino_ubicacion_id,
          solicitante.nombre AS solicitante_nombre,
          solicitante.tipo AS solicitante_tipo,
          destino.nombre AS destino_nombre,
          destino.tipo AS destino_tipo

        FROM solicitud_lineas sl

        INNER JOIN solicitudes s
          ON sl.solicitud_id = s.id

        INNER JOIN ubicaciones solicitante
          ON s.solicitante_ubicacion_id = solicitante.id

        INNER JOIN ubicaciones destino
          ON s.destino_ubicacion_id = destino.id

        WHERE sl.id = $1
      `,
      [Number(linea.solicitud_linea_id)]
    );

    if (solicitudLineaResult.rows.length === 0) {
      return {
        valido: false,
        status: 400,
        message: "La línea de solicitud seleccionada no existe"
      };
    }

    solicitudLinea = solicitudLineaResult.rows[0];

    if (Number(solicitudLinea.producto_id) !== productoId) {
      return {
        valido: false,
        status: 400,
        message:
          `La línea de la Solicitud #${solicitudLinea.solicitud_id} no corresponde al producto "${producto.nombre}"`
      };
    }

    if (solicitudLinea.destino_tipo !== "equipo_interno") {
      return {
        valido: false,
        status: 400,
        message:
          "Solo pueden vincularse compras a solicitudes cuyo destino sea un Equipo Interno"
      };
    }

    if (["rechazada", "cerrada"].includes(solicitudLinea.estado)) {
      return {
        valido: false,
        status: 400,
        message:
          `La Solicitud #${solicitudLinea.solicitud_id} ya está ${solicitudLinea.estado}`
      };
    }

    if (solicitudLinea.estado !== "aprobada") {
      return {
        valido: false,
        status: 400,
        message:
          `La Solicitud #${solicitudLinea.solicitud_id} debe estar aprobada antes de generar la compra`
      };
    }

    const cantidadAutorizada = Number(
      solicitudLinea.cantidad_aprobada ??
        solicitudLinea.cantidad_solicitada
    );

    if (
      Number.isFinite(cantidadAutorizada) &&
      cantidad > cantidadAutorizada
    ) {
      return {
        valido: false,
        status: 400,
        message:
          `La cantidad de compra supera lo aprobado en la Solicitud #${solicitudLinea.solicitud_id}`
      };
    }

    vinculadaEquipoInterno = true;

    if (
      producto.categoria_tipo === "privada" &&
      producto.ubicacion_propietaria_id &&
      Number(producto.ubicacion_propietaria_id) !==
        Number(solicitudLinea.destino_ubicacion_id)
    ) {
      return {
        valido: false,
        status: 403,
        message:
          `El producto privado "${producto.nombre}" no pertenece al Equipo Interno destino de la solicitud`
      };
    }
  }

  if (
    producto.categoria_tipo === "privada" &&
    !vinculadaEquipoInterno
  ) {
    return {
      valido: false,
      status: 403,
      message:
        `Central solo puede comprar el producto privado "${producto.nombre}" cuando está vinculado a una solicitud aprobada de Equipo Interno`
    };
  }

  const asociacionResult = await client.query(
    `
      SELECT
        proveedor_id,
        producto_id

      FROM proveedor_productos

      WHERE proveedor_id = $1
        AND producto_id = $2
    `,
    [proveedorId, productoId]
  );

  if (
    asociacionResult.rows.length === 0 &&
    !vinculadaEquipoInterno
  ) {
    return {
      valido: false,
      status: 400,
      message:
        `El producto "${producto.nombre}" no está asociado a este proveedor`
    };
  }

  return {
    valido: true,
    producto,
    solicitudLinea,
    crearAsociacionProveedor:
      vinculadaEquipoInterno &&
      asociacionResult.rows.length === 0
  };
};

const validarProductoNuevo = async (
  client,
  producto
) => {
  const solicitudProductoNuevoId =
    producto.solicitud_producto_nuevo_id
      ? Number(producto.solicitud_producto_nuevo_id)
      : null;

  let origenSolicitud = null;

  if (solicitudProductoNuevoId) {
    const origenResult = await client.query(
      `
        SELECT
          spn.id,
          spn.solicitud_id,
          spn.nombre,
          spn.descripcion,
          spn.categoria_id,
          spn.cantidad_solicitada,
          spn.proveedor_sugerido,
          spn.proveedor_link,
          spn.sku_sugerido,
          s.estado,
          s.destino_ubicacion_id,
          destino.tipo AS destino_tipo,
          c.tipo AS categoria_tipo,
          c.activo AS categoria_activa,
          c.ubicacion_propietaria_id

        FROM solicitud_productos_nuevos spn

        INNER JOIN solicitudes s
          ON spn.solicitud_id = s.id

        INNER JOIN ubicaciones destino
          ON s.destino_ubicacion_id = destino.id

        INNER JOIN categorias c
          ON spn.categoria_id = c.id

        WHERE spn.id = $1
      `,
      [solicitudProductoNuevoId]
    );

    if (origenResult.rows.length === 0) {
      return {
        valido: false,
        status: 400,
        message:
          "El producto nuevo seleccionado de la solicitud no existe"
      };
    }

    origenSolicitud = origenResult.rows[0];

    if (
      !["equipo_interno", "sucursal"].includes(
        origenSolicitud.destino_tipo
      )
    ) {
      return {
        valido: false,
        status: 400,
        message:
          "Solo pueden comprarse productos nuevos vinculados a solicitudes cuyo destino sea un Equipo Interno o una Sucursal"
      };
    }

    if (origenSolicitud.estado !== "aprobada") {
      return {
        valido: false,
        status: 400,
        message:
          `La Solicitud #${origenSolicitud.solicitud_id} debe estar aprobada antes de generar la compra`
      };
    }

    if (origenSolicitud.categoria_activa !== true) {
      return {
        valido: false,
        status: 400,
        message:
          "La categoría del producto solicitado está inactiva"
      };
    }

    if (
      origenSolicitud.categoria_tipo === "privada" &&
      Number(origenSolicitud.ubicacion_propietaria_id) !==
        Number(origenSolicitud.destino_ubicacion_id)
    ) {
      return {
        valido: false,
        status: 403,
        message:
          "La categoría privada del producto no pertenece al Equipo Interno destino"
      };
    }
  }

  const nombre =
    origenSolicitud?.nombre || producto.nombre?.trim();

  const descripcion =
    origenSolicitud?.descripcion?.trim() ||
    producto.descripcion?.trim() ||
    "";

  const sku =
    producto.sku?.trim() ||
    origenSolicitud?.sku_sugerido?.trim();

  const unidadMedida =
    producto.unidad_medida?.trim() || "pieza";

  const categoriaId = Number(
    origenSolicitud?.categoria_id ?? producto.categoria_id
  );

  const cantidad = Number(producto.cantidad_solicitada);

  if (
    !nombre ||
    !sku ||
    !unidadMedida ||
    !categoriaId ||
    !Number.isFinite(categoriaId) ||
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    return {
      valido: false,
      status: 400,
      message:
        "Cada producto nuevo necesita nombre, SKU, categoría, unidad de medida y cantidad mayor a 0"
    };
  }

  if (
    origenSolicitud &&
    cantidad > Number(origenSolicitud.cantidad_solicitada)
  ) {
    return {
      valido: false,
      status: 400,
      message:
        `La cantidad supera lo solicitado en la Solicitud #${origenSolicitud.solicitud_id}`
    };
  }

  if (
    producto.costo_unitario !== null &&
    producto.costo_unitario !== undefined &&
    producto.costo_unitario !== "" &&
    !validarNumeroNoNegativo(producto.costo_unitario)
  ) {
    return {
      valido: false,
      status: 400,
      message: "El costo unitario no puede ser negativo"
    };
  }

  const categoriaResult = await client.query(
    `
      SELECT
        id,
        nombre,
        tipo,
        activo,
        ubicacion_propietaria_id

      FROM categorias

      WHERE id = $1
    `,
    [categoriaId]
  );

  if (
    categoriaResult.rows.length === 0 ||
    categoriaResult.rows[0].activo !== true
  ) {
    return {
      valido: false,
      status: 400,
      message:
        "La categoría seleccionada no existe o está inactiva"
    };
  }

  if (
    categoriaResult.rows[0].tipo === "privada" &&
    !origenSolicitud
  ) {
    return {
      valido: false,
      status: 403,
      message:
        "Central no puede dar de alta productos manuales dentro de categorías privadas"
    };
  }

  const skuResult = await client.query(
    `
      SELECT id
      FROM productos
      WHERE LOWER(TRIM(sku)) = LOWER(TRIM($1))
    `,
    [sku]
  );

  if (skuResult.rows.length > 0) {
    return {
      valido: false,
      status: 409,
      message: `Ya existe un producto con el SKU "${sku}"`
    };
  }

  return {
    valido: true,
    datos: {
      nombre,
      descripcion,
      sku,
      unidad_medida: unidadMedida,
      categoria_id: categoriaId,
      cantidad_solicitada: cantidad,
      costo_unitario:
        producto.costo_unitario === "" ||
        producto.costo_unitario === null ||
        producto.costo_unitario === undefined
          ? null
          : Number(producto.costo_unitario),
      solicitud_producto_nuevo_id:
        solicitudProductoNuevoId,
      solicitud_id:
        origenSolicitud?.solicitud_id || null,
      proveedor_sugerido:
        origenSolicitud?.proveedor_sugerido || null,
      proveedor_link:
        origenSolicitud?.proveedor_link || null
    }
  };
};

const createOrden = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    if (
      !validarAdminCentral(
        req,
        res
      )
    ) {
      return;
    }

    const {
      proveedor_id,
      lineas = [],
      productos_nuevos = []
    } = req.body;

    const proveedorId =
      Number(proveedor_id);

    if (
      !proveedorId ||
      !Number.isFinite(
        proveedorId
      )
    ) {
      return res.status(400).json({
        message:
          "proveedor_id es obligatorio"
      });
    }

    if (
      !Array.isArray(lineas) ||
      !Array.isArray(
        productos_nuevos
      )
    ) {
      return res.status(400).json({
        message:
          "lineas y productos_nuevos deben ser arreglos"
      });
    }

    if (
      lineas.length === 0 &&
      productos_nuevos.length === 0
    ) {
      return res.status(400).json({
        message:
          "La orden debe contener al menos un producto existente o un producto nuevo"
      });
    }

    const proveedorResult =
      await client.query(
        `
          SELECT
            id,
            nombre

          FROM proveedores

          WHERE id = $1
            AND activo = TRUE
        `,
        [proveedorId]
      );

    if (
      proveedorResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        message:
          "Proveedor no encontrado o inactivo"
      });
    }

    const lineasValidadas = [];

    for (const linea of lineas) {
      const validacion = await validarProductoExistente(
        client,
        proveedorId,
        linea
      );

      if (!validacion.valido) {
        return res
          .status(validacion.status)
          .json({ message: validacion.message });
      }

      lineasValidadas.push({
        linea,
        ...validacion
      });
    }

    const nuevosValidados = [];

    for (
      const productoNuevo of
      productos_nuevos
    ) {
      const validacion =
        await validarProductoNuevo(
          client,
          productoNuevo
        );

      if (!validacion.valido) {
        return res
          .status(
            validacion.status
          )
          .json({
            message:
              validacion.message
          });
      }

      nuevosValidados.push(
        validacion.datos
      );
    }

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const ordenResult =
      await client.query(
        `
          INSERT INTO ordenes_compra (
            proveedor_id,
            creado_por_usuario_id,
            estado
          )

          VALUES (
            $1,
            $2,
            'borrador'
          )

          RETURNING id
        `,
        [
          proveedorId,
          req.usuario.id
        ]
      );

    const ordenId =
      ordenResult.rows[0].id;

    for (const validada of lineasValidadas) {
      const { linea, crearAsociacionProveedor } = validada;

      if (crearAsociacionProveedor) {
        await client.query(
          `
            INSERT INTO proveedor_productos (
              proveedor_id,
              producto_id
            )
            VALUES ($1, $2)
            ON CONFLICT (proveedor_id, producto_id)
            DO NOTHING
          `,
          [proveedorId, Number(linea.producto_id)]
        );
      }

      await client.query(
        `
          INSERT INTO orden_compra_lineas (
            orden_compra_id,
            producto_id,
            cantidad_solicitada,
            cantidad_recibida,
            costo_unitario,
            solicitud_linea_id,
            solicitud_producto_nuevo_id
          )
          VALUES ($1, $2, $3, 0, $4, $5, NULL)
        `,
        [
          ordenId,
          Number(linea.producto_id),
          Number(linea.cantidad_solicitada),
          linea.costo_unitario === "" ||
          linea.costo_unitario === null ||
          linea.costo_unitario === undefined
            ? null
            : Number(linea.costo_unitario),
          linea.solicitud_linea_id
            ? Number(linea.solicitud_linea_id)
            : null
        ]
      );
    }

    for (
      const productoNuevo of
      nuevosValidados
    ) {
      const productoResult =
        await client.query(
          `
            INSERT INTO productos (
              nombre,
              descripcion,
              sku,
              categoria_id,
              unidad_medida,
              punto_reorden,
              activo
            )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              0,
              TRUE
            )

            RETURNING id
          `,
          [
            productoNuevo.nombre,
            productoNuevo
              .descripcion,
            productoNuevo.sku,
            productoNuevo
              .categoria_id,
            productoNuevo
              .unidad_medida
          ]
        );

      const productoId =
        productoResult.rows[0].id;

      await client.query(
        `
          INSERT INTO proveedor_productos (
            proveedor_id,
            producto_id
          )

          VALUES ($1, $2)

          ON CONFLICT (
            proveedor_id,
            producto_id
          )
          DO NOTHING
        `,
        [
          proveedorId,
          productoId
        ]
      );

      await client.query(
        `
          INSERT INTO orden_compra_lineas (
            orden_compra_id,
            producto_id,
            cantidad_solicitada,
            cantidad_recibida,
            costo_unitario,
            solicitud_linea_id,
            solicitud_producto_nuevo_id
          )
          VALUES ($1, $2, $3, 0, $4, NULL, $5)
        `,
        [
          ordenId,
          productoId,
          productoNuevo.cantidad_solicitada,
          productoNuevo.costo_unitario,
          productoNuevo.solicitud_producto_nuevo_id
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.status(201).json({
      message:
        "Orden de compra creada correctamente",

      orden_compra_id:
        ordenId,

      estado:
        "borrador"
    });
  } catch (error) {
    if (
      transaccionIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    if (
      error.code ===
      "23505"
    ) {
      return res.status(409).json({
        message:
          "Ya existe un registro con esos datos",
        error:
          error.message
      });
    }

    res.status(500).json({
      message:
        "Error al crear la orden de compra",
      error:
        error.message
    });
  } finally {
    client.release();
  }
};

const enviarOrden = async (
  req,
  res
) => {
  try {
    if (
      !validarAdminCentral(
        req,
        res
      )
    ) {
      return;
    }

    const { id } =
      req.params;

    const result =
      await pool.query(
        `
          UPDATE ordenes_compra

          SET estado =
              'enviada'

          WHERE id = $1
            AND estado =
                'borrador'
        `,
        [id]
      );

    if (
      result.rowCount === 0
    ) {
      return res.status(400).json({
        message:
          "La orden no existe o no está en borrador"
      });
    }

    res.json({
      message:
        "Orden enviada al proveedor",

      orden_compra_id:
        Number(id),

      estado:
        "enviada"
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al enviar la orden",
      error:
        error.message
    });
  }
};

const recibirCompra = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    if (
      !validarAdminCentral(
        req,
        res
      )
    ) {
      return;
    }

    const { id } =
      req.params;

    const {
      lineas
    } = req.body;

    if (
      !Array.isArray(lineas) ||
      lineas.length === 0
    ) {
      return res.status(400).json({
        message:
          "Debes indicar los productos recibidos"
      });
    }

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const ordenesResult =
      await client.query(
        `
          SELECT
            id,
            estado

          FROM ordenes_compra

          WHERE id = $1

          FOR UPDATE
        `,
        [id]
      );

    if (
      ordenesResult.rows.length ===
      0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(404).json({
        message:
          "Orden de compra no encontrada"
      });
    }

    if (
      ![
        "enviada",
        "parcial"
      ].includes(
        ordenesResult
          .rows[0]
          .estado
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "Solo pueden recibirse órdenes enviadas o parcialmente recibidas"
      });
    }

    const lineasOrdenResult =
      await client.query(
        `
          SELECT
            id,
            producto_id,
            cantidad_solicitada,
            cantidad_recibida,
            solicitud_linea_id,
            solicitud_producto_nuevo_id

          FROM orden_compra_lineas

          WHERE orden_compra_id = $1

          FOR UPDATE
        `,
        [id]
      );

    const lineasOrden =
      lineasOrdenResult.rows;

    for (
      const recibida of lineas
    ) {
      const lineaOrden =
        lineasOrden.find(
          (linea) =>
            Number(
              linea.id
            ) ===
            Number(
              recibida
                .linea_id
            )
        );

      if (!lineaOrden) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            `La línea ${recibida.linea_id} no pertenece a esta orden`
        });
      }

      const cantidad =
        Number(
          recibida
            .cantidad_recibida
        );

      if (
        !validarNumeroPositivo(
          cantidad
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Las cantidades recibidas deben ser mayores a 0"
        });
      }

      const pendiente =
        Number(
          lineaOrden
            .cantidad_solicitada
        ) -
        Number(
          lineaOrden
            .cantidad_recibida
        );

      if (
        cantidad > pendiente
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            `La recepción supera lo pendiente del producto ${lineaOrden.producto_id}`,

          cantidad_pendiente:
            pendiente
        });
      }

      await client.query(
        `
          UPDATE orden_compra_lineas

          SET cantidad_recibida =
              cantidad_recibida +
              $1

          WHERE id = $2
        `,
        [
          cantidad,
          lineaOrden.id
        ]
      );

      await client.query(
        `
          INSERT INTO inventario (
            ubicacion_id,
            producto_id,
            cantidad
          )

          VALUES (
            $1,
            $2,
            $3
          )

          ON CONFLICT (
            ubicacion_id,
            producto_id
          )

          DO UPDATE SET

            cantidad =
              inventario.cantidad +
              EXCLUDED.cantidad,

            updated_at =
              CURRENT_TIMESTAMP
        `,
        [
          CENTRAL_ID,
          lineaOrden
            .producto_id,
          cantidad
        ]
      );

      await client.query(
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

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8
          )
        `,
        [
          CENTRAL_ID,
          lineaOrden
            .producto_id,
          req.usuario.id,
          "entrada",
          cantidad,
          "orden_compra",
          Number(id),

          lineaOrden.solicitud_linea_id
            ? `Recepción de orden de compra #${id}, vinculada a Solicitud_Línea #${lineaOrden.solicitud_linea_id}`
            : lineaOrden.solicitud_producto_nuevo_id
              ? `Recepción de orden de compra #${id}, vinculada a Producto_Nuevo_Solicitado #${lineaOrden.solicitud_producto_nuevo_id}`
              : `Recepción de orden de compra #${id} por reorden de Central`
        ]
      );
    }

    const pendientesResult =
      await client.query(
        `
          SELECT
            COUNT(*) AS total

          FROM orden_compra_lineas

          WHERE orden_compra_id = $1
            AND cantidad_recibida <
                cantidad_solicitada
        `,
        [id]
      );

    const completa =
      Number(
        pendientesResult
          .rows[0]
          .total
      ) === 0;

    await client.query(
      `
        UPDATE ordenes_compra

        SET estado = $1

        WHERE id = $2
      `,
      [
        completa
          ? "recibida"
          : "parcial",

        id
      ]
    );

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.json({
      message:
        completa
          ? "Orden recibida completamente"
          : "Recepción parcial registrada",

      orden_compra_id:
        Number(id),

      estado:
        completa
          ? "recibida"
          : "parcial"
    });
  } catch (error) {
    if (
      transaccionIniciada
    ) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Error al revertir la transacción:",
          rollbackError
        );
      }
    }

    res.status(500).json({
      message:
        "Error al recibir la compra",
      error:
        error.message
    });
  } finally {
    client.release();
  }
};

module.exports = {
  getOrdenes,
  getOrdenById,
  createOrden,
  enviarOrden,
  recibirCompra
};


