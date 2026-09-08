import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Pencil,
  Plus,
  RefreshCw,
  UserX
} from "lucide-react";

import api from "../services/api";

const FORM_INICIAL = {
  nombre: "",
  email: "",
  password: "",
  pin: "",
  rol: "",
  ubicacion_id: "",
  nivel_permiso: ""
};

const Usuarios = () => {
  const [
    usuarios,
    setUsuarios
  ] = useState([]);

  const [
    ubicaciones,
    setUbicaciones
  ] = useState([]);

  const [
    mostrarModal,
    setMostrarModal
  ] = useState(false);

  const [
    modoEdicion,
    setModoEdicion
  ] = useState(false);

  const [
    usuarioEditando,
    setUsuarioEditando
  ] = useState(null);

  const [
    form,
    setForm
  ] = useState(FORM_INICIAL);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    guardando,
    setGuardando
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  const [
    mensaje,
    setMensaje
  ] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const ubicacionSeleccionada =
    useMemo(() => {
      return ubicaciones.find(
        (item) =>
          Number(item.id) ===
          Number(
            form.ubicacion_id
          )
      );
    }, [
      ubicaciones,
      form.ubicacion_id
    ]);

  const tipoUbicacion =
    ubicacionSeleccionada?.tipo ||
    "";

  const esCentral =
    tipoUbicacion === "central";

  const esSucursal =
    tipoUbicacion === "sucursal";

  const esEquipoInterno =
    tipoUbicacion ===
    "equipo_interno";

  const obtenerRolPorTipo = (
    tipo
  ) => {
    if (tipo === "central") {
      return "principal";
    }

    if (tipo === "sucursal") {
      return "sucursal";
    }

    if (
      tipo === "equipo_interno"
    ) {
      return "equipo_interno";
    }

    return "";
  };

  const obtenerNombreRol = (
    rol
  ) => {
    if (rol === "principal") {
      return "Principal";
    }

    if (rol === "sucursal") {
      return "Sucursal";
    }

    if (
      rol === "equipo_interno"
    ) {
      return "Equipo Interno";
    }

    return "-";
  };

  const obtenerNombrePermiso = (
    permiso
  ) => {
    if (
      permiso === "consulta"
    ) {
      return "Consulta";
    }

    if (
      permiso === "operador"
    ) {
      return "Operador";
    }

    if (
      permiso ===
      "aprobador_admin"
    ) {
      return "Aprobador / Administrador";
    }

    return "-";
  };

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

      setUsuarios(
        usuariosRes.data || []
      );

      setUbicaciones(
        ubicacionesRes.data ||
          []
      );
    } catch (error) {
      setError(
        error.response?.data
          ?.message ||
          "No fue posible cargar usuarios"
      );
    } finally {
      setLoading(false);
    }
  };

  const limpiarFormulario =
    () => {
      setForm(
        FORM_INICIAL
      );

      setUsuarioEditando(
        null
      );

      setModoEdicion(false);
    };

  const cerrarModal = () => {
    if (guardando) {
      return;
    }

    setMostrarModal(false);
    limpiarFormulario();
  };

  const abrirNuevoUsuario =
    () => {
      setError("");
      setMensaje("");
      limpiarFormulario();

      setMostrarModal(true);
    };

  const abrirEditarUsuario = (
    usuario
  ) => {
    setError("");
    setMensaje("");

    setModoEdicion(true);

    setUsuarioEditando(
      usuario
    );

    setForm({
      nombre:
        usuario.nombre || "",

      email:
        usuario.email || "",

      password: "",
      pin: "",

      rol:
        usuario.rol || "",

      ubicacion_id:
        String(
          usuario.ubicacion_id ||
            ""
        ),

      nivel_permiso:
        usuario.nivel_permiso ||
        ""
    });

    setMostrarModal(true);
  };

  const cambiarUbicacion = (
    event
  ) => {
    const nuevaUbicacionId =
      event.target.value;

    const ubicacion =
      ubicaciones.find(
        (item) =>
          Number(item.id) ===
          Number(
            nuevaUbicacionId
          )
      );

    const nuevoRol =
      obtenerRolPorTipo(
        ubicacion?.tipo
      );

    setForm((actual) => ({
      ...actual,

      ubicacion_id:
        nuevaUbicacionId,

      rol: nuevoRol,

      nivel_permiso:
        ubicacion?.tipo ===
        "central"
          ? actual
              .nivel_permiso
          : "",

      pin:
        ubicacion?.tipo ===
        "sucursal"
          ? actual.pin
          : "",

      email:
        ubicacion?.tipo ===
        "sucursal"
          ? ""
          : actual.email,

      password:
        ubicacion?.tipo ===
        "sucursal"
          ? ""
          : actual.password
    }));
  };

  const construirPayload =
    () => {
      const payload = {
        nombre:
          form.nombre.trim(),

        ubicacion_id:
          Number(
            form.ubicacion_id
          ),

        rol:
          form.rol
      };

      if (esSucursal) {
        if (form.pin) {
          payload.pin =
            form.pin;
        }
      } else {
        payload.email =
          form.email.trim();

        if (form.password) {
          payload.password =
            form.password;
        }
      }

      if (esCentral) {
        payload.nivel_permiso =
          form.nivel_permiso;
      }

      return payload;
    };

  const validarFormulario =
    () => {
      if (
        !form.nombre.trim()
      ) {
        setError(
          "El nombre es obligatorio"
        );

        return false;
      }

      if (
        !form.ubicacion_id
      ) {
        setError(
          "Selecciona una ubicación"
        );

        return false;
      }

      if (!form.rol) {
        setError(
          "No fue posible determinar el rol de la ubicación"
        );

        return false;
      }

      if (esCentral) {
        if (
          !form.nivel_permiso
        ) {
          setError(
            "Selecciona el nivel de permiso"
          );

          return false;
        }
      }

      if (esSucursal) {
        if (
          !modoEdicion &&
          !/^\d{4,6}$/.test(
            form.pin
          )
        ) {
          setError(
            "El PIN debe contener entre 4 y 6 dígitos"
          );

          return false;
        }

        if (
          modoEdicion &&
          form.pin &&
          !/^\d{4,6}$/.test(
            form.pin
          )
        ) {
          setError(
            "El nuevo PIN debe contener entre 4 y 6 dígitos"
          );

          return false;
        }
      }

      if (
        esCentral ||
        esEquipoInterno
      ) {
        if (
          !form.email.trim()
        ) {
          setError(
            "El correo es obligatorio"
          );

          return false;
        }

        if (
          !modoEdicion &&
          !form.password
        ) {
          setError(
            "La contraseña es obligatoria"
          );

          return false;
        }
      }

      return true;
    };

  const guardarUsuario =
    async (event) => {
      event.preventDefault();

      setError("");
      setMensaje("");

      if (
        !validarFormulario()
      ) {
        return;
      }

      try {
        setGuardando(true);

        const payload =
          construirPayload();

        if (
          modoEdicion &&
          usuarioEditando
        ) {
          await api.patch(
            `/usuarios/${usuarioEditando.id}`,
            payload
          );

          setMensaje(
            "Usuario actualizado correctamente"
          );
        } else {
          await api.post(
            "/usuarios",
            payload
          );

          setMensaje(
            "Usuario creado correctamente"
          );
        }

        setMostrarModal(false);
        limpiarFormulario();

        await cargarDatos();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible guardar el usuario"
        );
      } finally {
        setGuardando(false);
      }
    };

  const desactivarUsuario =
    async (id) => {
      const confirmar =
        window.confirm(
          "¿Deseas desactivar este usuario?"
        );

      if (!confirmar) {
        return;
      }

      try {
        setError("");
        setMensaje("");

        await api.patch(
          `/usuarios/${id}/desactivar`
        );

        setMensaje(
          "Usuario desactivado correctamente"
        );

        await cargarDatos();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
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
          <h1>
            Usuarios
          </h1>

          <p>
            Administración de
            usuarios, ubicaciones y
            permisos.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={
              cargarDatos
            }
          >
            <RefreshCw
              size={18}
            />

            Actualizar
          </button>

          <button
            className="primary-button icon-button"
            type="button"
            onClick={
              abrirNuevoUsuario
            }
          >
            <Plus
              size={18}
            />

            Nuevo usuario
          </button>
        </div>
      </header>

      {mensaje && (
        <div className="success-message page-error">
          {mensaje}
        </div>
      )}

      {error &&
        !mostrarModal && (
          <div className="error-message page-error">
            {error}
          </div>
        )}

      <section className="content-card">
        {usuarios.length === 0 ? (
          <div className="empty-state">
            No hay usuarios
            registrados.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    Usuario
                  </th>

                  <th>
                    Rol
                  </th>

                  <th>
                    Ubicación
                  </th>

                  <th>
                    Permiso
                  </th>

                  <th>
                    Estado
                  </th>

                  <th>
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody>
                {usuarios.map(
                  (usuario) => (
                    <tr
                      key={
                        usuario.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            usuario.nombre
                          }
                        </strong>

                        <small className="table-secondary">
                          {usuario.email ||
                            "Acceso PIN"}
                        </small>
                      </td>

                      <td>
                        {obtenerNombreRol(
                          usuario.rol
                        )}
                      </td>

                      <td>
                        {
                          usuario.ubicacion_nombre
                        }
                      </td>

                      <td>
                        {obtenerNombrePermiso(
                          usuario.nivel_permiso
                        )}
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
                        <div
                          style={{
                            display:
                              "flex",
                            gap: "12px",
                            alignItems:
                              "center",
                            flexWrap:
                              "wrap"
                          }}
                        >
                          <button
                            type="button"
                            className="table-action"
                            onClick={() =>
                              abrirEditarUsuario(
                                usuario
                              )
                            }
                          >
                            <Pencil
                              size={
                                17
                              }
                            />

                            Editar
                          </button>

                          {usuario.activo ? (
                            <button
                              type="button"
                              className="table-action danger-text"
                              onClick={() =>
                                desactivarUsuario(
                                  usuario.id
                                )
                              }
                            >
                              <UserX
                                size={
                                  17
                                }
                              />

                              Desactivar
                            </button>
                          ) : (
                            "-"
                          )}
                        </div>
                      </td>
                    </tr>
                  )
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
                    ? "Editar usuario"
                    : "Nuevo usuario"}
                </h2>

                <p>
                  {modoEdicion
                    ? "Actualiza ubicación, permisos o credenciales."
                    : "Define ubicación y acceso."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarModal
                }
              >
                ×
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={
                guardarUsuario
              }
            >
              <div className="form-group">
                <label>
                  Nombre
                </label>

                <input
                  className="form-control"
                  value={
                    form.nombre
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      nombre:
                        event
                          .target
                          .value
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Ubicación
                </label>

                <select
                  className="form-control"
                  value={
                    form.ubicacion_id
                  }
                  onChange={
                    cambiarUbicacion
                  }
                  required
                >
                  <option value="">
                    Seleccionar...
                  </option>

                  {ubicaciones
                    .filter(
                      (item) =>
                        item.activo !==
                        false
                    )
                    .map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {
                            item.nombre
                          }
                        </option>
                      )
                    )}
                </select>
              </div>

              {ubicacionSeleccionada && (
                <div className="form-group">
                  <label>
                    Rol
                  </label>

                  <input
                    className="form-control"
                    value={obtenerNombreRol(
                      form.rol
                    )}
                    readOnly
                  />
                </div>
              )}

              {esCentral && (
                <div className="form-group">
                  <label>
                    Nivel de permiso
                  </label>

                  <select
                    className="form-control"
                    value={
                      form.nivel_permiso
                    }
                    onChange={(
                      event
                    ) =>
                      setForm({
                        ...form,
                        nivel_permiso:
                          event
                            .target
                            .value
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
                      Operador de
                      solicitudes
                    </option>

                    <option value="aprobador_admin">
                      Aprobador /
                      Administrador
                    </option>
                  </select>
                </div>
              )}

              {esSucursal && (
                <div className="form-group">
                  <label>
                    {modoEdicion
                      ? "Nuevo PIN (opcional)"
                      : "PIN (4–6 dígitos)"}
                  </label>

                  <input
                    className="form-control"
                    type="password"
                    inputMode="numeric"
                    minLength={
                      modoEdicion
                        ? undefined
                        : 4
                    }
                    maxLength="6"
                    value={
                      form.pin
                    }
                    onChange={(
                      event
                    ) => {
                      const valor =
                        event.target.value.replace(
                          /\D/g,
                          ""
                        );

                      setForm({
                        ...form,
                        pin: valor
                      });
                    }}
                    placeholder={
                      modoEdicion
                        ? "Dejar vacío para conservar el PIN"
                        : "4 a 6 dígitos"
                    }
                    required={
                      !modoEdicion
                    }
                  />
                </div>
              )}

              {(esCentral ||
                esEquipoInterno) && (
                <>
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
                            event
                              .target
                              .value
                        })
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {modoEdicion
                        ? "Nueva contraseña (opcional)"
                        : "Contraseña"}
                    </label>

                    <input
                      className="form-control"
                      type="password"
                      value={
                        form.password
                      }
                      onChange={(
                        event
                      ) =>
                        setForm({
                          ...form,
                          password:
                            event
                              .target
                              .value
                        })
                      }
                      placeholder={
                        modoEdicion
                          ? "Dejar vacío para conservarla"
                          : ""
                      }
                      required={
                        !modoEdicion
                      }
                    />
                  </div>
                </>
              )}

              {!form.ubicacion_id && (
                <p
                  style={{
                    fontSize:
                      "13px",
                    opacity: 0.7
                  }}
                >
                  Selecciona primero
                  una ubicación. El
                  formulario adaptará
                  automáticamente el
                  rol, permisos y tipo
                  de credencial.
                </p>
              )}

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

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
                  className="primary-button"
                  disabled={
                    guardando
                  }
                >
                  {guardando
                    ? "Guardando..."
                    : modoEdicion
                    ? "Guardar cambios"
                    : "Crear usuario"}
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