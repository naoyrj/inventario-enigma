import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  MapPinned
} from "lucide-react";
import api from "../services/api";

const Dashboard = () => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "{}"
  );

  const [resumen, setResumen] = useState({
    ubicaciones_activas: 0,
    productos_activos: 0,
    alertas_stock_bajo: 0,
    solicitudes: []
  });

  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  const cargarDashboard = async () => {
    try {
      setLoading(true);

      if (usuario.rol === "principal") {
        const [resumenResponse, alertasResponse] =
          await Promise.all([
            api.get("/reportes/resumen"),
            api.get("/reportes/alertas")
          ]);

        setResumen(resumenResponse.data);

        setAlertas(
          alertasResponse.data.alertas || []
        );
      } else {
        const alertasResponse =
          await api.get("/reportes/alertas");

        setAlertas(
          alertasResponse.data.alertas || []
        );

        setResumen((actual) => ({
          ...actual,
          alertas_stock_bajo:
            alertasResponse.data.total_alertas || 0
        }));
      }
    } catch (error) {
      console.error(
        "Error cargando dashboard:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const solicitudesPendientes =
    resumen.solicitudes
      ?.filter((item) =>
        [
          "solicitada",
          "en_revision",
          "aprobada",
          "en_transito"
        ].includes(item.estado)
      )
      .reduce(
        (total, item) =>
          total + Number(item.total),
        0
      ) || 0;

  if (loading) {
    return (
      <div className="page-loading">
        Cargando dashboard...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Bienvenido,{" "}
            <strong>
              {usuario.nombre || "Usuario"}
            </strong>
          </p>
        </div>

        <div className="location-badge">
          {usuario.ubicacion_nombre ||
            "Ubicación"}
        </div>
      </header>

      <section className="stats-grid">
        {usuario.rol === "principal" && (
          <>
            <div className="stat-card">
              <div className="stat-icon">
                <MapPinned size={24} />
              </div>

              <div>
                <span>Ubicaciones</span>
                <strong>
                  {resumen.ubicaciones_activas}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <Boxes size={24} />
              </div>

              <div>
                <span>Productos</span>
                <strong>
                  {resumen.productos_activos}
                </strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <ClipboardList size={24} />
              </div>

              <div>
                <span>Solicitudes abiertas</span>
                <strong>
                  {solicitudesPendientes}
                </strong>
              </div>
            </div>
          </>
        )}

        <div className="stat-card warning-card">
          <div className="stat-icon">
            <AlertTriangle size={24} />
          </div>

          <div>
            <span>Stock bajo</span>
            <strong>
              {resumen.alertas_stock_bajo}
            </strong>
          </div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Alertas de inventario</h2>
            <p>
              Productos por debajo del punto
              de reorden
            </p>
          </div>
        </div>

        {alertas.length === 0 ? (
          <div className="empty-state">
            No hay alertas de stock bajo.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Ubicación</th>
                  <th>Stock</th>
                  <th>Punto reorden</th>
                  <th>Faltante</th>
                </tr>
              </thead>

              <tbody>
                {alertas.slice(0, 8).map(
                  (alerta) => (
                    <tr
                      key={`${alerta.ubicacion_id}-${alerta.producto_id}`}
                    >
                      <td>
                        <strong>
                          {
                            alerta.producto_nombre
                          }
                        </strong>

                        <small className="table-secondary">
                          {alerta.sku}
                        </small>
                      </td>

                      <td>
                        {
                          alerta.ubicacion_nombre
                        }
                      </td>

                      <td>
                        {alerta.stock_actual}{" "}
                        {alerta.unidad_medida}
                      </td>

                      <td>
                        {
                          alerta.punto_reorden
                        }
                      </td>

                      <td>
                        <span className="status danger">
                          {
                            alerta.faltante_para_reorden
                          }
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;