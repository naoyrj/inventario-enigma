import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Edit3,
  FolderPlus,
  Lock,
  Power,
  RefreshCw
} from "lucide-react";

import api from "../services/api";

const Categorias = () => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") ||
      "{}"
  );

  const [categorias, setCategorias] =
    useState([]);

  const [
    mostrarModal,
    setMostrarModal
  ] = useState(false);

  const [
    categoriaEditando,
    setCategoriaEditando
  ] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: ""
  });

  const [loading, setLoading] =
    useState(true);

  const [guardando, setGuardando] =
    useState(false);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  const esPrincipal =
    usuario?.rol === "principal";

  const esEquipoInterno =
    usuario?.rol === "equipo_interno";

  const esSucursal =
    usuario?.rol === "sucursal";

  const puedeCrear =
    esPrincipal || esEquipoInterno;

  useEffect(() => {
    cargarCategorias();
  }, []);

  const cargarCategorias = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get("/categorias");

      setCategorias(
        response.data || []
      );
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible cargar las categorías"
      );
    } finally {
      setLoading(false);
    }
  };

  const puedeEditarCategoria = (
    categoria
  ) => {
    if (esPrincipal) {
      return (
        categoria.tipo === "global"
      );
    }

    if (esEquipoInterno) {
      return (
        categoria.tipo ===
          "privada" &&
        Number(
          categoria.ubicacion_propietaria_id
        ) ===
          Number(
            usuario?.ubicacion_id
          )
      );
    }

    return false;
  };

  const abrirNuevaCategoria = () => {
    setCategoriaEditando(null);

    setForm({
      nombre: "",
      descripcion: ""
    });

    setError("");
    setMensaje("");
    setMostrarModal(true);
  };

  const abrirEditarCategoria = (
    categoria
  ) => {
    if (
      !puedeEditarCategoria(
        categoria
      )
    ) {
      return;
    }

    setCategoriaEditando(
      categoria
    );

    setForm({
      nombre:
        categoria.nombre || "",
      descripcion:
        categoria.descripcion || ""
    });

    setError("");
    setMensaje("");
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    if (guardando) {
      return;
    }

    setMostrarModal(false);
    setCategoriaEditando(null);

    setForm({
      nombre: "",
      descripcion: ""
    });

    setError("");
  };

  const guardarCategoria = async (
    event
  ) => {
    event.preventDefault();

    if (!form.nombre.trim()) {
      setError(
        "El nombre de la categoría es obligatorio"
      );

      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const payload = {
        nombre:
          form.nombre.trim(),
        descripcion:
          form.descripcion.trim()
      };

      if (categoriaEditando) {
        await api.put(
          `/categorias/${categoriaEditando.id}`,
          payload
        );

        setMensaje(
          "Categoría actualizada correctamente"
        );
      } else {
        await api.post(
          "/categorias",
          payload
        );

        setMensaje(
          esEquipoInterno
            ? "Categoría privada creada correctamente"
            : "Categoría global creada correctamente"
        );
      }

      setMostrarModal(false);
      setCategoriaEditando(null);

      setForm({
        nombre: "",
        descripcion: ""
      });

      await cargarCategorias();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible guardar la categoría"
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoCategoria =
    async (categoria) => {
      if (
        !puedeEditarCategoria(
          categoria
        )
      ) {
        return;
      }

      const nuevoEstado =
        !categoria.activo;

      const accion =
        nuevoEstado
          ? "activar"
          : "desactivar";

      const confirmar =
        window.confirm(
          `¿Deseas ${accion} la categoría "${categoria.nombre}"?`
        );

      if (!confirmar) {
        return;
      }

      try {
        setError("");
        setMensaje("");

        await api.patch(
          `/categorias/${categoria.id}/estado`,
          {
            activo:
              nuevoEstado
          }
        );

        setMensaje(
          `Categoría ${
            nuevoEstado
              ? "activada"
              : "desactivada"
          } correctamente`
        );

        await cargarCategorias();
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible cambiar el estado de la categoría"
        );
      }
    };

  const categoriasGlobales =
    useMemo(
      () =>
        categorias.filter(
          (categoria) =>
            categoria.tipo ===
            "global"
        ),
      [categorias]
    );

  const categoriasPrivadas =
    useMemo(
      () =>
        categorias.filter(
          (categoria) =>
            categoria.tipo ===
            "privada"
        ),
      [categorias]
    );

  const textoPropietario = (
    categoria
  ) => {
    if (
      categoria.tipo === "global"
    ) {
      return "Central";
    }

    return (
      categoria
        .ubicacion_propietaria_nombre ||
      "-"
    );
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando categorías...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Categorías</h1>

          <p>
            Administración de categorías
            globales y privadas del
            inventario.
          </p>
        </div>

        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={
              cargarCategorias
            }
          >
            <RefreshCw size={18} />
            Actualizar
          </button>

          {puedeCrear && (
            <button
              className="primary-button icon-button"
              onClick={
                abrirNuevaCategoria
              }
            >
              <FolderPlus
                size={18}
              />

              {esEquipoInterno
                ? "Nueva categoría privada"
                : "Nueva categoría global"}
            </button>
          )}
        </div>
      </header>

      {mensaje && (
        <div
          className="success-message"
          style={{
            marginBottom:
              "16px"
          }}
        >
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
        <div
          style={{
            marginBottom: "20px"
          }}
        >
          <h2
            style={{
              marginBottom: "6px"
            }}
          >
            Categorías disponibles
          </h2>

          <p
            style={{
              margin: 0,
              opacity: 0.75
            }}
          >
            {esPrincipal &&
              "Central puede administrar las categorías globales y consultar las categorías privadas en modo de solo lectura."}

            {esEquipoInterno &&
              "Puedes consultar las categorías globales y administrar únicamente las categorías privadas de tu Equipo Interno."}

            {esSucursal &&
              "Puedes consultar las categorías globales disponibles."}
          </p>
        </div>

        {categorias.length ===
        0 ? (
          <div className="empty-state">
            No hay categorías
            disponibles.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>
                    Categoría
                  </th>

                  <th>Tipo</th>

                  <th>
                    Propietario
                  </th>

                  <th>Estado</th>

                  <th>
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {categorias.map(
                  (categoria) => {
                    const puedeEditar =
                      puedeEditarCategoria(
                        categoria
                      );

                    return (
                      <tr
                        key={
                          categoria.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              categoria.nombre
                            }
                          </strong>

                          <small className="table-secondary">
                            {categoria.descripcion ||
                              "Sin descripción"}
                          </small>
                        </td>

                        <td>
                          <span
                            className={
                              categoria.tipo ===
                              "privada"
                                ? "status warning"
                                : "status success"
                            }
                          >
                            {categoria.tipo ===
                              "privada" && (
                              <Lock
                                size={
                                  13
                                }
                                style={{
                                  marginRight:
                                    "4px"
                                }}
                              />
                            )}

                            {categoria.tipo ===
                            "privada"
                              ? "Privada"
                              : "Global"}
                          </span>
                        </td>

                        <td>
                          {textoPropietario(
                            categoria
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              categoria.activo
                                ? "status success"
                                : "status danger"
                            }
                          >
                            {categoria.activo
                              ? "Activa"
                              : "Inactiva"}
                          </span>
                        </td>

                        <td>
                          {puedeEditar ? (
                            <div
                              style={{
                                display:
                                  "flex",
                                gap:
                                  "12px",
                                flexWrap:
                                  "wrap"
                              }}
                            >
                              <button
                                className="table-action"
                                onClick={() =>
                                  abrirEditarCategoria(
                                    categoria
                                  )
                                }
                              >
                                <Edit3
                                  size={
                                    16
                                  }
                                />
                                Editar
                              </button>

                              <button
                                className={
                                  categoria.activo
                                    ? "table-action danger-text"
                                    : "table-action"
                                }
                                onClick={() =>
                                  cambiarEstadoCategoria(
                                    categoria
                                  )
                                }
                              >
                                <Power
                                  size={
                                    16
                                  }
                                />

                                {categoria.activo
                                  ? "Desactivar"
                                  : "Activar"}
                              </button>
                            </div>
                          ) : (
                            <span
                              style={{
                                opacity:
                                  0.65
                              }}
                            >
                              Solo lectura
                            </span>
                          )}
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

      {esPrincipal &&
        categoriasPrivadas.length >
          0 && (
          <section
            className="content-card"
            style={{
              marginTop: "20px"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "flex-start",
                gap: "12px"
              }}
            >
              <Lock size={20} />

              <div>
                <strong>
                  Categorías privadas
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 0 0",
                    opacity: 0.75
                  }}
                >
                  Central puede
                  consultarlas, pero
                  no editarlas,
                  desactivarlas ni
                  cambiar su
                  propietario.
                </p>
              </div>
            </div>
          </section>
        )}

      {esEquipoInterno &&
        categoriasGlobales.length >
          0 && (
          <section
            className="content-card"
            style={{
              marginTop: "20px"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems:
                  "flex-start",
                gap: "12px"
              }}
            >
              <Lock size={20} />

              <div>
                <strong>
                  Categorías globales
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 0 0",
                    opacity: 0.75
                  }}
                >
                  Las categorías
                  globales son
                  administradas por
                  Central. Tu Equipo
                  Interno puede
                  utilizarlas, pero no
                  modificarlas.
                </p>
              </div>
            </div>
          </section>
        )}

      {mostrarModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>
                  {categoriaEditando
                    ? "Editar categoría"
                    : esEquipoInterno
                      ? "Nueva categoría privada"
                      : "Nueva categoría global"}
                </h2>

                <p>
                  {esEquipoInterno
                    ? "Esta categoría será privada y pertenecerá automáticamente a tu Equipo Interno."
                    : "Esta categoría será global y estará disponible para todas las ubicaciones."}
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

            {error && (
              <div
                className="error-message"
                style={{
                  marginBottom:
                    "16px"
                }}
              >
                {error}
              </div>
            )}

            <form
              className="modal-form"
              onSubmit={
                guardarCategoria
              }
            >
              <div className="form-group">
                <label>
                  Nombre
                </label>

                <input
                  className="form-control"
                  type="text"
                  maxLength="100"
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
                  placeholder="Ej. Herramientas especializadas"
                  required
                  disabled={
                    guardando
                  }
                />
              </div>

              <div className="form-group">
                <label>
                  Descripción
                </label>

                <textarea
                  className="form-control"
                  rows="4"
                  maxLength="255"
                  value={
                    form.descripcion
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      descripcion:
                        event.target
                          .value
                    })
                  }
                  placeholder="Describe qué tipo de productos pertenecen a esta categoría"
                  disabled={
                    guardando
                  }
                />
              </div>

              <div
                style={{
                  padding: "12px",
                  borderRadius:
                    "8px",
                  background:
                    "rgba(0, 0, 0, 0.04)"
                }}
              >
                <strong>
                  Tipo:
                </strong>{" "}
                {esEquipoInterno
                  ? "Privada"
                  : "Global"}

                {esEquipoInterno && (
                  <div
                    style={{
                      marginTop:
                        "5px",
                      fontSize:
                        "14px",
                      opacity:
                        0.75
                    }}
                  >
                    La ubicación
                    propietaria se
                    asigna
                    automáticamente
                    desde tu usuario.
                  </div>
                )}
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
                    ? "Guardando..."
                    : categoriaEditando
                      ? "Guardar cambios"
                      : "Crear categoría"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categorias;