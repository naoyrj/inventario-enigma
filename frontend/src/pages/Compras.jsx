import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Eye,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2
} from "lucide-react";

import api from "../services/api";

const lineaInicial = {
  producto_id: "",
  cantidad_solicitada: 1,
  costo_unitario: "",
  solicitud_linea_id: ""
};

const productoNuevoInicial = {
  nombre: "",
  descripcion: "",
  sku: "",
  categoria_id: "",
  unidad_medida: "pieza",
  cantidad_solicitada: 1,
  costo_unitario: "",
  solicitud_producto_nuevo_id: "",
  solicitud_id: "",
  destino_ubicacion_nombre: "",
  proveedor_sugerido: "",
  proveedor_link: "",
  categoria_nombre: ""
};

const Compras = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [solicitudLineas, setSolicitudLineas] = useState([]);
  const [solicitudProductosNuevos, setSolicitudProductosNuevos] = useState([]);

  const [detalle, setDetalle] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);
  const [cantidadesRecepcion, setCantidadesRecepcion] = useState({});

  const [proveedorId, setProveedorId] = useState("");
  const [solicitudSeleccionadaId, setSolicitudSeleccionadaId] = useState("");

  const [lineas, setLineas] = useState([
    { ...lineaInicial }
  ]);

  const [productosNuevos, setProductosNuevos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarSolicitudesConLineas = async (
    solicitudesBase
  ) => {
    const solicitudesCompra =
      (solicitudesBase || []).filter(
        (solicitud) =>
          ["equipo_interno", "sucursal"].includes(
            solicitud.destino_ubicacion_tipo
          ) &&
          ![
            "cerrada",
            "rechazada"
          ].includes(
            solicitud.estado
          )
      );

    if (solicitudesCompra.length === 0) {
      setSolicitudLineas([]);
      setSolicitudProductosNuevos([]);
      return;
    }

    const resultados = await Promise.allSettled(
      solicitudesCompra.map((solicitud) =>
        api.get(`/solicitudes/${solicitud.id}`)
      )
    );

    const lineasDisponibles = [];
    const nuevosDisponibles = [];

    resultados.forEach((resultado, index) => {
      if (resultado.status !== "fulfilled") {
        return;
      }

      const data = resultado.value.data;
      const solicitud =
        data.solicitud || solicitudesCompra[index];

      if (
          !["equipo_interno", "sucursal"].includes(
            solicitud.destino_ubicacion_tipo
          )
        ) {
          return;
        }

      (data.lineas || []).forEach(
          (linea) => {
            const tipoDestino =
              solicitud.destino_ubicacion_tipo ||
              ubicacionDestino?.tipo;

            if (tipoDestino !== "equipo_interno") {
              return;
            }
        lineasDisponibles.push({
          ...linea,
          solicitud_id: solicitud.id,
          solicitud_estado: solicitud.estado,
          solicitante_ubicacion_id:
            solicitud.solicitante_ubicacion_id,
          solicitante_ubicacion_nombre:
            solicitud.solicitante_ubicacion_nombre || "",
          solicitante_ubicacion_tipo:
            solicitud.solicitante_ubicacion_tipo || "",
          destino_ubicacion_id:
            solicitud.destino_ubicacion_id,
          destino_ubicacion_tipo:
            solicitud.destino_ubicacion_tipo,
          destino_ubicacion_nombre:
            solicitud.destino_ubicacion_nombre ||
            solicitudesCompra[index]
              .destino_ubicacion_nombre ||
            ""
        });
      });

      (data.productos_nuevos || []).forEach((producto) => {
        nuevosDisponibles.push({
          ...producto,
          solicitud_id: solicitud.id,
          solicitud_estado: solicitud.estado,
          solicitante_ubicacion_id:
            solicitud.solicitante_ubicacion_id,
          solicitante_ubicacion_nombre:
            solicitud.solicitante_ubicacion_nombre || "",
          solicitante_ubicacion_tipo:
            solicitud.solicitante_ubicacion_tipo || "",
          destino_ubicacion_id:
            solicitud.destino_ubicacion_id,
          destino_ubicacion_tipo:
            solicitud.destino_ubicacion_tipo,
          destino_ubicacion_nombre:
            solicitud.destino_ubicacion_nombre ||
            solicitudesCompra[index]
              .destino_ubicacion_nombre ||
            ""
        });
      });
    });

    setSolicitudLineas(lineasDisponibles);
    setSolicitudProductosNuevos(nuevosDisponibles);
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        ordenesRes,
        proveedoresRes,
        productosRes,
        categoriasRes,
        solicitudesRes
      ] = await Promise.all([
        api.get("/compras"),
        api.get("/proveedores"),
        api.get("/productos"),
        api.get("/categorias"),
        api.get("/solicitudes")
      ]);

      const ordenesData = ordenesRes.data || [];
      const proveedoresData = proveedoresRes.data || [];
      const productosData = productosRes.data || [];
      const categoriasData = categoriasRes.data || [];
      const solicitudesData = solicitudesRes.data || [];

      setOrdenes(ordenesData);
      setProveedores(proveedoresData);
      setProductos(productosData);
      setCategorias(categoriasData);
      setSolicitudes(solicitudesData);

      await cargarSolicitudesConLineas(solicitudesData);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar compras"
      );
    } finally {
      setLoading(false);
    }
  };

  const categoriasCentral = useMemo(
    () =>
      categorias.filter(
        (categoria) =>
          categoria.activo !== false &&
          categoria.tipo !== "privada"
      ),
    [categorias]
  );

  const productosCentral = useMemo(
    () =>
      productos.filter(
        (producto) =>
          producto.activo !== false &&
          producto.categoria_tipo !== "privada"
      ),
    [productos]
  );

  const productosCompra = useMemo(() => {
    const mapa = new Map();

    productosCentral.forEach((producto) => {
      mapa.set(Number(producto.id), producto);
    });

    solicitudLineas
      .filter(
        (linea) =>
          linea.destino_ubicacion_tipo === "equipo_interno" &&
          linea.solicitud_estado === "aprobada"
      )
      .forEach((linea) => {
        const id = Number(linea.producto_id);

        const productoCompleto = productos.find(
          (producto) => Number(producto.id) === id
        );

        if (productoCompleto) {
          mapa.set(id, productoCompleto);
          return;
        }

        mapa.set(id, {
          id,
          nombre:
            linea.producto_nombre || `Producto #${id}`,
          sku: linea.sku || "",
          activo: true,
          categoria_tipo: linea.categoria_tipo || "privada"
        });
      });

    return [...mapa.values()].sort((a, b) =>
      String(a.nombre || "").localeCompare(
        String(b.nombre || ""),
        "es"
      )
    );
  }, [productosCentral, productos, solicitudLineas]);

  const solicitudesDisponiblesCompra = useMemo(() => {
    const mapa = new Map();

    solicitudes
      .filter(
        (solicitud) =>
          ["equipo_interno", "sucursal"].includes(
            solicitud.destino_ubicacion_tipo
          ) &&
          solicitud.estado === "aprobada"
      )
      .forEach((solicitud) => {
        const tieneLineas = solicitudLineas.some(
          (linea) =>
            Number(linea.solicitud_id) ===
            Number(solicitud.id)
        );

        const tieneNuevos = solicitudProductosNuevos.some(
          (producto) =>
            Number(producto.solicitud_id) ===
            Number(solicitud.id)
        );

        if (tieneLineas || tieneNuevos) {
          mapa.set(Number(solicitud.id), solicitud);
        }
      });

    return [...mapa.values()].sort(
      (a, b) => Number(b.id) - Number(a.id)
    );
  }, [solicitudes, solicitudLineas, solicitudProductosNuevos]);

  const solicitudesPorProducto = (productoId) => {
    if (!productoId) {
      return [];
    }

    return solicitudLineas.filter(
      (linea) =>
        Number(linea.producto_id) === Number(productoId) &&
        linea.destino_ubicacion_tipo === "equipo_interno" &&
        linea.solicitud_estado === "aprobada"
    );
  };

  const actualizarLinea = (index, campo, valor) => {
    const nuevas = [...lineas];

    nuevas[index] = {
      ...nuevas[index],
      [campo]: valor
    };

    if (campo === "producto_id") {
      nuevas[index].solicitud_linea_id = "";
    }

    if (campo === "solicitud_linea_id" && valor) {
      const origen = solicitudLineas.find(
        (item) => Number(item.id) === Number(valor)
      );

      if (origen) {
        const cantidadAprobada = Number(
          origen.cantidad_aprobada ?? origen.cantidad_solicitada
        );

        if (
          Number.isFinite(cantidadAprobada) &&
          cantidadAprobada > 0
        ) {
          nuevas[index].cantidad_solicitada = cantidadAprobada;
        }
      }
    }

    setLineas(nuevas);
  };

  const agregarLinea = () => {
    setLineas([
      ...lineas,
      { ...lineaInicial }
    ]);
  };

  const eliminarLinea = (index) => {
    setLineas(
      lineas.filter((_, i) => i !== index)
    );
  };

  const agregarProductoNuevo = () => {
    setProductosNuevos([
      ...productosNuevos,
      { ...productoNuevoInicial }
    ]);
  };

  const actualizarProductoNuevo = (
    index,
    campo,
    valor
  ) => {
    const nuevos = [...productosNuevos];

    nuevos[index] = {
      ...nuevos[index],
      [campo]: valor
    };

    setProductosNuevos(nuevos);
  };

  const eliminarProductoNuevo = (index) => {
    setProductosNuevos(
      productosNuevos.filter((_, i) => i !== index)
    );
  };

  const cargarSolicitudEnOrden = () => {
    if (!solicitudSeleccionadaId) {
      setError(
        "Selecciona una solicitud aprobada para compra."
      );
      return;
    }

    const solicitudId = Number(solicitudSeleccionadaId);

    const lineasSolicitud = solicitudLineas.filter(
      (linea) =>
        Number(linea.solicitud_id) === solicitudId &&
        linea.solicitud_estado === "aprobada"
    );

    const nuevosSolicitud = solicitudProductosNuevos.filter(
      (producto) =>
        Number(producto.solicitud_id) === solicitudId &&
        producto.solicitud_estado === "aprobada"
    );

    const lineasCargadas = lineasSolicitud
      .filter((linea) => {
        const cantidad = Number(
          linea.cantidad_aprobada ?? linea.cantidad_solicitada
        );
        return Number.isFinite(cantidad) && cantidad > 0;
      })
      .map((linea) => ({
        producto_id: String(linea.producto_id),
        cantidad_solicitada: Number(
          linea.cantidad_aprobada ?? linea.cantidad_solicitada
        ),
        costo_unitario: "",
        solicitud_linea_id: String(linea.id)
      }));

    const nuevosCargados = nuevosSolicitud.map(
      (producto) => ({
        ...productoNuevoInicial,
        nombre: producto.nombre || "",
        descripcion: producto.descripcion || "",
        sku: producto.sku_sugerido || "",
        categoria_id: String(producto.categoria_id || ""),
        unidad_medida: "pieza",
        cantidad_solicitada:
          Number(producto.cantidad_solicitada) || 1,
        solicitud_producto_nuevo_id: String(producto.id),
        solicitud_id: String(producto.solicitud_id),
        destino_ubicacion_nombre:
          producto.destino_ubicacion_nombre || "",
        proveedor_sugerido:
          producto.proveedor_sugerido || "",
        proveedor_link: producto.proveedor_link || "",
        categoria_nombre: producto.categoria_nombre || ""
      })
    );

    setLineas((actuales) => {
      const existentes = actuales.filter(
        (linea) => linea.producto_id
      );

      const idsOrigen = new Set(
        existentes
          .filter((linea) => linea.solicitud_linea_id)
          .map((linea) => Number(linea.solicitud_linea_id))
      );

      const nuevas = lineasCargadas.filter(
        (linea) =>
          !idsOrigen.has(Number(linea.solicitud_linea_id))
      );

      return [...existentes, ...nuevas];
    });

    setProductosNuevos((actuales) => {
      const idsOrigen = new Set(
        actuales
          .filter(
            (producto) =>
              producto.solicitud_producto_nuevo_id
          )
          .map((producto) =>
            Number(producto.solicitud_producto_nuevo_id)
          )
      );

      const nuevos = nuevosCargados.filter(
        (producto) =>
          !idsOrigen.has(
            Number(producto.solicitud_producto_nuevo_id)
          )
      );

      return [...actuales, ...nuevos];
    });

    setError("");
  };

  const limpiarNuevaOrden = () => {
    setProveedorId("");
    setSolicitudSeleccionadaId("");
    setLineas([{ ...lineaInicial }]);
    setProductosNuevos([]);
  };

  const crearOrden = async (event) => {
    event.preventDefault();

    try {
      setGuardando(true);
      setError("");

      if (!proveedorId) {
        setError("Selecciona un proveedor.");
        return;
      }

      const lineasValidas = lineas
        .filter(
          (linea) =>
            linea.producto_id &&
            Number(linea.cantidad_solicitada) > 0
        )
        .map((linea) => ({
          producto_id: Number(linea.producto_id),
          cantidad_solicitada: Number(
            linea.cantidad_solicitada
          ),
          costo_unitario:
            linea.costo_unitario === ""
              ? null
              : Number(linea.costo_unitario),
          solicitud_linea_id:
            linea.solicitud_linea_id
              ? Number(linea.solicitud_linea_id)
              : null
        }));

      const nuevosValidos = productosNuevos.map(
        (producto) => ({
          nombre: producto.nombre.trim(),
          descripcion: producto.descripcion.trim(),
          sku: producto.sku.trim(),
          categoria_id: Number(producto.categoria_id),
          unidad_medida: producto.unidad_medida.trim(),
          cantidad_solicitada: Number(
            producto.cantidad_solicitada
          ),
          costo_unitario:
            producto.costo_unitario === ""
              ? null
              : Number(producto.costo_unitario),
          solicitud_producto_nuevo_id:
            producto.solicitud_producto_nuevo_id
              ? Number(
                  producto.solicitud_producto_nuevo_id
                )
              : null
        })
      );

      if (
        lineasValidas.length === 0 &&
        nuevosValidos.length === 0
      ) {
        setError(
          "Agrega al menos un producto existente o un producto nuevo."
        );
        return;
      }

      const nuevoInvalido = nuevosValidos.find(
        (producto) =>
          !producto.nombre ||
          !producto.sku ||
          !producto.categoria_id ||
          !producto.unidad_medida ||
          !Number.isFinite(producto.cantidad_solicitada) ||
          producto.cantidad_solicitada <= 0
      );

      if (nuevoInvalido) {
        setError(
          "Completa nombre, SKU, categoría, unidad y cantidad de todos los productos nuevos."
        );
        return;
      }

      await api.post("/compras", {
        proveedor_id: Number(proveedorId),
        lineas: lineasValidas,
        productos_nuevos: nuevosValidos
      });

      setMostrarNueva(false);
      limpiarNuevaOrden();
      await cargarDatos();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible crear la orden"
      );
    } finally {
      setGuardando(false);
    }
  };

  const verDetalle = async (id) => {
    try {
      setError("");
      const response = await api.get(`/compras/${id}`);
      setDetalle(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar la orden"
      );
    }
  };

  const enviarOrden = async (id) => {
    try {
      setGuardando(true);
      setError("");
      await api.patch(`/compras/${id}/enviar`);
      await cargarDatos();
      await verDetalle(id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible enviar la orden"
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirRecepcion = () => {
    if (!detalle) {
      return;
    }

    const cantidades = {};

    detalle.lineas.forEach((linea) => {
      const pendiente =
        Number(linea.cantidad_solicitada) -
        Number(linea.cantidad_recibida);

      if (pendiente > 0) {
        cantidades[linea.id] = "";
      }
    });

    setCantidadesRecepcion(cantidades);
    setMostrarRecepcion(true);
  };

  const actualizarRecepcion = (lineaId, valor) => {
    setCantidadesRecepcion((actual) => ({
      ...actual,
      [lineaId]: valor
    }));
  };

  const recibirCompra = async (event) => {
    event.preventDefault();

    if (!detalle) {
      return;
    }

    const lineasRecibidas = detalle.lineas
      .map((linea) => {
        const pendiente =
          Number(linea.cantidad_solicitada) -
          Number(linea.cantidad_recibida);

        const cantidad = Number(
          cantidadesRecepcion[linea.id] || 0
        );

        return {
          linea_id: linea.id,
          cantidad_recibida: cantidad,
          pendiente
        };
      })
      .filter(
        (linea) => linea.cantidad_recibida > 0
      );

    if (lineasRecibidas.length === 0) {
      setError(
        "Captura al menos una cantidad recibida mayor a cero."
      );
      return;
    }

    const invalida = lineasRecibidas.find(
      (linea) =>
        !Number.isFinite(linea.cantidad_recibida) ||
        linea.cantidad_recibida <= 0 ||
        linea.cantidad_recibida > linea.pendiente
    );

    if (invalida) {
      setError(
        "La cantidad recibida no puede superar lo pendiente."
      );
      return;
    }

    try {
      setGuardando(true);
      setError("");

      await api.patch(
        `/compras/${detalle.orden.id}/recibir`,
        {
          lineas: lineasRecibidas.map(
            ({ linea_id, cantidad_recibida }) => ({
              linea_id,
              cantidad_recibida
            })
          )
        }
      );

      setMostrarRecepcion(false);
      setCantidadesRecepcion({});
      await cargarDatos();
      await verDetalle(detalle.orden.id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible registrar la recepción"
      );
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando compras...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Compras</h1>
          <p>
            Órdenes de compra del almacén Central.
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

          <button
            className="primary-button icon-button"
            onClick={() => {
              limpiarNuevaOrden();
              setError("");
              setMostrarNueva(true);
            }}
          >
            <Plus size={18} />
            Nueva orden
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="content-card">
        {ordenes.length === 0 ? (
          <div className="empty-state">
            No hay órdenes de compra.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Proveedor</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Creada por</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {ordenes.map((orden) => (
                  <tr key={orden.id}>
                    <td>#{orden.id}</td>
                    <td>{orden.proveedor_nombre}</td>
                    <td>
                      <strong>
                        {orden.origen || "Reorden Central"}
                      </strong>
                    </td>
                    <td>
                      <span className="status neutral">
                        {orden.estado}
                      </span>
                    </td>
                    <td>
                      {orden.creado_por_usuario_nombre}
                    </td>
                    <td>
                      {new Date(
                        orden.created_at
                      ).toLocaleDateString("es-MX")}
                    </td>
                    <td>
                      <button
                        className="table-action"
                        onClick={() => verDetalle(orden.id)}
                      >
                        <Eye size={17} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
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
                <h2>Nueva orden de compra</h2>
                <p>
                  Compra para reorden de Central, solicitud de Equipo Interno o producto extraordinario de Sucursal.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  if (guardando) {
                    return;
                  }

                  setMostrarNueva(false);
                  setError("");
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={crearOrden}>
              <div className="form-group">
                <label>Proveedor</label>
                <select
                  className="form-control"
                  value={proveedorId}
                  onChange={(event) =>
                    setProveedorId(event.target.value)
                  }
                  required
                >
                  <option value="">Seleccionar...</option>
                  {proveedores
                    .filter(
                      (proveedor) =>
                        proveedor.activo !== false
                    )
                    .map((proveedor) => (
                      <option
                        key={proveedor.id}
                        value={proveedor.id}
                      >
                        {proveedor.nombre}
                      </option>
                    ))}
                </select>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  padding: "14px",
                  border: "1px solid rgba(128,128,128,0.25)",
                  borderRadius: "10px"
                }}
              >
                <h3>Solicitud para compra</h3>
                <p
                  style={{
                    marginTop: "4px",
                    opacity: 0.75
                  }}
                >
                  Selecciona una solicitud aprobada para cargar automáticamente sus productos existentes y productos nuevos.
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px, 1fr) auto",
                    gap: "10px",
                    alignItems: "end"
                  }}
                >
                  <div className="form-group">
                    <label>Solicitud aprobada</label>
                    <select
                      className="form-control"
                      value={solicitudSeleccionadaId}
                      onChange={(event) =>
                        setSolicitudSeleccionadaId(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Seleccionar...
                      </option>

                      {solicitudesDisponiblesCompra.map(
                        (solicitud) => (
                          <option
                            key={solicitud.id}
                            value={solicitud.id}
                          >
                            Solicitud #{solicitud.id} — {solicitud.destino_ubicacion_nombre || "Equipo Interno"}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={cargarSolicitudEnOrden}
                  >
                    Cargar solicitud
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: "22px",
                  marginBottom: "10px"
                }}
              >
                <h3>Productos existentes</h3>
                <p
                  style={{
                    marginTop: "4px",
                    opacity: 0.75
                  }}
                >
                  Los productos privados de Equipo Interno solo pueden comprarse cuando están vinculados a su solicitud aprobada.
                </p>
              </div>

              {lineas.length === 0 ? (
                <div className="empty-state">
                  No hay productos existentes agregados.
                </div>
              ) : (
                <div className="modal-lines">
                  {lineas.map((linea, index) => {
                    const solicitudesProducto =
                      solicitudesPorProducto(
                        linea.producto_id
                      );

                    return (
                      <div
                        key={`linea-${index}`}
                        style={{
                          border:
                            "1px solid rgba(128,128,128,0.25)",
                          borderRadius: "10px",
                          padding: "14px",
                          marginBottom: "14px"
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: "10px"
                          }}
                        >
                          <div className="form-group">
                            <label>Producto</label>
                            <select
                              className="form-control"
                              value={linea.producto_id}
                              onChange={(event) =>
                                actualizarLinea(
                                  index,
                                  "producto_id",
                                  event.target.value
                                )
                              }
                            >
                              <option value="">
                                Seleccionar...
                              </option>

                              {productosCompra.map(
                                (producto) => (
                                  <option
                                    key={producto.id}
                                    value={producto.id}
                                  >
                                    {producto.nombre}
                                    {producto.sku
                                      ? ` (${producto.sku})`
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Cantidad pedida</label>
                            <input
                              className="form-control"
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={
                                linea.cantidad_solicitada
                              }
                              onChange={(event) =>
                                actualizarLinea(
                                  index,
                                  "cantidad_solicitada",
                                  event.target.value
                                )
                              }
                            />
                          </div>

                          <div className="form-group">
                            <label>Costo unitario</label>
                            <input
                              className="form-control"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Opcional"
                              value={linea.costo_unitario}
                              onChange={(event) =>
                                actualizarLinea(
                                  index,
                                  "costo_unitario",
                                  event.target.value
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Origen de esta línea</label>
                          <select
                            className="form-control"
                            value={linea.solicitud_linea_id}
                            onChange={(event) =>
                              actualizarLinea(
                                index,
                                "solicitud_linea_id",
                                event.target.value
                              )
                            }
                          >
                            <option value="">
                              Reorden propio de Central
                            </option>

                            {solicitudesProducto.map(
                              (solicitudLinea) => (
                                <option
                                  key={solicitudLinea.id}
                                  value={solicitudLinea.id}
                                >
                                  Solicitud #{solicitudLinea.solicitud_id} — {solicitudLinea.destino_ubicacion_nombre || "Destino"} — Aprobada: {solicitudLinea.cantidad_aprobada ?? solicitudLinea.cantidad_solicitada}
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            eliminarLinea(index)
                          }
                        >
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                className="text-button"
                onClick={agregarLinea}
              >
                + Agregar producto existente
              </button>

              <div
                style={{
                  marginTop: "30px",
                  marginBottom: "10px"
                }}
              >
                <h3>Productos nuevos</h3>
                <p
                  style={{
                    marginTop: "4px",
                    opacity: 0.75
                  }}
                >
                  Los productos nuevos cargados desde una solicitud conservan el vínculo, proveedor sugerido, link y SKU sugerido.
                </p>
              </div>

              {productosNuevos.length === 0 ? (
                <div className="empty-state">
                  No hay productos nuevos agregados.
                </div>
              ) : (
                <div className="modal-lines">
                  {productosNuevos.map(
                    (producto, index) => {
                      const vinculado = Boolean(
                        producto.solicitud_producto_nuevo_id
                      );

                      return (
                        <div
                          key={`nuevo-${index}`}
                          style={{
                            border:
                              "1px solid rgba(128,128,128,0.25)",
                            borderRadius: "10px",
                            padding: "14px",
                            marginBottom: "14px"
                          }}
                        >
                          {vinculado && (
                            <div
                              style={{
                                marginBottom: "14px",
                                padding: "10px",
                                borderRadius: "8px",
                                background:
                                  "rgba(128,128,128,0.08)"
                              }}
                            >
                              <strong>
                                Solicitud #{producto.solicitud_id}
                              </strong>
                              <div>
                                Destino: {producto.destino_ubicacion_nombre || "Equipo Interno"}
                              </div>
                              {producto.proveedor_sugerido && (
                                <div>
                                  Proveedor sugerido: {producto.proveedor_sugerido}
                                </div>
                              )}
                              {producto.proveedor_link && (
                                <div>
                                  Link: {" "}
                                  <a
                                    href={producto.proveedor_link}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Abrir
                                  </a>
                                </div>
                              )}
                            </div>
                          )}

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(180px, 1fr))",
                              gap: "10px"
                            }}
                          >
                            <div className="form-group">
                              <label>Nombre</label>
                              <input
                                className="form-control"
                                type="text"
                                value={producto.nombre}
                                onChange={(event) =>
                                  actualizarProductoNuevo(
                                    index,
                                    "nombre",
                                    event.target.value
                                  )
                                }
                                disabled={vinculado}
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label>SKU</label>
                              <input
                                className="form-control"
                                type="text"
                                value={producto.sku}
                                onChange={(event) =>
                                  actualizarProductoNuevo(
                                    index,
                                    "sku",
                                    event.target.value
                                  )
                                }
                                placeholder={
                                  vinculado
                                    ? "Confirma o captura el SKU"
                                    : "SKU"
                                }
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label>Categoría</label>
                              {vinculado ? (
                                <input
                                  className="form-control"
                                  type="text"
                                  value={
                                    producto.categoria_nombre ||
                                    "Categoría de la solicitud"
                                  }
                                  disabled
                                />
                              ) : (
                                <select
                                  className="form-control"
                                  value={producto.categoria_id}
                                  onChange={(event) =>
                                    actualizarProductoNuevo(
                                      index,
                                      "categoria_id",
                                      event.target.value
                                    )
                                  }
                                  required
                                >
                                  <option value="">
                                    Seleccionar...
                                  </option>

                                  {categoriasCentral.map(
                                    (categoria) => (
                                      <option
                                        key={categoria.id}
                                        value={categoria.id}
                                      >
                                        {categoria.nombre}
                                      </option>
                                    )
                                  )}
                                </select>
                              )}
                            </div>

                            <div className="form-group">
                              <label>Unidad</label>
                              <input
                                className="form-control"
                                type="text"
                                value={producto.unidad_medida}
                                onChange={(event) =>
                                  actualizarProductoNuevo(
                                    index,
                                    "unidad_medida",
                                    event.target.value
                                  )
                                }
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label>Cantidad</label>
                              <input
                                className="form-control"
                                type="number"
                                min="0.01"
                                step="0.01"
                                max={
                                  vinculado
                                    ? producto.cantidad_solicitada
                                    : undefined
                                }
                                value={
                                  producto.cantidad_solicitada
                                }
                                onChange={(event) =>
                                  actualizarProductoNuevo(
                                    index,
                                    "cantidad_solicitada",
                                    event.target.value
                                  )
                                }
                                required
                              />
                            </div>

                            <div className="form-group">
                              <label>Costo unitario</label>
                              <input
                                className="form-control"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Opcional"
                                value={
                                  producto.costo_unitario
                                }
                                onChange={(event) =>
                                  actualizarProductoNuevo(
                                    index,
                                    "costo_unitario",
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>Descripción</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={producto.descripcion}
                              onChange={(event) =>
                                actualizarProductoNuevo(
                                  index,
                                  "descripcion",
                                  event.target.value
                                )
                              }
                              disabled={vinculado}
                            />
                          </div>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() =>
                              eliminarProductoNuevo(index)
                            }
                          >
                            <Trash2 size={16} />
                            Eliminar
                          </button>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              <button
                type="button"
                className="text-button"
                onClick={agregarProductoNuevo}
              >
                + Agregar producto nuevo manual
              </button>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={guardando}
                  onClick={() => {
                    if (guardando) {
                      return;
                    }

                    setMostrarNueva(false);
                    setError("");
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={guardando}
                >
                  {guardando
                    ? "Creando..."
                    : "Crear orden"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarRecepcion && detalle && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>Registrar recepción</h2>
                <p>
                  Orden #{detalle.orden.id}. Captura únicamente lo recibido ahora.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  if (guardando) {
                    return;
                  }

                  setMostrarRecepcion(false);
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={recibirCompra}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Pedido</th>
                      <th>Recibido</th>
                      <th>Pendiente</th>
                      <th>Recibir ahora</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detalle.lineas
                      .filter(
                        (linea) =>
                          Number(linea.cantidad_solicitada) >
                          Number(linea.cantidad_recibida)
                      )
                      .map((linea) => {
                        const pendiente =
                          Number(linea.cantidad_solicitada) -
                          Number(linea.cantidad_recibida);

                        return (
                          <tr key={linea.id}>
                            <td>{linea.producto_nombre}</td>
                            <td>{linea.cantidad_solicitada}</td>
                            <td>{linea.cantidad_recibida}</td>
                            <td>{pendiente}</td>
                            <td>
                              <input
                                className="form-control quantity-input"
                                type="number"
                                min="0"
                                max={pendiente}
                                step="0.01"
                                value={
                                  cantidadesRecepcion[linea.id] ??
                                  ""
                                }
                                onChange={(event) =>
                                  actualizarRecepcion(
                                    linea.id,
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={guardando}
                  onClick={() =>
                    setMostrarRecepcion(false)
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={guardando}
                >
                  {guardando
                    ? "Registrando..."
                    : "Registrar recepción"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalle && !mostrarRecepcion && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>Orden #{detalle.orden.id}</h2>
                <p>{detalle.orden.proveedor_nombre}</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setDetalle(null)}
              >
                ×
              </button>
            </div>

            <div className="shipment-status">
              <ShoppingCart size={20} />
              Estado: <strong>{detalle.orden.estado}</strong>
            </div>

            <div
              style={{
                marginTop: "12px",
                marginBottom: "16px"
              }}
            >
              <strong>Origen: </strong>
              {detalle.orden.origen || "Reorden Central"}
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Origen</th>
                    <th>Pedido</th>
                    <th>Recibido</th>
                    <th>Pendiente</th>
                    <th>Costo unitario</th>
                  </tr>
                </thead>

                <tbody>
                  {detalle.lineas.map((linea) => {
                    const pendiente =
                      Number(linea.cantidad_solicitada) -
                      Number(linea.cantidad_recibida);

                    return (
                      <tr key={linea.id}>
                        <td>
                          {linea.producto_nombre}
                          {linea.sku && (
                            <small className="table-secondary">
                              SKU: {linea.sku}
                            </small>
                          )}
                        </td>

                        <td>
                          {linea.solicitud_id ? (
                            <>
                              <strong>
                                Solicitud #{linea.solicitud_id}
                              </strong>
                              <small className="table-secondary">
                                Destino: {linea.destino_ubicacion_nombre || "—"}
                              </small>
                              {linea.solicitud_producto_nuevo_id && (
                                <small className="table-secondary">
                                  Producto nuevo solicitado #{linea.solicitud_producto_nuevo_id}
                                </small>
                              )}
                            </>
                          ) : (
                            "Reorden Central"
                          )}
                        </td>

                        <td>{linea.cantidad_solicitada}</td>
                        <td>{linea.cantidad_recibida}</td>
                        <td>{pendiente}</td>
                        <td>
                          {linea.costo_unitario !== null &&
                          linea.costo_unitario !== undefined
                            ? `$${Number(
                                linea.costo_unitario
                              ).toLocaleString("es-MX")}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              {detalle.orden.estado === "borrador" && (
                <button
                  className="primary-button"
                  disabled={guardando}
                  onClick={() =>
                    enviarOrden(detalle.orden.id)
                  }
                >
                  Enviar orden
                </button>
              )}

              {["enviada", "parcial"].includes(
                detalle.orden.estado
              ) && (
                <button
                  className="primary-button"
                  disabled={guardando}
                  onClick={abrirRecepcion}
                >
                  Registrar recepción
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compras;
