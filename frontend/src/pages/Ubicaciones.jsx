import { useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  MapPin,
  Pencil,
  Power,
  PowerOff
} from "lucide-react";

import api from "../services/api";

const formularioInicial = {
  nombre: "",
  tipo: "sucursal",
  puede_solicitar_a_nombre_de_otra: false
};

const Ubicaciones = () => {
  const [ubicaciones, setUbicaciones] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  const [mostrarModal, setMostrarModal] =
    useState(false);

  const [modoEdicion, setModoEdicion] =
    useState(false);

  const [ubicacionEditando, setUbicacionEditando] =
    useState(null);

  const [guardando, setGuardando] =
    useState(false);

  const [form, setForm] =
    useState(formularioInicial);

  useEffect(() => {
    cargarUbicaciones();
  }, []);

  const cargarUbicaciones = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get("/ubicaciones");

      setUbicaciones(
        response.data || []
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar las ubicaciones"
      );
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNueva = () => {
    setError("");
    setMensaje("");
    setModoEdicion(false);
    setUbicacionEditando(null);
    setForm(formularioInicial);
    setMostrarModal(true);
  };

  const abrirModalEditar = (ubicacion) => {
    setError("");
    setMensaje("");
    setModoEdicion(true);
    setUbicacionEditando(ubicacion);

    setForm({
      nombre: ubicacion.nombre || "",
      tipo: ubicacion.tipo || "sucursal",
      puede_solicitar_a_nombre_de_otra:
        Boolean(
          ubicacion.puede_solicitar_a_nombre_de_otra
        )
    });

    setMostrarModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setMostrarModal(false);
    setModoEdicion(false);
    setUbicacionEditando(null);
    setForm(formularioInicial);
  };

  const manejarCambio = (event) => {
    const {
      name,
      value,
      type,
      checked
    } = event.target;

    setForm((anterior) => ({
      ...anterior,
      [name]:
        type === "checkbox"
          ? checked
          : value
    }));
  };

  const guardarUbicacion = async (
    event
  ) => {
    event.preventDefault();

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        puede_solicitar_a_nombre_de_otra:
          form.tipo === "equipo_interno"
            ? form.puede_solicitar_a_nombre_de_otra
            : false
      };

      if (modoEdicion) {
        await api.put(
          `/ubicaciones/${ubicacionEditando.id}`,
          payload
        );

        setMensaje(
          "Ubicación actualizada correctamente."
        );
      } else {
        await api.post(
          "/ubicaciones",
          payload
        );

        setMensaje(
          "Ubicación creada correctamente."
        );
      }

      cerrarModal();
      await cargarUbicaciones();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible guardar la ubicación"
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (
    ubicacion
  ) => {
    const estaActiva =
      ubicacion.estado === "activa" ||
      (
        !ubicacion.estado &&
        ubicacion.activo === true
      );

    const nuevoEstado =
      !estaActiva;

    let accion = "";

    if (ubicacion.estado === "pendiente") {
      accion = "activar";
    } else {
      accion =
        nuevoEstado
          ? "activar"
          : "desactivar";
    }

    const confirmar =
      window.confirm(
        `¿Deseas ${accion} la ubicación "${ubicacion.nombre}"?`
      );

    if (!confirmar) return;

    try {
      setError("");
      setMensaje("");

      await api.patch(
        `/ubicaciones/${ubicacion.id}/estado`,
        {
          activo: nuevoEstado
        }
      );

      setMensaje(
        nuevoEstado
          ? "Ubicación activada correctamente."
          : "Ubicación desactivada correctamente."
      );

      await cargarUbicaciones();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cambiar el estado de la ubicación"
      );
    }
  };

  const obtenerTipo = (tipo) => {
    switch (tipo) {
      case "central":
        return "Central";

      case "sucursal":
        return "Sucursal";

      case "equipo_interno":
        return "Equipo Interno";

      default:
        return tipo;
    }
  };

  const obtenerEstado = (ubicacion) => {
    if (ubicacion.estado === "pendiente") {
      return {
        texto: "Pendiente",
        clase: "status neutral"
      };
    }

    if (
      ubicacion.estado === "inactiva" ||
      ubicacion.activo === false
    ) {
      return {
        texto: "Inactiva",
        clase: "status danger"
      };
    }

    return {
      texto: "Activa",
      clase: "status success"
    };
  };

  const puedeActivar = (ubicacion) => {
    return (
      ubicacion.estado === "pendiente" ||
      ubicacion.estado === "inactiva" ||
      ubicacion.activo === false
    );
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando ubicaciones...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Ubicaciones</h1>

          <p>
            Administración de Central,
            sucursales y equipos internos.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={cargarUbicaciones}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button
            className="primary-button icon-button"
            onClick={abrirModalNueva}
          >
            <Plus size={18} />
            Nueva ubicación
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="success-message page-error">
          {mensaje}
        </div>
      )}

      <section className="content-card">
        {ubicaciones.length === 0 ? (
          <div className="empty-state">
            <MapPin size={36} />

            <p>
              No hay ubicaciones registradas.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Ubicación</th>
                  <th>Tipo</th>
                  <th>
                    Solicitudes a nombre de otra
                  </th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {ubicaciones.map(
                  (ubicacion) => {
                    const estado =
                      obtenerEstado(ubicacion);

                    const activar =
                      puedeActivar(ubicacion);

                    return (
                      <tr key={ubicacion.id}>
                        <td>
                          <strong>
                            {ubicacion.nombre}
                          </strong>

                          <small className="table-secondary">
                            ID: {ubicacion.id}
                          </small>
                        </td>

                        <td>
                          {obtenerTipo(
                            ubicacion.tipo
                          )}
                        </td>

                        <td>
                          {ubicacion
                            .puede_solicitar_a_nombre_de_otra
                            ? "Sí"
                            : "No"}
                        </td>

                        <td>
                          <span
                            className={
                              estado.clase
                            }
                          >
                            {estado.texto}
                          </span>
                        </td>

                        <td>
                          <div className="table-actions">
                            <button
                              className="table-action"
                              onClick={() =>
                                abrirModalEditar(
                                  ubicacion
                                )
                              }
                            >
                              <Pencil
                                size={17}
                              />
                              Editar
                            </button>

                            <button
                              className={
                                activar
                                  ? "table-action"
                                  : "table-action danger-text"
                              }
                              onClick={() =>
                                cambiarEstado(
                                  ubicacion
                                )
                              }
                            >
                              {activar ? (
                                <>
                                  <Power
                                    size={17}
                                  />

                                  {ubicacion.estado ===
                                  "pendiente"
                                    ? "Activar"
                                    : "Activar"}
                                </>
                              ) : (
                                <>
                                  <PowerOff
                                    size={17}
                                  />
                                  Desactivar
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>
                  {modoEdicion
                    ? "Editar ubicación"
                    : "Nueva ubicación"}
                </h2>

                <p>
                  {modoEdicion
                    ? "Modifica los datos de la ubicación."
                    : "Registra una sucursal o equipo interno."}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={cerrarModal}
                disabled={guardando}
              >
                ×
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={guardarUbicacion}
            >
              <div className="form-group">
                <label>
                  Nombre de la ubicación
                </label>

                <input
                  className="form-control"
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={manejarCambio}
                  placeholder="Ej. Sucursal Querétaro"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Tipo de ubicación
                </label>

                <select
                  className="form-control"
                  name="tipo"
                  value={form.tipo}
                  onChange={manejarCambio}
                  required
                >
                  <option value="sucursal">
                    Sucursal
                  </option>

                  <option value="equipo_interno">
                    Equipo Interno
                  </option>

                  <option value="central">
                    Central
                  </option>
                </select>
              </div>

              {modoEdicion &&
                ubicacionEditando?.estado ===
                  "pendiente" && (
                  <div
                    style={{
                      padding: "12px",
                      marginBottom: "16px",
                      border:
                        "1px solid rgba(128, 128, 128, 0.25)",
                      borderRadius: "8px"
                    }}
                  >
                    <strong>
                      Ubicación pendiente
                    </strong>

                    <small
                      className="table-secondary"
                      style={{
                        display: "block",
                        marginTop: "5px"
                      }}
                    >
                      Esta ubicación fue creada
                      automáticamente desde una
                      solicitud para una franquicia
                      que todavía no estaba dada de
                      alta. Utiliza el botón
                      Activar cuando esté lista para
                      operar.
                    </small>
                  </div>
                )}

              {form.tipo ===
                "equipo_interno" && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      name="puede_solicitar_a_nombre_de_otra"
                      checked={
                        form.puede_solicitar_a_nombre_de_otra
                      }
                      onChange={
                        manejarCambio
                      }
                    />

                    {" "}
                    Puede solicitar a nombre
                    de otra ubicación
                  </label>

                  <small className="table-secondary">
                    Permite que este equipo
                    interno genere solicitudes
                    para una sucursal o
                    franquicia.
                  </small>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cerrarModal}
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : modoEdicion
                      ? "Guardar cambios"
                      : "Crear ubicación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ubicaciones;