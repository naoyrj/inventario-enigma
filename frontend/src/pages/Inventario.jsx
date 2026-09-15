import {
  useEffect,
  useMemo,
  useRef,
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
  Upload,
  FileText,
  Eye,
  Save
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

  const [proveedores, setProveedores] =
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

  const [guardando, setGuardando] =
    useState(false);

  const [importando, setImportando] =
    useState(false);

  const usuario = JSON.parse(
    localStorage.getItem("usuario") ||
      "{}"
  );

  const esPrincipal =
    usuario.rol === "principal";

  // =======================================================
  // AGREGAR ARTÍCULO
  // =======================================================

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

  // =======================================================
  // IMPORTACIÓN CSV
  // =======================================================

  const [
    mostrarImportacion,
    setMostrarImportacion
  ] = useState(false);

  const [
    archivoCsv,
    setArchivoCsv
  ] = useState(null);

  const [
    resultadoImportacion,
    setResultadoImportacion
  ] = useState(null);

  const inputArchivoRef = useRef(null);

  // =======================================================
  // ENI-45 - ESPECIFICACIONES DEL PRODUCTO
  // =======================================================

  const [
    mostrarDetalle,
    setMostrarDetalle
  ] = useState(false);

  const [
    cargandoDetalle,
    setCargandoDetalle
  ] = useState(false);

  const [
    articuloDetalle,
    setArticuloDetalle
  ] = useState(null);

  const [
    detalleOriginal,
    setDetalleOriginal
  ] = useState(null);

  const [
    formularioDetalle,
    setFormularioDetalle
  ] = useState({
    nombre: "",
    descripcion: "",
    existencias: "",
    punto_reorden: "",
    proveedor_id: "",
    sku: "",
    unidad_medida: ""
  });

  const [
    motivoExistencias,
    setMotivoExistencias
  ] = useState("");

  // =======================================================
  // CARGAR DATOS
  // =======================================================

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

      if (esPrincipal) {
        peticiones.push(
          api.get("/ubicaciones")
        );

        peticiones.push(
          api.get("/proveedores")
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

      if (esPrincipal) {
        setUbicaciones(
          respuestas[3].data || []
        );

        setProveedores(
          respuestas[4].data || []
        );
      }
    } catch (errorPeticion) {
      console.error(errorPeticion);

      setError(
        errorPeticion.response?.data
          ?.message ||
          "No fue posible cargar el inventario"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =======================================================
  // FILTROS
  // =======================================================

  const inventarioFiltrado =
    useMemo(() => {
      return inventario.filter(
        (item) => {
          const texto =
            busqueda
              .toLowerCase()
              .trim();

          const nombre =
            item.producto_nombre
              ?.toLowerCase() || "";

          const sku =
            item.sku
              ?.toLowerCase() || "";

          const proveedor =
            item.proveedor_nombre
              ?.toLowerCase() || "";

          const coincideBusqueda =
            !texto ||
            nombre.includes(texto) ||
            sku.includes(texto) ||
            proveedor.includes(texto);

          const coincideCategoria =
            !categoria ||
            Number(
              item.categoria_id
            ) === Number(categoria);

          const coincideUbicacion =
            !ubicacion ||
            Number(
              item.ubicacion_id
            ) === Number(ubicacion);

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
              item
                .ubicacion_propietaria_id
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

  // =======================================================
  // RESUMEN
  // =======================================================

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
  // AGREGAR ARTÍCULO
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
    if (guardando) {
      return;
    }

    setMostrarModal(false);
    limpiarFormulario();
    setError("");
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
      } catch (errorPeticion) {
        console.error(errorPeticion);

        setError(
          errorPeticion.response?.data
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
          !nuevoProducto
            .unidad_medida
            .trim()
        ) {
          setError(
            "Escribe la unidad de medida."
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

        if (
          !Number.isFinite(
            puntoReorden
          ) ||
          puntoReorden < 0
        ) {
          setError(
            "El punto de reorden debe ser mayor o igual a cero."
          );

          return;
        }

        setGuardando(true);

        const response =
          await api.post(
            "/inventario/propio/nuevo",
            {
              nombre:
                nuevoProducto
                  .nombre
                  .trim(),

              descripcion:
                nuevoProducto
                  .descripcion
                  .trim() || null,

              sku:
                nuevoProducto
                  .sku
                  .trim() || null,

              categoria_id:
                nuevoProducto
                  .categoria_id
                  ? Number(
                      nuevoProducto
                        .categoria_id
                    )
                  : null,

              unidad_medida:
                nuevoProducto
                  .unidad_medida
                  .trim(),

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
      } catch (errorPeticion) {
        console.error(errorPeticion);

        setError(
          errorPeticion.response?.data
            ?.message ||
            "No fue posible crear el producto."
        );
      } finally {
        setGuardando(false);
      }
    };

  // =======================================================
  // IMPORTAR CSV
  // =======================================================

  const abrirImportacion = () => {
    setError("");
    setMensaje("");
    setArchivoCsv(null);
    setResultadoImportacion(null);

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value =
        "";
    }

    setMostrarImportacion(true);
  };

  const cerrarImportacion = () => {
    if (importando) {
      return;
    }

    setMostrarImportacion(false);
    setArchivoCsv(null);
    setResultadoImportacion(null);
    setError("");

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value =
        "";
    }
  };

  const seleccionarArchivoCsv = (
    event
  ) => {
    setError("");
    setResultadoImportacion(null);

    const archivo =
      event.target.files?.[0];

    if (!archivo) {
      setArchivoCsv(null);
      return;
    }

    if (
      !archivo.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      setArchivoCsv(null);

      event.target.value = "";

      setError(
        "Selecciona un archivo con extensión .csv."
      );

      return;
    }

    if (
      archivo.size >
      5 * 1024 * 1024
    ) {
      setArchivoCsv(null);

      event.target.value = "";

      setError(
        "El archivo CSV no puede superar los 5 MB."
      );

      return;
    }

    setArchivoCsv(archivo);
  };

  const importarCsv = async (
    event
  ) => {
    event.preventDefault();

    if (!archivoCsv) {
      setError(
        "Selecciona un archivo CSV."
      );

      return;
    }

    try {
      setImportando(true);
      setError("");
      setMensaje("");
      setResultadoImportacion(null);

      const formData =
        new FormData();

      formData.append(
        "archivo",
        archivoCsv
      );

      const response =
        await api.post(
          "/inventario/importar-csv",
          formData
        );

      const datos =
        response.data || {};

      setResultadoImportacion(datos);

      const resumen =
        datos.resumen || {};

      const agregados =
        Number(
          resumen.agregados || 0
        );

      const errores =
        Number(
          resumen.filas_con_error || 0
        );

      if (errores > 0) {
        setMensaje(
          `Importación procesada: ${agregados} fila(s) agregada(s) y ${errores} fila(s) con error.`
        );
      } else {
        setMensaje(
          datos.message ||
            `Importación completada correctamente. ${agregados} fila(s) agregada(s).`
        );
      }

      await cargarDatos();
    } catch (errorPeticion) {
      console.error(errorPeticion);

      setError(
        errorPeticion.response?.data
          ?.message ||
          "No fue posible importar el archivo CSV."
      );
    } finally {
      setImportando(false);
    }
  };

  // =======================================================
  // ENI-45 - VER / EDITAR ESPECIFICACIONES
  // =======================================================

  const obtenerProveedorId = (
    producto
  ) => {
    if (!producto) {
      return "";
    }

    if (producto.proveedor_id) {
      return String(
        producto.proveedor_id
      );
    }

    if (
      Array.isArray(
        producto.proveedor_ids
      ) &&
      producto.proveedor_ids.length >
        0
    ) {
      return String(
        producto.proveedor_ids[0]
      );
    }

    if (
      Array.isArray(
        producto.proveedores
      ) &&
      producto.proveedores.length >
        0
    ) {
      const primerProveedor =
        producto.proveedores[0];

      if (
        typeof primerProveedor ===
        "object"
      ) {
        return String(
          primerProveedor.id ||
            primerProveedor
              .proveedor_id ||
            ""
        );
      }

      return String(
        primerProveedor
      );
    }

    return "";
  };

  const abrirDetalle = async (
    item
  ) => {
    setError("");
    setMensaje("");
    setArticuloDetalle(item);
    setMotivoExistencias("");

    const productoLocal =
      productos.find(
        (producto) =>
          Number(producto.id) ===
          Number(item.producto_id)
      ) || {};

    const datosIniciales = {
      nombre:
        productoLocal.nombre ||
        item.producto_nombre ||
        item.nombre ||
        "",

      descripcion:
        productoLocal.descripcion ||
        item.descripcion ||
        "",

      existencias:
        String(
          item.cantidad ?? 0
        ),

      punto_reorden:
        String(
          productoLocal.punto_reorden ??
            item.punto_reorden ??
            0
        ),

      proveedor_id:
        obtenerProveedorId(
          productoLocal
        ) ||
        obtenerProveedorId(
          item
        ),

      sku:
        productoLocal.sku ||
        item.sku ||
        "",

      unidad_medida:
        productoLocal.unidad_medida ||
        item.unidad_medida ||
        ""
    };

    setFormularioDetalle(
      datosIniciales
    );

    setDetalleOriginal(
      datosIniciales
    );

    setMostrarDetalle(true);
    setCargandoDetalle(true);

    try {
      const response =
        await api.get(
          `/productos/${item.producto_id}`
        );

      const producto =
        response.data?.producto ||
        response.data ||
        {};

      const datosFormulario = {
        nombre:
          producto.nombre ||
          datosIniciales.nombre,

        descripcion:
          producto.descripcion ??
          datosIniciales.descripcion,

        existencias:
          datosIniciales.existencias,

        punto_reorden:
          String(
            producto.punto_reorden ??
              datosIniciales.punto_reorden
          ),

        proveedor_id:
          obtenerProveedorId(
            producto
          ) ||
          datosIniciales.proveedor_id,

        sku:
          producto.sku ||
          datosIniciales.sku,

        unidad_medida:
          producto.unidad_medida ||
          datosIniciales.unidad_medida
      };

      setFormularioDetalle(
        datosFormulario
      );

      setDetalleOriginal(
        datosFormulario
      );
    } catch (errorPeticion) {
      console.error(
        "No fue posible actualizar los datos del producto:",
        errorPeticion
      );
    } finally {
      setCargandoDetalle(false);
    }
  };
  const cerrarDetalle = () => {
    if (guardando) {
      return;
    }

    setMostrarDetalle(false);
    setArticuloDetalle(null);
    setDetalleOriginal(null);

    setFormularioDetalle({
      nombre: "",
      descripcion: "",
      existencias: "",
      punto_reorden: "",
      proveedor_id: "",
      sku: "",
      unidad_medida: ""
    });

    setMotivoExistencias("");
    setError("");
  };

  const handleDetalle = (
    event
  ) => {
    const {
      name,
      value
    } = event.target;

    setFormularioDetalle(
      (anterior) => ({
        ...anterior,
        [name]: value
      })
    );
  };

  const existenciasCambiaron =
    detalleOriginal
      ? Number(
          formularioDetalle
            .existencias
        ) !==
        Number(
          detalleOriginal
            .existencias
        )
      : false;

  const guardarDetalle = async (
    event
  ) => {
    event.preventDefault();

    if (
      !articuloDetalle ||
      !detalleOriginal
    ) {
      return;
    }

    setError("");
    setMensaje("");

    if (
      !formularioDetalle
        .nombre
        .trim()
    ) {
      setError(
        "El nombre es obligatorio."
      );

      return;
    }

    if (
      !formularioDetalle
        .unidad_medida
        .trim()
    ) {
      setError(
        "La unidad de medida es obligatoria."
      );

      return;
    }

    const nuevasExistencias =
      Number(
        formularioDetalle
          .existencias
      );

    if (
      !Number.isFinite(
        nuevasExistencias
      ) ||
      nuevasExistencias < 0
    ) {
      setError(
        "Las existencias deben ser un número mayor o igual a cero."
      );

      return;
    }

    const nuevoPuntoReorden =
      formularioDetalle
        .punto_reorden === ""
        ? 0
        : Number(
            formularioDetalle
              .punto_reorden
          );

    if (
      !Number.isFinite(
        nuevoPuntoReorden
      ) ||
      nuevoPuntoReorden < 0
    ) {
      setError(
        "El punto de reorden debe ser mayor o igual a cero."
      );

      return;
    }

    if (
      existenciasCambiaron &&
      !motivoExistencias.trim()
    ) {
      setError(
        "Debes indicar una justificación para modificar las existencias."
      );

      return;
    }

    try {
      setGuardando(true);

      const proveedorId =
        formularioDetalle
          .proveedor_id
          ? Number(
              formularioDetalle
                .proveedor_id
            )
          : null;

      await api.put(
        `/productos/${articuloDetalle.producto_id}`,
        {
          nombre:
            formularioDetalle
              .nombre
              .trim(),

          descripcion:
            formularioDetalle
              .descripcion
              .trim() || null,

          sku:
            formularioDetalle
              .sku
              .trim() || null,

          unidad_medida:
            formularioDetalle
              .unidad_medida
              .trim(),

          punto_reorden:
            nuevoPuntoReorden,

          categoria_id:
            articuloDetalle
              .categoria_id
              ? Number(
                  articuloDetalle
                    .categoria_id
                )
              : null,

          proveedor_id:
            proveedorId,

          proveedor_ids:
            proveedorId
              ? [proveedorId]
              : [],

          activo: true
        }
      );

      if (existenciasCambiaron) {
        await api.patch(
          "/inventario/ajuste",
          {
            producto_id:
              Number(
                articuloDetalle
                  .producto_id
              ),

            cantidad_nueva:
              nuevasExistencias,

            motivo:
              motivoExistencias
                .trim()
          }
        );
      }

      setMostrarDetalle(false);
      setArticuloDetalle(null);
      setDetalleOriginal(null);
      setMotivoExistencias("");

      setMensaje(
        existenciasCambiaron
          ? "Producto y existencias actualizados correctamente."
          : "Especificaciones del producto actualizadas correctamente."
      );

      await cargarDatos();
    } catch (errorPeticion) {
      console.error(errorPeticion);

      setError(
        errorPeticion.response?.data
          ?.message ||
          "No fue posible actualizar el producto."
      );
    } finally {
      setGuardando(false);
    }
  };

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <div className="page-loading">
        Cargando inventario...
      </div>
    );
  }

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Inventario</h1>

          <p>
            Consulta existencias,
            agrega artículos y administra
            las especificaciones de los
            productos.
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
            type="button"
            className="secondary-button"
            onClick={cargarDatos}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={abrirImportacion}
          >
            <Upload size={18} />
            Importar CSV
          </button>

          <button
            type="button"
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
        !mostrarImportacion &&
        !mostrarDetalle && (
          <div className="error-message page-error">
            {error}
          </div>
        )}

      {mensaje &&
        !mostrarModal &&
        !mostrarImportacion &&
        !mostrarDetalle && (
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
              placeholder="Buscar producto, SKU o proveedor..."
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

          {esPrincipal && (
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
            type="button"
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
                  <th>Proveedor</th>
                  <th>Categoría</th>
                  <th>Ubicación</th>
                  <th>Existencias</th>
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
                            {item.sku ||
                              "Sin SKU"}
                          </small>
                        </td>

                        <td>
                          {item.proveedor_nombre ||
                            "Sin proveedor"}
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
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              abrirDetalle(
                                item
                              )
                            }
                            disabled={
                              cargandoDetalle
                            }
                          >
                            <Eye size={16} />
                            Ver
                          </button>
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
      {/* ENI-45 - ESPECIFICACIONES */}
      {/* ============================================= */}

      {mostrarDetalle &&
        articuloDetalle && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                cerrarDetalle();
              }
            }}
          >
            <div
              className="modal-content"
              style={{
                maxWidth: "760px",
                width:
                  "calc(100% - 32px)",
                maxHeight: "90vh",
                overflowY: "auto"
              }}
            >
              <div className="modal-header">
                <div>
                  <h2>
                    Especificaciones del
                    producto
                  </h2>

                  <p>
                    Consulta y edita los
                    datos del producto.
                  </p>
                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={
                    cerrarDetalle
                  }
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

              <form
                onSubmit={
                  guardarDetalle
                }
              >
                <div className="form-group">
                  <label>
                    Nombre *
                  </label>

                  <input
                    name="nombre"
                    value={
                      formularioDetalle
                        .nombre
                    }
                    onChange={
                      handleDetalle
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
                    rows="3"
                    value={
                      formularioDetalle
                        .descripcion
                    }
                    onChange={
                      handleDetalle
                    }
                    placeholder="Descripción opcional"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px"
                  }}
                >
                  <div className="form-group">
                    <label>
                      Existencias *
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="any"
                      name="existencias"
                      value={
                        formularioDetalle
                          .existencias
                      }
                      onChange={
                        handleDetalle
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
                        formularioDetalle
                          .punto_reorden
                      }
                      onChange={
                        handleDetalle
                      }
                    />
                  </div>
                </div>

                {existenciasCambiaron && (
                  <div className="form-group">
                    <label>
                      Justificación del
                      cambio de existencias *
                    </label>

                    <textarea
                      rows="3"
                      value={
                        motivoExistencias
                      }
                      onChange={(
                        event
                      ) =>
                        setMotivoExistencias(
                          event.target
                            .value
                        )
                      }
                      placeholder="Ej. Corrección después de conteo físico"
                      required
                    />

                    <small className="table-secondary">
                      La justificación
                      solamente es obligatoria
                      porque modificaste las
                      existencias.
                    </small>
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px"
                  }}
                >
                  <div className="form-group">
                    <label>
                      Proveedor
                    </label>

                    <select
                      name="proveedor_id"
                      value={
                        formularioDetalle
                          .proveedor_id
                      }
                      onChange={
                        handleDetalle
                      }
                    >
                      <option value="">
                        Sin proveedor
                      </option>

                      {proveedores.map(
                        (proveedor) => (
                          <option
                            key={
                              proveedor.id
                            }
                            value={
                              proveedor.id
                            }
                          >
                            {
                              proveedor.nombre
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      SKU
                    </label>

                    <input
                      name="sku"
                      value={
                        formularioDetalle
                          .sku
                      }
                      onChange={
                        handleDetalle
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Unidad de medida *
                  </label>

                  <input
                    name="unidad_medida"
                    value={
                      formularioDetalle
                        .unidad_medida
                    }
                    onChange={
                      handleDetalle
                    }
                    required
                  />
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: "10px",
                    marginTop: "8px"
                  }}
                >
                  <small className="table-secondary">
                    Campos obligatorios:
                    Nombre, Existencias y
                    Unidad de medida.
                    Descripción, Punto de
                    reorden, Proveedor y SKU
                    son opcionales.
                  </small>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: "10px",
                    marginTop: "24px",
                    flexWrap: "wrap"
                  }}
                >
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      cerrarDetalle
                    }
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={guardando}
                  >
                    <Save size={18} />

                    {guardando
                      ? "Guardando..."
                      : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* ============================================= */}
      {/* IMPORTAR CSV */}
      {/* ============================================= */}

      {mostrarImportacion && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cerrarImportacion();
            }
          }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: "650px",
              width:
                "calc(100% - 32px)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Importar inventario CSV
                </h2>

                <p>
                  Agrega varios productos
                  directamente al inventario
                  de tu ubicación.
                </p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={
                  cerrarImportacion
                }
                disabled={importando}
              >
                <X size={22} />
              </button>
            </div>

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

            <div
              style={{
                padding: "16px",
                border:
                  "1px dashed #cbd5e1",
                borderRadius: "10px",
                marginBottom: "20px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "12px"
                }}
              >
                <FileText size={24} />

                <strong>
                  Archivo CSV
                </strong>
              </div>

              <input
                ref={inputArchivoRef}
                type="file"
                accept=".csv,text/csv"
                onChange={
                  seleccionarArchivoCsv
                }
                disabled={importando}
              />

              {archivoCsv && (
                <div
                  className="table-secondary"
                  style={{
                    marginTop: "12px"
                  }}
                >
                  Archivo seleccionado:{" "}
                  <strong>
                    {archivoCsv.name}
                  </strong>
                </div>
              )}
            </div>

            <div
              style={{
                marginBottom: "20px"
              }}
            >
              <strong>
                Formato esperado
              </strong>

              <p
                className="table-secondary"
                style={{
                  marginTop: "8px"
                }}
              >
                Las columnas obligatorias
                son nombre, unidad_medida y
                cantidad. SKU, descripción,
                categoria_id y
                punto_reorden son
                opcionales.
              </p>

              <div
                style={{
                  overflowX: "auto",
                  marginTop: "12px"
                }}
              >
                <table>
                  <thead>
                    <tr>
                      <th>nombre</th>
                      <th>
                        unidad_medida
                      </th>
                      <th>cantidad</th>
                      <th>sku</th>
                      <th>
                        categoria_id
                      </th>
                      <th>
                        punto_reorden
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>
                        Mouse Logitech
                      </td>

                      <td>
                        pieza
                      </td>

                      <td>10</td>

                      <td>
                        Opcional
                      </td>

                      <td>
                        Opcional
                      </td>

                      <td>
                        Opcional
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {resultadoImportacion && (
              <div
                style={{
                  marginTop: "20px",
                  marginBottom: "20px"
                }}
              >
                <h3>
                  Resultado de la
                  importación
                </h3>

                <div
                  className="inventory-summary"
                  style={{
                    marginTop: "14px"
                  }}
                >
                  <div className="mini-stat">
                    <FileText
                      size={20}
                    />

                    <div>
                      <span>
                        Filas
                      </span>

                      <strong>
                        {resultadoImportacion
                          .resumen
                          ?.total_filas ||
                          0}
                      </strong>
                    </div>
                  </div>

                  <div className="mini-stat">
                    <PackagePlus
                      size={20}
                    />

                    <div>
                      <span>
                        Agregadas
                      </span>

                      <strong>
                        {resultadoImportacion
                          .resumen
                          ?.agregados ||
                          0}
                      </strong>
                    </div>
                  </div>

                  <div className="mini-stat">
                    <AlertTriangle
                      size={20}
                    />

                    <div>
                      <span>
                        Errores
                      </span>

                      <strong>
                        {resultadoImportacion
                          .resumen
                          ?.filas_con_error ||
                          0}
                      </strong>
                    </div>
                  </div>
                </div>

                {resultadoImportacion
                  .errores?.length >
                  0 && (
                  <div
                    style={{
                      marginTop:
                        "18px"
                    }}
                  >
                    <strong>
                      Filas con error
                    </strong>

                    <div
                      className="table-container"
                      style={{
                        marginTop:
                          "10px"
                      }}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>
                              Fila
                            </th>

                            <th>
                              Producto
                            </th>

                            <th>
                              Error
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {resultadoImportacion.errores.map(
                            (
                              item,
                              index
                            ) => (
                              <tr
                                key={`${item.fila}-${index}`}
                              >
                                <td>
                                  {
                                    item.fila
                                  }
                                </td>

                                <td>
                                  {item.nombre ||
                                    item.sku ||
                                    "-"}
                                </td>

                                <td>
                                  {
                                    item.error
                                  }
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={importarCsv}
            >
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
                    cerrarImportacion
                  }
                  disabled={importando}
                >
                  {resultadoImportacion
                    ? "Cerrar"
                    : "Cancelar"}
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    importando ||
                    !archivoCsv
                  }
                >
                  <Upload size={18} />

                  {importando
                    ? "Importando..."
                    : "Importar CSV"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================= */}
      {/* AGREGAR ARTÍCULO */}
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
                "calc(100% - 32px)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Agregar artículo al stock
                </h2>

                <p>
                  Se agregará directamente
                  a tu ubicación.
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
                      Todas las categorías
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
                      Selecciona un producto
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
                      nuevoProducto
                        .descripcion
                    }
                    onChange={
                      handleNuevoProducto
                    }
                    rows="3"
                    placeholder="Opcional"
                  />
                </div>

                <div className="form-group">
                  <label>
                    SKU
                  </label>

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
                    Categoría
                  </label>

                  <select
                    name="categoria_id"
                    value={
                      nuevoProducto
                        .categoria_id
                    }
                    onChange={
                      handleNuevoProducto
                    }
                  >
                    <option value="">
                      Sin categoría
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
                      nuevoProducto
                        .unidad_medida
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
                      nuevoProducto
                        .punto_reorden
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
                      nuevoProducto
                        .cantidad
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
    </div>
  );
};

export default Inventario;