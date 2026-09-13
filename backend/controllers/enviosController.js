const pool = require("../config/db");

const CENTRAL_ID = 1;

// =========================================================
// PERMISOS
// =========================================================

const validarPermisoCentral = (req, res) => {
  if (
    req.usuario.rol !== "principal" ||
    !["operador", "aprobador_admin"].includes(
      req.usuario.nivel_permiso
    )
  ) {
    res.status(403).json({
      message:
        "No tienes permiso para gestionar envíos"
    });

    return false;
  }

  return true;
};

// =========================================================
// CANTIDAD RESERVADA EN ENVÍOS EN PREPARACIÓN
// =========================================================

const obtenerReservadoPreparacion = async (
  client,
  {
    solicitudLineaId = null,
    solicitudProductoNuevoId = null
  }
) => {
  const result = await client.query(
    `
      SELECT
        COALESCE(
          SUM(el.cantidad_enviada),
          0
        ) AS reservado

      FROM envio_lineas el

      INNER JOIN envios e
        ON el.envio_id = e.id

      WHERE e.estado = 'preparacion'

        AND (
          (
            $1::INTEGER IS NOT NULL
            AND
            el.solicitud_linea_id = $1
          )
          OR
          (
            $2::INTEGER IS NOT NULL
            AND
            el.solicitud_producto_nuevo_id = $2
          )
        )
    `,
    [
      solicitudLineaId,
      solicitudProductoNuevoId
    ]
  );

  return Number(
    result.rows[0]?.reservado || 0
  );
};

// =========================================================
// COMPRA RECIBIDA DE PRODUCTO EXISTENTE
// =========================================================

const obtenerCompraLineaExistente = async (
  client,
  solicitudLineaId
) => {
  const result = await client.query(
    `
      SELECT
        COALESCE(
          SUM(ocl.cantidad_recibida),
          0
        ) AS cantidad_recibida,

        COUNT(*) AS total_lineas

      FROM orden_compra_lineas ocl

      WHERE ocl.solicitud_linea_id = $1
    `,
    [solicitudLineaId]
  );

  return {
    cantidadRecibida:
      Number(
        result.rows[0]
          ?.cantidad_recibida || 0
      ),

    tieneCompra:
      Number(
        result.rows[0]
          ?.total_lineas || 0
      ) > 0
  };
};

// =========================================================
// COMPRA RECIBIDA DE PRODUCTO NUEVO
// =========================================================

const obtenerCompraProductoNuevo = async (
  client,
  solicitudProductoNuevoId
) => {
  const result = await client.query(
    `
      SELECT
        ocl.producto_id,

        p.nombre
          AS producto_nombre,

        COALESCE(
          SUM(ocl.cantidad_recibida),
          0
        ) AS cantidad_recibida

      FROM orden_compra_lineas ocl

      INNER JOIN productos p
        ON ocl.producto_id = p.id

      WHERE
        ocl.solicitud_producto_nuevo_id = $1

      GROUP BY
        ocl.producto_id,
        p.nombre

      ORDER BY
        ocl.producto_id
    `,
    [
      solicitudProductoNuevoId
    ]
  );

  if (
    result.rows.length === 0
  ) {
    return {
      existe: false,
      ambiguo: false,
      productoId: null,
      productoNombre: null,
      cantidadRecibida: 0
    };
  }

  if (
    result.rows.length > 1
  ) {
    return {
      existe: true,
      ambiguo: true,
      productoId: null,
      productoNombre: null,
      cantidadRecibida: 0
    };
  }

  return {
    existe: true,
    ambiguo: false,

    productoId:
      Number(
        result.rows[0]
          .producto_id
      ),

    productoNombre:
      result.rows[0]
        .producto_nombre,

    cantidadRecibida:
      Number(
        result.rows[0]
          .cantidad_recibida || 0
      )
  };
};

// =========================================================
// LISTAR ENVÍOS
// =========================================================

