import { useEffect, useState } from "react";
import {
  Eye,
  Plus,
  RefreshCw,
  ShoppingCart
} from "lucide-react";
import api from "../services/api";

const Compras = () => {
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);

  const [detalle, setDetalle] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);

  const [proveedorId, setProveedorId] = useState("");

  const [lineas, setLineas] = useState([
    {
      producto_id: "",
      cantidad_solicitada: 1,
      costo_unitario: ""
    }
  ]);

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
        ordenesRes,
        proveedoresRes,
        productosRes
      ] = await Promise.all([
        api.get("/compras"),
        api.get("/proveedores"),
        api.get("/productos")
      ]);

      setOrdenes(ordenesRes.data || []);
      setProveedores(proveedoresRes.data || []);
      setProductos(productosRes.data || []);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible cargar compras"
      );
    } finally {
      setLoading(false);
    }
  };

  const actualizarLinea = (
    index,
    campo,
    valor
  ) => {
    const nuevas = [...lineas];

    nuevas[index] = {
      ...nuevas[index],
      [campo]: valor
    };

    setLineas(nuevas);
  };

  const agregarLinea = () => {
    setLineas([
      ...lineas,
      {
        producto_id: "",
        cantidad_solicitada: 1,
        costo_unitario: ""
      }
    ]);
  };

  const crearOrden = async (event) => {
    event.preventDefault();

    try {
      await api.post("/compras", {
        proveedor_id: Number(proveedorId),
        lineas: lineas.map((linea) => ({
          producto_id: Number(
            linea.producto_id
          ),
          cantidad_solicitada: Number(
            linea.cantidad_solicitada
          ),
          costo_unitario:
            linea.costo_unitario === ""
              ? null
              : Number(linea.costo_unitario)
        }))
      });

      setMostrarNueva(false);
      setProveedorId("");

      setLineas([
        {
          producto_id: "",
          cantidad_solicitada: 1,
          costo_unitario: ""
        }
      ]);

      await cargarDatos();
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible crear la orden"
      );
    }
  };

  const verDetalle = async (id) => {
    try {
      const response = await api.get(
        `/compras/${id}`
      );

      setDetalle(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible cargar la orden"
      );
    }
  };

  const enviarOrden = async (id) => {
    try {
      await api.patch(
        `/compras/${id}/enviar`
      );

      await cargarDatos();
      await verDetalle(id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible enviar la orden"
      );
    }
  };

  const recibirCompleta = async () => {
    if (!detalle) return;

    try {
      const lineasRecibidas =
        detalle.lineas
          .map((linea) => {
            const pendiente =
              Number(linea.cantidad_solicitada) -
              Number(linea.cantidad_recibida);

            return {
              linea_id: linea.id,
              cantidad_recibida: pendiente
            };
          })
          .filter(
            (linea) =>
              linea.cantidad_recibida > 0
          );

      if (lineasRecibidas.length === 0) {
        return;
      }

      await api.patch(
        `/compras/${detalle.orden.id}/recibir`,
        {
          lineas: lineasRecibidas
        }
      );

      await cargarDatos();
      await verDetalle(detalle.orden.id);
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "No fue posible recibir la compra"
      );
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        Cargando compras...
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Compras</h1>
          <p>
            Órdenes de compra del almacén Central.
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
            onClick={() => setMostrarNueva(true)}
          >
            <Plus size={18} />
            Nueva orden
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="content-card">
        {ordenes.length === 0 ? (
          <div className="empty-state">
            No hay órdenes de compra.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th>Creada por</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {ordenes.map((orden) => (
                  <tr key={orden.id}>
                    <td>#{orden.id}</td>

                    <td>
                      {orden.proveedor_nombre}
                    </td>

                    <td>
                      <span className="status neutral">
                        {orden.estado}
                      </span>
                    </td>

                    <td>
                      {
                        orden.creado_por_usuario_nombre
                      }
                    </td>

                    <td>
                      {new Date(
                        orden.created_at
                      ).toLocaleDateString(
                        "es-MX"
                      )}
                    </td>

                    <td>
                      <button
                        className="table-action"
                        onClick={() =>
                          verDetalle(orden.id)
                        }
                      >
                        <Eye size={17} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mostrarNueva && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>Nueva orden de compra</h2>
                <p>
                  Selecciona proveedor y productos.
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setMostrarNueva(false)
                }
              >
                ×
              </button>
            </div>

            <form onSubmit={crearOrden}>
              <div className="form-group">
                <label>Proveedor</label>

                <select
                  className="form-control"
                  value={proveedorId}
                  onChange={(e) =>
                    setProveedorId(e.target.value)
                  }
                  required
                >
                  <option value="">
                    Seleccionar...
                  </option>

                  {proveedores.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-lines">
                {lineas.map(
                  (linea, index) => (
                    <div
                      className="purchase-line"
                      key={index}
                    >
                      <select
                        className="form-control"
                        value={linea.producto_id}
                        onChange={(e) =>
                          actualizarLinea(
                            index,
                            "producto_id",
                            e.target.value
                          )
                        }
                        required
                      >
                        <option value="">
                          Producto...
                        </option>

                        {productos.map(
                          (producto) => (
                            <option
                              key={producto.id}
                              value={producto.id}
                            >
                              {producto.nombre}
                            </option>
                          )
                        )}
                      </select>

                      <input
                        className="form-control"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Cantidad"
                        value={
                          linea.cantidad_solicitada
                        }
                        onChange={(e) =>
                          actualizarLinea(
                            index,
                            "cantidad_solicitada",
                            e.target.value
                          )
                        }
                      />

                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Costo"
                        value={
                          linea.costo_unitario
                        }
                        onChange={(e) =>
                          actualizarLinea(
                            index,
                            "costo_unitario",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                className="text-button"
                onClick={agregarLinea}
              >
                + Agregar producto
              </button>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setMostrarNueva(false)
                  }
                >
                  Cancelar
                </button>

                <button className="primary-button">
                  Crear orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalle && (
        <div className="modal-backdrop">
          <div className="modal-card large-modal">
            <div className="modal-header">
              <div>
                <h2>
                  Orden #{detalle.orden.id}
                </h2>

                <p>
                  {detalle.orden.proveedor_nombre}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setDetalle(null)
                }
              >
                ×
              </button>
            </div>

            <div className="shipment-status">
              <ShoppingCart size={20} />

              Estado:

              <strong>
                {detalle.orden.estado}
              </strong>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Solicitado</th>
                    <th>Recibido</th>
                    <th>Costo unitario</th>
                  </tr>
                </thead>

                <tbody>
                  {detalle.lineas.map(
                    (linea) => (
                      <tr key={linea.id}>
                        <td>
                          {linea.producto_nombre}
                        </td>

                        <td>
                          {linea.cantidad_solicitada}
                        </td>

                        <td>
                          {linea.cantidad_recibida}
                        </td>

                        <td>
                          {linea.costo_unitario
                            ? `$${Number(
                                linea.costo_unitario
                              ).toLocaleString(
                                "es-MX"
                              )}`
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              {detalle.orden.estado ===
                "borrador" && (
                <button
                  className="primary-button"
                  onClick={() =>
                    enviarOrden(
                      detalle.orden.id
                    )
                  }
                >
                  Enviar orden
                </button>
              )}

              {[
                "enviada",
                "parcial"
              ].includes(
                detalle.orden.estado
              ) && (
                <button
                  className="primary-button"
                  onClick={recibirCompleta}
                >
                  Recibir pendiente
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compras;