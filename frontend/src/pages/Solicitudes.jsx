import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  PackageCheck,
  Truck
} from "lucide-react";
import api from "../services/api";

const Solicitudes = () => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "{}"
  );

  const [solicitudes, setSolicitudes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const [mostrarNueva, setMostrarNueva] = useState(false);

  const [destino, setDestino] = useState(
    usuario.ubicacion_id || ""
  );

  const [lineas, setLineas] = useState([
    {
      producto_id: "",
      cantidad_solicitada: 1
    }
  ]);

  const [seleccionada, setSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

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
        ubicacionesRes
      ] = await Promise.all([
        api.get("/solicitudes"),
        api.get("/productos"),
        api.get("/ubicaciones")
      ]);

      setSolicitudes(
        solicitudesRes.data || []
      );

      setProductos(
        productosRes.data || []
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

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((item) => {
      const texto = busqueda
        .toLowerCase()
        .trim();

      const coincideBusqueda =
        !texto ||
        String(item.id).includes(texto) ||
        item.destino_ubicacion_nombre
          ?.toLowerCase()
          .includes(texto) ||
        item.creado_por_usuario_nombre
          ?.toLowerCase()
          .includes(texto);

      const coincideEstado =
        !estadoFiltro ||
        item.estado === estadoFiltro;

      return (
        coincideBusqueda &&
        coincideEstado
      );
    });
  }, [
    solicitudes,
    busqueda,
    estadoFiltro
  ]);

  const agregarLinea = () => {
    setLineas([
      ...lineas,
      {
        producto_id: "",
        cantidad_solicitada: 1
      }
    ]);
  };

  const eliminarLinea = (index) => {
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
    const nuevas = [...lineas];

    nuevas[index] = {
      ...nuevas[index],
      [campo]: valor
    };

    setLineas(nuevas);
  };

  const crearSolicitud = async (event) => {
    event.preventDefault();

    try {
      setGuardando(true);
      setError("");

      await api.post(
        "/solicitudes",
        {
          destino_ubicacion_id:
            Number(destino),

          lineas: lineas.map(
            (linea) => ({
              producto_id: Number(
                linea.producto_id
              ),

              cantidad_solicitada:
                Number(
                  linea.cantidad_solicitada
                )
            })
          )
        }
      );

      setMostrarNueva(false);

      setLineas([
        {
          producto_id: "",
          cantidad_solicitada: 1
        }
      ]);

      await cargarDatos();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible crear la solicitud"
      );
    } finally {
      setGuardando(false);
    }
  };

  const verDetalle = async (id) => {
    try {
      setError("");

      const response =
        await api.get(
          `/solicitudes/${id}`
        );

      setSeleccionada(id);
      setDetalle(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar el detalle"
      );
    }
  };

  const iniciarRevision = async (id) => {
    try {
      setError("");

      await api.patch(
        `/solicitudes/${id}/revision`
      );

      await cargarDatos();
      await verDetalle(id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible iniciar la revisión"
      );
    }
  };

  const aprobarSolicitud = async () => {
    if (!detalle) return;

    try {
      setGuardando(true);
      setError("");

      const lineasAprobadas =
        detalle.lineas.map(
          (linea) => ({
            linea_id: linea.id,

            cantidad_aprobada:
              Number(
                linea.cantidad_solicitada
              )
          })
        );

      await api.patch(
        `/solicitudes/${seleccionada}/aprobar`,
        {
          lineas: lineasAprobadas
        }
      );

      await cargarDatos();
      await verDetalle(
        seleccionada
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible aprobar la solicitud"
      );
    } finally {
      setGuardando(false);
    }
  };

  const rechazarSolicitud = async () => {
    const motivo = window.prompt(
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
        error.response?.data?.message ||
          "No fue posible rechazar la solicitud"
      );
    } finally {
      setGuardando(false);
    }
  };

  const cerrarSolicitud = async () => {
    const motivo = window.prompt(
      "Motivo del cierre:"
    );

    try {
      setGuardando(true);
      setError("");

      await api.patch(
        `/solicitudes/${seleccionada}/cerrar`,
        {
          motivo: motivo || ""
        }
      );

      await cargarDatos();
      await verDetalle(
        seleccionada
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cerrar la solicitud"
      );
    } finally {
      setGuardando(false);
    }
  };

  const crearEnvio = async () => {
    if (!detalle) return;

    const lineasEnvio =
      detalle.lineas
        .map((linea) => {
          const aprobada =
            Number(
              linea.cantidad_aprobada
            );

          const enviada =
            Number(
              linea.cantidad_enviada_acumulada
            );

          return {
            solicitud_linea_id:
              linea.id,

            cantidad_enviada:
              aprobada - enviada
          };
        })
        .filter(
          (linea) =>
            linea.cantidad_enviada > 0
        );

    if (
      lineasEnvio.length === 0
    ) {
      setError(
        "Esta solicitud no tiene productos pendientes de envío"
      );

      return;
    }

    const confirmar =
      window.confirm(
        "¿Deseas crear el envío con todas las cantidades aprobadas pendientes?"
      );

    if (!confirmar) {
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
                detalle.solicitud.id
              ),

            lineas:
              lineasEnvio
          }
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
        error.response?.data?.message ||
          "No fue posible crear el envío"
      );
    } finally {
      setGuardando(false);
    }
  };

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
            Reabastecimiento entre Central y
            ubicaciones.
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
              onClick={() =>
                setMostrarNueva(true)
              }
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
              onChange={(event) =>
                setBusqueda(
                  event.target.value
                )
              }
            />
          </div>

          <select
            value={estadoFiltro}
            onChange={(event) =>
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
                  <th>Destino</th>
                  <th>Creada por</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {solicitudesFiltradas.map(
                  (item) => (
                    <tr key={item.id}>
                      <td>
                        #{item.id}
                      </td>

                      <td>
                        {
                          item.destino_ubicacion_nombre
                        }
                      </td>

                      <td>
                        {
                          item.creado_por_usuario_nombre
                        }
                      </td>

                      <td>
                        <span className="status neutral">
                          {item.estado}
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
                          <Eye size={17} />
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
                  Selecciona destino y productos.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setMostrarNueva(false)
                }
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

                <select
                  className="form-control"
                  value={destino}
                  onChange={(event) =>
                    setDestino(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Seleccionar...
                  </option>

                  {ubicaciones
                    .filter(
                      (ubicacion) => {
                        if (
                          Number(
                            ubicacion.id
                          ) ===
                          Number(
                            usuario.ubicacion_id
                          )
                        ) {
                          return true;
                        }

                        return (
                          usuario.rol ===
                          "equipo_interno"
                        );
                      }
                    )
                    .map(
                      (ubicacion) => (
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
              </div>

              <div className="modal-lines">
                {lineas.map(
                  (
                    linea,
                    index
                  ) => (
                    <div
                      className="request-line"
                      key={index}
                    >
                      <select
                        className="form-control"
                        value={
                          linea.producto_id
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
                        required
                      >
                        <option value="">
                          Producto...
                        </option>

                        {productos.map(
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
                          linea.cantidad_solicitada
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
                        required
                      />

                      {lineas.length >
                        1 && (
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
                      )}
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                className="text-button"
                onClick={agregarLinea}
              >
                + Agregar producto
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
                >
                  Cancelar
                </button>

                <button
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

      {detalle && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Solicitud #
                  {
                    detalle.solicitud
                      .id
                  }
                </h2>

                <p>
                  Estado:{" "}
                  <strong>
                    {
                      detalle.solicitud
                        .estado
                    }
                  </strong>
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setDetalle(null)
                }
              >
                ×
              </button>
            </div>

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
                    (linea) => (
                      <tr
                        key={
                          linea.id
                        }
                      >
                        <td>
                          {
                            linea.producto_nombre
                          }
                        </td>

                        <td>
                          {
                            linea.cantidad_solicitada
                          }
                        </td>

                        <td>
                          {
                            linea.cantidad_aprobada
                          }
                        </td>

                        <td>
                          {
                            linea.cantidad_enviada_acumulada
                          }
                        </td>

                        <td>
                          {
                            linea.cantidad_recibida_acumulada
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              {puedeRevisar &&
                detalle.solicitud
                  .estado ===
                  "solicitada" && (
                  <button
                    className="secondary-button"
                    onClick={() =>
                      iniciarRevision(
                        detalle.solicitud
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
                detalle.solicitud
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
                        aprobarSolicitud
                      }
                      disabled={
                        guardando
                      }
                    >
                      <CheckCircle2
                        size={17}
                      />

                      {guardando
                        ? "Procesando..."
                        : "Aprobar completa"}
                    </button>
                  </>
                )}

              {puedeRevisar &&
                detalle.solicitud
                  .estado ===
                  "aprobada" &&
                detalle.lineas.some(
                  (linea) =>
                    Number(
                      linea.cantidad_aprobada
                    ) >
                    Number(
                      linea.cantidad_enviada_acumulada
                    )
                ) && (
                  <button
                    className="primary-button icon-button"
                    onClick={
                      crearEnvio
                    }
                    disabled={
                      guardando
                    }
                  >
                    <Truck
                      size={17}
                    />

                    {guardando
                      ? "Creando envío..."
                      : "Crear envío"}
                  </button>
                )}

              {puedeAprobar &&
                [
                  "aprobada",
                  "en_transito",
                  "recibida"
                ].includes(
                  detalle.solicitud
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