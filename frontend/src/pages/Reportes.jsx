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

  const [productoId, setProductoId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const buscarKardex = async () => {
    if (!productoId) return;

    try {
      const response = await api.get(
        `/reportes/kardex/${productoId}`
      );

      setKardex(response.data || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar el Kardex"
      );
    }
  };

  const filtrarConsumo = async () => {
    try {
      const params = new URLSearchParams();

      if (desde) params.append("desde", desde);
      if (hasta) params.append("hasta", hasta);

      const response = await api.get(
        `/reportes/consumo?${params.toString()}`
      );

      setConsumo(response.data.consumo || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible filtrar el consumo"
      );
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando reportes...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Reportes</h1>
          <p>
            Inventario, consumo, alertas y movimientos.
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

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="report-grid">
        <div className="content-card">
          <div className="section-heading">
            <div>
              <h2>Alertas de stock</h2>
              <p>
                Productos por debajo del punto de reorden.
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

      <section className="content-card report-section">
        <div className="section-heading">
          <div>
            <h2>Kardex por producto</h2>
            <p>
              Historial completo de movimientos.
            </p>
          </div>
        </div>

        <div className="kardex-search">
          <div className="search-box">
            <Search size={18} />

            <input
              type="number"
              min="1"
              placeholder="ID del producto"
              value={productoId}
              onChange={(e) =>
                setProductoId(e.target.value)
              }
            />
          </div>

          <button
            className="primary-button"
            onClick={buscarKardex}
          >
            Buscar Kardex
          </button>
        </div>

        {kardex.length > 0 && (
          <div className="table-container report-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
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
                      {new Date(
                        item.created_at
                      ).toLocaleString("es-MX")}
                    </td>

                    <td>
                      {item.producto_nombre}
                    </td>

                    <td>
                      {item.ubicacion_nombre}
                    </td>

                    <td>
                      {item.tipo}
                    </td>

                    <td>
                      {item.cantidad}
                    </td>

                    <td>
                      {item.motivo}
                    </td>

                    <td>
                      {item.usuario_nombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="content-card report-section">
        <div className="section-heading">
          <div>
            <h2>Historial de solicitudes</h2>
            <p>
              Estados y ubicaciones relacionadas.
            </p>
          </div>
        </div>

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
                  <td>#{item.id}</td>

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
                    {new Date(
                      item.created_at
                    ).toLocaleDateString(
                      "es-MX"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Reportes;