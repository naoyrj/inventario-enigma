import { useEffect, useState } from "react";
import {
  BarChart3,
  Search,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import api from "../services/api";

const Reportes = () => {
  const [consumo, setConsumo] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [kardex, setKardex] = useState([]);

  // ==============================
  // FILTROS DE CONSUMO
  // ==============================

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // ==============================
  // FILTROS DE KARDEX
  // ==============================

  const [kardexNombre, setKardexNombre] = useState("");
  const [kardexSku, setKardexSku] = useState("");
  const [kardexProveedor, setKardexProveedor] = useState("");
  const [kardexDesde, setKardexDesde] = useState("");
  const [kardexHasta, setKardexHasta] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingKardex, setLoadingKardex] = useState(false);

  const [error, setError] = useState("");

  // ==============================
  // CARGAR REPORTES
  // ==============================

  useEffect(() => {
    cargarReportes();
  }, []);

  const cargarReportes = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        alertasRes,
        consumoRes,
        solicitudesRes
      ] = await Promise.all([
        api.get("/reportes/alertas"),
        api.get("/reportes/consumo"),
        api.get("/reportes/solicitudes")
      ]);

      setAlertas(alertasRes.data.alertas || []);
      setConsumo(consumoRes.data.consumo || []);
      setSolicitudes(solicitudesRes.data || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar los reportes"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // FILTRAR CONSUMO
  // ==============================

  const filtrarConsumo = async () => {
    try {
      setError("");

      const params = new URLSearchParams();

      if (desde) {
        params.append("desde", desde);
      }

      if (hasta) {
        params.append("hasta", hasta);
      }

      const query = params.toString();

      const response = await api.get(
        `/reportes/consumo${query ? `?${query}` : ""}`
      );

      setConsumo(response.data.consumo || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible filtrar el consumo"
      );
    }
  };

  // ==============================
  // BUSCAR KARDEX
  // ==============================

  const buscarKardex = async () => {
    try {
      setLoadingKardex(true);
      setError("");

      const params = new URLSearchParams();

      if (kardexNombre.trim()) {
        params.append(
          "nombre",
          kardexNombre.trim()
        );
      }

      if (kardexSku.trim()) {
        params.append(
          "sku",
          kardexSku.trim()
        );
      }

      if (kardexProveedor.trim()) {
        params.append(
          "proveedor",
          kardexProveedor.trim()
        );
      }

      if (kardexDesde) {
        params.append(
          "desde",
          kardexDesde
        );
      }

      if (kardexHasta) {
        params.append(
          "hasta",
          kardexHasta
        );
      }

      const query = params.toString();

      const response = await api.get(
        `/reportes/kardex${query ? `?${query}` : ""}`
      );

      setKardex(response.data || []);
    } catch (error) {
      setKardex([]);

      setError(
        error.response?.data?.message ||
          "No fue posible cargar el Kardex"
      );
    } finally {
      setLoadingKardex(false);
    }
  };

  // ==============================
  // LIMPIAR FILTROS KARDEX
  // ==============================

  const limpiarFiltrosKardex = () => {
    setKardexNombre("");
    setKardexSku("");
    setKardexProveedor("");
    setKardexDesde("");
    setKardexHasta("");
    setKardex([]);
    setError("");
  };

  // ==============================
  // FORMATO DE FECHA
  // ==============================

  const formatearFechaHora = (fecha) => {
    if (!fecha) {
      return "—";
    }

    return new Date(fecha).toLocaleString(
      "es-MX"
    );
  };

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return "—";
    }

    return new Date(fecha).toLocaleDateString(
      "es-MX"
    );
  };

  // ==============================
  // LOADING INICIAL
  // ==============================

  if (loading) {
    return (
      <div className="page-loading">
        Cargando reportes...
      </div>
    );
  }

  // ==============================
  // RENDER
  // ==============================

  return (
    <div>
      {/* =========================================
          ENCABEZADO
      ========================================= */}

      <header className="page-header">
        <div>
          <h1>Reportes</h1>

          <p>
            Inventario, consumo, alertas y
            movimientos.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={cargarReportes}
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

      {/* =========================================
          ERROR GENERAL
      ========================================= */}

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      {/* =========================================
          ALERTAS + CONSUMO
      ========================================= */}

      <section className="report-grid">

        {/* =======================================
            ALERTAS
        ======================================= */}

        <div className="content-card">
          <div className="section-heading">
            <div>
              <h2>Alertas de stock</h2>

              <p>
                Productos por debajo del punto
                de reorden.
              </p>
            </div>

            <AlertTriangle size={21} />
          </div>

          {alertas.length === 0 ? (
            <div className="empty-state">
              No hay alertas.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Ubicación</th>
                    <th>Stock</th>
                  </tr>
                </thead>

                <tbody>
                  {alertas.map((item) => (
                    <tr
                      key={`${item.ubicacion_id}-${item.producto_id}`}
                    >
                      <td>
                        {item.producto_nombre}
                      </td>

                      <td>
                        {item.ubicacion_nombre}
                      </td>

                      <td>
                        <span className="status danger">
                          {item.stock_actual}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =======================================
            CONSUMO
        ======================================= */}

        <div className="content-card">
          <div className="section-heading">
            <div>
              <h2>Consumo por periodo</h2>

              <p>
                Salidas registradas en inventario.
              </p>
            </div>

            <BarChart3 size={21} />
          </div>

          <div className="report-filters">
            <input
              type="date"
              className="form-control"
              value={desde}
              onChange={(e) =>
                setDesde(e.target.value)
              }
            />

            <input
              type="date"
              className="form-control"
              value={hasta}
              onChange={(e) =>
                setHasta(e.target.value)
              }
            />

            <button
              className="primary-button"
              onClick={filtrarConsumo}
            >
              Filtrar
            </button>
          </div>

          {consumo.length === 0 ? (
            <div className="empty-state">
              No hay consumo registrado.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Ubicación</th>
                    <th>Consumo</th>
                  </tr>
                </thead>

                <tbody>
                  {consumo.map((item) => (
                    <tr
                      key={`${item.ubicacion_id}-${item.producto_id}`}
                    >
                      <td>
                        {item.producto_nombre}
                      </td>

                      <td>
                        {item.ubicacion_nombre}
                      </td>

                      <td>
                        {item.consumo_total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* =========================================
          KARDEX
      ========================================= */}

      <section className="content-card report-section">

        <div className="section-heading">
          <div>
            <h2>Kardex</h2>

            <p>
              Consulta el historial de movimientos
              del inventario por producto, SKU,
              proveedor y periodo.
            </p>
          </div>
        </div>

        {/* =======================================
            FILTROS KARDEX
        ======================================= */}

        <div className="report-filters">

          {/* PRODUCTO */}

          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Nombre del producto"
              value={kardexNombre}
              onChange={(e) =>
                setKardexNombre(
                  e.target.value
                )
              }
            />
          </div>

          {/* SKU */}

          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="SKU"
              value={kardexSku}
              onChange={(e) =>
                setKardexSku(
                  e.target.value
                )
              }
            />
          </div>

          {/* PROVEEDOR */}

          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Proveedor"
              value={kardexProveedor}
              onChange={(e) =>
                setKardexProveedor(
                  e.target.value
                )
              }
            />
          </div>

          {/* FECHA DESDE */}

          <input
            type="date"
            className="form-control"
            value={kardexDesde}
            onChange={(e) =>
              setKardexDesde(
                e.target.value
              )
            }
          />

          {/* FECHA HASTA */}

          <input
            type="date"
            className="form-control"
            value={kardexHasta}
            onChange={(e) =>
              setKardexHasta(
                e.target.value
              )
            }
          />

          {/* BUSCAR */}

          <button
            className="primary-button"
            onClick={buscarKardex}
            disabled={loadingKardex}
          >
            <Search size={18} />

            {loadingKardex
              ? "Buscando..."
              : "Buscar"}
          </button>

          {/* LIMPIAR */}

          <button
            className="secondary-button"
            onClick={limpiarFiltrosKardex}
            type="button"
          >
            Limpiar
          </button>
        </div>

        {/* =======================================
            ESTADO DEL KARDEX
        ======================================= */}

        {loadingKardex ? (
          <div className="empty-state">
            Consultando movimientos...
          </div>
        ) : kardex.length === 0 ? (
          <div className="empty-state">
            Utiliza los filtros y presiona
            <strong> Buscar </strong>
            para consultar el Kardex.
          </div>
        ) : (
          <div className="table-container report-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Proveedor</th>
                  <th>Ubicación</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Motivo</th>
                  <th>Responsable</th>
                </tr>
              </thead>

              <tbody>
                {kardex.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {formatearFechaHora(
                        item.created_at
                      )}
                    </td>

                    <td>
                      {item.producto_nombre ||
                        "—"}
                    </td>

                    <td>
                      {item.sku || "—"}
                    </td>

                    <td>
                      {item.proveedor_nombre ||
                        "Sin proveedor"}
                    </td>

                    <td>
                      {item.ubicacion_nombre ||
                        "—"}
                    </td>

                    <td>
                      {item.tipo || "—"}
                    </td>

                    <td>
                      {item.cantidad ?? "—"}
                    </td>

                    <td>
                      {item.motivo || "—"}
                    </td>

                    <td>
                      {item.usuario_nombre ||
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =========================================
          HISTORIAL DE SOLICITUDES
      ========================================= */}

      <section className="content-card report-section">

        <div className="section-heading">
          <div>
            <h2>Historial de solicitudes</h2>

            <p>
              Estados y ubicaciones relacionadas.
            </p>
          </div>
        </div>

        {solicitudes.length === 0 ? (
          <div className="empty-state">
            No hay solicitudes registradas.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Solicitante</th>
                  <th>Destino</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>

              <tbody>
                {solicitudes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      #{item.id}
                    </td>

                    <td>
                      {
                        item.solicitante_ubicacion_nombre
                      }
                    </td>

                    <td>
                      {
                        item.destino_ubicacion_nombre
                      }
                    </td>

                    <td>
                      <span className="status neutral">
                        {item.estado}
                      </span>
                    </td>

                    <td>
                      {formatearFecha(
                        item.created_at
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Reportes;