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
  Save,
  Pencil
} from "lucide-react";

import api from "../services/api";
import "../App.css";

const Inventario = () => {
  const [inventario, setInventario] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarImportacion, setMostrarImportacion] = useState(false);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const [articuloDetalle, setArticuloDetalle] = useState(null);
  const [editandoDetalle, setEditandoDetalle] = useState(false);

  const [archivoCsv, setArchivoCsv] = useState(null);
  const [resultadoImportacion, setResultadoImportacion] =
    useState(null);

  const [imagenDetalleUrl, setImagenDetalleUrl] = useState("");
  const [archivoImagenDetalle, setArchivoImagenDetalle] =
    useState(null);
  const [previewImagenDetalle, setPreviewImagenDetalle] =
    useState("");
  const [tieneImagenDetalle, setTieneImagenDetalle] =
    useState(false);

  const inputArchivoRef = useRef(null);
  const inputImagenDetalleRef = useRef(null);

  const [formulario, setFormulario] = useState({
    producto_id: "",
    cantidad: "",
    ubicacion_id: "",
    motivo: ""
  });

  const [formularioDetalle, setFormularioDetalle] = useState({
    nombre: "",
    descripcion: "",
    existencias: "",
    punto_reorden: "",
    proveedor_id: "",
    categoria_id: "",
    sku: "",
    unidad_medida: ""
  });

  const [detalleOriginal, setDetalleOriginal] = useState({
    nombre: "",
    descripcion: "",
    existencias: "",
    punto_reorden: "",
    proveedor_id: "",
    categoria_id: "",
    sku: "",
    unidad_medida: ""
  });

  const [motivoExistencias, setMotivoExistencias] =
    useState("");

  const usuario = useMemo(() => {
    try {
      const datos = localStorage.getItem("usuario");
      return datos ? JSON.parse(datos) : null;
    } catch {
      return null;
    }
  }, []);

  const tipoUbicacion =
    usuario?.tipo_ubicacion ||
    usuario?.ubicacion_tipo ||
    "";

  const esPrincipal =
    tipoUbicacion === "principal" ||
    usuario?.es_principal === true ||
    usuario?.es_principal === 1;

  const normalizarInventario = (respuesta) => {
    if (Array.isArray(respuesta)) {
      return respuesta;
    }

    if (Array.isArray(respuesta?.inventario)) {
      return respuesta.inventario;
    }

    if (Array.isArray(respuesta?.data)) {
      return respuesta.data;
    }

    return [];
  };

  const normalizarLista = (
    respuesta,
    propiedad
  ) => {
    if (Array.isArray(respuesta)) {
      return respuesta;
    }

    if (
      propiedad &&
      Array.isArray(respuesta?.[propiedad])
    ) {
      return respuesta[propiedad];
    }

    if (Array.isArray(respuesta?.data)) {
      return respuesta.data;
    }

    return [];
  };

  const obtenerProveedorId = (producto) => {
    if (!producto) {
      return "";
    }

    if (producto.proveedor_id) {
      return String(producto.proveedor_id);
    }

    if (
      Array.isArray(producto.proveedores) &&
      producto.proveedores.length > 0
    ) {
      const proveedor = producto.proveedores[0];

      return String(
        proveedor?.id ||
          proveedor?.proveedor_id ||
          ""
      );
    }

    if (
      Array.isArray(producto.proveedor_ids) &&
      producto.proveedor_ids.length > 0
    ) {
      return String(producto.proveedor_ids[0]);
    }

    return "";
  };

  const obtenerCategoriaId = (producto) => {
    if (!producto) {
      return "";
    }

    return String(
      producto.categoria_id ||
        producto.categoria?.id ||
        ""
    );
  };

  const obtenerNombreProveedor = (
    proveedorId
  ) => {
    if (!proveedorId) {
      return "Sin proveedor";
    }

    const proveedor = proveedores.find(
      (item) =>
        Number(item.id) === Number(proveedorId)
    );

    return proveedor?.nombre || "Sin proveedor";
  };

  const obtenerNombreCategoria = (
    categoriaId
  ) => {
    if (!categoriaId) {
      return "Sin categoría";
    }

    const categoriaEncontrada =
      categorias.find(
        (item) =>
          Number(item.id) ===
          Number(categoriaId)
      );

    return (
      categoriaEncontrada?.nombre ||
      "Sin categoría"
    );
  };

  const cargarInventario = async () => {
    let response;

    if (esPrincipal) {
      response = await api.get(
        "/reportes/inventario"
      );
    } else {
      response = await api.get("/inventario");
    }

    setInventario(
      normalizarInventario(response.data)
    );
  };

  const cargarCategorias = async () => {
    try {
      const response = await api.get(
        "/categorias"
      );

      setCategorias(
        normalizarLista(
          response.data,
          "categorias"
        )
      );
    } catch (err) {
      console.error(
        "Error al cargar categorías:",
        err
      );

      setCategorias([]);
    }
  };

  const cargarUbicaciones = async () => {
    try {
      const response = await api.get(
        "/ubicaciones"
      );

      setUbicaciones(
        normalizarLista(
          response.data,
          "ubicaciones"
        )
      );
    } catch (err) {
      console.error(
        "Error al cargar ubicaciones:",
        err
      );

      setUbicaciones([]);
    }
  };

  const cargarProductos = async () => {
    try {
      const response = await api.get(
        "/productos"
      );

      setProductos(
        normalizarLista(
          response.data,
          "productos"
        )
      );
    } catch (err) {
      console.error(
        "Error al cargar productos:",
        err
      );

      setProductos([]);
    }
  };

  const cargarProveedores = async () => {
    try {
      const response = await api.get(
        "/proveedores"
      );

      setProveedores(
        normalizarLista(
          response.data,
          "proveedores"
        )
      );
    } catch (err) {
      console.error(
        "Error al cargar proveedores:",
        err
      );

      setProveedores([]);
    }
  };

  const cargarDatos = async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        cargarInventario(),
        cargarCategorias(),
        cargarUbicaciones(),
        cargarProductos(),
        cargarProveedores()
      ]);
    } catch (err) {
      console.error(
        "Error al cargar inventario:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.mensaje ||
          "No fue posible cargar el inventario."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    return () => {
      if (
        imagenDetalleUrl &&
        imagenDetalleUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          imagenDetalleUrl
        );
      }

      if (
        previewImagenDetalle &&
        previewImagenDetalle.startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          previewImagenDetalle
        );
      }
    };
  }, [
    imagenDetalleUrl,
    previewImagenDetalle
  ]);

  const inventarioFiltrado = useMemo(() => {
    const termino =
      busqueda.trim().toLowerCase();

    return inventario.filter((item) => {
      const nombre = String(
        item.producto_nombre ||
          item.nombre ||
          ""
      ).toLowerCase();

      const sku = String(
        item.sku || ""
      ).toLowerCase();

      const proveedor = String(
        item.proveedor_nombre ||
          item.proveedor ||
          ""
      ).toLowerCase();

      const coincideBusqueda =
        !termino ||
        nombre.includes(termino) ||
        sku.includes(termino) ||
        proveedor.includes(termino);

      const coincideCategoria =
        !categoria ||
        String(item.categoria_id) ===
          String(categoria);

      const coincideUbicacion =
        !ubicacion ||
        String(item.ubicacion_id) ===
          String(ubicacion);

      const stockBajo =
        Number(item.stock_bajo) === 1 ||
        Number(item.cantidad || 0) <=
          Number(
            item.punto_reorden || 0
          );

      const coincideStock =
        !soloBajoStock || stockBajo;

      return (
        coincideBusqueda &&
        coincideCategoria &&
        coincideUbicacion &&
        coincideStock
      );
    });
  }, [
    inventario,
    busqueda,
    categoria,
    ubicacion,
    soloBajoStock
  ]);

  const totalProductos =
    inventarioFiltrado.length;

  const totalUnidades =
    inventarioFiltrado.reduce(
      (total, item) =>
        total + Number(item.cantidad || 0),
      0
    );

  const totalAlertas =
    inventarioFiltrado.filter(
      (item) =>
        Number(item.stock_bajo) === 1 ||
        Number(item.cantidad || 0) <=
          Number(
            item.punto_reorden || 0
          )
    ).length;

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoria("");
    setUbicacion("");
    setSoloBajoStock(false);
  };

  const abrirModal = () => {
    setError("");
    setMensaje("");

    setFormulario({
      producto_id: "",
      cantidad: "",
      ubicacion_id: "",
      motivo: ""
    });

    setMostrarModal(true);
  };

  const cerrarModal = () => {
    if (guardando) {
      return;
    }

    setMostrarModal(false);
    setError("");
  };

  const handleFormulario = (event) => {
    const {
      name,
      value
    } = event.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value
    }));
  };

  const guardarArticulo = async (event) => {
    event.preventDefault();

    setError("");
    setMensaje("");

    if (!formulario.producto_id) {
      setError(
        "Selecciona un producto."
      );
      return;
    }

    const cantidad = Number(
      formulario.cantidad
    );

    if (
      Number.isNaN(cantidad) ||
      cantidad < 0
    ) {
      setError(
        "La cantidad debe ser un número válido."
      );
      return;
    }

    setGuardando(true);

    try {
      const payload = {
        producto_id:
          Number(
            formulario.producto_id
          ),
        cantidad
      };

      if (formulario.ubicacion_id) {
        payload.ubicacion_id =
          Number(
            formulario.ubicacion_id
          );
      }

      if (formulario.motivo.trim()) {
        payload.motivo =
          formulario.motivo.trim();
      }

      await api.post(
        "/inventario/stock-inicial",
        payload
      );

      setMensaje(
        "Artículo agregado correctamente al inventario."
      );

      setMostrarModal(false);

      await cargarInventario();
    } catch (err) {
      console.error(
        "Error al agregar artículo:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.mensaje ||
          "No fue posible agregar el artículo."
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirImportacion = () => {
    setError("");
    setMensaje("");
    setArchivoCsv(null);
    setResultadoImportacion(null);

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = "";
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
  };

  const seleccionarArchivoCsv = (
    event
  ) => {
    const archivo =
      event.target.files?.[0] ||
      null;

    setArchivoCsv(archivo);
    setResultadoImportacion(null);
    setError("");
    setMensaje("");
  };

  const importarCsv = async () => {
    if (!archivoCsv) {
      setError(
        "Selecciona un archivo CSV."
      );
      return;
    }

    setImportando(true);
    setError("");
    setMensaje("");
    setResultadoImportacion(null);

    try {
      const formData =
        new FormData();

      formData.append(
        "archivo",
        archivoCsv
      );

      const response = await api.post(
        "/inventario/importar-csv",
        formData
      );

      setResultadoImportacion(
        response.data
      );

      setMensaje(
        response.data?.message ||
          response.data?.mensaje ||
          "Archivo procesado correctamente."
      );

      await Promise.all([
        cargarInventario(),
        cargarProductos()
      ]);
    } catch (err) {
      console.error(
        "Error al importar CSV:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.mensaje ||
          "No fue posible importar el archivo CSV."
      );

      if (err.response?.data) {
        setResultadoImportacion(
          err.response.data
        );
      }
    } finally {
      setImportando(false);
    }
  };

  const liberarUrlImagen = (url) => {
    if (
      url &&
      url.startsWith("blob:")
    ) {
      URL.revokeObjectURL(url);
    }
  };

  const limpiarSeleccionImagen = () => {
    setArchivoImagenDetalle(null);

    setPreviewImagenDetalle(
      (urlActual) => {
        liberarUrlImagen(urlActual);
        return "";
      }
    );

    if (inputImagenDetalleRef.current) {
      inputImagenDetalleRef.current.value =
        "";
    }
  };

  const limpiarImagenActual = () => {
    setImagenDetalleUrl(
      (urlActual) => {
        liberarUrlImagen(urlActual);
        return "";
      }
    );

    setTieneImagenDetalle(false);
  };

  const cargarImagenProducto = async (
    productoId,
    tieneImagen
  ) => {
    limpiarImagenActual();

    if (!tieneImagen) {
      return;
    }

    setTieneImagenDetalle(true);

    try {
      const response = await api.get(
        `/productos/${productoId}/imagen`,
        {
          responseType: "blob"
        }
      );

      const url =
        URL.createObjectURL(
          response.data
        );

      setImagenDetalleUrl(url);
    } catch (err) {
      console.error(
        "No fue posible cargar la imagen del producto:",
        err
      );

      setTieneImagenDetalle(false);
    }
  };

  const seleccionarImagenDetalle = (
    event
  ) => {
    const archivo =
      event.target.files?.[0] ||
      null;

    setError("");
    setMensaje("");

    if (!archivo) {
      limpiarSeleccionImagen();
      return;
    }

    const tiposPermitidos = [
      "image/png",
      "image/jpeg"
    ];

    if (
      !tiposPermitidos.includes(
        archivo.type
      )
    ) {
      setError(
        "Formato de imagen no permitido. Solo se aceptan PNG, JPG y JPEG."
      );

      if (
        inputImagenDetalleRef.current
      ) {
        inputImagenDetalleRef.current.value =
          "";
      }

      return;
    }

    if (
      archivo.size >
      5 * 1024 * 1024
    ) {
      setError(
        "La imagen no puede superar los 5 MB."
      );

      if (
        inputImagenDetalleRef.current
      ) {
        inputImagenDetalleRef.current.value =
          "";
      }

      return;
    }

    setArchivoImagenDetalle(
      archivo
    );

    setPreviewImagenDetalle(
      (urlActual) => {
        liberarUrlImagen(urlActual);

        return URL.createObjectURL(
          archivo
        );
      }
    );
  };

  const abrirDetalle = (item) => {
    setError("");
    setMensaje("");
    setArticuloDetalle(item);
    setMotivoExistencias("");
    setEditandoDetalle(false);

    limpiarSeleccionImagen();
    limpiarImagenActual();

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
        obtenerProveedorId(item),

      categoria_id:
        obtenerCategoriaId(
          productoLocal
        ) ||
        String(
          item.categoria_id || ""
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

    cargarDetalleProducto(
      item,
      datosIniciales
    );
  };

  const cargarDetalleProducto =
    async (
      item,
      datosIniciales
    ) => {
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

          categoria_id:
            obtenerCategoriaId(
              producto
            ) ||
            datosIniciales.categoria_id,

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

        await cargarImagenProducto(
          item.producto_id,
          producto.tiene_imagen
        );
      } catch (err) {
        console.error(
          "No fue posible obtener el detalle completo del producto:",
          err
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
    setEditandoDetalle(false);
    setMotivoExistencias("");
    limpiarSeleccionImagen();
    limpiarImagenActual();
    setError("");
    setMensaje("");
  };

  const activarEdicionDetalle = () => {
    setError("");
    setMensaje("");
    setMotivoExistencias("");

    setDetalleOriginal({
      ...formularioDetalle
    });

    limpiarSeleccionImagen();

    setEditandoDetalle(true);
  };

  const cancelarEdicionDetalle = () => {
    setFormularioDetalle({
      ...detalleOriginal
    });

    setMotivoExistencias("");
    limpiarSeleccionImagen();
    setError("");
    setMensaje("");
    setEditandoDetalle(false);
  };

  const handleDetalle = (event) => {
    const {
      name,
      value
    } = event.target;

    setFormularioDetalle(
      (actual) => ({
        ...actual,
        [name]: value
      })
    );
  };

  const guardarDetalle = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setMensaje("");

    const nombre =
      formularioDetalle.nombre.trim();

    const existencias = Number(
      formularioDetalle.existencias
    );

    const puntoReorden = Number(
      formularioDetalle.punto_reorden
    );

    const unidadMedida =
      formularioDetalle.unidad_medida.trim();

    const existenciasOriginales =
      Number(
        detalleOriginal.existencias
      );

    const existenciasCambiaron =
      existencias !==
      existenciasOriginales;

    if (!nombre) {
      setError(
        "El nombre del producto es obligatorio."
      );
      return;
    }

    if (
      Number.isNaN(existencias) ||
      existencias < 0
    ) {
      setError(
        "Las existencias deben ser un número válido mayor o igual a cero."
      );
      return;
    }

    if (!unidadMedida) {
      setError(
        "La unidad de medida es obligatoria."
      );
      return;
    }

    if (
      Number.isNaN(puntoReorden) ||
      puntoReorden < 0
    ) {
      setError(
        "El punto de reorden debe ser un número válido."
      );
      return;
    }

    if (
      existenciasCambiaron &&
      !motivoExistencias.trim()
    ) {
      setError(
        "Debes escribir una justificación para modificar las existencias."
      );
      return;
    }

    if (
      !articuloDetalle?.producto_id
    ) {
      setError(
        "No se encontró el producto seleccionado."
      );
      return;
    }

    setGuardando(true);

    try {
      const proveedorId =
        formularioDetalle.proveedor_id
          ? Number(
              formularioDetalle.proveedor_id
            )
          : null;

      const categoriaId =
        formularioDetalle.categoria_id
          ? Number(
              formularioDetalle.categoria_id
            )
          : null;

      const payloadProducto = {
        nombre,

        descripcion:
          formularioDetalle.descripcion.trim(),

        punto_reorden:
          puntoReorden,

        sku:
          formularioDetalle.sku.trim() ||
          null,

        unidad_medida:
          unidadMedida,

        proveedor_id:
          proveedorId,

        proveedor_ids:
          proveedorId
            ? [proveedorId]
            : [],

        categoria_id:
          categoriaId,

        activo: true
      };

      await api.put(
        `/productos/${articuloDetalle.producto_id}`,
        payloadProducto
      );

      if (existenciasCambiaron) {
        const payloadAjuste = {
          producto_id:
            Number(
              articuloDetalle.producto_id
            ),

          cantidad_nueva:
            existencias,

          motivo:
            motivoExistencias.trim()
        };

        if (
          articuloDetalle.ubicacion_id
        ) {
          payloadAjuste.ubicacion_id =
            Number(
              articuloDetalle.ubicacion_id
            );
        }

        await api.post(
          "/inventario/ajuste",
          payloadAjuste
        );
      }

      if (archivoImagenDetalle) {
        const formDataImagen =
          new FormData();

        formDataImagen.append(
          "imagen",
          archivoImagenDetalle
        );

        await api.put(
          `/productos/${articuloDetalle.producto_id}/imagen`,
          formDataImagen
        );
      }

      const datosGuardados = {
        ...formularioDetalle,

        nombre,

        descripcion:
          formularioDetalle.descripcion.trim(),

        existencias:
          String(existencias),

        punto_reorden:
          String(puntoReorden),

        proveedor_id:
          proveedorId
            ? String(proveedorId)
            : "",

        categoria_id:
          categoriaId
            ? String(categoriaId)
            : "",

        sku:
          formularioDetalle.sku.trim(),

        unidad_medida:
          unidadMedida
      };

      setFormularioDetalle(
        datosGuardados
      );

      setDetalleOriginal(
        datosGuardados
      );

      setMotivoExistencias("");
      setEditandoDetalle(false);

      setMensaje(
        "Producto actualizado correctamente."
      );

      limpiarSeleccionImagen();

      await Promise.all([
        cargarInventario(),
        cargarProductos()
      ]);
    } catch (err) {
      console.error(
        "Error al guardar producto:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.mensaje ||
          "No fue posible guardar los cambios."
      );
    } finally {
      setGuardando(false);
    }
  };

  const obtenerEstado = (item) => {
    const cantidad = Number(
      item.cantidad || 0
    );

    const puntoReorden = Number(
      item.punto_reorden || 0
    );

    if (cantidad <= 0) {
      return {
        texto: "Agotado",
        clase: "badge-danger"
      };
    }

    if (
      cantidad <= puntoReorden
    ) {
      return {
        texto: "Stock bajo",
        clase: "badge-warning"
      };
    }

    return {
      texto: "Disponible",
      clase: "badge-success"
    };
  };

  const formatearFecha = (
    fecha
  ) => {
    if (!fecha) {
      return "Sin fecha";
    }

    try {
      return new Date(
        fecha
      ).toLocaleString(
        "es-MX",
        {
          dateStyle: "short",
          timeStyle: "short"
        }
      );
    } catch {
      return "Sin fecha";
    }
  };

  return (
    <div className="page-container">
      <section className="page-header">
        <div>
          <div className="page-title-row">
            <Package size={28} />
            <div>
              <h1>Inventario</h1>

              <p>
                Consulta y administra las
                existencias de productos.
              </p>
            </div>
          </div>
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
            className="btn btn-secondary"
            onClick={cargarDatos}
            disabled={loading}
          >
            <RefreshCw
              size={17}
              className={
                loading
                  ? "spin"
                  : ""
              }
            />
            Actualizar
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={
              abrirImportacion
            }
          >
            <Upload size={17} />
            Importar CSV
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={abrirModal}
          >
            <Plus size={17} />
            Agregar artículo
          </button>
        </div>
      </section>

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {mensaje && (
        <div className="alert alert-success">
          <span>{mensaje}</span>

          <button
            type="button"
            onClick={() =>
              setMensaje("")
            }
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>
      )}

      <section
        className="dashboard-grid"
        style={{
          marginBottom: "20px"
        }}
      >
        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <Boxes size={22} />
          </div>

          <div>
            <span className="dashboard-card-label">
              Productos
            </span>

            <strong className="dashboard-card-value">
              {totalProductos}
            </strong>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <Package size={22} />
          </div>

          <div>
            <span className="dashboard-card-label">
              Unidades
            </span>

            <strong className="dashboard-card-value">
              {totalUnidades}
            </strong>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">
            <AlertTriangle size={22} />
          </div>

          <div>
            <span className="dashboard-card-label">
              Alertas
            </span>

            <strong className="dashboard-card-value">
              {totalAlertas}
            </strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(240px, 2fr) repeat(3, minmax(160px, 1fr))",
            gap: "12px",
            alignItems: "end",
            marginBottom: "18px"
          }}
        >
          <div className="form-group">
            <label>
              Buscar
            </label>

            <div
              style={{
                position: "relative"
              }}
            >
              <Search
                size={17}
                style={{
                  position:
                    "absolute",
                  left: "12px",
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  pointerEvents:
                    "none"
                }}
              />

              <input
                type="text"
                value={busqueda}
                onChange={(event) =>
                  setBusqueda(
                    event.target.value
                  )
                }
                placeholder="Producto, SKU o proveedor..."
                style={{
                  paddingLeft:
                    "38px"
                }}
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              Categoría
            </label>

            <select
              value={categoria}
              onChange={(event) =>
                setCategoria(
                  event.target.value
                )
              }
            >
              <option value="">
                Todas
              </option>

              {categorias.map(
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
          </div>

          {esPrincipal && (
            <div className="form-group">
              <label>
                Ubicación
              </label>

              <select
                value={ubicacion}
                onChange={(event) =>
                  setUbicacion(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Todas
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
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              paddingBottom:
                "4px"
            }}
          >
            <label
              style={{
                display: "flex",
                gap: "8px",
                alignItems:
                  "center",
                cursor: "pointer",
                margin: 0
              }}
            >
              <input
                type="checkbox"
                checked={
                  soloBajoStock
                }
                onChange={(event) =>
                  setSoloBajoStock(
                    event.target
                      .checked
                  )
                }
              />

              <span>
                Solo stock bajo
              </span>
            </label>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={
                limpiarFiltros
              }
            >
              Limpiar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw
              size={28}
              className="spin"
            />

            <p>
              Cargando inventario...
            </p>
          </div>
        ) : inventarioFiltrado.length ===
          0 ? (
          <div className="empty-state">
            <Package size={36} />

            <h3>
              No hay productos
            </h3>

            <p>
              No se encontraron
              productos con los
              filtros actuales.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    Producto
                  </th>

                  {esPrincipal && (
                    <th>
                      Proveedor
                    </th>
                  )}

                  <th>
                    Categoría
                  </th>

                  <th>
                    Ubicación
                  </th>

                  <th>
                    Existencias
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
                {inventarioFiltrado.map(
                  (item) => {
                    const estado =
                      obtenerEstado(
                        item
                      );

                    const proveedorNombre =
                      item.proveedor_nombre ||
                      item.proveedor ||
                      obtenerNombreProveedor(
                        obtenerProveedorId(
                          item
                        )
                      );

                    const categoriaNombre =
                      item.categoria_nombre ||
                      obtenerNombreCategoria(
                        item.categoria_id
                      );

                    return (
                      <tr
                        key={`${item.ubicacion_id}-${item.producto_id}`}
                      >
                        <td>
                          <div
                            style={{
                              display:
                                "flex",
                              flexDirection:
                                "column",
                              gap: "3px"
                            }}
                          >
                            <strong>
                              {item.producto_nombre ||
                                item.nombre ||
                                "Sin nombre"}
                            </strong>

                            {item.sku && (
                              <small className="table-secondary">
                                SKU:{" "}
                                {
                                  item.sku
                                }
                              </small>
                            )}
                          </div>
                        </td>

                        {esPrincipal && (
                          <td>
                            {proveedorNombre ||
                              "Sin proveedor"}
                          </td>
                        )}

                        <td>
                          {categoriaNombre}
                        </td>

                        <td>
                          {item.ubicacion_nombre ||
                            "Sin ubicación"}
                        </td>

                        <td>
                          <strong>
                            {
                              item.cantidad
                            }
                          </strong>

                          {item.unidad_medida && (
                            <small className="table-secondary">
                              {" "}
                              {
                                item.unidad_medida
                              }
                            </small>
                          )}
                        </td>

                        <td>
                          <span
                            className={`badge ${estado.clase}`}
                          >
                            {
                              estado.texto
                            }
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              abrirDetalle(
                                item
                              )
                            }
                          >
                            <Eye
                              size={16}
                            />
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
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background:
              "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "16px"
          }}
        >
          <div
            className="modal-content"
            style={{
              width:
                "min(620px, 100%)",
              maxHeight:
                "calc(100vh - 32px)",
              overflowY:
                "auto",
              background:
                "#fff",
              borderRadius:
                "14px"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Agregar artículo
                </h2>

                <p>
                  Agrega un producto
                  existente al
                  inventario.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarModal
                }
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                guardarArticulo
              }
            >
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    Producto *
                  </label>

                  <select
                    name="producto_id"
                    value={
                      formulario.producto_id
                    }
                    onChange={
                      handleFormulario
                    }
                    required
                  >
                    <option value="">
                      Selecciona un
                      producto
                    </option>

                    {productos.map(
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
                            ? ` - ${producto.sku}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Cantidad *
                  </label>

                  <input
                    type="number"
                    name="cantidad"
                    min="0"
                    step="any"
                    value={
                      formulario.cantidad
                    }
                    onChange={
                      handleFormulario
                    }
                    required
                  />
                </div>

                {esPrincipal && (
                  <div className="form-group">
                    <label>
                      Ubicación
                    </label>

                    <select
                      name="ubicacion_id"
                      value={
                        formulario.ubicacion_id
                      }
                      onChange={
                        handleFormulario
                      }
                    >
                      <option value="">
                        Ubicación
                        del usuario
                      </option>

                      {ubicaciones.map(
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
                )}

                <div className="form-group">
                  <label>
                    Motivo
                  </label>

                  <textarea
                    name="motivo"
                    rows="3"
                    value={
                      formulario.motivo
                    }
                    onChange={
                      handleFormulario
                    }
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
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
                  className="btn btn-primary"
                  disabled={
                    guardando
                  }
                >
                  {guardando ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="spin"
                      />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <PackagePlus
                        size={17}
                      />
                      Agregar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              maxWidth:
                "650px",
              width:
                "calc(100% - 32px)"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Importar inventario
                  CSV
                </h2>

                <p>
                  Agrega varios
                  productos
                  directamente al
                  inventario de tu
                  ubicación.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarImportacion
                }
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>
                  Archivo CSV
                </label>

                <input
                  ref={
                    inputArchivoRef
                  }
                  type="file"
                  accept=".csv,text/csv"
                  onChange={
                    seleccionarArchivoCsv
                  }
                />

                <small className="table-secondary">
                  Campos obligatorios:
                  nombre, cantidad y
                  unidad_medida.
                </small>
              </div>

              {archivoCsv && (
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "10px",
                    padding:
                      "12px",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      "10px"
                  }}
                >
                  <FileText
                    size={20}
                  />

                  <div>
                    <strong>
                      {
                        archivoCsv.name
                      }
                    </strong>

                    <div>
                      <small className="table-secondary">
                        {(
                          archivoCsv.size /
                          1024
                        ).toFixed(
                          1
                        )}{" "}
                        KB
                      </small>
                    </div>
                  </div>
                </div>
              )}

              {resultadoImportacion && (
                <div
                  style={{
                    marginTop:
                      "16px",
                    padding:
                      "14px",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius:
                      "10px"
                  }}
                >
                  <strong>
                    Resultado de
                    importación
                  </strong>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "10px",
                      marginTop:
                        "12px"
                    }}
                  >
                    <div>
                      <small>
                        Total
                      </small>

                      <strong
                        style={{
                          display:
                            "block"
                        }}
                      >
                        {
                          resultadoImportacion
                            ?.resumen
                            ?.total_filas ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <small>
                        Agregados
                      </small>

                      <strong
                        style={{
                          display:
                            "block"
                        }}
                      >
                        {
                          resultadoImportacion
                            ?.resumen
                            ?.agregados ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <small>
                        Creados
                      </small>

                      <strong
                        style={{
                          display:
                            "block"
                        }}
                      >
                        {
                          resultadoImportacion
                            ?.resumen
                            ?.productos_creados ??
                          0
                        }
                      </strong>
                    </div>

                    <div>
                      <small>
                        Errores
                      </small>

                      <strong
                        style={{
                          display:
                            "block"
                        }}
                      >
                        {
                          resultadoImportacion
                            ?.resumen
                            ?.filas_con_error ??
                          0
                        }
                      </strong>
                    </div>
                  </div>

                  {Array.isArray(
                    resultadoImportacion.errores
                  ) &&
                    resultadoImportacion
                      .errores.length >
                      0 && (
                      <div
                        style={{
                          marginTop:
                            "14px"
                        }}
                      >
                        <strong>
                          Filas con
                          error
                        </strong>

                        <ul
                          style={{
                            marginTop:
                              "8px"
                          }}
                        >
                          {resultadoImportacion.errores.map(
                            (
                              item,
                              index
                            ) => (
                              <li
                                key={
                                  index
                                }
                              >
                                Fila{" "}
                                {
                                  item.fila
                                }
                                :{" "}
                                {
                                  item.error
                                }
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={
                  cerrarImportacion
                }
                disabled={
                  importando
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  importarCsv
                }
                disabled={
                  importando ||
                  !archivoCsv
                }
              >
                {importando ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="spin"
                    />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload
                      size={17}
                    />
                    Importar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarDetalle && (
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
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background:
              "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: "16px"
          }}
        >
          <div
            className="modal-content"
            style={{
              width:
                "min(900px, 100%)",
              maxHeight:
                "calc(100vh - 32px)",
              overflowY:
                "auto",
              background:
                "#fff",
              borderRadius:
                "14px"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {editandoDetalle
                    ? "Editar producto"
                    : "Detalle del producto"}
                </h2>

                <p>
                  {editandoDetalle
                    ? "Modifica la información del producto."
                    : "Consulta la información del producto."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  cerrarDetalle
                }
                disabled={
                  guardando
                }
              >
                <X size={20} />
              </button>
            </div>

            {cargandoDetalle ? (
              <div
                className="empty-state"
                style={{
                  padding:
                    "50px 20px"
                }}
              >
                <RefreshCw
                  size={28}
                  className="spin"
                />

                <p>
                  Cargando
                  información del
                  producto...
                </p>
              </div>
            ) : (
              <form
                onSubmit={
                  guardarDetalle
                }
              >
                <div className="modal-body">
                  {!editandoDetalle ? (
                    <>
                      <div
                        style={{
                          marginBottom:
                            "22px"
                        }}
                      >
                        {tieneImagenDetalle &&
                        imagenDetalleUrl ? (
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "center",
                              marginBottom:
                                "16px"
                            }}
                          >
                            <img
                              src={
                                imagenDetalleUrl
                              }
                              alt={
                                formularioDetalle.nombre ||
                                "Producto"
                              }
                              style={{
                                maxWidth:
                                  "280px",
                                maxHeight:
                                  "280px",
                                objectFit:
                                  "contain",
                                borderRadius:
                                  "12px",
                                border:
                                  "1px solid #e2e8f0"
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "center",
                              alignItems:
                                "center",
                              minHeight:
                                "180px",
                              border:
                                "1px dashed #cbd5e1",
                              borderRadius:
                                "12px",
                              color:
                                "#64748b"
                            }}
                          >
                            Sin imagen
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(260px, 1fr))",
                          gap: "16px"
                        }}
                      >
                        <div className="form-group">
                          <label>
                            Nombre
                          </label>

                          <div className="readonly-field">
                            {
                              formularioDetalle.nombre ||
                              "Sin nombre"
                            }
                          </div>
                        </div>

                        <div className="form-group">
                          <label>
                            Categoría
                          </label>

                          <div className="readonly-field">
                            {obtenerNombreCategoria(
                              formularioDetalle.categoria_id
                            )}
                          </div>
                        </div>

                        <div className="form-group">
                          <label>
                            Existencias
                          </label>

                          <div className="readonly-field">
                            {
                              formularioDetalle.existencias
                            }
                          </div>
                        </div>

                        <div className="form-group">
                          <label>
                            Punto de
                            reorden
                          </label>

                          <div className="readonly-field">
                            {
                              formularioDetalle.punto_reorden
                            }
                          </div>
                        </div>

                        <div className="form-group">
                          <label>
                            Proveedor
                          </label>

                          <div className="readonly-field">
                            {obtenerNombreProveedor(
                              formularioDetalle.proveedor_id
                            )}
                          </div>
                        </div>

                        <div className="form-group">
                          <label>
                            SKU
                          </label>

                          <div className="readonly-field">
                            {
                              formularioDetalle.sku ||
                              "Sin SKU"
                            }
                          </div>
                        </div>

                        <div className="form-group">
                          <label>
                            Unidad de
                            medida
                          </label>

                          <div className="readonly-field">
                            {
                              formularioDetalle.unidad_medida ||
                              "Sin unidad"
                            }
                          </div>
                        </div>
                      </div>

                      <div
                        className="form-group"
                        style={{
                          marginTop:
                            "16px"
                        }}
                      >
                        <label>
                          Descripción
                        </label>

                        <div
                          className="readonly-field"
                          style={{
                            minHeight:
                              "80px",
                            whiteSpace:
                              "pre-wrap"
                          }}
                        >
                          {formularioDetalle.descripcion ||
                            "Sin descripción"}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label>
                          Imagen del
                          producto
                        </label>

                        {previewImagenDetalle ? (
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "center",
                              marginBottom:
                                "12px"
                            }}
                          >
                            <img
                              src={
                                previewImagenDetalle
                              }
                              alt="Vista previa"
                              style={{
                                maxWidth:
                                  "280px",
                                maxHeight:
                                  "280px",
                                objectFit:
                                  "contain",
                                borderRadius:
                                  "12px",
                                border:
                                  "1px solid #e2e8f0"
                              }}
                            />
                          </div>
                        ) : tieneImagenDetalle &&
                          imagenDetalleUrl ? (
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "center",
                              marginBottom:
                                "12px"
                            }}
                          >
                            <img
                              src={
                                imagenDetalleUrl
                              }
                              alt={
                                formularioDetalle.nombre ||
                                "Producto"
                              }
                              style={{
                                maxWidth:
                                  "280px",
                                maxHeight:
                                  "280px",
                                objectFit:
                                  "contain",
                                borderRadius:
                                  "12px",
                                border:
                                  "1px solid #e2e8f0"
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "center",
                              alignItems:
                                "center",
                              minHeight:
                                "150px",
                              border:
                                "1px dashed #cbd5e1",
                              borderRadius:
                                "12px",
                              color:
                                "#64748b",
                              marginBottom:
                                "12px"
                            }}
                          >
                            Sin imagen
                          </div>
                        )}

                        <input
                          ref={
                            inputImagenDetalleRef
                          }
                          type="file"
                          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                          onChange={
                            seleccionarImagenDetalle
                          }
                        />

                        <small className="table-secondary">
                          Formatos permitidos:
                          PNG, JPG y JPEG.
                          Máximo 5 MB.
                        </small>
                      </div>

                      <div className="form-group">
                        <label>
                          Nombre *
                        </label>

                        <input
                          name="nombre"
                          value={
                            formularioDetalle.nombre
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
                            formularioDetalle.descripcion
                          }
                          onChange={
                            handleDetalle
                          }
                          placeholder="Descripción opcional"
                        />
                      </div>

                      <div
                        style={{
                          display:
                            "grid",
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
                              formularioDetalle.existencias
                            }
                            onChange={
                              handleDetalle
                            }
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>
                            Punto de
                            reorden
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="any"
                            name="punto_reorden"
                            value={
                              formularioDetalle.punto_reorden
                            }
                            onChange={
                              handleDetalle
                            }
                          />
                        </div>
                      </div>

                      {existenciasCambiaron &&
                        editandoDetalle && (
                          <div className="form-group">
                            <label>
                              Justificación
                              del cambio
                              de
                              existencias
                              *
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
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder="Ej. Corrección después de conteo físico"
                              required
                            />

                            <small className="table-secondary">
                              La
                              justificación
                              solamente
                              es
                              obligatoria
                              porque
                              modificaste
                              las
                              existencias.
                            </small>
                          </div>
                        )}

                      <div
                        style={{
                          display:
                            "grid",
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
                              formularioDetalle.proveedor_id
                            }
                            onChange={
                              handleDetalle
                            }
                          >
                            <option value="">
                              Sin
                              proveedor
                            </option>

                            {proveedores.map(
                              (
                                proveedor
                              ) => (
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
                            Categoría
                          </label>

                          <select
                            name="categoria_id"
                            value={
                              formularioDetalle.categoria_id
                            }
                            onChange={
                              handleDetalle
                            }
                          >
                            <option value="">
                              Sin
                              categoría
                            </option>

                            {categorias.map(
                              (
                                categoriaItem
                              ) => (
                                <option
                                  key={
                                    categoriaItem.id
                                  }
                                  value={
                                    categoriaItem.id
                                  }
                                >
                                  {
                                    categoriaItem.nombre
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>
                          SKU
                        </label>

                        <input
                          name="sku"
                          value={
                            formularioDetalle.sku
                          }
                          onChange={
                            handleDetalle
                          }
                          placeholder="Opcional"
                        />
                      </div>

                      <div className="form-group">
                        <label>
                          Unidad de
                          medida *
                        </label>

                        <input
                          name="unidad_medida"
                          value={
                            formularioDetalle.unidad_medida
                          }
                          onChange={
                            handleDetalle
                          }
                          required
                        />
                      </div>

                      <div
                        style={{
                          padding:
                            "12px 14px",
                          border:
                            "1px solid #e2e8f0",
                          borderRadius:
                            "10px",
                          marginTop:
                            "8px"
                        }}
                      >
                        <small className="table-secondary">
                          Campos
                          obligatorios:
                          Nombre,
                          Existencias
                          y Unidad de
                          medida.
                          Descripción,
                          Punto de
                          reorden,
                          Proveedor,
                          Categoría y
                          SKU son
                          opcionales.
                        </small>
                      </div>
                    </>
                  )}
                </div>

                <div className="modal-footer">
                  {!editandoDetalle ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={
                          cerrarDetalle
                        }
                        disabled={
                          guardando
                        }
                      >
                        Cerrar
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={
                          activarEdicionDetalle
                        }
                        disabled={
                          guardando
                        }
                      >
                        <Pencil
                          size={17}
                        />
                        Editar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={
                          cancelarEdicionDetalle
                        }
                        disabled={
                          guardando
                        }
                      >
                        Cancelar
                      </button>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={
                          guardando
                        }
                      >
                        {guardando ? (
                          <>
                            <RefreshCw
                              size={
                                17
                              }
                              className="spin"
                            />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save
                              size={
                                17
                              }
                            />
                            Guardar
                            cambios
                          </>
                        )}
                      </button>
                    </>
                  )}
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