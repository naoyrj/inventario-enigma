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
  ShoppingCart,
  PackagePlus
} from "lucide-react";

import api from "../services/api";

const Solicitudes = () => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "{}"
  );

  const [solicitudes, setSolicitudes] =
    useState([]);

  const [productos, setProductos] =
    useState([]);

  const [categorias, setCategorias] =
    useState([]);

  const [ubicaciones, setUbicaciones] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [estadoFiltro, setEstadoFiltro] =
    useState("");

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
    lineasDisponiblesEnvio,
    setLineasDisponiblesEnvio
  ] = useState([]);

  const [
    preparandoEnvio,
    setPreparandoEnvio
  ] = useState(false);

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
    registrandoInventario,
    setRegistrandoInventario
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

  // =========================================================
  // CARGA GENERAL
  // =========================================================

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        solicitudesRes,
        catalogoRes,
        ubicacionesRes
      ] = await Promise.all([
        api.get("/solicitudes"),
        api.get("/solicitudes/catalogo"),
        api.get("/ubicaciones")
      ]);

      setSolicitudes(
        solicitudesRes.data || []
      );

      setProductos(
        catalogoRes.data?.productos || []
      );

      setCategorias(
        catalogoRes.data?.categorias || []
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

  // =========================================================
  // FILTROS
  // =========================================================

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
            item.destino_ubicacion_nombre
              ?.toLowerCase()
              .includes(texto) ||
            item.creado_por_usuario_nombre
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
      const activos =
        productos.filter(
          (producto) =>
            producto.activo !== false
        );

      if (!categoriaCatalogo) {
        return activos;
      }

      return activos.filter(
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

  const categoriasCatalogo =
    useMemo(
      () =>
        categorias.filter(
          (categoria) =>
            categoria.activo !== false
        ),
      [categorias]
    );

  // =========================================================
  // TIPO DE SOLICITUD
  // =========================================================

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

  const esSolicitudPropiaEquipoInterno =
    usuario.rol ===
      "equipo_interno" &&
    detalle?.solicitud &&
    Number(
      detalle.solicitud
        .destino_ubicacion_id
    ) ===
      Number(
        usuario.ubicacion_id
      ) &&
    Number(
      detalle.solicitud
        .solicitante_ubicacion_id
    ) ===
      Number(
        usuario.ubicacion_id
      );

  // =========================================================
  // ETIQUETAS
  // =========================================================

  const etiquetaEstadoSolicitud = (
    solicitud
  ) => {
    if (
      solicitud?.destino_ubicacion_tipo ===
        "equipo_interno" &&
      solicitud?.estado ===
        "recibida"
    ) {
      return "Recibida por Central";
    }

    const etiquetas = {
      solicitada:
        "Solicitada",

      en_revision:
        "En revisión",

      aprobada:
        "Aprobada",

      en_transito:
        "En tránsito",

      recibida:
        "Recibida",

      cerrada:
        "Cerrada",

      rechazada:
        "Rechazada"
    };

    return (
      etiquetas[
        solicitud?.estado
      ] ||
      solicitud?.estado ||
      "—"
    );
  };

  // =========================================================
  // CANTIDAD PENDIENTE DE REGISTRAR EN INVENTARIO PERSONAL
  // =========================================================

  const obtenerDisponibleRegistro = (
    linea
  ) => {
    if (
      linea
        ?.cantidad_disponible_registro !==
        undefined &&
      linea
        ?.cantidad_disponible_registro !==
        null
    ) {
      return Math.max(
        Number(
          linea
            .cantidad_disponible_registro
        ) || 0,
        0
      );
    }

    const recibida =
      Number(
        linea
          ?.cantidad_recibida_acumulada ||
          0
      );

    const registrada =
      Number(
        linea
          ?.cantidad_registrada_inventario ||
          0
      );

    return Math.max(
      recibida - registrada,
      0
    );
  };

  const unidadesDisponiblesRegistro =
    useMemo(() => {
      if (!detalle) {
        return 0;
      }

      const existentes =
        (
          detalle.lineas || []
        ).reduce(
          (total, linea) =>
            total +
            obtenerDisponibleRegistro(
              linea
            ),
          0
        );

      const nuevos =
        (
          detalle.productos_nuevos ||
          []
        ).reduce(
          (total, producto) =>
            total +
            obtenerDisponibleRegistro(
              producto
            ),
          0
        );

      return existentes + nuevos;
    }, [detalle]);

  // =========================================================
  // LÍNEAS DE SOLICITUD
  // =========================================================

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
        (_, i) =>
          i !== index
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

    setLineas(
      nuevas
    );
  };

  // =========================================================
  // PRODUCTOS NUEVOS
  // =========================================================

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
        (_, i) =>
          i !== index
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

  // =========================================================
  // LIMPIAR SOLICITUD
  // =========================================================

  const limpiarNuevaSolicitud =
    () => {
      setDestino(
        usuario.ubicacion_id ||
          ""
      );

      setUsarFranquiciaNueva(
        false
      );

      setNombreFranquiciaNueva(
        ""
      );

      setCategoriaCatalogo(
        ""
      );

      setLineas([
        {
          producto_id: "",
          cantidad_solicitada: 1
        }
      ]);

      setProductosNuevos(
        []
      );
    };

  // =========================================================
  // CREAR SOLICITUD
  // =========================================================

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
                producto
                  .categoria_id
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

      setMostrarNueva(
        false
      );

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

  // =========================================================
  // DETALLE
  // =========================================================

  const verDetalle = async (
    id
  ) => {
    try {
      setError("");

      const response =
        await api.get(
          `/solicitudes/${id}`
        );

      setSeleccionada(
        id
      );

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

  // =========================================================
  // REVISIÓN
  // =========================================================

  const iniciarRevision = async (
    id
  ) => {
    try {
      setError("");

      await api.patch(
        `/solicitudes/${id}/revision`
      );

      await cargarDatos();

      await verDetalle(
        id
      );
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "No fue posible iniciar la revisión"
      );
    }
  };

  // =========================================================
  // APROBACIÓN
  // =========================================================

  const abrirAprobacion =
    async () => {
      if (!detalle) {
        return;
      }

      try {
        setCargandoAprobacion(
          true
        );

        setError("");

        const cantidadesIniciales =
          {};

        // Equipo Interno:
        // no utilizamos ni mostramos stock
        // de Central.
        if (
          esDestinoEquipoInterno
        ) {
          detalle.lineas.forEach(
            (linea) => {
              cantidadesIniciales[
                linea.id
              ] =
                Number(
                  linea
                    .cantidad_solicitada ||
                    0
                );
            }
          );

          setStockCentral(
            {}
          );

          setCantidadesAprobacion(
            cantidadesIniciales
          );

          setMostrarAprobacion(
            true
          );

          return;
        }

        // Sucursal:
        // solamente Central consulta su
        // propio stock durante aprobación.
        const response =
          await api.get(
            "/reportes/inventario",
            {
              params: {
                ubicacion_id:
                  Number(
                    usuario.ubicacion_id
                  )
              }
            }
          );

        const mapaStock = {};

        (
          response.data || []
        ).forEach(
          (item) => {
            mapaStock[
              Number(
                item.producto_id
              )
            ] =
              Number(
                item.cantidad ||
                  0
              );
          }
        );

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
                    linea.producto_id
                  )
                ] || 0
              );

            cantidadesIniciales[
              linea.id
            ] =
              Math.min(
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
          [lineaId]: valor
        })
      );
    };

  const aprobarSolicitud =
    async (event) => {
      event.preventDefault();

      if (!detalle) {
        return;
      }

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
                        linea.producto_id
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
        (
          detalle
            .productos_nuevos ||
          []
        ).length > 0;

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

        setStockCentral(
          {}
        );

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

  // =========================================================
  // RECHAZAR
  // =========================================================

  const rechazarSolicitud =
    async () => {
      const motivo =
        window.prompt(
          "Escribe el motivo del rechazo:"
        );

      if (!motivo) {
        return;
      }

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

  // =========================================================
  // CERRAR
  // =========================================================

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

  // =========================================================
  // COMPRAS VINCULADAS
  // =========================================================

  const cargarComprasVinculadas =
    async () => {
      const ordenesResponse =
        await api.get(
          "/compras"
        );

      const ordenes =
        ordenesResponse.data ||
        [];

      const detalles =
        await Promise.all(
          ordenes.map(
            async (orden) => {
              try {
                const response =
                  await api.get(
                    `/compras/${orden.id}`
                  );

                return response.data;
              } catch {
                return null;
              }
            }
          )
        );

      return detalles.filter(
        Boolean
      );
    };

  // =========================================================
  // PREPARAR ENVÍO
  // =========================================================

  const abrirCrearEnvio =
    async () => {
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

      if (
        esDestinoEquipoInterno &&
        detalle.solicitud.estado !==
          "recibida"
      ) {
        setError(
          "La compra debe estar recibida por Central antes de crear el envío al Equipo Interno."
        );

        return;
      }

      if (
        esDestinoSucursal &&
        ![
          "aprobada",
          "en_transito"
        ].includes(
          detalle.solicitud.estado
        )
      ) {
        setError(
          "La solicitud de Sucursal debe estar aprobada o en tránsito para crear el envío."
        );

        return;
      }

      try {
        setPreparandoEnvio(
          true
        );

        setError("");

        const disponibles = [];

        // =====================================================
        // SUCURSAL
        // Se envía desde stock Central.
        // =====================================================

        if (
          esDestinoSucursal
        ) {
          (
            detalle.lineas ||
            []
          ).forEach(
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
                disponibles.push({
                  key:
                    `existente-${linea.id}`,

                  tipo:
                    "existente",

                  solicitud_linea_id:
                    linea.id,

                  solicitud_producto_nuevo_id:
                    null,

                  producto_id:
                    linea.producto_id,

                  producto_nombre:
                    linea.producto_nombre,

                  cantidad_base:
                    aprobada,

                  cantidad_enviada:
                    enviada,

                  cantidad_disponible:
                    pendiente
                });
              }
            }
          );
        }

        // =====================================================
        // EQUIPO INTERNO
        // Lo disponible depende de lo recibido del proveedor,
        // no del stock de Central.
        // =====================================================

        if (
          esDestinoEquipoInterno
        ) {
          const compras =
            await cargarComprasVinculadas();

          const lineasCompra =
            compras.flatMap(
              (compra) =>
                (
                  compra?.lineas ||
                  []
                ).map(
                  (linea) => ({
                    ...linea,

                    orden_id:
                      compra?.orden?.id
                  })
                )
            );

          // ---------------------------------------------------
          // Productos existentes
          // ---------------------------------------------------

          (
            detalle.lineas ||
            []
          ).forEach(
            (linea) => {
              const compradas =
                lineasCompra.filter(
                  (compra) =>
                    Number(
                      compra
                        .solicitud_linea_id
                    ) ===
                    Number(
                      linea.id
                    )
                );

              const recibidoProveedor =
                compradas.reduce(
                  (
                    total,
                    compra
                  ) =>
                    total +
                    Number(
                      compra
                        .cantidad_recibida ||
                        0
                    ),
                  0
                );

              const aprobada =
                Number(
                  linea
                    .cantidad_aprobada ||
                    linea
                      .cantidad_solicitada ||
                    0
                );

              const enviada =
                Number(
                  linea
                    .cantidad_enviada_acumulada ||
                    0
                );

              const disponible =
                Math.max(
                  Math.min(
                    aprobadoSeguro(
                      aprobada
                    ),
                    recibidoProveedor
                  ) -
                    enviada,
                  0
                );

              if (
                disponible > 0
              ) {
                disponibles.push({
                  key:
                    `existente-${linea.id}`,

                  tipo:
                    "existente",

                  solicitud_linea_id:
                    linea.id,

                  solicitud_producto_nuevo_id:
                    null,

                  producto_id:
                    linea.producto_id,

                  producto_nombre:
                    linea.producto_nombre,

                  cantidad_base:
                    recibidoProveedor,

                  cantidad_enviada:
                    enviada,

                  cantidad_disponible:
                    disponible
                });
              }
            }
          );

          // ---------------------------------------------------
          // Productos nuevos
          // ---------------------------------------------------

          for (
            const productoNuevo of
              detalle
                .productos_nuevos ||
              []
          ) {
            const compradas =
              lineasCompra.filter(
                (compra) =>
                  Number(
                    compra
                      .solicitud_producto_nuevo_id
                  ) ===
                  Number(
                    productoNuevo.id
                  ) &&
                  Number(
                    compra
                      .cantidad_recibida ||
                      0
                  ) > 0
              );

            const porProducto =
              new Map();

            compradas.forEach(
              (compra) => {
                const productoId =
                  Number(
                    compra.producto_id
                  );

                if (!productoId) {
                  return;
                }

                const actual =
                  porProducto.get(
                    productoId
                  ) || {
                    producto_id:
                      productoId,

                    producto_nombre:
                      compra
                        .producto_nombre ||
                      productoNuevo.nombre,

                    cantidad_recibida:
                      0
                  };

                actual.cantidad_recibida +=
                  Number(
                    compra
                      .cantidad_recibida ||
                      0
                  );

                porProducto.set(
                  productoId,
                  actual
                );
              }
            );

            const productosComprados =
              Array.from(
                porProducto.values()
              );

            if (
              productosComprados.length >
              1
            ) {
              throw new Error(
                `El producto nuevo "${productoNuevo.nombre}" está vinculado a más de un producto real. Revisa la orden de compra antes de crear el envío.`
              );
            }

            if (
              productosComprados.length ===
              0
            ) {
              continue;
            }

            const compra =
              productosComprados[0];

            const enviada =
              Number(
                productoNuevo
                  .cantidad_enviada_acumulada ||
                  0
              );

            const disponible =
              Math.max(
                Number(
                  compra
                    .cantidad_recibida ||
                    0
                ) -
                  enviada,
                0
              );

            if (
              disponible > 0
            ) {
              disponibles.push({
                key:
                  `nuevo-${productoNuevo.id}`,

                tipo:
                  "nuevo",

                solicitud_linea_id:
                  null,

                solicitud_producto_nuevo_id:
                  productoNuevo.id,

                producto_id:
                  compra.producto_id,

                producto_nombre:
                  compra
                    .producto_nombre ||
                  productoNuevo.nombre,

                cantidad_base:
                  Number(
                    compra
                      .cantidad_recibida ||
                      0
                  ),

                cantidad_enviada:
                  enviada,

                cantidad_disponible:
                  disponible
              });
            }
          }
        }

        if (
          disponibles.length ===
          0
        ) {
          setError(
            esDestinoEquipoInterno
              ? "No hay artículos recibidos por Central pendientes de enviar al Equipo Interno."
              : "Esta solicitud no tiene productos pendientes de envío."
          );

          return;
        }

        const cantidades = {};

        disponibles.forEach(
          (linea) => {
            cantidades[
              linea.key
            ] = "";
          }
        );

        setLineasDisponiblesEnvio(
          disponibles
        );

        setCantidadesEnvio(
          cantidades
        );

        setMostrarEnvio(
          true
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            error.message ||
            "No fue posible preparar el envío"
        );
      } finally {
        setPreparandoEnvio(
          false
        );
      }
    };

  const aprobadoSeguro = (
    cantidad
  ) => {
    const numero =
      Number(cantidad);

    return Number.isFinite(
      numero
    )
      ? Math.max(
          numero,
          0
        )
      : 0;
  };

  const actualizarCantidadEnvio =
    (
      key,
      valor
    ) => {
      setCantidadesEnvio(
        (actual) => ({
          ...actual,
          [key]: valor
        })
      );
    };

  // =========================================================
  // CREAR ENVÍO
  // =========================================================

  const crearEnvio =
    async (event) => {
      event.preventDefault();

      if (!detalle) {
        return;
      }

      const seleccionadas =
        lineasDisponiblesEnvio
          .map(
            (linea) => ({
              ...linea,

              cantidad:
                Number(
                  cantidadesEnvio[
                    linea.key
                  ] || 0
                )
            })
          )
          .filter(
            (linea) =>
              linea.cantidad > 0
          );

      if (
        seleccionadas.length ===
        0
      ) {
        setError(
          "Captura al menos una cantidad mayor a cero para crear el envío."
        );

        return;
      }

      const invalida =
        seleccionadas.find(
          (linea) =>
            !Number.isFinite(
              linea.cantidad
            ) ||
            linea.cantidad <= 0 ||
            linea.cantidad >
              Number(
                linea
                  .cantidad_disponible ||
                  0
              )
        );

      if (invalida) {
        setError(
          "La cantidad a enviar debe ser mayor a cero y no puede superar la cantidad disponible."
        );

        return;
      }

      const payloadLineas =
        seleccionadas.map(
          (linea) => {
            if (
              linea.tipo ===
              "nuevo"
            ) {
              return {
                solicitud_producto_nuevo_id:
                  Number(
                    linea
                      .solicitud_producto_nuevo_id
                  ),

                producto_id:
                  Number(
                    linea.producto_id
                  ),

                cantidad_enviada:
                  linea.cantidad
              };
            }

            return {
              solicitud_linea_id:
                Number(
                  linea
                    .solicitud_linea_id
                ),

              cantidad_enviada:
                linea.cantidad
            };
          }
        );

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
                payloadLineas
            }
          );

        setMostrarEnvio(
          false
        );

        setCantidadesEnvio(
          {}
        );

        setLineasDisponiblesEnvio(
          []
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

  // =========================================================
  // REGISTRAR EN INVENTARIO PERSONAL
  // =========================================================

  const registrarPedidoEnInventario =
    async () => {
      if (
        !detalle ||
        !esSolicitudPropiaEquipoInterno
      ) {
        return;
      }

      if (
        unidadesDisponiblesRegistro <=
        0
      ) {
        setError(
          "No hay artículos recibidos pendientes de registrar en tu inventario."
        );

        return;
      }

      const confirmar =
        window.confirm(
          `Se registrarán ${unidadesDisponiblesRegistro} unidad(es) recibidas en tu inventario. ¿Deseas continuar?`
        );

      if (!confirmar) {
        return;
      }

      try {
        setRegistrandoInventario(
          true
        );

        setError("");

        const response =
          await api.post(
            `/solicitudes/${detalle.solicitud.id}/registrar-inventario`
          );

        await cargarDatos();

        await verDetalle(
          detalle.solicitud.id
        );

        window.alert(
          response.data?.message ||
            "Artículos registrados en tu inventario correctamente."
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible registrar los artículos en tu inventario"
        );
      } finally {
        setRegistrandoInventario(
          false
        );
      }
    };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="page-loading">
        Cargando solicitudes...
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>
            Solicitudes
          </h1>

          <p>
            Solicitudes de Sucursales y
            Equipos Internos.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={cargarDatos}
          >
            <RefreshCw size={18} />

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
              value={busqueda}
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
            value={estadoFiltro}
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
              Recibida / Recibida por
              Central
            </option>

            <option value="cerrada">
              Cerrada
            </option>

            <option value="rechazada">
              Rechazada
            </option>
          </select>
        </div>

        {solicitudesFiltradas.length ===
        0 ? (
          <div className="empty-state">
            No hay solicitudes disponibles.
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
                          ? "Compra → Envío"
                          : "Central → Envío"}
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
                            etiquetaEstadoSolicitud(
                              item
                            )
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

      {/* ===================================================
          NUEVA SOLICITUD
      =================================================== */}

      {mostrarNueva && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Nueva solicitud
                </h2>

                <p>
                  Aquí puedes consultar los
                  artículos y categorías
                  disponibles para realizar
                  una solicitud. Las
                  cantidades de stock de
                  Central no son visibles.
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

                      gap:
                        "8px",

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

                    Franquicia nueva, aún
                    no dada de alta
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

                        opacity:
                          0.7
                      }}
                    >
                      La ubicación se creará
                      con estado Pendiente.
                    </small>
                  </>
                ) : (
                  <select
                    className="form-control"
                    value={destino}
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

                <p
                  style={{
                    opacity:
                      0.75
                  }}
                >
                  El catálogo no muestra
                  existencias ni cantidades
                  disponibles del almacén
                  Central.
                </p>
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

                  {categoriasCatalogo.map(
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
                + Agregar producto existente
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
                    opacity:
                      0.75
                  }}
                >
                  Usa esta sección cuando
                  el artículo no existe en
                  el catálogo.
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

                        {categoriasCatalogo.map(
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
                            Proveedor sugerido
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
                                event.target
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
                                event.target
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
                                event.target
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

      {/* ===================================================
          APROBACIÓN
      =================================================== */}

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
                                      event.target
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

      {/* ===================================================
          CREAR ENVÍO
      =================================================== */}

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
                  onClick={() => {
                    setMostrarEnvio(
                      false
                    );

                    setLineasDisponiblesEnvio(
                      []
                    );

                    setCantidadesEnvio(
                      {}
                    );
                  }}
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
                          Origen
                        </th>

                        <th>
                          Disponible
                        </th>

                        <th>
                          Enviar
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {lineasDisponiblesEnvio.map(
                        (
                          linea
                        ) => (
                          <tr
                            key={
                              linea.key
                            }
                          >
                            <td>
                              {
                                linea.producto_nombre
                              }
                            </td>

                            <td>
                              {linea.tipo ===
                              "nuevo"
                                ? "Compra / producto nuevo"
                                : esDestinoEquipoInterno
                                  ? "Compra a proveedor"
                                  : "Stock Central"}
                            </td>

                            <td>
                              {
                                linea
                                  .cantidad_disponible
                              }
                            </td>

                            <td>
                              <input
                                className="form-control quantity-input"
                                type="number"
                                min="0"
                                max={
                                  linea
                                    .cantidad_disponible
                                }
                                step="0.01"
                                value={
                                  cantidadesEnvio[
                                    linea.key
                                  ] ??
                                  ""
                                }
                                onChange={(
                                  event
                                ) =>
                                  actualizarCantidadEnvio(
                                    linea.key,
                                    event.target
                                      .value
                                  )
                                }
                              />
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setMostrarEnvio(
                        false
                      );

                      setLineasDisponiblesEnvio(
                        []
                      );

                      setCantidadesEnvio(
                        {}
                      );
                    }}
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

                    {guardando
                      ? "Creando..."
                      : "Crear envío"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* ===================================================
          DETALLE
      =================================================== */}

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
                        etiquetaEstadoSolicitud(
                          detalle
                            .solicitud
                        )
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
                  Flujo de abastecimiento:{" "}
                </strong>

                {esDestinoEquipoInterno ? (
                  <span>
                    Compra a proveedor →
                    Recibida por Central →
                    Envío → Registro manual
                    en inventario

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
                    Envío a Sucursal →
                    Inventario de Sucursal
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

                        {esDestinoEquipoInterno && (
                          <th>
                            Registrada
                          </th>
                        )}
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

                            {esDestinoEquipoInterno && (
                              <td>
                                {Number(
                                  linea
                                    .cantidad_registrada_inventario ||
                                    0
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No hay productos existentes.
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

                        <th>
                          Enviada
                        </th>

                        <th>
                          Recibida
                        </th>

                        {esDestinoEquipoInterno && (
                          <th>
                            Registrada
                          </th>
                        )}

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
                                  producto.descripcion ||
                                  "—"
                                }
                              </td>

                              <td>
                                {
                                  producto.categoria_nombre ||
                                  "—"
                                }
                              </td>

                              <td>
                                {
                                  producto
                                    .cantidad_solicitada
                                }
                              </td>

                              <td>
                                {Number(
                                  producto
                                    .cantidad_enviada_acumulada ||
                                    0
                                )}
                              </td>

                              <td>
                                {Number(
                                  producto
                                    .cantidad_recibida_acumulada ||
                                    0
                                )}
                              </td>

                              {esDestinoEquipoInterno && (
                                <td>
                                  {Number(
                                    producto
                                      .cantidad_registrada_inventario ||
                                      0
                                  )}
                                </td>
                              )}

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
                  No hay productos nuevos.
                </div>
              )}

              {/* =================================================
                  ACCIONES
              ================================================= */}

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
                            detalle
                              .lineas
                              .length ===
                              0 &&
                            (
                              detalle
                                .productos_nuevos ||
                              []
                            ).length ===
                              0
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
                  (
                    (
                      esDestinoSucursal &&
                      [
                        "aprobada",
                        "en_transito"
                      ].includes(
                        detalle
                          .solicitud
                          .estado
                      )
                    ) ||
                    (
                      esDestinoEquipoInterno &&
                      detalle
                        .solicitud
                        .estado ===
                        "recibida"
                    )
                  ) &&
                  (
                    (
                      detalle.lineas ||
                      []
                    ).length >
                      0 ||
                    (
                      detalle
                        .productos_nuevos ||
                      []
                    ).length >
                      0
                  ) && (
                    <button
                      className="primary-button icon-button"
                      onClick={
                        abrirCrearEnvio
                      }
                      disabled={
                        preparandoEnvio
                      }
                    >
                      <Truck
                        size={17}
                      />

                      {preparandoEnvio
                        ? "Preparando..."
                        : esDestinoEquipoInterno
                          ? "Crear envío al solicitante"
                          : "Crear envío"}
                    </button>
                  )}

                {puedeRevisar &&
                  esDestinoEquipoInterno &&
                  detalle
                    .solicitud
                    .estado ===
                    "aprobada" && (
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

                      Pendiente de recepción
                      por Central en Compras
                    </div>
                  )}

                {esSolicitudPropiaEquipoInterno &&
                  unidadesDisponiblesRegistro >
                    0 && (
                    <button
                      className="primary-button icon-button"
                      onClick={
                        registrarPedidoEnInventario
                      }
                      disabled={
                        registrandoInventario
                      }
                    >
                      <PackagePlus
                        size={17}
                      />

                      {registrandoInventario
                        ? "Registrando..."
                        : `Registrar en mi inventario (${unidadesDisponiblesRegistro})`}
                    </button>
                  )}

                {esSolicitudPropiaEquipoInterno &&
                  unidadesDisponiblesRegistro ===
                    0 &&
                  (
                    detalle.lineas || []
                  ).some(
                    (linea) =>
                      Number(
                        linea
                          .cantidad_recibida_acumulada ||
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
                      <PackageCheck
                        size={17}
                        style={{
                          verticalAlign:
                            "middle",

                          marginRight:
                            "7px"
                        }}
                      />

                      Todo lo recibido ya fue
                      registrado en tu
                      inventario
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
                  ) &&
                  !(
                    esDestinoEquipoInterno &&
                    detalle
                      .solicitud
                      .estado ===
                      "recibida"
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