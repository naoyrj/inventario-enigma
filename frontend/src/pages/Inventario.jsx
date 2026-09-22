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
  const [resultadoImportacion, setResultadoImportacion] = useState(null);

  const [imagenDetalleUrl, setImagenDetalleUrl] = useState("");
  const [archivoImagenDetalle, setArchivoImagenDetalle] = useState(null);
  const [previewImagenDetalle, setPreviewImagenDetalle] = useState("");
  const [tieneImagenDetalle, setTieneImagenDetalle] = useState(false);

  const inputArchivoRef = useRef(null);
  const inputImagenDetalleRef = useRef(null);

  const [nuevoProducto, setNuevoProducto] = useState({
    nombre: "",
    descripcion: "",
    sku: "",
    categoria_id: "",
    unidad_medida: "pieza",
    punto_reorden: "0",
    cantidad: ""
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

  const [motivoExistencias, setMotivoExistencias] = useState("");

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
    usuario?.rol === "principal" ||
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

  const normalizarLista = (respuesta, propiedad) => {
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

  const obtenerNombreProveedor = (proveedorId) => {
    if (!proveedorId) {
      return "Sin proveedor";
    }

    const proveedor = proveedores.find(
      (item) =>
        Number(item.id) === Number(proveedorId)
    );

    return proveedor?.nombre || "Sin proveedor";
  };

  const cargarInventario = async () => {
    try {
      const response = await api.get("/inventario");

      setInventario(
        normalizarInventario(response.data)
      );
    } catch (err) {
      console.error(
        "Error al cargar inventario:",
        err
      );

      throw err;
    }
  };

  const cargarCategorias = async () => {
    try {
      const response = await api.get("/categorias");

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
      const response = await api.get("/ubicaciones");

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
      const response = await api.get("/productos");

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
      const response = await api.get("/proveedores");

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
        URL.revokeObjectURL(imagenDetalleUrl);
      }

      if (
        previewImagenDetalle &&
        previewImagenDetalle.startsWith("blob:")
      ) {
        URL.revokeObjectURL(previewImagenDetalle);
      }
    };
  }, [imagenDetalleUrl, previewImagenDetalle]);

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
          Number(item.punto_reorden || 0);

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
          Number(item.punto_reorden || 0)
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

    setNuevoProducto({
      nombre: "",
      descripcion: "",
      sku: "",
      categoria_id: "",
      unidad_medida: "pieza",
      punto_reorden: "0",
      cantidad: ""
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

  const handleNuevoProducto = (event) => {
    const {
      name,
      value
    } = event.target;

    setNuevoProducto((actual) => ({
      ...actual,
      [name]: value
    }));
  };

  const guardarArticulo = async (event) => {
    event.preventDefault();

    setError("");
    setMensaje("");

    const nombre =
      nuevoProducto.nombre.trim();

    const sku =
      nuevoProducto.sku.trim();

    const unidadMedida =
      nuevoProducto.unidad_medida.trim();

    const cantidad =
      Number(nuevoProducto.cantidad);

    const puntoReorden =
      nuevoProducto.punto_reorden === ""
        ? 0
        : Number(
            nuevoProducto.punto_reorden
          );

    if (!nombre) {
      setError(
        "El nombre del artículo es obligatorio."
      );
      return;
    }

    if (!sku) {
      setError("El SKU es obligatorio.");
      return;
    }

    if (!nuevoProducto.categoria_id) {
      setError("La categoría es obligatoria.");
      return;
    }

    if (!unidadMedida) {
      setError(
        "La unidad de medida es obligatoria."
      );
      return;
    }

    if (
      nuevoProducto.cantidad === "" ||
      Number.isNaN(cantidad) ||
      cantidad <= 0
    ) {
      setError(
        "La cantidad inicial debe ser mayor que cero."
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

    setGuardando(true);

    try {
      await api.post(
        "/inventario/propio/nuevo",
        {
          nombre,
          descripcion:
            nuevoProducto.descripcion.trim(),
          sku,
          categoria_id:
            Number(
              nuevoProducto.categoria_id
            ),
          unidad_medida:
            unidadMedida,
          punto_reorden:
            puntoReorden,
          cantidad
        }
      );

      setMensaje(
        "Artículo creado y agregado correctamente al inventario."
      );

      setMostrarModal(false);

      await Promise.all([
        cargarInventario(),
        cargarProductos()
      ]);
    } catch (err) {
      console.error(
        "Error al crear artículo:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.mensaje ||
          "No fue posible crear el artículo."
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

  const seleccionarArchivoCsv = (event) => {
    const archivo =
      event.target.files?.[0] || null;

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

      const response =
        await api.post(
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
      const response =
        await api.get(
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
        String(item.cantidad ?? 0),

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

  const cargarDetalleProducto = async (
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

  const existenciasCambiaron =
    Number(
      formularioDetalle.existencias
    ) !==
    Number(
      detalleOriginal.existencias
    );

  const guardarDetalle = async (
    event
  ) => {
    event.preventDefault();

    setError("");
    setMensaje("");

    const nombre =
      formularioDetalle.nombre.trim();

    const unidadMedida =
      formularioDetalle.unidad_medida.trim();

    const existencias =
      Number(
        formularioDetalle.existencias
      );

    const puntoReorden =
      formularioDetalle.punto_reorden ===
      ""
        ? 0
        : Number(
            formularioDetalle.punto_reorden
          );

    if (!nombre) {
      setError(
        "El nombre es obligatorio."
      );
      return;
    }

    if (
      formularioDetalle.existencias ===
        "" ||
      Number.isNaN(existencias) ||
      existencias < 0
    ) {
      setError(
        "Las existencias son obligatorias y deben ser un número válido."
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

      const formDataProducto =
        new FormData();

      formDataProducto.append(
        "nombre",
        nombre
      );

      formDataProducto.append(
        "descripcion",
        formularioDetalle.descripcion.trim()
      );

      formDataProducto.append(
        "punto_reorden",
        String(puntoReorden)
      );

      formDataProducto.append(
        "sku",
        formularioDetalle.sku.trim()
      );

      formDataProducto.append(
        "unidad_medida",
        unidadMedida
      );

      formDataProducto.append(
        "proveedor_id",
        proveedorId
          ? String(proveedorId)
          : ""
      );

      formDataProducto.append(
        "categoria_id",
        categoriaId
          ? String(categoriaId)
          : ""
      );

      if (archivoImagenDetalle) {
        formDataProducto.append(
          "imagen",
          archivoImagenDetalle
        );
      }

      await api.put(
        `/productos/${articuloDetalle.producto_id}`,
        formDataProducto
      );

      if (existenciasCambiaron) {
        const payloadAjuste = {
          producto_id: Number(
            articuloDetalle.producto_id
          ),
          cantidad_nueva: existencias,
          motivo: motivoExistencias.trim()
        };

        if (articuloDetalle.ubicacion_id) {
          payloadAjuste.ubicacion_id =
            Number(
              articuloDetalle.ubicacion_id
            );
        }

        await api.patch(
          "/inventario/ajuste",
          payloadAjuste
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

      const habiaNuevaImagen =
        Boolean(
          archivoImagenDetalle
        );

      limpiarSeleccionImagen();

      if (
        habiaNuevaImagen ||
        tieneImagenDetalle
      ) {
        await cargarImagenProducto(
          articuloDetalle.producto_id,
          true
        );
      }

      setMotivoExistencias("");
      setEditandoDetalle(false);

      setMensaje(
        "Producto actualizado correctamente."
      );

      const nombreProveedorActualizado =
        proveedorId
          ? obtenerNombreProveedor(
              proveedorId
            )
          : "Sin proveedor";

      setInventario(
        (inventarioActual) =>
          inventarioActual.map(
            (item) =>
              Number(item.producto_id) ===
              Number(
                articuloDetalle.producto_id
              )
                ? {
                    ...item,
                    proveedor_id:
                      proveedorId,
                    proveedor_nombre:
                      nombreProveedorActualizado
                  }
                : item
          )
      );

      await cargarProductos();
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

  const estiloDatoConsulta = {
    padding: "11px 13px",
    border:
      "1px solid #e2e8f0",
    borderRadius: "9px",
    background: "#f8fafc",
    minHeight: "44px",
    display: "flex",
    alignItems: "center",
    color: "#1e293b",
    wordBreak: "break-word"
  };

  const estiloImagen = {
    border:
      "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#f8fafc",
    minHeight: "190px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: "12px"
  };

  const estiloImg = {
    display: "block",
    maxWidth: "100%",
    maxHeight: "280px",
    objectFit: "contain",
    borderRadius: "8px"
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
            Consulta existencias, agrega artículos y administra
            las especificaciones de los productos.
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
            {inventarioFiltrado.length}
          </strong>{" "}
          registros
        </div>

        {inventarioFiltrado.length ===
        0 ? (
          <div className="empty-state">
            No hay productos que coincidan con los filtros.
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
                      ) === 1 ||
                      Number(
                        item.cantidad || 0
                      ) <=
                        Number(
                          item.punto_reorden ||
                            0
                        );

                    return (
                      <tr
                        key={`${item.ubicacion_id}-${item.producto_id}`}
                      >
                        <td>
                          <strong>
                            {item.producto_nombre ||
                              item.nombre}
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
                          {item.ubicacion_nombre ||
                            "Sin ubicación"}
                        </td>

                        <td>
                          <strong>
                            {Number(
                              item.cantidad ||
                                0
                            ).toLocaleString(
                              "es-MX"
                            )}
                          </strong>{" "}
                          {item.unidad_medida}
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

      {mostrarDetalle &&
        articuloDetalle && (
          <div
            className="modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background:
                "rgba(15, 23, 42, 0.65)",
              overflowY: "auto"
            }}
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
                position: "relative",
                zIndex: 1000000,
                maxWidth: "760px",
                width:
                  "calc(100% - 32px)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                boxShadow:
                  "0 24px 70px rgba(15, 23, 42, 0.28)"
              }}
            >
              <div className="modal-header">
                <div>
                  <h2>
                    Especificaciones del producto
                  </h2>

                  <p>
                    {editandoDetalle
                      ? "Edita los datos del producto."
                      : "Información del producto."}
                  </p>
                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={cerrarDetalle}
                  disabled={guardando}
                >
                  <X size={22} />
                </button>
              </div>

              {cargandoDetalle && (
                <div
                  className="table-secondary"
                  style={{
                    marginBottom:
                      "16px"
                  }}
                >
                  Actualizando información del producto...
                </div>
              )}

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

              {!editandoDetalle ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "14px"
                    }}
                  >
                    <div>
                      <label>Nombre</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.nombre ||
                          "Sin nombre"}
                      </div>
                    </div>

                    <div>
                      <label>SKU</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.sku ||
                          "Sin SKU"}
                      </div>
                    </div>

                    <div>
                      <label>Categoría</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.categoria_id
                          ? categorias.find(
                              (item) =>
                                Number(item.id) ===
                                Number(
                                  formularioDetalle.categoria_id
                                )
                            )?.nombre ||
                            "Sin categoría"
                          : "Sin categoría"}
                      </div>
                    </div>

                    <div>
                      <label>Proveedor</label>
                      <div style={estiloDatoConsulta}>
                        {obtenerNombreProveedor(
                          formularioDetalle.proveedor_id
                        )}
                      </div>
                    </div>

                    <div>
                      <label>Unidad de medida</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.unidad_medida ||
                          "Sin unidad"}
                      </div>
                    </div>

                    <div>
                      <label>Existencias</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.existencias ||
                          "0"}
                      </div>
                    </div>

                    <div>
                      <label>Punto de reorden</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.punto_reorden ||
                          "0"}
                      </div>
                    </div>

                    <div
                      style={{
                        gridColumn:
                          "1 / -1"
                      }}
                    >
                      <label>Descripción</label>
                      <div style={estiloDatoConsulta}>
                        {formularioDetalle.descripcion ||
                          "Sin descripción"}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "18px"
                    }}
                  >
                    <label>Imagen</label>

                    <div style={estiloImagen}>
                      {imagenDetalleUrl ? (
                        <img
                          src={
                            imagenDetalleUrl
                          }
                          alt={
                            formularioDetalle.nombre ||
                            "Producto"
                          }
                          style={estiloImg}
                        />
                      ) : (
                        <span className="table-secondary">
                          No hay imagen disponible.
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "flex-end",
                      marginTop: "20px"
                    }}
                  >
                    <button
                      type="button"
                      className="primary-button"
                      onClick={
                        activarEdicionDetalle
                      }
                    >
                      <Pencil size={18} />
                      Editar
                    </button>
                  </div>
                </>
              ) : (
                <form
                  onSubmit={
                    guardarDetalle
                  }
                >
                  <div className="form-group">
                    <label>Nombre *</label>

                    <input
                      type="text"
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
                    <label>Descripción</label>

                    <textarea
                      name="descripcion"
                      rows="4"
                      value={
                        formularioDetalle.descripcion
                      }
                      onChange={
                        handleDetalle
                      }
                      placeholder="Opcional"
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "14px"
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
                        Punto de reorden
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
                          Sin proveedor
                        </option>

                        {proveedores.map(
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
                          Sin categoría
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

                    <div className="form-group">
                      <label>SKU</label>

                      <input
                        type="text"
                        name="sku"
                        value={
                          formularioDetalle.sku
                        }
                        onChange={
                          handleDetalle
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        Unidad de medida *
                      </label>

                      <input
                        type="text"
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
                  </div>

                  <div
                    style={{
                      marginTop: "10px"
                    }}
                  >
                    <label>
                      Imagen
                    </label>

                    <input
                      ref={
                        inputImagenDetalleRef
                      }
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={
                        seleccionarImagenDetalle
                      }
                    />

                    {previewImagenDetalle && (
                      <div
                        style={{
                          ...estiloImagen,
                          marginTop: "12px"
                        }}
                      >
                        <img
                          src={
                            previewImagenDetalle
                          }
                          alt="Vista previa"
                          style={
                            estiloImg
                          }
                        />
                      </div>
                    )}
                  </div>

                  {existenciasCambiaron && (
                    <div className="form-group">
                      <label>
                        Justificación del cambio de existencias *
                      </label>

                      <textarea
                        rows="3"
                        value={
                          motivoExistencias
                        }
                        onChange={(event) =>
                          setMotivoExistencias(
                            event.target.value
                          )
                        }
                        placeholder="Explica por qué cambias las existencias"
                        required
                      />
                    </div>
                  )}

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
                      className="primary-button"
                      disabled={
                        guardando
                      }
                    >
                      <Save size={18} />

                      {guardando
                        ? "Guardando..."
                        : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      {mostrarImportacion && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background:
              "rgba(15, 23, 42, 0.65)",
            overflowY: "auto"
          }}
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
              position: "relative",
              maxWidth: "760px",
              width:
                "calc(100% - 32px)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              boxShadow:
                "0 24px 70px rgba(15, 23, 42, 0.28)"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Importar inventario
                </h2>

                <p>
                  Carga un archivo CSV con los artículos.
                </p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={
                  cerrarImportacion
                }
                disabled={
                  importando
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
                Archivo CSV
              </label>

              <input
                ref={inputArchivoRef}
                type="file"
                accept=".csv,text/csv"
                onChange={
                  seleccionarArchivoCsv
                }
              />
            </div>

            <div
              className="table-secondary"
              style={{
                marginTop: "12px",
                lineHeight: "1.6"
              }}
            >
              <strong>
                Columnas obligatorias:
              </strong>{" "}
              nombre, sku, categoria_id,
              unidad_medida y cantidad.
              <br />
              <strong>
                Columnas opcionales:
              </strong>{" "}
              descripcion y punto_reorden.
            </div>

            {resultadoImportacion && (
              <div
                style={{
                  marginTop: "18px"
                }}
              >
                <h3>
                  Resultado de importación
                </h3>

                <pre
                  style={{
                    background:
                      "#f8fafc",
                    padding: "14px",
                    borderRadius:
                      "10px",
                    overflowX:
                      "auto",
                    whiteSpace:
                      "pre-wrap"
                  }}
                >
                  {JSON.stringify(
                    resultadoImportacion,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "10px",
                marginTop: "20px",
                flexWrap: "wrap"
              }}
            >
              <button
                type="button"
                className="secondary-button"
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
                className="primary-button"
                onClick={
                  importarCsv
                }
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
          </div>
        </div>
      )}

      {mostrarModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            background:
              "rgba(15, 23, 42, 0.65)",
            overflowY: "auto"
          }}
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
              position: "relative",
              maxWidth: "650px",
              width:
                "calc(100% - 32px)",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              boxShadow:
                "0 24px 70px rgba(15, 23, 42, 0.28)"
            }}
          >
            <div className="modal-header">
              <div>
                <h2>
                  Nuevo artículo
                </h2>

                <p>
                  Registra un producto que todavía no existe en el inventario.
                </p>
              </div>

              <button
                type="button"
                className="text-button"
                onClick={
                  cerrarModal
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

            <form
              onSubmit={
                guardarArticulo
              }
            >
              <div className="form-group">
                <label>
                  Nombre *
                </label>

                <input
                  type="text"
                  name="nombre"
                  value={
                    nuevoProducto.nombre
                  }
                  onChange={
                    handleNuevoProducto
                  }
                  placeholder="Nombre del artículo"
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  SKU *
                </label>

                <input
                  type="text"
                  name="sku"
                  value={
                    nuevoProducto.sku
                  }
                  onChange={
                    handleNuevoProducto
                  }
                  placeholder="SKU del artículo"
                  required
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
                    Selecciona una categoría
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
              </div>

              <div className="form-group">
                <label>
                  Unidad de medida *
                </label>

                <input
                  type="text"
                  name="unidad_medida"
                  value={
                    nuevoProducto.unidad_medida
                  }
                  onChange={
                    handleNuevoProducto
                  }
                  placeholder="pieza, caja, kg, litro..."
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Existencias iniciales *
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
                  placeholder="0"
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
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>
                  Descripción
                </label>

                <textarea
                  name="descripcion"
                  rows="4"
                  value={
                    nuevoProducto.descripcion
                  }
                  onChange={
                    handleNuevoProducto
                  }
                  placeholder="Descripción opcional del artículo"
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                  marginTop:
                    "24px",
                  flexWrap:
                    "wrap"
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
                    ? "Guardando..."
                    : "Crear artículo"}
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