const getEnvios = async (
  req,
  res
) => {
  try {
    const params = [];

    let sql = `
      SELECT
        e.id,
        e.solicitud_id,
        e.estado,
        e.fecha_envio,
        e.fecha_recepcion,
        e.created_at,

        s.estado AS solicitud_estado,

        destino.id
          AS destino_ubicacion_id,

        destino.nombre
          AS destino_ubicacion_nombre,

        destino.tipo
          AS destino_ubicacion_tipo,

        u.id
          AS creado_por_usuario_id,

        u.nombre
          AS creado_por_usuario_nombre

      FROM envios e

      INNER JOIN solicitudes s
        ON e.solicitud_id = s.id

      INNER JOIN ubicaciones destino
        ON s.destino_ubicacion_id =
           destino.id

      INNER JOIN usuarios u
        ON e.creado_por_usuario_id =
           u.id

      WHERE 1 = 1
    `;

    if (
      req.usuario.rol !==
      "principal"
    ) {
      params.push(
        Number(
          req.usuario
            .ubicacion_id
        )
      );

      sql += `
        AND (
          s.destino_ubicacion_id =
            $${params.length}

          OR

          s.solicitante_ubicacion_id =
            $${params.length}
        )
      `;
    }

    sql += `
      ORDER BY
        e.created_at DESC
    `;

    const result =
      await pool.query(
        sql,
        params
      );

    res.json(
      result.rows
    );
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener los envíos",
      error:
        error.message
    });
  }
};

// =========================================================
// DETALLE DE ENVÍO
// =========================================================

const getEnvioById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const enviosResult =
      await pool.query(
        `
          SELECT
            e.id,
            e.solicitud_id,
            e.estado,
            e.fecha_envio,
            e.fecha_recepcion,
            e.created_at,

            s.estado
              AS solicitud_estado,

            s.solicitante_ubicacion_id,

            destino.id
              AS destino_ubicacion_id,

            destino.nombre
              AS destino_ubicacion_nombre,

            destino.tipo
              AS destino_ubicacion_tipo,

            u.id
              AS creado_por_usuario_id,

            u.nombre
              AS creado_por_usuario_nombre

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id =
               s.id

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          INNER JOIN usuarios u
            ON e.creado_por_usuario_id =
               u.id

          WHERE e.id = $1
        `,
        [id]
      );

    if (
      enviosResult.rows.length ===
      0
    ) {
      return res.status(404).json({
        message:
          "Envío no encontrado"
      });
    }

    const envio =
      enviosResult.rows[0];

    if (
      req.usuario.rol !==
      "principal"
    ) {
      const ubicacionUsuario =
        Number(
          req.usuario
            .ubicacion_id
        );

      const permitido =
        Number(
          envio
            .destino_ubicacion_id
        ) ===
          ubicacionUsuario ||
        Number(
          envio
            .solicitante_ubicacion_id
        ) ===
          ubicacionUsuario;

      if (
        !permitido
      ) {
        return res.status(404).json({
          message:
            "Envío no encontrado"
        });
      }
    }

    const lineasResult =
      await pool.query(
        `
          SELECT
            el.id,
            el.solicitud_linea_id,
            el.solicitud_producto_nuevo_id,
            el.producto_id,
            el.cantidad_enviada,

            p.nombre
              AS producto_nombre,

            p.sku,
            p.unidad_medida,

            sl.cantidad_solicitada
              AS cantidad_solicitada_existente,

            sl.cantidad_aprobada,

            sl.cantidad_enviada_acumulada
              AS cantidad_enviada_acumulada_existente,

            sl.cantidad_recibida_acumulada
              AS cantidad_recibida_acumulada_existente,

            spn.nombre
              AS producto_nuevo_solicitado_nombre,

            spn.cantidad_solicitada
              AS cantidad_solicitada_nueva,

            spn.cantidad_enviada_acumulada
              AS cantidad_enviada_acumulada_nueva,

            spn.cantidad_recibida_acumulada
              AS cantidad_recibida_acumulada_nueva

          FROM envio_lineas el

          INNER JOIN productos p
            ON el.producto_id = p.id

          LEFT JOIN solicitud_lineas sl
            ON el.solicitud_linea_id =
               sl.id

          LEFT JOIN solicitud_productos_nuevos spn
            ON el.solicitud_producto_nuevo_id =
               spn.id

          WHERE el.envio_id = $1

          ORDER BY el.id
        `,
        [id]
      );

    res.json({
      envio,
      lineas:
        lineasResult.rows
    });
  } catch (error) {
    res.status(500).json({
      message:
        "Error al obtener el envío",
      error:
        error.message
    });
  }
};

