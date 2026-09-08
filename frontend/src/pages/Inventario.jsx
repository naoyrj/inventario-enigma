import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  AlertTriangle,
  Package,
  Search,
  RefreshCw,
  Plus,
  X,
  Boxes,
  PackagePlus,
  SlidersHorizontal
} from "lucide-react";

import api from "../services/api";

const Inventario = () => {
  const [inventario, setInventario] =
    useState([]);

  const [categorias, setCategorias] =
    useState([]);

  const [ubicaciones, setUbicaciones] =
    useState([]);

  const [productos, setProductos] =
    useState([]);

  const [busqueda, setBusqueda] =
    useState("");

  const [categoria, setCategoria] =
    useState("");

  const [ubicacion, setUbicacion] =
    useState("");

  const [
    soloBajoStock,
    setSoloBajoStock
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [mensaje, setMensaje] =
    useState("");

  // ISSUE 10
  const [
    mostrarModal,
    setMostrarModal
  ] = useState(false);

  const [tipoAlta, setTipoAlta] =
    useState("existente");

  const [
    categoriaProductoExistente,
    setCategoriaProductoExistente
  ] = useState("");

  const [
    productoExistenteId,
    setProductoExistenteId
  ] = useState("");

  const [
    cantidadExistente,
    setCantidadExistente
  ] = useState("");

  const [
    nuevoProducto,
    setNuevoProducto
  ] = useState({
    nombre: "",
    descripcion: "",
    sku: "",
    categoria_id: "",
    unidad_medida: "pieza",
    punto_reorden: "",
    cantidad: ""
  });

  // ISSUE 11
  const [
    mostrarAjuste,
    setMostrarAjuste
  ] = useState(false);

  const [
    articuloAjuste,
    setArticuloAjuste
  ] = useState(null);

  const [
    cantidadAjuste,
    setCantidadAjuste
  ] = useState("");

  const [
    motivoAjuste,
    setMotivoAjuste
  ] = useState("");

  const [guardando, setGuardando] =
    useState(false);

  const usuario = JSON.parse(
    localStorage.getItem("usuario") ||
      "{}"
  );

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError("");

      const peticiones = [
        api.get(
          "/reportes/inventario"
        ),
        api.get("/categorias"),
        api.get("/productos")
      ];

      if (
        usuario.rol === "principal"
      ) {
        peticiones.push(
          api.get("/ubicaciones")
        );
      }

      const respuestas =
        await Promise.all(
          peticiones
        );

      setInventario(
        respuestas[0].data || []
      );

      setCategorias(
        respuestas[1].data || []
      );

      setProductos(
        respuestas[2].data || []
      );

      if (
        usuario.rol === "principal"
      ) {
        setUbicaciones(
          respuestas[3].data || []
        );
      }
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data
          ?.message ||
          "No fue posible cargar el inventario"
      );
    } finally {
      setLoading(false);
    }
  };

  const inventarioFiltrado =
    useMemo(() => {
      return inventario.filter(
        (item) => {
          const texto =
            busqueda
              .toLowerCase()
              .trim();

          const coincideBusqueda =
            !texto ||
            item.producto_nombre
              ?.toLowerCase()
              .includes(texto) ||
            item.sku
              ?.toLowerCase()
              .includes(texto);

          const coincideCategoria =
            !categoria ||
            Number(
              item.categoria_id
            ) ===
              Number(categoria);

          const coincideUbicacion =
            !ubicacion ||
            Number(
              item.ubicacion_id
            ) ===
              Number(ubicacion);

          const coincideStock =
            !soloBajoStock ||
            Number(
              item.stock_bajo
            ) === 1;

          return (
            coincideBusqueda &&
            coincideCategoria &&
            coincideUbicacion &&
            coincideStock
          );
        }
      );
    }, [
      inventario,
      busqueda,
      categoria,
      ubicacion,
      soloBajoStock
    ]);

  const categoriasParaAlta =
    useMemo(() => {
      return categorias.filter(
        (item) => {
          if (
            item.tipo === "global"
          ) {
            return true;
          }

          if (
            usuario.rol ===
              "equipo_interno" &&
            item.tipo ===
              "privada" &&
            Number(
              item.ubicacion_propietaria_id
            ) ===
              Number(
                usuario.ubicacion_id
              )
          ) {
            return true;
          }

          return false;
        }
      );
    }, [
      categorias,
      usuario.rol,
      usuario.ubicacion_id
    ]);

  const productosDisponibles =
    useMemo(() => {
      return productos.filter(
        (producto) => {
          if (
            producto.solo_lectura
          ) {
            return false;
          }

          if (
            !categoriaProductoExistente
          ) {
            return true;
          }

          return (
            Number(
              producto.categoria_id
            ) ===
            Number(
              categoriaProductoExistente
            )
          );
        }
      );
    }, [
      productos,
      categoriaProductoExistente
    ]);

  const totalProductos =
    new Set(
      inventario.map(
        (item) => item.producto_id
      )
    ).size;

  const totalUnidades =
    inventario.reduce(
      (total, item) =>
        total +
        Number(item.cantidad || 0),
      0
    );

  const totalAlertas =
    inventario.filter(
      (item) =>
        Number(item.stock_bajo) === 1
    ).length;

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoria("");
    setUbicacion("");
    setSoloBajoStock(false);
  };

  // =======================================================
  // ISSUE 10
  // =======================================================

  const limpiarFormulario = () => {
    setTipoAlta("existente");

    setCategoriaProductoExistente(
      ""
    );

    setProductoExistenteId("");
    setCantidadExistente("");

    setNuevoProducto({
      nombre: "",
      descripcion: "",
      sku: "",
      categoria_id: "",
      unidad_medida: "pieza",
      punto_reorden: "",
      cantidad: ""
    });
  };

  const abrirModal = () => {
    setError("");
    setMensaje("");

    limpiarFormulario();

    setMostrarModal(true);
  };

  const cerrarModal = () => {
    if (guardando) return;

    setMostrarModal(false);
    limpiarFormulario();
  };

  const handleNuevoProducto = (
    event
  ) => {
    const {
      name,
      value
    } = event.target;

    setNuevoProducto(
      (anterior) => ({
        ...anterior,
        [name]: value
      })
    );
  };

  const agregarProductoExistente =
    async (event) => {
      event.preventDefault();

      try {
        setError("");
        setMensaje("");

        if (!productoExistenteId) {
          setError(
            "Selecciona un producto."
          );
          return;
        }

        const cantidadNumero =
          Number(
            cantidadExistente
          );

        if (
          !Number.isFinite(
            cantidadNumero
          ) ||
          cantidadNumero <= 0
        ) {
          setError(
            "La cantidad debe ser mayor a cero."
          );
          return;
        }

        setGuardando(true);

        const response =
          await api.post(
            "/inventario/propio/existente",
            {
              producto_id:
                Number(
                  productoExistenteId
                ),

              cantidad:
                cantidadNumero
            }
          );

        setMostrarModal(false);
        limpiarFormulario();

        setMensaje(
          response.data?.message ||
            "Artículo agregado correctamente."
        );

        await cargarDatos();
      } catch (error) {
        console.error(error);

        setError(
          error.response?.data
            ?.message ||
            "No fue posible agregar el artículo."
        );
      } finally {
        setGuardando(false);
      }
    };

  const agregarProductoNuevo =
    async (event) => {
      event.preventDefault();

      try {
        setError("");
        setMensaje("");

        if (
          !nuevoProducto.nombre.trim()
        ) {
          setError(
            "Escribe el nombre del producto."
          );
          return;
        }

        if (
          !nuevoProducto.categoria_id
        ) {
          setError(
            "Selecciona una categoría."
          );
          return;
        }

        const cantidad =
          Number(
            nuevoProducto.cantidad
          );

        if (
          !Number.isFinite(cantidad) ||
          cantidad <= 0
        ) {
          setError(
            "La cantidad debe ser mayor a cero."
          );
          return;
        }

        const puntoReorden =
          nuevoProducto
            .punto_reorden === ""
            ? 0
            : Number(
                nuevoProducto
                  .punto_reorden
              );

        setGuardando(true);

        const response =
          await api.post(
            "/inventario/propio/nuevo",
            {
              nombre:
                nuevoProducto.nombre.trim(),

              descripcion:
                nuevoProducto.descripcion.trim(),

              sku:
                nuevoProducto.sku.trim(),

              categoria_id:
                Number(
                  nuevoProducto.categoria_id
                ),

              unidad_medida:
                nuevoProducto.unidad_medida.trim(),

              punto_reorden:
                puntoReorden,

              cantidad
            }
          );

        setMostrarModal(false);
        limpiarFormulario();

        setMensaje(
          response.data?.message ||
            "Producto creado correctamente."
        );

        await cargarDatos();
      } catch (error) {
        console.error(error);

        setError(
          error.response?.data
            ?.message ||
            "No fue posible crear el producto."
        );
      } finally {
        setGuardando(false);
      }
    };

  // =======================================================
  // ISSUE 11
  // =======================================================

  const puedeAjustar = (item) => {
    const esPropio =
      Number(item.ubicacion_id) ===
      Number(usuario.ubicacion_id);

    if (esPropio) {
      return true;
    }

    return (
      usuario.rol ===
        "principal" &&
      usuario.nivel_permiso ===
        "aprobador_admin"
    );
  };

  const abrirAjuste = (item) => {
    setError("");
    setMensaje("");

    setArticuloAjuste(item);

    setCantidadAjuste(
      String(item.cantidad)
    );

    setMotivoAjuste("");

    setMostrarAjuste(true);
  };

  const cerrarAjuste = () => {
    if (guardando) return;

    setMostrarAjuste(false);
    setArticuloAjuste(null);
    setCantidadAjuste("");
    setMotivoAjuste("");
  };

  const guardarAjuste =
    async (event) => {
      event.preventDefault();

      if (!articuloAjuste) {
        return;
      }

      const nuevaCantidad =
        Number(cantidadAjuste);

      if (
        !Number.isFinite(
          nuevaCantidad
        ) ||
        nuevaCantidad < 0
      ) {
        setError(
          "La cantidad debe ser mayor o igual a cero."
        );
        return;
      }

      if (!motivoAjuste.trim()) {
        setError(
          "Debes indicar el motivo del ajuste."
        );
        return;
      }

      try {
        setGuardando(true);
        setError("");

        const response =
          await api.patch(
            "/inventario/ajuste",
            {
              producto_id:
                Number(
                  articuloAjuste.producto_id
                ),

              ubicacion_id:
                Number(
                  articuloAjuste.ubicacion_id
                ),

              cantidad_nueva:
                nuevaCantidad,

              motivo:
                motivoAjuste.trim()
            }
          );

        cerrarAjuste();

        setMensaje(
          response.data?.message ||
            "Stock ajustado correctamente."
        );

        await cargarDatos();
      } catch (error) {
        console.error(error);

        setError(
          error.response?.data
            ?.message ||
            "No fue posible ajustar el stock."
        );
      } finally {
        setGuardando(false);
      }
    };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando inventario...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Inventario</h1>

          <p>
            Consulta existencias,
            agrega artículos y realiza
            ajustes de stock.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap"
          }}
        >
          <button
            className="secondary-button"
            onClick={cargarDatos}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button
            className="primary-button"
            onClick={abrirModal}
          >
            <Plus size={18} />
            Agregar artículo
          </button>
        </div>
      </header>

      {error &&
        !mostrarModal &&
        !mostrarAjuste && (
          <div className="error-message page-error">
            {error}
          </div>
        )}

      {mensaje &&
        !mostrarModal &&
        !mostrarAjuste && (
          <div className="success-message page-error">
            {mensaje}
          </div>
        )}

      <section className="inventory-summary">
        <div className="mini-stat">
          <Package size={21} />

          <div>
            <span>Productos</span>
            <strong>
              {totalProductos}
            </strong>
          </div>
        </div>

        <div className="mini-stat">
          <Boxes size={21} />

          <div>
            <span>
              Existencias totales
            </span>

            <strong>
              {totalUnidades.toLocaleString(
                "es-MX"
              )}
            </strong>
          </div>
        </div>

        <div className="mini-stat">
          <AlertTriangle size={21} />

          <div>
            <span>Alertas</span>
            <strong>
              {totalAlertas}
            </strong>
          </div>
        </div>
      </section>

      <section className="content-card">
        <div className="filters-row">
          <div className="search-box">
            <Search size={18} />

            <input
              type="text"
              placeholder="Buscar producto o SKU..."
              value={busqueda}
              onChange={(event) =>
                setBusqueda(
                  event.target.value
                )
              }
            />
          </div>

          <select
            value={categoria}
            onChange={(event) =>
              setCategoria(
                event.target.value
              )
            }
          >
            <option value="">
              Todas las categorías
            </option>

            {categorias.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.id}
                >
                  {item.nombre}
                  {item.tipo ===
                  "privada"
                    ? " (Privada)"
                    : ""}
                </option>
              )
            )}
          </select>

          {usuario.rol ===
            "principal" && (
            <select
              value={ubicacion}
              onChange={(event) =>
                setUbicacion(
                  event.target.value
                )
              }
            >
              <option value="">
                Todas las ubicaciones
              </option>

              {ubicaciones.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.nombre}
                  </option>
                )
              )}
            </select>
          )}

          <label className="stock-filter">
            <input
              type="checkbox"
              checked={soloBajoStock}
              onChange={(event) =>
                setSoloBajoStock(
                  event.target.checked
                )
              }
            />

            Solo stock bajo
          </label>

          <button
            className="text-button"
            onClick={limpiarFiltros}
          >
            Limpiar
          </button>
        </div>

        <div className="results-info">
          Mostrando{" "}
          <strong>
            {
              inventarioFiltrado.length
            }
          </strong>{" "}
          registros
        </div>

        {inventarioFiltrado.length ===
        0 ? (
          <div className="empty-state">
            No hay productos que
            coincidan con los filtros.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Ubicación</th>
                  <th>Existencia</th>
                  <th>
                    Punto reorden
                  </th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {inventarioFiltrado.map(
                  (item) => {
                    const bajoStock =
                      Number(
                        item.stock_bajo
                      ) === 1;

                    return (
                      <tr
                        key={`${item.ubicacion_id}-${item.producto_id}`}
                      >
                        <td>
                          <strong>
                            {
                              item.producto_nombre
                            }
                          </strong>

                          <small className="table-secondary">
                            SKU:{" "}
                            {item.sku}
                          </small>
                        </td>

                        <td>
                          {item.categoria_nombre ||
                            "Sin categoría"}
                        </td>

                        <td>
                          {
                            item.ubicacion_nombre
                          }
                        </td>

                        <td>
                          <strong>
                            {Number(
                              item.cantidad
                            ).toLocaleString(
                              "es-MX"
                            )}
                          </strong>{" "}
                          {
                            item.unidad_medida
                          }
                        </td>

                        <td>
                          {Number(
                            item.punto_reorden ||
                              0
                          ).toLocaleString(
                            "es-MX"
                          )}
                        </td>

                        <td>
                          {bajoStock ? (
                            <span className="status danger">
                              Stock bajo
                            </span>
                          ) : (
                            <span className="status success">
                              Disponible
                            </span>
                          )}
                        </td>

                        <td>
                          {puedeAjustar(
                            item
                          ) ? (
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                abrirAjuste(
                                  item
                                )
                              }
                            >
                              <SlidersHorizontal
                                size={17}
                              />
                              Ajustar
                            </button>
                          ) : (
                            <span className="table-secondary">
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

      {/* ============================================= */}
      {/* ISSUE 10 - AGREGAR ARTÍCULO */}
      {/* ============================================= */}

      {mostrarModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cerrarModal();
            }
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: "720px",
              width:
                "calc(100% - 32px)"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Agregar artículo al
                  stock
                </h2>

                <p>
                  Se agregará
                  directamente a tu
                  ubicación.
                </p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={cerrarModal}
                disabled={guardando}
              >
                <X size={22} />
              </button>
            </div>

            {error && (
              <div className="error-message page-error">
                {error}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "24px",
                flexWrap: "wrap"
              }}
            >
              <button
                type="button"
                className={
                  tipoAlta ===
                  "existente"
                    ? "primary-button"
                    : "secondary-button"
                }
                onClick={() =>
                  setTipoAlta(
                    "existente"
                  )
                }
              >
                <Package size={18} />
                Producto existente
              </button>

              <button
                type="button"
                className={
                  tipoAlta ===
                  "nuevo"
                    ? "primary-button"
                    : "secondary-button"
                }
                onClick={() =>
                  setTipoAlta("nuevo")
                }
              >
                <PackagePlus
                  size={18}
                />
                Producto nuevo
              </button>
            </div>

            {tipoAlta ===
              "existente" && (
              <form
                onSubmit={
                  agregarProductoExistente
                }
              >
                <div className="form-group">
                  <label>
                    Categoría
                  </label>

                  <select
                    value={
                      categoriaProductoExistente
                    }
                    onChange={(
                      event
                    ) => {
                      setCategoriaProductoExistente(
                        event.target
                          .value
                      );

                      setProductoExistenteId(
                        ""
                      );
                    }}
                  >
                    <option value="">
                      Todas las
                      categorías
                    </option>

                    {categoriasParaAlta.map(
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
                          {item.tipo ===
                          "privada"
                            ? " (Privada)"
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Producto
                  </label>

                  <select
                    value={
                      productoExistenteId
                    }
                    onChange={(
                      event
                    ) =>
                      setProductoExistenteId(
                        event.target
                          .value
                      )
                    }
                    required
                  >
                    <option value="">
                      Selecciona un
                      producto
                    </option>

                    {productosDisponibles.map(
                      (producto) => (
                        <option
                          key={
                            producto.id
                          }
                          value={
                            producto.id
                          }
                        >
                          {
                            producto.nombre
                          }
                          {producto.sku
                            ? ` — ${producto.sku}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Cantidad a agregar
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={
                      cantidadExistente
                    }
                    onChange={(
                      event
                    ) =>
                      setCantidadExistente(
                        event.target
                          .value
                      )
                    }
                    required
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: "10px",
                    marginTop: "24px"
                  }}
                >
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
                    <Plus size={18} />

                    {guardando
                      ? "Agregando..."
                      : "Agregar al stock"}
                  </button>
                </div>
              </form>
            )}

            {tipoAlta === "nuevo" && (
              <form
                onSubmit={
                  agregarProductoNuevo
                }
              >
                <div className="form-group">
                  <label>
                    Nombre *
                  </label>

                  <input
                    name="nombre"
                    value={
                      nuevoProducto.nombre
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Descripción
                  </label>

                  <textarea
                    name="descripcion"
                    value={
                      nuevoProducto.descripcion
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>SKU</label>

                  <input
                    name="sku"
                    value={
                      nuevoProducto.sku
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    placeholder="Opcional"
                  />
                </div>

                <div className="form-group">
                  <label>
                    Categoría *
                  </label>

                  <select
                    name="categoria_id"
                    value={
                      nuevoProducto.categoria_id
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    required
                  >
                    <option value="">
                      Selecciona una
                      categoría
                    </option>

                    {categoriasParaAlta.map(
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
                          {item.tipo ===
                          "privada"
                            ? " (Privada)"
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Unidad de medida *
                  </label>

                  <input
                    name="unidad_medida"
                    value={
                      nuevoProducto.unidad_medida
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Punto de reorden
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    name="punto_reorden"
                    value={
                      nuevoProducto.punto_reorden
                    }
                    onChange={
                      handleNuevoProducto
                    }
                  />
                </div>

                <div className="form-group">
                  <label>
                    Cantidad inicial *
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    name="cantidad"
                    value={
                      nuevoProducto.cantidad
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    required
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: "10px",
                    marginTop: "24px"
                  }}
                >
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
                    <PackagePlus
                      size={18}
                    />

                    {guardando
                      ? "Creando..."
                      : "Crear y agregar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* ISSUE 11 - AJUSTE DE STOCK */}
      {/* ============================================= */}

      {mostrarAjuste &&
        articuloAjuste && (
          <div
            className="modal-overlay"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                cerrarAjuste();
              }
            }}
          >
            <div
              className="modal-content"
              style={{
                maxWidth: "560px",
                width:
                  "calc(100% - 32px)"
              }}
            >
              <div className="modal-header">
                <div>
                  <h2>
                    Ajustar stock
                  </h2>

                  <p>
                    Corrección por
                    conteo físico o
                    diferencia de
                    inventario.
                  </p>
                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={
                    cerrarAjuste
                  }
                  disabled={
                    guardando
                  }
                >
                  <X size={22} />
                </button>
              </div>

              {error && (
                <div className="error-message page-error">
                  {error}
                </div>
              )}

              <div className="form-group">
                <label>
                  Producto
                </label>

                <strong>
                  {
                    articuloAjuste.producto_nombre
                  }
                </strong>

                <small className="table-secondary">
                  SKU:{" "}
                  {
                    articuloAjuste.sku
                  }
                </small>
              </div>

              <div className="form-group">
                <label>
                  Ubicación
                </label>

                <strong>
                  {
                    articuloAjuste.ubicacion_nombre
                  }
                </strong>
              </div>

              {Number(
                articuloAjuste.ubicacion_id
              ) !==
                Number(
                  usuario.ubicacion_id
                ) && (
                <div className="error-message page-error">
                  Anulación excepcional
                  de Central sobre otra
                  ubicación.
                </div>
              )}

              <form
                onSubmit={
                  guardarAjuste
                }
              >
                <div className="form-group">
                  <label>
                    Existencia actual
                  </label>

                  <input
                    value={
                      articuloAjuste.cantidad
                    }
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label>
                    Nueva existencia *
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={
                      cantidadAjuste
                    }
                    onChange={(
                      event
                    ) =>
                      setCantidadAjuste(
                        event.target
                          .value
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Motivo del ajuste *
                  </label>

                  <textarea
                    rows="3"
                    value={
                      motivoAjuste
                    }
                    onChange={(
                      event
                    ) =>
                      setMotivoAjuste(
                        event.target
                          .value
                      )
                    }
                    placeholder="Ej. Diferencia detectada durante conteo físico"
                    required
                  />
                </div>

                <small className="table-secondary">
                  Este proceso solamente
                  corrige un artículo que
                  ya existe en el stock.
                  No da de alta productos
                  nuevos.
                </small>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: "10px",
                    marginTop: "24px"
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      cerrarAjuste
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
                    <SlidersHorizontal
                      size={18}
                    />

                    {guardando
                      ? "Guardando..."
                      : "Guardar ajuste"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
};

export default Inventario;