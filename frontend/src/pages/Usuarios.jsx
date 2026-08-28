import { useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  UserX,
  Users as UsersIcon
} from "lucide-react";
import api from "../services/api";

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [mostrarModal, setMostrarModal] =
    useState(false);

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
    pin: "",
    rol: "equipo_interno",
    ubicacion_id: "",
    nivel_permiso: ""
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        usuariosRes,
        ubicacionesRes
      ] = await Promise.all([
        api.get("/usuarios"),
        api.get("/ubicaciones")
      ]);

      setUsuarios(usuariosRes.data || []);
      setUbicaciones(
        ubicacionesRes.data || []
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar usuarios"
      );
    } finally {
      setLoading(false);
    }
  };

  const crearUsuario = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        nombre: form.nombre,
        rol: form.rol,
        ubicacion_id: Number(
          form.ubicacion_id
        )
      };

      if (form.rol === "sucursal") {
        payload.pin = form.pin;
      } else {
        payload.email = form.email;
        payload.password =
          form.password;
      }

      if (form.rol === "principal") {
        payload.nivel_permiso =
          form.nivel_permiso;
      }

      await api.post("/usuarios", payload);

      setMostrarModal(false);

      setForm({
        nombre: "",
        email: "",
        password: "",
        pin: "",
        rol: "equipo_interno",
        ubicacion_id: "",
        nivel_permiso: ""
      });

      await cargarDatos();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible crear el usuario"
      );
    }
  };

  const desactivarUsuario = async (id) => {
    const confirmar = window.confirm(
      "¿Deseas desactivar este usuario?"
    );

    if (!confirmar) return;

    try {
      await api.patch(
        `/usuarios/${id}/desactivar`
      );

      await cargarDatos();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible desactivar el usuario"
      );
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando usuarios...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>
            Administración de usuarios,
            ubicaciones y permisos.
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
            onClick={() =>
              setMostrarModal(true)
            }
          >
            <Plus size={18} />
            Nuevo usuario
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="content-card">
        {usuarios.length === 0 ? (
          <div className="empty-state">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Ubicación</th>
                  <th>Permiso</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id}>
                    <td>
                      <strong>
                        {usuario.nombre}
                      </strong>

                      <small className="table-secondary">
                        {usuario.email || "Acceso PIN"}
                      </small>
                    </td>

                    <td>{usuario.rol}</td>

                    <td>
                      {usuario.ubicacion_nombre}
                    </td>

                    <td>
                      {usuario.nivel_permiso ||
                        "-"}
                    </td>

                    <td>
                      <span
                        className={
                          usuario.activo
                            ? "status success"
                            : "status danger"
                        }
                      >
                        {usuario.activo
                          ? "Activo"
                          : "Inactivo"}
                      </span>
                    </td>

                    <td>
                      {usuario.activo ? (
                        <button
                          className="table-action danger-text"
                          onClick={() =>
                            desactivarUsuario(
                              usuario.id
                            )
                          }
                        >
                          <UserX size={17} />
                          Desactivar
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
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
                <h2>Nuevo usuario</h2>
                <p>
                  Define rol, ubicación y acceso.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setMostrarModal(false)
                }
              >
                ×
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={crearUsuario}
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
                <label>Rol</label>

                <select
                  className="form-control"
                  value={form.rol}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      rol: e.target.value
                    })
                  }
                >
                  <option value="principal">
                    Principal
                  </option>

                  <option value="sucursal">
                    Sucursal
                  </option>

                  <option value="equipo_interno">
                    Equipo Interno
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label>Ubicación</label>

                <select
                  className="form-control"
                  value={form.ubicacion_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ubicacion_id:
                        e.target.value
                    })
                  }
                  required
                >
                  <option value="">
                    Seleccionar...
                  </option>

                  {ubicaciones.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {form.rol === "sucursal" ? (
                <div className="form-group">
                  <label>PIN (4–6 dígitos)</label>

                  <input
                    className="form-control"
                    type="password"
                    inputMode="numeric"
                    maxLength="6"
                    value={form.pin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pin: e.target.value
                      })
                    }
                    required
                  />
                </div>
              ) : (
                <>
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
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Contraseña</label>

                    <input
                      className="form-control"
                      type="password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          password:
                            e.target.value
                        })
                      }
                      required
                    />
                  </div>
                </>
              )}

              {form.rol === "principal" && (
                <div className="form-group">
                  <label>
                    Nivel de permiso
                  </label>

                  <select
                    className="form-control"
                    value={
                      form.nivel_permiso
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        nivel_permiso:
                          e.target.value
                      })
                    }
                    required
                  >
                    <option value="">
                      Seleccionar...
                    </option>

                    <option value="consulta">
                      Consulta
                    </option>

                    <option value="operador">
                      Operador
                    </option>

                    <option value="aprobador_admin">
                      Aprobador /
                      Administrador
                    </option>
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setMostrarModal(false)
                  }
                >
                  Cancelar
                </button>

                <button className="primary-button">
                  Crear usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;