// =========================================================
// CREAR ENVÍO
// =========================================================

const createEnvio = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    if (
      !validarPermisoCentral(
        req,
        res
      )
    ) {
      return;
    }

    const {
      solicitud_id,
      lineas
    } = req.body;

    const solicitudId =
      Number(
        solicitud_id
      );

    if (
      !solicitudId ||
      !Number.isFinite(
        solicitudId
      )
    ) {
      return res.status(400).json({
        message:
          "solicitud_id es obligatorio"
      });
    }

    if (
      !Array.isArray(lineas) ||
      lineas.length === 0
    ) {
      return res.status(400).json({
        message:
          "El envío debe contener productos"
      });
    }

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const solicitudResult =
      await client.query(
        `
          SELECT
            s.id,
            s.estado,
            s.destino_ubicacion_id,

            destino.nombre
              AS destino_ubicacion_nombre,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM solicitudes s

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE s.id = $1

          FOR UPDATE OF s
        `,
        [
          solicitudId
        ]
      );

    if (
      solicitudResult.rows.length ===
      0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(404).json({
        message:
          "Solicitud no encontrada"
      });
    }

    const solicitud =
      solicitudResult.rows[0];

    if (
      ![
        "sucursal",
        "equipo_interno"
      ].includes(
        solicitud
          .destino_ubicacion_tipo
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "El destino de la solicitud no admite envíos"
      });
    }

    /*
     * IMPORTANTE:
     *
     * Sucursal:
     * Puede generar envíos desde que
     * la solicitud está aprobada.
     * También puede generar envíos
     * parciales mientras permanece
     * en tránsito.
     *
     * Equipo Interno:
     * La solicitud debe haber terminado
     * su ciclo y estar "recibida" por
     * Central antes de comenzar el flujo
     * independiente de Envíos.
     */

    if (
      solicitud
        .destino_ubicacion_tipo ===
      "equipo_interno"
    ) {
      if (
        solicitud.estado !==
        "recibida"
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Central debe recibir completamente la compra antes de generar el envío al Equipo Interno"
        });
      }
    } else {
      if (
        ![
          "aprobada",
          "en_transito"
        ].includes(
          solicitud.estado
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "La solicitud de Sucursal debe estar aprobada o en tránsito para generar el envío"
        });
      }
    }

    const lineasExistentesResult =
      await client.query(
        `
          SELECT
            sl.id,
            sl.producto_id,
            sl.cantidad_solicitada,
            sl.cantidad_aprobada,
            sl.cantidad_enviada_acumulada,
            sl.cantidad_recibida_acumulada,

            p.nombre
              AS producto_nombre

          FROM solicitud_lineas sl

          INNER JOIN productos p
            ON sl.producto_id =
               p.id

          WHERE sl.solicitud_id =
                $1

          FOR UPDATE OF sl
        `,
        [
          solicitudId
        ]
      );

    const productosNuevosResult =
      await client.query(
        `
          SELECT
            spn.id,
            spn.nombre,
            spn.cantidad_solicitada,
            spn.cantidad_enviada_acumulada,
            spn.cantidad_recibida_acumulada

          FROM solicitud_productos_nuevos spn

          WHERE spn.solicitud_id =
                $1

          FOR UPDATE OF spn
        `,
        [
          solicitudId
        ]
      );

    const lineasExistentes =
      lineasExistentesResult.rows;

    const productosNuevos =
      productosNuevosResult.rows;

    const preparadas =
      [];

    for (
      const linea of lineas
    ) {
      const cantidad =
        Number(
          linea
            .cantidad_enviada
        );

      if (
        !Number.isFinite(
          cantidad
        ) ||
        cantidad <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Todas las cantidades del envío deben ser mayores a 0"
        });
      }

      const solicitudLineaId =
        linea
          .solicitud_linea_id
          ? Number(
              linea
                .solicitud_linea_id
            )
          : null;

      const solicitudProductoNuevoId =
        linea
          .solicitud_producto_nuevo_id
          ? Number(
              linea
                .solicitud_producto_nuevo_id
            )
          : null;

      if (
        (
          solicitudLineaId &&
          solicitudProductoNuevoId
        ) ||
        (
          !solicitudLineaId &&
          !solicitudProductoNuevoId
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Cada línea debe pertenecer a un único producto de la solicitud"
        });
      }

      // ===================================================
      // PRODUCTO EXISTENTE
      // ===================================================

      if (
        solicitudLineaId
      ) {
        const original =
          lineasExistentes.find(
            (item) =>
              Number(
                item.id
              ) ===
              solicitudLineaId
          );

        if (
          !original
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(400).json({
            message:
              `La línea ${solicitudLineaId} no pertenece a la solicitud`
          });
        }

        const reservado =
          await obtenerReservadoPreparacion(
            client,
            {
              solicitudLineaId
            }
          );

        let origen =
          "central";

        let disponible =
          0;

        if (
          solicitud
            .destino_ubicacion_tipo ===
          "equipo_interno"
        ) {
          const compra =
            await obtenerCompraLineaExistente(
              client,
              solicitudLineaId
            );

          if (
            !compra.tieneCompra
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaccionIniciada =
              false;

            return res.status(400).json({
              message:
                `El producto "${original.producto_nombre}" no tiene una compra directa vinculada`
            });
          }

          origen =
            "compra_directa";

          disponible =
            Math.max(
              Math.min(
                Number(
                  original
                    .cantidad_aprobada ||
                    0
                ),

                compra
                  .cantidadRecibida
              ) -
                Number(
                  original
                    .cantidad_enviada_acumulada ||
                    0
                ) -
                reservado,
              0
            );
        } else {
          disponible =
            Math.max(
              Number(
                original
                  .cantidad_aprobada ||
                  0
              ) -
                Number(
                  original
                    .cantidad_enviada_acumulada ||
                    0
                ) -
                reservado,
              0
            );
        }

        if (
          cantidad >
          disponible
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(400).json({
            message:
              `La cantidad supera lo disponible para "${original.producto_nombre}"`,

            cantidad_disponible:
              disponible
          });
        }

        preparadas.push({
          solicitud_linea_id:
            solicitudLineaId,

          solicitud_producto_nuevo_id:
            null,

          producto_id:
            Number(
              original
                .producto_id
            ),

          cantidad_enviada:
            cantidad,

          origen
        });

        continue;
      }

      // ===================================================
      // PRODUCTO NUEVO
      // ===================================================

      const originalNuevo =
        productosNuevos.find(
          (item) =>
            Number(
              item.id
            ) ===
            solicitudProductoNuevoId
        );

      if (
        !originalNuevo
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            `El producto nuevo ${solicitudProductoNuevoId} no pertenece a la solicitud`
        });
      }

      if (
        solicitud
          .destino_ubicacion_tipo !==
        "equipo_interno"
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            "Los productos nuevos de compra directa solo pueden enviarse a Equipos Internos"
        });
      }

      const compraNueva =
        await obtenerCompraProductoNuevo(
          client,
          solicitudProductoNuevoId
        );

      if (
        !compraNueva.existe
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            `El producto "${originalNuevo.nombre}" aún no tiene compra recibida`
        });
      }

      if (
        compraNueva.ambiguo
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(409).json({
          message:
            `El producto nuevo "${originalNuevo.nombre}" está relacionado con más de un producto real`
        });
      }

      const reservado =
        await obtenerReservadoPreparacion(
          client,
          {
            solicitudProductoNuevoId
          }
        );

      const disponible =
        Math.max(
          Math.min(
            Number(
              originalNuevo
                .cantidad_solicitada ||
                0
            ),

            compraNueva
              .cantidadRecibida
          ) -
            Number(
              originalNuevo
                .cantidad_enviada_acumulada ||
                0
            ) -
            reservado,
          0
        );

      if (
        cantidad >
        disponible
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaccionIniciada =
          false;

        return res.status(400).json({
          message:
            `La cantidad supera lo disponible para "${originalNuevo.nombre}"`,

          cantidad_disponible:
            disponible
        });
      }

      preparadas.push({
        solicitud_linea_id:
          null,

        solicitud_producto_nuevo_id:
          solicitudProductoNuevoId,

        producto_id:
          compraNueva
            .productoId,

        cantidad_enviada:
          cantidad,

        origen:
          "compra_directa"
      });
    }

    const envioResult =
      await client.query(
        `
          INSERT INTO envios (
            solicitud_id,
            creado_por_usuario_id,
            estado
          )

          VALUES (
            $1,
            $2,
            'preparacion'
          )

          RETURNING id
        `,
        [
          solicitudId,
          req.usuario.id
        ]
      );

    const envioId =
      envioResult.rows[0].id;

    for (
      const linea of
      preparadas
    ) {
      await client.query(
        `
          INSERT INTO envio_lineas (
            envio_id,
            solicitud_linea_id,
            solicitud_producto_nuevo_id,
            producto_id,
            cantidad_enviada
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
        `,
        [
          envioId,

          linea
            .solicitud_linea_id,

          linea
            .solicitud_producto_nuevo_id,

          linea.producto_id,

          linea
            .cantidad_enviada
        ]
      );
    }

    /*
     * Crear el envío no cambia todavía
     * el estado de la Solicitud.
     *
     * Equipo Interno:
     * ya está "recibida" por Central
     * y así debe permanecer.
     *
     * Sucursal:
     * cambia a "en_transito" únicamente
     * cuando el envío realmente se despacha.
     */

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.status(201).json({
      message:
        "Envío creado correctamente",

      envio_id:
        envioId,

      solicitud_id:
        solicitudId,

      estado:
        "preparacion"
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
        "Error al crear el envío",
      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// MARCAR ENVÍO EN TRÁNSITO
// =========================================================

const marcarEnTransito = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    if (
      !validarPermisoCentral(
        req,
        res
      )
    ) {
      return;
    }

    const { id } =
      req.params;

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const envioResult =
      await client.query(
        `
          SELECT
            e.id,
            e.solicitud_id,
            e.estado,

            s.estado
              AS solicitud_estado,

            s.destino_ubicacion_id,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id =
               s.id

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE e.id = $1

          FOR UPDATE OF e
        `,
        [id]
      );

    if (
      envioResult.rows.length ===
      0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(404).json({
        message:
          "Envío no encontrado"
      });
    }

    const envio =
      envioResult.rows[0];

    if (
      envio.estado !==
      "preparacion"
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "Solo un envío en preparación puede pasar a tránsito"
      });
    }

    if (
      envio
        .destino_ubicacion_tipo ===
        "equipo_interno" &&
      envio
        .solicitud_estado !==
        "recibida"
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "La compra debe estar recibida por Central antes de despachar este envío"
      });
    }

    if (
      envio
        .destino_ubicacion_tipo ===
        "sucursal" &&
      ![
        "aprobada",
        "en_transito"
      ].includes(
        envio.solicitud_estado
      )
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "La solicitud de Sucursal debe estar aprobada o en tránsito para despachar este envío"
      });
    }

    const lineasResult =
      await client.query(
        `
          SELECT
            el.id,
            el.solicitud_linea_id,
            el.solicitud_producto_nuevo_id,
            el.producto_id,
            el.cantidad_enviada,

            p.nombre
              AS producto_nombre

          FROM envio_lineas el

          INNER JOIN productos p
            ON el.producto_id =
               p.id

          WHERE el.envio_id =
                $1

          FOR UPDATE OF el
        `,
        [id]
      );

    if (
      lineasResult.rows.length ===
      0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "El envío no contiene productos"
      });
    }

    for (
      const linea of
      lineasResult.rows
    ) {
      const cantidad =
        Number(
          linea
            .cantidad_enviada
        );

      // ===================================================
      // PRODUCTO EXISTENTE
      // ===================================================

      if (
        linea
          .solicitud_linea_id
      ) {
        const solicitudLineaResult =
          await client.query(
            `
              SELECT
                id,
                producto_id,
                cantidad_aprobada,
                cantidad_enviada_acumulada

              FROM solicitud_lineas

              WHERE id = $1

              FOR UPDATE
            `,
            [
              linea
                .solicitud_linea_id
            ]
          );

        if (
          solicitudLineaResult.rows
            .length === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(400).json({
            message:
              "Una línea de la solicitud ya no existe"
          });
        }

        const solicitudLinea =
          solicitudLineaResult
            .rows[0];

        if (
          envio
            .destino_ubicacion_tipo ===
          "equipo_interno"
        ) {
          const compra =
            await obtenerCompraLineaExistente(
              client,
              linea
                .solicitud_linea_id
            );

          const disponible =
            Math.max(
              Math.min(
                Number(
                  solicitudLinea
                    .cantidad_aprobada ||
                    0
                ),

                compra
                  .cantidadRecibida
              ) -
                Number(
                  solicitudLinea
                    .cantidad_enviada_acumulada ||
                    0
                ),
              0
            );

          if (
            cantidad >
            disponible
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaccionIniciada =
              false;

            return res.status(400).json({
              message:
                `Ya no hay suficientes unidades recibidas del proveedor para "${linea.producto_nombre}"`,

              cantidad_disponible:
                disponible
            });
          }

          /*
           * Compra directa:
           *
           * NO descuenta Central.
           */
        } else {
          const pendienteSolicitud =
            Math.max(
              Number(
                solicitudLinea
                  .cantidad_aprobada ||
                  0
              ) -
                Number(
                  solicitudLinea
                    .cantidad_enviada_acumulada ||
                    0
                ),
              0
            );

          if (
            cantidad >
            pendienteSolicitud
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaccionIniciada =
              false;

            return res.status(400).json({
              message:
                `La cantidad del envío supera lo pendiente para "${linea.producto_nombre}"`,

              cantidad_disponible:
                pendienteSolicitud
            });
          }

          const inventarioResult =
            await client.query(
              `
                SELECT
                  cantidad

                FROM inventario

                WHERE ubicacion_id =
                      $1

                  AND producto_id =
                      $2

                FOR UPDATE
              `,
              [
                CENTRAL_ID,
                linea
                  .producto_id
              ]
            );

          const stockCentral =
            inventarioResult.rows
              .length > 0
              ? Number(
                  inventarioResult
                    .rows[0]
                    .cantidad
                )
              : 0;

          if (
            stockCentral <
            cantidad
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaccionIniciada =
              false;

            return res.status(400).json({
              message:
                `Stock insuficiente en Central para "${linea.producto_nombre}"`,

              stock_actual:
                stockCentral,

              cantidad_envio:
                cantidad
            });
          }

          await client.query(
            `
              UPDATE inventario

              SET
                cantidad =
                  cantidad - $1,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE ubicacion_id =
                    $2

                AND producto_id =
                    $3
            `,
            [
              cantidad,
              CENTRAL_ID,
              linea
                .producto_id
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

              linea
                .producto_id,

              req.usuario.id,

              "salida",

              cantidad,

              "envio",

              Number(id),

              `Salida por envío #${id}`
            ]
          );
        }

        await client.query(
          `
            UPDATE solicitud_lineas

            SET
              cantidad_enviada_acumulada =
                cantidad_enviada_acumulada +
                $1

            WHERE id = $2
          `,
          [
            cantidad,

            linea
              .solicitud_linea_id
          ]
        );

        continue;
      }

      // ===================================================
      // PRODUCTO NUEVO
      // ===================================================

      if (
        linea
          .solicitud_producto_nuevo_id
      ) {
        if (
          envio
            .destino_ubicacion_tipo !==
          "equipo_interno"
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(400).json({
            message:
              "Un producto nuevo de compra directa no puede despacharse por el flujo de Sucursal"
          });
        }

        const nuevoResult =
          await client.query(
            `
              SELECT
                id,
                nombre,
                cantidad_solicitada,
                cantidad_enviada_acumulada

              FROM solicitud_productos_nuevos

              WHERE id = $1

              FOR UPDATE
            `,
            [
              linea
                .solicitud_producto_nuevo_id
            ]
          );

        if (
          nuevoResult.rows.length ===
          0
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(400).json({
            message:
              "El producto nuevo de la solicitud ya no existe"
          });
        }

        const nuevo =
          nuevoResult.rows[0];

        const compra =
          await obtenerCompraProductoNuevo(
            client,
            linea
              .solicitud_producto_nuevo_id
          );

        if (
          !compra.existe ||
          compra.ambiguo
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(409).json({
            message:
              `No es posible determinar correctamente la compra de "${nuevo.nombre}"`
          });
        }

        if (
          Number(
            compra.productoId
          ) !==
          Number(
            linea.producto_id
          )
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(409).json({
            message:
              `El producto real vinculado a "${nuevo.nombre}" cambió después de preparar el envío`
          });
        }

        const disponible =
          Math.max(
            Math.min(
              Number(
                nuevo
                  .cantidad_solicitada ||
                  0
              ),

              compra
                .cantidadRecibida
            ) -
              Number(
                nuevo
                  .cantidad_enviada_acumulada ||
                  0
              ),
            0
          );

        if (
          cantidad >
          disponible
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaccionIniciada =
            false;

          return res.status(400).json({
            message:
              `La cantidad del envío supera lo recibido del proveedor para "${nuevo.nombre}"`,

            cantidad_disponible:
              disponible
          });
        }

        await client.query(
          `
            UPDATE solicitud_productos_nuevos

            SET
              cantidad_enviada_acumulada =
                cantidad_enviada_acumulada +
                $1

            WHERE id = $2
          `,
          [
            cantidad,

            linea
              .solicitud_producto_nuevo_id
          ]
        );
      }
    }

    await client.query(
      `
        UPDATE envios

        SET
          estado =
            'en_transito',

          fecha_envio =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [id]
    );

    if (
      envio
        .destino_ubicacion_tipo ===
      "sucursal"
    ) {
      await client.query(
        `
          UPDATE solicitudes

          SET
            estado = 'en_transito',
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
            AND estado IN (
              'aprobada',
              'en_transito'
            )
        `,
        [
          envio.solicitud_id
        ]
      );
    }

    /*
     * Equipo Interno:
     * la Solicitud permanece "recibida"
     * porque ese estado significa que
     * Central ya recibió la compra.
     *
     * Sucursal:
     * al despachar el envío la Solicitud
     * pasa a "en_transito".
     */

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.json({
      message:
        "Envío marcado en tránsito",

      envio_id:
        Number(id),

      solicitud_id:
        Number(
          envio.solicitud_id
        ),

      estado:
        "en_transito"
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
        "Error al marcar el envío en tránsito",

      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// CONFIRMAR RECEPCIÓN
// =========================================================

const confirmarRecepcion = async (
  req,
  res
) => {
  const client =
    await pool.connect();

  let transaccionIniciada =
    false;

  try {
    const { id } =
      req.params;

    await client.query(
      "BEGIN"
    );

    transaccionIniciada =
      true;

    const envioResult =
      await client.query(
        `
          SELECT
            e.id,
            e.solicitud_id,
            e.estado,

            s.estado
              AS solicitud_estado,

            s.destino_ubicacion_id,

            destino.nombre
              AS destino_ubicacion_nombre,

            destino.tipo
              AS destino_ubicacion_tipo

          FROM envios e

          INNER JOIN solicitudes s
            ON e.solicitud_id =
               s.id

          INNER JOIN ubicaciones destino
            ON s.destino_ubicacion_id =
               destino.id

          WHERE e.id = $1

          FOR UPDATE OF e
        `,
        [id]
      );

    if (
      envioResult.rows.length ===
      0
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(404).json({
        message:
          "Envío no encontrado"
      });
    }

    const envio =
      envioResult.rows[0];

    if (
      envio.estado !==
      "en_transito"
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(400).json({
        message:
          "Solo un envío en tránsito puede recibirse"
      });
    }

    const destinoId =
      Number(
        envio
          .destino_ubicacion_id
      );

    /*
     * La recepción debe confirmarla
     * realmente el destino.
     *
     * Central no puede marcar como
     * recibido un envío destinado a
     * otra ubicación.
     */

    if (
      Number(
        req.usuario
          .ubicacion_id
      ) !==
      destinoId
    ) {
      await client.query(
        "ROLLBACK"
      );

      transaccionIniciada =
        false;

      return res.status(403).json({
        message:
          "Solo la ubicación destino puede confirmar la recepción del envío"
      });
    }

    const lineasResult =
      await client.query(
        `
          SELECT
            el.id,
            el.solicitud_linea_id,
            el.solicitud_producto_nuevo_id,
            el.producto_id,
            el.cantidad_enviada,

            p.nombre
              AS producto_nombre

          FROM envio_lineas el

          INNER JOIN productos p
            ON el.producto_id =
               p.id

          WHERE el.envio_id =
                $1

          FOR UPDATE OF el
        `,
        [id]
      );

    for (
      const linea of
      lineasResult.rows
    ) {
      const cantidad =
        Number(
          linea
            .cantidad_enviada
        );

      // ===================================================
      // ACTUALIZAR RECEPCIÓN FÍSICA
      // ===================================================

      if (
        linea
          .solicitud_linea_id
      ) {
        await client.query(
          `
            UPDATE solicitud_lineas

            SET
              cantidad_recibida_acumulada =
                cantidad_recibida_acumulada +
                $1

            WHERE id = $2
          `,
          [
            cantidad,

            linea
              .solicitud_linea_id
          ]
        );
      } else if (
        linea
          .solicitud_producto_nuevo_id
      ) {
        await client.query(
          `
            UPDATE solicitud_productos_nuevos

            SET
              cantidad_recibida_acumulada =
                cantidad_recibida_acumulada +
                $1

            WHERE id = $2
          `,
          [
            cantidad,

            linea
              .solicitud_producto_nuevo_id
          ]
        );
      }

      // ===================================================
      // SUCURSAL
      // ===================================================

      if (
        envio
          .destino_ubicacion_tipo ===
        "sucursal"
      ) {
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
            destinoId,

            linea
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
            destinoId,

            linea
              .producto_id,

            req.usuario.id,

            "entrada",

            cantidad,

            "envio",

            Number(id),

            `Recepción del envío #${id}`
          ]
        );
      }

      /*
       * EQUIPO INTERNO
       *
       * NO se agrega al inventario aquí.
       *
       * Únicamente queda registrada la
       * recepción física.
       *
       * Posteriormente el Equipo Interno
       * usa:
       *
       * POST
       * /solicitudes/:id/registrar-inventario
       */
    }

    await client.query(
      `
        UPDATE envios

        SET
          estado =
            'recibido',

          fecha_recepcion =
            CURRENT_TIMESTAMP,

          confirmado_por_usuario_id =
            $1

        WHERE id = $2
      `,
      [
        req.usuario.id,
        id
      ]
    );

    let solicitudCompletamenteRecibida =
      null;

    if (
      envio
        .destino_ubicacion_tipo ===
      "sucursal"
    ) {
      const pendientesResult =
        await client.query(
          `
            SELECT
              COUNT(*) AS total

            FROM solicitud_lineas

            WHERE solicitud_id = $1
              AND
              cantidad_recibida_acumulada <
              cantidad_aprobada
          `,
          [
            envio.solicitud_id
          ]
        );

      solicitudCompletamenteRecibida =
        Number(
          pendientesResult
            .rows[0]
            .total
        ) === 0;

      await client.query(
        `
          UPDATE solicitudes

          SET
            estado = $1,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $2
        `,
        [
          solicitudCompletamenteRecibida
            ? "recibida"
            : "en_transito",

          envio.solicitud_id
        ]
      );
    }

    /*
     * Equipo Interno:
     * la Solicitud NO cambia aquí.
     * Sigue "recibida" porque ese estado
     * significa "Recibida por Central".
     *
     * Sucursal:
     * permanece "en_transito" mientras
     * existan cantidades aprobadas
     * pendientes de recibir y pasa a
     * "recibida" cuando toda la solicitud
     * fue recibida físicamente.
     */

    await client.query(
      "COMMIT"
    );

    transaccionIniciada =
      false;

    res.json({
      message:
        "Recepción del envío confirmada correctamente",

      envio_id:
        Number(id),

      solicitud_id:
        Number(
          envio.solicitud_id
        ),

      estado:
        "recibido",

      destino_tipo:
        envio
          .destino_ubicacion_tipo,

      agregado_automaticamente_inventario:
        envio
          .destino_ubicacion_tipo ===
        "sucursal",

      solicitud_completamente_recibida:
        solicitudCompletamenteRecibida
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
        "Error al confirmar la recepción del envío",

      error:
        error.message
    });
  } finally {
    client.release();
  }
};

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  getEnvios,
  getEnvioById,
  createEnvio,
  marcarEnTransito,
  confirmarRecepcion
};