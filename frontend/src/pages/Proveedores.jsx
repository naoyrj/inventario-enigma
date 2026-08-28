import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  RefreshCw
} from "lucide-react";
import api from "../services/api";

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
    email: ""
  });

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/proveedores");

      setProveedores(response.data || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible cargar los proveedores"
      );
    } finally {
      setLoading(false);
    }
  };

  const crearProveedor = async (event) => {
    event.preventDefault();

    try {
      await api.post("/proveedores", form);

      setForm({
        nombre: "",
        contacto: "",
        telefono: "",
        email: ""
      });

      setMostrarModal(false);

      await cargarProveedores();
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible crear el proveedor"
      );
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
          <h1>Proveedores</h1>
          <p>
            Catálogo de proveedores del almacén Central.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={cargarProveedores}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button
            className="primary-button icon-button"
            onClick={() => setMostrarModal(true)}
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
            {proveedores.map((proveedor) => (
              <div
                className="provider-card"
                key={proveedor.id}
              >
                <div className="provider-icon">
                  <Building2 size={24} />
                </div>

                <div>
                  <h3>{proveedor.nombre}</h3>

                  <p>
                    {proveedor.contacto || "Sin contacto"}
                  </p>

                  <small>
                    {proveedor.email || "Sin email"}
                  </small>

                  <small>
                    {proveedor.telefono || "Sin teléfono"}
                  </small>
                </div>

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
              </div>
            ))}
          </div>
        )}
      </section>

      {mostrarModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Nuevo proveedor</h2>
                <p>
                  Registra un proveedor para Central.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() => setMostrarModal(false)}
              >
                ×
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={crearProveedor}
            >
              <div className="form-group">
                <label>Nombre</label>

                <input
                  className="form-control"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nombre: e.target.value
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Contacto</label>

                <input
                  className="form-control"
                  value={form.contacto}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contacto: e.target.value
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Teléfono</label>

                <input
                  className="form-control"
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefono: e.target.value
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Email</label>

                <input
                  className="form-control"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value
                    })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setMostrarModal(false)}
                >
                  Cancelar
                </button>

                <button className="primary-button">
                  Guardar proveedor
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