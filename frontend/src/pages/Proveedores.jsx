import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  RefreshCw,
  ExternalLink,
  Pencil
} from "lucide-react";
import api from "../services/api";

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mostrarModal, setMostrarModal] =
    useState(false);

  const [proveedorEditandoId, setProveedorEditandoId] =
    useState(null);

  const [form, setForm] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
    email: "",
    url: ""
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(
        "/proveedores"
      );

      setProveedores(
        response.data || []
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar los proveedores"
      );
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario = () => {
    setForm({
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      url: ""
    });

    setProveedorEditandoId(null);
  };

  const abrirNuevoProveedor = () => {
    setError("");
    limpiarFormulario();
    setMostrarModal(true);
  };

  const abrirEdicionProveedor = (
    proveedor
  ) => {
    setError("");

    setProveedorEditandoId(
      Number(proveedor.id)
    );

    setForm({
      nombre:
        proveedor.nombre || "",
      contacto:
        proveedor.contacto || "",
      telefono:
        proveedor.telefono || "",
      email:
        proveedor.email || "",
      url:
        proveedor.url || ""
    });

    setMostrarModal(true);
  };

  const cerrarModal = () => {
    if (guardando) {
      return;
    }

    setMostrarModal(false);
    setError("");
    limpiarFormulario();
  };

  const guardarProveedor = async (
    event
  ) => {
    event.preventDefault();

    try {
      setGuardando(true);
      setError("");

      const payload = {
        nombre:
          form.nombre.trim(),

        contacto:
          form.contacto.trim() ||
          null,

        telefono:
          form.telefono.trim() ||
          null,

        email:
          form.email.trim() ||
          null,

        url:
          form.url.trim() ||
          null
      };

      if (proveedorEditandoId) {
        await api.put(
          `/proveedores/${proveedorEditandoId}`,
          payload
        );
      } else {
        await api.post(
          "/proveedores",
          payload
        );
      }

      setMostrarModal(false);
      limpiarFormulario();

      await cargarProveedores();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          (
            proveedorEditandoId
              ? "No fue posible actualizar el proveedor"
              : "No fue posible crear el proveedor"
          )
      );
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando proveedores...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>
            Proveedores
          </h1>

          <p>
            Catálogo de proveedores del
            almacén Central.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={
              cargarProveedores
            }
          >
            <RefreshCw size={18} />

            Actualizar
          </button>

          <button
            type="button"
            className="primary-button icon-button"
            onClick={
              abrirNuevoProveedor
            }
          >
            <Plus size={18} />

            Nuevo proveedor
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="content-card">
        {proveedores.length === 0 ? (
          <div className="empty-state">
            No hay proveedores registrados.
          </div>
        ) : (
          <div className="providers-grid">
            {proveedores.map(
              (proveedor) => (
                <div
                  className="provider-card"
                  key={proveedor.id}
                >
                  <div className="provider-icon">
                    <Building2
                      size={24}
                    />
                  </div>

                  <div
                    style={{
                      flex: 1
                    }}
                  >
                    <h3>
                      {proveedor.nombre}
                    </h3>

                    <p>
                      {proveedor.contacto ||
                        "Sin contacto"}
                    </p>

                    <small
                      style={{
                        display: "block"
                      }}
                    >
                      {proveedor.email ||
                        "Sin email"}
                    </small>

                    <small
                      style={{
                        display: "block"
                      }}
                    >
                      {proveedor.telefono ||
                        "Sin teléfono"}
                    </small>

                    {proveedor.url ? (
                      <a
                        href={
                          proveedor.url
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: "6px",
                          marginTop:
                            "8px",
                          wordBreak:
                            "break-word"
                        }}
                      >
                        <ExternalLink
                          size={14}
                        />

                        Visitar proveedor
                      </a>
                    ) : (
                      <small
                        style={{
                          display:
                            "block",
                          marginTop:
                            "8px"
                        }}
                      >
                        Sin URL
                      </small>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection:
                        "column",
                      alignItems:
                        "flex-end",
                      gap: "10px"
                    }}
                  >
                    <span
                      className={
                        proveedor.activo
                          ? "status success"
                          : "status danger"
                      }
                    >
                      {proveedor.activo
                        ? "Activo"
                        : "Inactivo"}
                    </span>

                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        abrirEdicionProveedor(
                          proveedor
                        )
                      }
                    >
                      <Pencil
                        size={16}
                      />

                      Editar
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      {mostrarModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>
                  {proveedorEditandoId
                    ? "Editar proveedor"
                    : "Nuevo proveedor"}
                </h2>

                <p>
                  {proveedorEditandoId
                    ? "Modifica la información del proveedor."
                    : "Registra un proveedor para Central."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarModal
                }
                disabled={
                  guardando
                }
              >
                ×
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={
                guardarProveedor
              }
            >
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label>
                  Nombre
                </label>

                <input
                  className="form-control"
                  type="text"
                  value={
                    form.nombre
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      nombre:
                        event.target
                          .value
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Contacto
                </label>

                <input
                  className="form-control"
                  type="text"
                  value={
                    form.contacto
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      contacto:
                        event.target
                          .value
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  Teléfono
                </label>

                <input
                  className="form-control"
                  type="text"
                  value={
                    form.telefono
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      telefono:
                        event.target
                          .value
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  Email
                </label>

                <input
                  className="form-control"
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      email:
                        event.target
                          .value
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  URL
                </label>

                <input
                  className="form-control"
                  type="url"
                  value={
                    form.url
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      url:
                        event.target
                          .value
                    })
                  }
                  placeholder="https://www.proveedor.com"
                />

                <small
                  style={{
                    opacity: 0.7,
                    marginTop:
                      "5px",
                    display:
                      "block"
                  }}
                >
                  Campo opcional.
                  Debe comenzar con
                  http:// o https://
                </small>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    cerrarModal
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
                    ? proveedorEditandoId
                      ? "Actualizando..."
                      : "Guardando..."
                    : proveedorEditandoId
                      ? "Guardar cambios"
                      : "Guardar proveedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Proveedores;