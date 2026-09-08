import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  PackageCheck,
  Truck,
  ShoppingCart
} from "lucide-react";

import api from "../services/api";

const Solicitudes = () => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") ||
      "{}"
  );

  const [
    solicitudes,
    setSolicitudes
  ] = useState([]);

  const [
    productos,
    setProductos
  ] = useState([]);

  const [
    categorias,
    setCategorias
  ] = useState([]);

  const [
    ubicaciones,
    setUbicaciones
  ] = useState([]);

  const [
    busqueda,
    setBusqueda
  ] = useState("");

  const [
    estadoFiltro,
    setEstadoFiltro
  ] = useState("");

  const [
    categoriaCatalogo,
    setCategoriaCatalogo
  ] = useState("");

  const [
    mostrarNueva,
    setMostrarNueva
  ] = useState(false);

  const [
    mostrarEnvio,
    setMostrarEnvio
  ] = useState(false);

  const [
    cantidadesEnvio,
    setCantidadesEnvio
  ] = useState({});

  const [
    mostrarAprobacion,
    setMostrarAprobacion
  ] = useState(false);

  const [
    cantidadesAprobacion,
    setCantidadesAprobacion
  ] = useState({});

  const [
    stockCentral,
    setStockCentral
  ] = useState({});

  const [
    cargandoAprobacion,
    setCargandoAprobacion
  ] = useState(false);

  const [
    destino,
    setDestino
  ] = useState(
    usuario.ubicacion_id || ""
  );

  const [
    usarFranquiciaNueva,
    setUsarFranquiciaNueva
  ] = useState(false);

  const [
    nombreFranquiciaNueva,
    setNombreFranquiciaNueva
  ] = useState("");

  const [
    lineas,
    setLineas
  ] = useState([
    {
      producto_id: "",
      cantidad_solicitada: 1
    }
  ]);

  const [
    productosNuevos,
    setProductosNuevos
  ] = useState([]);

  const [
    seleccionada,
    setSeleccionada
  ] = useState(null);

  const [
    detalle,
    setDetalle
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    guardando,
    setGuardando
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        solicitudesRes,
        productosRes,
        categoriasRes,
        ubicacionesRes
      ] = await Promise.all([
        api.get("/solicitudes"),
        api.get("/productos"),
        api.get("/categorias"),
        api.get("/ubicaciones")
      ]);

      setSolicitudes(
        solicitudesRes.data || []
      );

      setProductos(
        productosRes.data || []
      );

      setCategorias(
        categoriasRes.data || []
      );

      setUbicaciones(
        ubicacionesRes.data || []
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar las solicitudes"
      );
    } finally {
      setLoading(false);
    }
  };

  const solicitudesFiltradas =
    useMemo(() => {
      return solicitudes.filter(
        (item) => {
          const texto = busqueda
            .toLowerCase()
            .trim();

          const coincideBusqueda =
            !texto ||
            String(item.id).includes(
              texto
            ) ||
            item
              .destino_ubicacion_nombre
              ?.toLowerCase()
              .includes(texto) ||
            item
              .creado_por_usuario_nombre
              ?.toLowerCase()
              .includes(texto);

          const coincideEstado =
            !estadoFiltro ||
            item.estado ===
              estadoFiltro;

          return (
            coincideBusqueda &&
            coincideEstado
          );
        }
      );
    }, [
      solicitudes,
      busqueda,
      estadoFiltro
    ]);

  const productosCatalogo =
    useMemo(() => {
      if (!categoriaCatalogo) {
        return productos;
      }

      return productos.filter(
        (producto) =>
          Number(
            producto.categoria_id
          ) ===
          Number(
            categoriaCatalogo
          )
      );
    }, [
      productos,
      categoriaCatalogo
    ]);

  const esDestinoEquipoInterno =
    detalle?.solicitud
      ?.destino_ubicacion_tipo ===
    "equipo_interno";

  const esDestinoSucursal =
    detalle?.solicitud
      ?.destino_ubicacion_tipo ===
    "sucursal";

  const puedeRevisar =
    usuario.rol === "principal" &&
    [
      "operador",
      "aprobador_admin"
    ].includes(
      usuario.nivel_permiso
    );

  const puedeAprobar =
    usuario.rol === "principal" &&
    usuario.nivel_permiso ===
      "aprobador_admin";

  const puedeVerDatosProveedor =
    usuario.rol === "principal" ||
    usuario.rol ===
      "equipo_interno";

  const agregarLinea = () => {
    setLineas([
      ...lineas,
      {
        producto_id: "",
        cantidad_solicitada: 1
      }
    ]);
  };

  const eliminarLinea = (
    index
  ) => {
    setLineas(
      lineas.filter(
        (_, i) => i !== index
      )
    );
  };

  const actualizarLinea = (
    index,
    campo,
    valor
  ) => {
    const nuevas = [
      ...lineas
    ];

    nuevas[index] = {
      ...nuevas[index],
      [campo]: valor
    };

    setLineas(nuevas);
  };

  const agregarProductoNuevo =
    () => {
      setProductosNuevos([
        ...productosNuevos,
        {
          nombre: "",
          descripcion: "",
          categoria_id: "",
          cantidad_solicitada: 1,
          proveedor_sugerido: "",
          proveedor_link: "",
          sku_sugerido: ""
        }
      ]);
    };

  const eliminarProductoNuevo = (
    index
  ) => {
    setProductosNuevos(
      productosNuevos.filter(
        (_, i) => i !== index
      )
    );
  };

  const actualizarProductoNuevo = (
    index,
    campo,
    valor
  ) => {
    const nuevos = [
      ...productosNuevos
    ];

    nuevos[index] = {
      ...nuevos[index],
      [campo]: valor
    };

    setProductosNuevos(
      nuevos
    );
  };

  const limpiarNuevaSolicitud =
    () => {
      setDestino(
        usuario.ubicacion_id || ""
      );

      setUsarFranquiciaNueva(
        false
      );

      setNombreFranquiciaNueva(
        ""
      );

      setCategoriaCatalogo("");

      setLineas([
        {
          producto_id: "",
          cantidad_solicitada: 1
        }
      ]);

      setProductosNuevos([]);
    };

  const crearSolicitud = async (
    event
  ) => {
    event.preventDefault();

    try {
      setGuardando(true);
      setError("");

      const lineasValidas =
        lineas
          .filter(
            (linea) =>
              linea.producto_id &&
              Number(
                linea
                  .cantidad_solicitada
              ) > 0
          )
          .map(
            (linea) => ({
              producto_id:
                Number(
                  linea.producto_id
                ),

              cantidad_solicitada:
                Number(
                  linea
                    .cantidad_solicitada
                )
            })
          );

      const productosNuevosValidos =
        productosNuevos.map(
          (producto) => ({
            nombre:
              producto.nombre.trim(),

            descripcion:
              producto.descripcion.trim(),

            categoria_id:
              Number(
                producto.categoria_id
              ),

            cantidad_solicitada:
              Number(
                producto
                  .cantidad_solicitada
              ),

            ...(usuario.rol ===
            "equipo_interno"
              ? {
                  proveedor_sugerido:
                    producto
                      .proveedor_sugerido
                      .trim(),

                  proveedor_link:
                    producto
                      .proveedor_link
                      .trim(),

                  sku_sugerido:
                    producto
                      .sku_sugerido
                      .trim()
                }
              : {})
          })
        );

      if (
        lineasValidas.length ===
          0 &&
        productosNuevosValidos
          .length === 0
      ) {
        setError(
          "Agrega al menos un producto existente o un producto nuevo."
        );

        return;
      }

      const productoNuevoInvalido =
        productosNuevosValidos.find(
          (producto) =>
            !producto.nombre ||
            !producto.descripcion ||
            !producto.categoria_id ||
            !Number.isFinite(
              producto
                .cantidad_solicitada
            ) ||
            producto
              .cantidad_solicitada <=
              0
        );

      if (
        productoNuevoInvalido
      ) {
        setError(
          "Todos los productos nuevos necesitan nombre, descripción, categoría y una cantidad mayor a cero."
        );

        return;
      }

      const payloadSolicitud = {
        lineas:
          lineasValidas,

        productos_nuevos:
          productosNuevosValidos
      };

      if (
        usuario.rol ===
          "equipo_interno" &&
        usarFranquiciaNueva
      ) {
        if (
          !nombreFranquiciaNueva.trim()
        ) {
          setError(
            "Escribe el nombre de la nueva franquicia."
          );

          return;
        }

        payloadSolicitud
          .nueva_franquicia = {
          nombre:
            nombreFranquiciaNueva.trim()
        };
      } else {
        if (!destino) {
          setError(
            "Selecciona una ubicación destino."
          );

          return;
        }

        payloadSolicitud
          .destino_ubicacion_id =
          Number(destino);
      }

      await api.post(
        "/solicitudes",
        payloadSolicitud
      );

      setMostrarNueva(false);

      limpiarNuevaSolicitud();

      await cargarDatos();
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "No fue posible crear la solicitud"
      );
    } finally {
      setGuardando(false);
    }
  };

  const verDetalle = async (
    id
  ) => {
    try {
      setError("");

      const response =
        await api.get(
          `/solicitudes/${id}`
        );

      setSeleccionada(id);

      setDetalle(
        response.data
      );
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "No fue posible cargar el detalle"
      );
    }
  };

  const iniciarRevision = async (
    id
  ) => {
    try {
      setError("");

      await api.patch(
        `/solicitudes/${id}/revision`
      );

      await cargarDatos();

      await verDetalle(id);
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "No fue posible iniciar la revisión"
      );
    }
  };

  const abrirAprobacion =
    async () => {
      if (!detalle) return;

      try {
        setCargandoAprobacion(
          true
        );

        setError("");

        const cantidadesIniciales =
          {};

        /*
         * ISSUE 7
         *
         * Equipo Interno:
         * no depende del stock Central.
         *
         * Sucursal:
         * sí se aprueba contra stock
         * disponible de Central.
         */
        if (
          esDestinoEquipoInterno
        ) {
          detalle.lineas.forEach(
            (linea) => {
              cantidadesIniciales[
                linea.id
              ] = Number(
                linea
                  .cantidad_solicitada ||
                  0
              );
            }
          );

          setStockCentral({});

          setCantidadesAprobacion(
            cantidadesIniciales
          );

          setMostrarAprobacion(
            true
          );

          return;
        }

        const response =
          await api.get(
            "/reportes/inventario",
            {
              params: {
                ubicacion_id: 1
              }
            }
          );

        const mapaStock = {};

        (
          response.data || []
        ).forEach((item) => {
          mapaStock[
            Number(
              item.producto_id
            )
          ] = Number(
            item.cantidad || 0
          );
        });

        detalle.lineas.forEach(
          (linea) => {
            const solicitada =
              Number(
                linea
                  .cantidad_solicitada ||
                  0
              );

            const disponible =
              Number(
                mapaStock[
                  Number(
                    linea
                      .producto_id
                  )
                ] || 0
              );

            cantidadesIniciales[
              linea.id
            ] = Math.min(
              solicitada,
              disponible
            );
          }
        );

        setStockCentral(
          mapaStock
        );

        setCantidadesAprobacion(
          cantidadesIniciales
        );

        setMostrarAprobacion(
          true
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible preparar la aprobación de la solicitud"
        );
      } finally {
        setCargandoAprobacion(
          false
        );
      }
    };

  const actualizarCantidadAprobacion =
    (
      lineaId,
      valor
    ) => {
      setCantidadesAprobacion(
        (actual) => ({
          ...actual,
          [lineaId]:
            valor
        })
      );
    };

  const aprobarSolicitud =
    async (event) => {
      event.preventDefault();

      if (!detalle) return;

      const lineasAprobadas =
        detalle.lineas.map(
          (linea) => {
            const solicitada =
              Number(
                linea
                  .cantidad_solicitada ||
                  0
              );

            const disponible =
              esDestinoSucursal
                ? Number(
                    stockCentral[
                      Number(
                        linea
                          .producto_id
                      )
                    ] || 0
                  )
                : solicitada;

            const cantidad =
              Number(
                cantidadesAprobacion[
                  linea.id
                ]
              );

            return {
              linea_id:
                linea.id,

              cantidad_aprobada:
                cantidad,

              solicitada,

              disponible
            };
          }
        );

      const cantidadInvalida =
        lineasAprobadas.find(
          (linea) =>
            !Number.isFinite(
              linea
                .cantidad_aprobada
            ) ||
            linea
              .cantidad_aprobada <
              0 ||
            linea
              .cantidad_aprobada >
              linea.solicitada ||
            (
              esDestinoSucursal &&
              linea
                .cantidad_aprobada >
                linea.disponible
            )
        );

      if (
        cantidadInvalida
      ) {
        setError(
          esDestinoSucursal
            ? "Cada cantidad aprobada debe ser igual o mayor a cero y no puede superar ni lo solicitado ni el stock disponible en Central."
            : "Cada cantidad aprobada debe ser igual o mayor a cero y no puede superar la cantidad solicitada."
        );

        return;
      }

      const totalAprobado =
        lineasAprobadas.reduce(
          (
            total,
            linea
          ) =>
            total +
            linea
              .cantidad_aprobada,
          0
        );

      const tieneProductosNuevos =
        (detalle.productos_nuevos || []).length > 0;

      if (
        totalAprobado <= 0 &&
        !tieneProductosNuevos
      ) {
        setError(
          "Debes aprobar una cantidad mayor a cero en al menos una línea. Si no se aprobará ningún producto, utiliza Rechazar."
        );

        return;
      }

      try {
        setGuardando(true);

        setError("");

        await api.patch(
          `/solicitudes/${seleccionada}/aprobar`,
          {
            lineas:
              lineasAprobadas.map(
                ({
                  linea_id,
                  cantidad_aprobada
                }) => ({
                  linea_id,
                  cantidad_aprobada
                })
              )
          }
        );

        setMostrarAprobacion(
          false
        );

        setCantidadesAprobacion(
          {}
        );

        setStockCentral({});

        await cargarDatos();

        await verDetalle(
          seleccionada
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible aprobar la solicitud"
        );
      } finally {
        setGuardando(false);
      }
    };

  const rechazarSolicitud =
    async () => {
      const motivo =
        window.prompt(
          "Escribe el motivo del rechazo:"
        );

      if (!motivo) return;

      try {
        setGuardando(true);

        setError("");

        await api.patch(
          `/solicitudes/${seleccionada}/rechazar`,
          {
            motivo
          }
        );

        await cargarDatos();

        await verDetalle(
          seleccionada
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible rechazar la solicitud"
        );
      } finally {
        setGuardando(false);
      }
    };

  const cerrarSolicitud =
    async () => {
      const motivo =
        window.prompt(
          "Motivo del cierre:"
        );

      try {
        setGuardando(true);

        setError("");

        await api.patch(
          `/solicitudes/${seleccionada}/cerrar`,
          {
            motivo:
              motivo || ""
          }
        );

        await cargarDatos();

        await verDetalle(
          seleccionada
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible cerrar la solicitud"
        );
      } finally {
        setGuardando(false);
      }
    };

  const abrirCrearEnvio =
    () => {
      if (!detalle) {
        return;
      }

      if (
        !esDestinoSucursal &&
        !esDestinoEquipoInterno
      ) {
        setError(
          "El destino de esta solicitud no admite envíos."
        );

        return;
      }

      const cantidadesIniciales =
        {};

      detalle.lineas.forEach(
        (linea) => {
          const aprobada =
            Number(
              linea
                .cantidad_aprobada ||
                0
            );

          const enviada =
            Number(
              linea
                .cantidad_enviada_acumulada ||
                0
            );

          const pendiente =
            Math.max(
              aprobada -
                enviada,
              0
            );

          if (
            pendiente > 0
          ) {
            cantidadesIniciales[
              linea.id
            ] = "";
          }
        }
      );

      if (
        Object.keys(
          cantidadesIniciales
        ).length === 0
      ) {
        setError(
          "Esta solicitud no tiene productos pendientes de envío"
        );

        return;
      }

      setCantidadesEnvio(
        cantidadesIniciales
      );

      setError("");

      setMostrarEnvio(true);
    };

  const actualizarCantidadEnvio =
    (
      lineaId,
      valor
    ) => {
      setCantidadesEnvio(
        (actual) => ({
          ...actual,
          [lineaId]:
            valor
        })
      );
    };

  const crearEnvio =
    async (event) => {
      event.preventDefault();

      if (!detalle) return;

      if (
        !esDestinoSucursal &&
        !esDestinoEquipoInterno
      ) {
        setError(
          "El destino de esta solicitud no admite envíos."
        );

        return;
      }

      const lineasEnvio =
        detalle.lineas
          .map(
            (linea) => {
              const aprobada =
                Number(
                  linea
                    .cantidad_aprobada ||
                    0
                );

              const enviada =
                Number(
                  linea
                    .cantidad_enviada_acumulada ||
                    0
                );

              const pendiente =
                Math.max(
                  aprobada -
                    enviada,
                  0
                );

              const cantidad =
                Number(
                  cantidadesEnvio[
                    linea.id
                  ] || 0
                );

              return {
                solicitud_linea_id:
                  linea.id,

                cantidad_enviada:
                  cantidad,

                pendiente
              };
            }
          )
          .filter(
            (linea) =>
              linea
                .cantidad_enviada >
              0
          );

      if (
        lineasEnvio.length === 0
      ) {
        setError(
          "Captura al menos una cantidad mayor a cero para crear el envío"
        );

        return;
      }

      const cantidadInvalida =
        lineasEnvio.find(
          (linea) =>
            !Number.isFinite(
              linea
                .cantidad_enviada
            ) ||
            linea
              .cantidad_enviada <=
              0 ||
            linea
              .cantidad_enviada >
              linea.pendiente
        );

      if (
        cantidadInvalida
      ) {
        setError(
          "La cantidad a enviar debe ser mayor a cero y no puede superar el pendiente aprobado"
        );

        return;
      }

      try {
        setGuardando(true);

        setError("");

        const response =
          await api.post(
            "/envios",
            {
              solicitud_id:
                Number(
                  detalle
                    .solicitud.id
                ),

              lineas:
                lineasEnvio.map(
                  ({
                    solicitud_linea_id,
                    cantidad_enviada
                  }) => ({
                    solicitud_linea_id,
                    cantidad_enviada
                  })
                )
            }
          );

        setMostrarEnvio(
          false
        );

        setCantidadesEnvio(
          {}
        );

        await cargarDatos();

        await verDetalle(
          detalle.solicitud.id
        );

        window.alert(
          `Envío #${response.data.envio_id} creado correctamente.`
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible crear el envío"
        );
      } finally {
        setGuardando(false);
      }
    };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando solicitudes...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>
            Solicitudes
          </h1>

          <p>
            Solicitudes de
            Sucursales y Equipos
            Internos.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={
              cargarDatos
            }
          >
            <RefreshCw
              size={18}
            />

            Actualizar
          </button>

          {usuario.rol !==
            "principal" && (
            <button
              className="primary-button icon-button"
              onClick={() => {
                limpiarNuevaSolicitud();

                setError("");

                setMostrarNueva(
                  true
                );
              }}
            >
              <Plus size={18} />

              Nueva solicitud
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="content-card">
        <div className="filters-row">
          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Buscar solicitud..."
              value={
                busqueda
              }
              onChange={(
                event
              ) =>
                setBusqueda(
                  event.target.value
                )
              }
            />
          </div>

          <select
            value={
              estadoFiltro
            }
            onChange={(
              event
            ) =>
              setEstadoFiltro(
                event.target.value
              )
            }
          >
            <option value="">
              Todos los estados
            </option>

            <option value="solicitada">
              Solicitada
            </option>

            <option value="en_revision">
              En revisión
            </option>

            <option value="aprobada">
              Aprobada
            </option>

            <option value="en_transito">
              En tránsito
            </option>

            <option value="recibida">
              Recibida
            </option>

            <option value="cerrada">
              Cerrada
            </option>

            <option value="rechazada">
              Rechazada
            </option>
          </select>
        </div>

        {solicitudesFiltradas
          .length === 0 ? (
          <div className="empty-state">
            No hay solicitudes
            disponibles.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>
                    Destino
                  </th>
                  <th>
                    Flujo
                  </th>
                  <th>
                    Creada por
                  </th>
                  <th>
                    Estado
                  </th>
                  <th>
                    Fecha
                  </th>
                  <th>
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {solicitudesFiltradas.map(
                  (item) => (
                    <tr
                      key={
                        item.id
                      }
                    >
                      <td>
                        #{item.id}
                      </td>

                      <td>
                        {
                          item
                            .destino_ubicacion_nombre
                        }
                      </td>

                      <td>
                        {item
                          .destino_ubicacion_tipo ===
                        "equipo_interno"
                          ? "Compra"
                          : "Central"}
                      </td>

                      <td>
                        {
                          item
                            .creado_por_usuario_nombre
                        }
                      </td>

                      <td>
                        <span className="status neutral">
                          {
                            item.estado
                          }
                        </span>
                      </td>

                      <td>
                        {new Date(
                          item.created_at
                        ).toLocaleDateString(
                          "es-MX"
                        )}
                      </td>

                      <td>
                        <button
                          className="table-action"
                          onClick={() =>
                            verDetalle(
                              item.id
                            )
                          }
                        >
                          <Eye
                            size={17}
                          />

                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarNueva && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Nueva solicitud
                </h2>

                <p>
                  Agrega productos del
                  catálogo o productos
                  nuevos.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  if (
                    guardando
                  ) {
                    return;
                  }

                  setMostrarNueva(
                    false
                  );

                  setError("");
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                crearSolicitud
              }
            >
              <div className="form-group">
                <label>
                  Ubicación destino
                </label>

                {usuario.rol ===
                  "equipo_interno" && (
                  <label
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: "8px",
                      marginBottom:
                        "12px"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={
                        usarFranquiciaNueva
                      }
                      onChange={(
                        event
                      ) => {
                        const checked =
                          event.target
                            .checked;

                        setUsarFranquiciaNueva(
                          checked
                        );

                        if (
                          checked
                        ) {
                          setDestino(
                            ""
                          );
                        } else {
                          setNombreFranquiciaNueva(
                            ""
                          );

                          setDestino(
                            usuario
                              .ubicacion_id ||
                              ""
                          );
                        }
                      }}
                    />

                    Franquicia nueva,
                    aún no dada de alta
                  </label>
                )}

                {usuario.rol ===
                  "equipo_interno" &&
                usarFranquiciaNueva ? (
                  <>
                    <input
                      className="form-control"
                      type="text"
                      value={
                        nombreFranquiciaNueva
                      }
                      onChange={(
                        event
                      ) =>
                        setNombreFranquiciaNueva(
                          event.target
                            .value
                        )
                      }
                      placeholder="Nombre de la nueva franquicia"
                      required
                    />

                    <small
                      style={{
                        display:
                          "block",
                        marginTop:
                          "7px",
                        opacity: 0.7
                      }}
                    >
                      La ubicación se
                      creará con estado
                      Pendiente.
                    </small>
                  </>
                ) : (
                  <select
                    className="form-control"
                    value={
                      destino
                    }
                    onChange={(
                      event
                    ) =>
                      setDestino(
                        event.target
                          .value
                      )
                    }
                    required
                  >
                    <option value="">
                      Seleccionar...
                    </option>

                    {ubicaciones
                      .filter(
                        (
                          ubicacion
                        ) => {
                          const estaActiva =
                            ubicacion.activo !==
                              false &&
                            ubicacion.estado !==
                              "pendiente" &&
                            ubicacion.estado !==
                              "inactiva";

                          if (
                            !estaActiva
                          ) {
                            return false;
                          }

                          if (
                            Number(
                              ubicacion.id
                            ) ===
                            Number(
                              usuario
                                .ubicacion_id
                            )
                          ) {
                            return true;
                          }

                          return (
                            usuario.rol ===
                              "equipo_interno" &&
                            ubicacion.tipo ===
                              "sucursal"
                          );
                        }
                      )
                      .map(
                        (
                          ubicacion
                        ) => (
                          <option
                            key={
                              ubicacion.id
                            }
                            value={
                              ubicacion.id
                            }
                          >
                            {
                              ubicacion.nombre
                            }
                          </option>
                        )
                      )}
                  </select>
                )}
              </div>

              <div
                style={{
                  marginTop:
                    "22px"
                }}
              >
                <h3>
                  Productos existentes
                </h3>
              </div>

              <div className="form-group">
                <label>
                  Categoría del catálogo
                </label>

                <select
                  className="form-control"
                  value={
                    categoriaCatalogo
                  }
                  onChange={(
                    event
                  ) =>
                    setCategoriaCatalogo(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    Todas las categorías
                  </option>

                  {categorias.map(
                    (
                      categoria
                    ) => (
                      <option
                        key={
                          categoria.id
                        }
                        value={
                          categoria.id
                        }
                      >
                        {
                          categoria.nombre
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="modal-lines">
                {lineas.map(
                  (
                    linea,
                    index
                  ) => (
                    <div
                      className="request-line"
                      key={`existente-${index}`}
                    >
                      <select
                        className="form-control"
                        value={
                          linea
                            .producto_id
                        }
                        onChange={(
                          event
                        ) =>
                          actualizarLinea(
                            index,
                            "producto_id",
                            event.target
                              .value
                          )
                        }
                      >
                        <option value="">
                          Producto...
                        </option>

                        {productosCatalogo.map(
                          (
                            producto
                          ) => (
                            <option
                              key={
                                producto.id
                              }
                              value={
                                producto.id
                              }
                            >
                              {
                                producto.nombre
                              }{" "}
                              (
                              {
                                producto.sku
                              }
                              )
                            </option>
                          )
                        )}
                      </select>

                      <input
                        className="form-control quantity-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          linea
                            .cantidad_solicitada
                        }
                        onChange={(
                          event
                        ) =>
                          actualizarLinea(
                            index,
                            "cantidad_solicitada",
                            event.target
                              .value
                          )
                        }
                      />

                      <button
                        type="button"
                        className="danger-icon-button"
                        onClick={() =>
                          eliminarLinea(
                            index
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                className="text-button"
                onClick={
                  agregarLinea
                }
              >
                + Agregar producto
                existente
              </button>

              <div
                style={{
                  marginTop:
                    "30px"
                }}
              >
                <h3>
                  Productos nuevos
                </h3>

                <p
                  style={{
                    opacity: 0.75
                  }}
                >
                  Usa esta sección
                  cuando el artículo no
                  existe en el catálogo.
                </p>
              </div>

              {productosNuevos.map(
                (
                  producto,
                  index
                ) => (
                  <div
                    key={`nuevo-${index}`}
                    style={{
                      border:
                        "1px solid rgba(128,128,128,.25)",
                      borderRadius:
                        "10px",
                      padding:
                        "16px",
                      marginBottom:
                        "16px"
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between"
                      }}
                    >
                      <strong>
                        Producto nuevo #
                        {index + 1}
                      </strong>

                      <button
                        type="button"
                        className="danger-icon-button"
                        onClick={() =>
                          eliminarProductoNuevo(
                            index
                          )
                        }
                      >
                        ×
                      </button>
                    </div>

                    <div className="form-group">
                      <label>
                        Nombre
                      </label>

                      <input
                        className="form-control"
                        value={
                          producto.nombre
                        }
                        onChange={(
                          event
                        ) =>
                          actualizarProductoNuevo(
                            index,
                            "nombre",
                            event.target
                              .value
                          )
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Descripción
                      </label>

                      <textarea
                        className="form-control"
                        rows="3"
                        value={
                          producto.descripcion
                        }
                        onChange={(
                          event
                        ) =>
                          actualizarProductoNuevo(
                            index,
                            "descripcion",
                            event.target
                              .value
                          )
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Categoría
                      </label>

                      <select
                        className="form-control"
                        value={
                          producto
                            .categoria_id
                        }
                        onChange={(
                          event
                        ) =>
                          actualizarProductoNuevo(
                            index,
                            "categoria_id",
                            event.target
                              .value
                          )
                        }
                        required
                      >
                        <option value="">
                          Seleccionar...
                        </option>

                        {categorias.map(
                          (
                            categoria
                          ) => (
                            <option
                              key={
                                categoria.id
                              }
                              value={
                                categoria.id
                              }
                            >
                              {
                                categoria.nombre
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>
                        Cantidad
                      </label>

                      <input
                        className="form-control"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          producto
                            .cantidad_solicitada
                        }
                        onChange={(
                          event
                        ) =>
                          actualizarProductoNuevo(
                            index,
                            "cantidad_solicitada",
                            event.target
                              .value
                          )
                        }
                        required
                      />
                    </div>

                    {usuario.rol ===
                      "equipo_interno" && (
                      <>
                        <div
                          style={{
                            marginTop:
                              "14px"
                          }}
                        >
                          <strong>
                            Información de
                            compra
                          </strong>
                        </div>

                        <div className="form-group">
                          <label>
                            Proveedor
                            sugerido
                          </label>

                          <input
                            className="form-control"
                            value={
                              producto
                                .proveedor_sugerido
                            }
                            onChange={(
                              event
                            ) =>
                              actualizarProductoNuevo(
                                index,
                                "proveedor_sugerido",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Nombre del proveedor"
                          />
                        </div>

                        <div className="form-group">
                          <label>
                            Link de compra
                          </label>

                          <input
                            className="form-control"
                            type="url"
                            value={
                              producto
                                .proveedor_link
                            }
                            onChange={(
                              event
                            ) =>
                              actualizarProductoNuevo(
                                index,
                                "proveedor_link",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="https://..."
                          />
                        </div>

                        <div className="form-group">
                          <label>
                            SKU sugerido
                          </label>

                          <input
                            className="form-control"
                            value={
                              producto
                                .sku_sugerido
                            }
                            onChange={(
                              event
                            ) =>
                              actualizarProductoNuevo(
                                index,
                                "sku_sugerido",
                                event
                                  .target
                                  .value
                              )
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                )
              )}

              <button
                type="button"
                className="text-button"
                onClick={
                  agregarProductoNuevo
                }
              >
                + Agregar producto nuevo
              </button>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setMostrarNueva(
                      false
                    )
                  }
                  disabled={
                    guardando
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? "Creando..."
                    : "Crear solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarAprobacion &&
        detalle && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Aprobar solicitud #
                  {
                    detalle
                      .solicitud.id
                  }
                </h2>

                <p>
                  {esDestinoEquipoInterno
                    ? "Equipo Interno: la aprobación no depende del stock de Central. Los productos aprobados pasan al flujo de Compras."
                    : "Sucursal: la cantidad aprobada está limitada por el stock disponible en Central."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setMostrarAprobacion(
                    false
                  );

                  setCantidadesAprobacion(
                    {}
                  );

                  setStockCentral(
                    {}
                  );
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                aprobarSolicitud
              }
            >
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Producto
                      </th>

                      <th>
                        Solicitada
                      </th>

                      {esDestinoSucursal && (
                        <th>
                          Stock Central
                        </th>
                      )}

                      <th>
                        Aprobar
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.lineas.map(
                      (
                        linea
                      ) => {
                        const solicitada =
                          Number(
                            linea
                              .cantidad_solicitada ||
                              0
                          );

                        const disponible =
                          Number(
                            stockCentral[
                              Number(
                                linea
                                  .producto_id
                              )
                            ] || 0
                          );

                        return (
                          <tr
                            key={
                              linea.id
                            }
                          >
                            <td>
                              {
                                linea
                                  .producto_nombre
                              }
                            </td>

                            <td>
                              {
                                solicitada
                              }
                            </td>

                            {esDestinoSucursal && (
                              <td>
                                {
                                  disponible
                                }
                              </td>
                            )}

                            <td>
                              <input
                                className="form-control quantity-input"
                                type="number"
                                min="0"
                                max={
                                  esDestinoSucursal
                                    ? Math.min(
                                        solicitada,
                                        disponible
                                      )
                                    : solicitada
                                }
                                step="0.01"
                                value={
                                  cantidadesAprobacion[
                                    linea.id
                                  ] ??
                                  ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  actualizarCantidadAprobacion(
                                    linea.id,
                                    event
                                      .target
                                      .value
                                  )
                                }
                              />
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setMostrarAprobacion(
                      false
                    )
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button icon-button"
                  disabled={
                    guardando
                  }
                >
                  <CheckCircle2
                    size={17}
                  />

                  Confirmar aprobación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarEnvio &&
        detalle && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Crear envío parcial
                </h2>

                <p>
                  Solicitud #
                  {
                    detalle
                      .solicitud.id
                  }
                </p>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={() =>
                  setMostrarEnvio(
                    false
                  )
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                crearEnvio
              }
            >
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Producto
                      </th>
                      <th>
                        Aprobada
                      </th>
                      <th>
                        Enviada
                      </th>
                      <th>
                        Pendiente
                      </th>
                      <th>
                        Enviar
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.lineas
                      .filter(
                        (
                          linea
                        ) =>
                          Number(
                            linea
                              .cantidad_aprobada
                          ) >
                          Number(
                            linea
                              .cantidad_enviada_acumulada
                          )
                      )
                      .map(
                        (
                          linea
                        ) => {
                          const aprobada =
                            Number(
                              linea
                                .cantidad_aprobada
                            );

                          const enviada =
                            Number(
                              linea
                                .cantidad_enviada_acumulada
                            );

                          const pendiente =
                            aprobada -
                            enviada;

                          return (
                            <tr
                              key={
                                linea.id
                              }
                            >
                              <td>
                                {
                                  linea
                                    .producto_nombre
                                }
                              </td>

                              <td>
                                {
                                  aprobada
                                }
                              </td>

                              <td>
                                {
                                  enviada
                                }
                              </td>

                              <td>
                                {
                                  pendiente
                                }
                              </td>

                              <td>
                                <input
                                  className="form-control quantity-input"
                                  type="number"
                                  min="0"
                                  max={
                                    pendiente
                                  }
                                  step="0.01"
                                  value={
                                    cantidadesEnvio[
                                      linea.id
                                    ] ??
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    actualizarCantidadEnvio(
                                      linea.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          );
                        }
                      )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setMostrarEnvio(
                      false
                    )
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button icon-button"
                  disabled={
                    guardando
                  }
                >
                  <Truck
                    size={17}
                  />

                  Crear envío
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalle &&
        !mostrarEnvio &&
        !mostrarAprobacion && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Solicitud #
                  {
                    detalle
                      .solicitud.id
                  }
                </h2>

                <p>
                  Estado:{" "}
                  <strong>
                    {
                      detalle
                        .solicitud
                        .estado
                    }
                  </strong>
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setDetalle(
                    null
                  );

                  setSeleccionada(
                    null
                  );

                  setError("");
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding:
                  "12px",
                marginBottom:
                  "18px",
                border:
                  "1px solid rgba(128,128,128,.25)",
                borderRadius:
                  "8px"
              }}
            >
              <strong>
                Flujo de
                abastecimiento:{" "}
              </strong>

              {esDestinoEquipoInterno ? (
                <span>
                  Compra a proveedor
                  <ShoppingCart
                    size={16}
                    style={{
                      marginLeft:
                        "7px",
                      verticalAlign:
                        "middle"
                    }}
                  />
                </span>
              ) : (
                <span>
                  Stock de Central →
                  Envío a Sucursal
                </span>
              )}
            </div>

            <h3>
              Productos existentes
            </h3>

            {detalle.lineas
              ?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Producto
                      </th>
                      <th>
                        Solicitada
                      </th>
                      <th>
                        Aprobada
                      </th>
                      <th>
                        Enviada
                      </th>
                      <th>
                        Recibida
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.lineas.map(
                      (
                        linea
                      ) => (
                        <tr
                          key={
                            linea.id
                          }
                        >
                          <td>
                            {
                              linea
                                .producto_nombre
                            }
                          </td>

                          <td>
                            {
                              linea
                                .cantidad_solicitada
                            }
                          </td>

                          <td>
                            {
                              linea
                                .cantidad_aprobada
                            }
                          </td>

                          <td>
                            {
                              linea
                                .cantidad_enviada_acumulada
                            }
                          </td>

                          <td>
                            {
                              linea
                                .cantidad_recibida_acumulada
                            }
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No hay productos
                existentes.
              </div>
            )}

            <div
              style={{
                marginTop:
                  "28px"
              }}
            >
              <h3>
                Productos nuevos
              </h3>
            </div>

            {detalle
              .productos_nuevos
              ?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Nombre
                      </th>
                      <th>
                        Descripción
                      </th>
                      <th>
                        Categoría
                      </th>
                      <th>
                        Cantidad
                      </th>

                      {puedeVerDatosProveedor && (
                        <>
                          <th>
                            Proveedor
                          </th>
                          <th>
                            SKU
                          </th>
                          <th>
                            Link
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {detalle
                      .productos_nuevos
                      .map(
                        (
                          producto
                        ) => (
                          <tr
                            key={
                              producto.id
                            }
                          >
                            <td>
                              {
                                producto.nombre
                              }
                            </td>

                            <td>
                              {
                                producto.descripcion
                              }
                            </td>

                            <td>
                              {
                                producto.categoria_nombre
                              }
                            </td>

                            <td>
                              {
                                producto.cantidad_solicitada
                              }
                            </td>

                            {puedeVerDatosProveedor && (
                              <>
                                <td>
                                  {producto
                                    .proveedor_sugerido ||
                                    "—"}
                                </td>

                                <td>
                                  {producto
                                    .sku_sugerido ||
                                    "—"}
                                </td>

                                <td>
                                  {producto
                                    .proveedor_link ? (
                                    <a
                                      href={
                                        producto
                                          .proveedor_link
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Abrir
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        )
                      )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No hay productos
                nuevos.
              </div>
            )}

            <div className="modal-actions">
              {puedeRevisar &&
                detalle
                  .solicitud
                  .estado ===
                  "solicitada" && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      iniciarRevision(
                        detalle
                          .solicitud
                          .id
                      )
                    }
                  >
                    <ClipboardList
                      size={17}
                    />

                    Iniciar revisión
                  </button>
                )}

              {puedeAprobar &&
                detalle
                  .solicitud
                  .estado ===
                  "en_revision" && (
                  <>
                    <button
                      className="danger-button"
                      onClick={
                        rechazarSolicitud
                      }
                      disabled={
                        guardando
                      }
                    >
                      <XCircle
                        size={17}
                      />

                      Rechazar
                    </button>

                    <button
                      className="primary-button icon-button"
                      onClick={
                        abrirAprobacion
                      }
                      disabled={
                        guardando ||
                        cargandoAprobacion ||
                        (
                          detalle.lineas.length === 0 &&
                          (detalle.productos_nuevos || []).length === 0
                        )
                      }
                    >
                      <CheckCircle2
                        size={17}
                      />

                      {cargandoAprobacion
                        ? "Preparando..."
                        : "Revisar aprobación"}
                    </button>
                  </>
                )}

              {puedeRevisar &&
                (esDestinoSucursal ||
                  esDestinoEquipoInterno) &&
                [
                  "aprobada",
                  "en_transito"
                ].includes(
                  detalle
                    .solicitud
                    .estado
                ) &&
                detalle.lineas.some(
                  (
                    linea
                  ) =>
                    Number(
                      linea
                        .cantidad_aprobada
                    ) >
                    Number(
                      linea
                        .cantidad_enviada_acumulada
                    )
                ) && (
                  <button
                    className="primary-button icon-button"
                    onClick={
                      abrirCrearEnvio
                    }
                  >
                    <Truck
                      size={17}
                    />

                    Crear envío
                  </button>
                )}

              {puedeRevisar &&
                esDestinoEquipoInterno &&
                detalle.solicitud.estado ===
                  "aprobada" &&
                !detalle.lineas.some(
                  (linea) =>
                    Number(
                      linea.cantidad_enviada_acumulada ||
                        0
                    ) > 0
                ) && (
                  <div
                    style={{
                      padding:
                        "10px 14px",
                      borderRadius:
                        "8px",
                      border:
                        "1px solid rgba(128,128,128,.3)"
                    }}
                  >
                    <ShoppingCart
                      size={17}
                      style={{
                        verticalAlign:
                          "middle",
                        marginRight:
                          "7px"
                      }}
                    />

                    Pendiente de
                    gestionar en
                    Compras
                  </div>
                )}

              {puedeAprobar &&
                [
                  "aprobada",
                  "en_transito",
                  "recibida"
                ].includes(
                  detalle
                    .solicitud
                    .estado
                ) && (
                  <button
                    className="secondary-button"
                    onClick={
                      cerrarSolicitud
                    }
                    disabled={
                      guardando
                    }
                  >
                    <PackageCheck
                      size={17}
                    />

                    Cerrar solicitud
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Solicitudes;