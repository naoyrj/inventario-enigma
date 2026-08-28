import { useEffect, useState } from "react";
import {
  Eye,
  RefreshCw,
  Send,
  PackageCheck,
  Truck
} from "lucide-react";
import api from "../services/api";

const Envios = () => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "{}"
  );

  const [envios, setEnvios] = useState([]);
  const [detalle, setDetalle] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarEnvios();
  }, []);

  const cargarEnvios = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/envios");

      setEnvios(response.data || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar los envíos"
      );
    } finally {
      setLoading(false);
    }
  };

  const verDetalle = async (id) => {
    try {
      const response = await api.get(
        `/envios/${id}`
      );

      setDetalle(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar el envío"
      );
    }
  };

  const marcarTransito = async (id) => {
    try {
      await api.patch(
        `/envios/${id}/transito`
      );

      await cargarEnvios();
      await verDetalle(id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible despachar el envío"
      );
    }
  };

  const recibirEnvio = async (id) => {
    try {
      await api.patch(
        `/envios/${id}/recibir`
      );

      await cargarEnvios();
      await verDetalle(id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible confirmar la recepción"
      );
    }
  };

  const puedeDespachar =
    usuario.rol === "principal" &&
    ["operador", "aprobador_admin"].includes(
      usuario.nivel_permiso
    );

  if (loading) {
    return (
      <div className="page-loading">
        Cargando envíos...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Envíos</h1>
          <p>
            Seguimiento de despachos y
            recepciones.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={cargarEnvios}
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

      <section className="content-card">
        {envios.length === 0 ? (
          <div className="empty-state">
            No hay envíos registrados.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Solicitud</th>
                  <th>Destino</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {envios.map((envio) => (
                  <tr key={envio.id}>
                    <td>#{envio.id}</td>

                    <td>
                      #{envio.solicitud_id}
                    </td>

                    <td>
                      {
                        envio.destino_ubicacion_nombre
                      }
                    </td>

                    <td>
                      <span className="status neutral">
                        {envio.estado}
                      </span>
                    </td>

                    <td>
                      {new Date(
                        envio.created_at
                      ).toLocaleDateString(
                        "es-MX"
                      )}
                    </td>

                    <td>
                      <button
                        className="table-action"
                        onClick={() =>
                          verDetalle(envio.id)
                        }
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

      {detalle && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Envío #{detalle.envio.id}
                </h2>

                <p>
                  Solicitud #
                  {
                    detalle.envio
                      .solicitud_id
                  }
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

            <div className="shipment-status">
              <Truck size={20} />
              Estado:
              <strong>
                {detalle.envio.estado}
              </strong>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad enviada</th>
                  </tr>
                </thead>

                <tbody>
                  {detalle.lineas.map(
                    (linea) => (
                      <tr key={linea.id}>
                        <td>
                          <strong>
                            {
                              linea.producto_nombre
                            }
                          </strong>

                          <small className="table-secondary">
                            {linea.sku}
                          </small>
                        </td>

                        <td>
                          {
                            linea.cantidad_enviada
                          }{" "}
                          {
                            linea.unidad_medida
                          }
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              {puedeDespachar &&
                detalle.envio.estado ===
                  "preparacion" && (
                  <button
                    className="primary-button icon-button"
                    onClick={() =>
                      marcarTransito(
                        detalle.envio.id
                      )
                    }
                  >
                    <Send size={17} />
                    Marcar en tránsito
                  </button>
                )}

              {detalle.envio.estado ===
                "en_transito" &&
                (usuario.rol ===
                  "principal" ||
                  Number(
                    usuario.ubicacion_id
                  ) ===
                    Number(
                      detalle.envio
                        .destino_ubicacion_id
                    )) && (
                  <button
                    className="primary-button icon-button"
                    onClick={() =>
                      recibirEnvio(
                        detalle.envio.id
                      )
                    }
                  >
                    <PackageCheck size={17} />
                    Confirmar recepción
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Envios;