import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Package,
  Search,
  RefreshCw
} from "lucide-react";
import api from "../services/api";

const Inventario = () => {
  const [inventario, setInventario] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "{}"
  );

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError("");

      const peticiones = [
        api.get("/reportes/inventario"),
        api.get("/categorias")
      ];

      if (usuario.rol === "principal") {
        peticiones.push(api.get("/ubicaciones"));
      }

      const respuestas = await Promise.all(peticiones);

      setInventario(respuestas[0].data || []);
      setCategorias(respuestas[1].data || []);

      if (usuario.rol === "principal") {
        setUbicaciones(respuestas[2].data || []);
      }
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.message ||
          "No fue posible cargar el inventario"
      );
    } finally {
      setLoading(false);
    }
  };

  const inventarioFiltrado = useMemo(() => {
    return inventario.filter((item) => {
      const texto = busqueda.toLowerCase().trim();

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
        Number(item.categoria_id) ===
          Number(categoria);

      const coincideUbicacion =
        !ubicacion ||
        Number(item.ubicacion_id) ===
          Number(ubicacion);

      const coincideStock =
        !soloBajoStock ||
        Number(item.stock_bajo) === 1;

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

  const totalProductos = new Set(
    inventario.map((item) => item.producto_id)
  ).size;

  const totalUnidades = inventario.reduce(
    (total, item) =>
      total + Number(item.cantidad || 0),
    0
  );

  const totalAlertas = inventario.filter(
    (item) => Number(item.stock_bajo) === 1
  ).length;

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoria("");
    setUbicacion("");
    setSoloBajoStock(false);
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
            Consulta existencias por producto,
            categoría y ubicación.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={cargarDatos}
        >
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

      {error && (
        <div className="error-message page-error">
          {error}
        </div>
      )}

      <section className="inventory-summary">
        <div className="mini-stat">
          <Package size={21} />

          <div>
            <span>Productos</span>
            <strong>{totalProductos}</strong>
          </div>
        </div>

        <div className="mini-stat">
          <Package size={21} />

          <div>
            <span>Existencias totales</span>
            <strong>
              {totalUnidades.toLocaleString("es-MX")}
            </strong>
          </div>
        </div>

        <div className="mini-stat">
          <AlertTriangle size={21} />

          <div>
            <span>Alertas</span>
            <strong>{totalAlertas}</strong>
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
                setBusqueda(event.target.value)
              }
            />
          </div>

          <select
            value={categoria}
            onChange={(event) =>
              setCategoria(event.target.value)
            }
          >
            <option value="">
              Todas las categorías
            </option>

            {categorias.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.nombre}
              </option>
            ))}
          </select>

          {usuario.rol === "principal" && (
            <select
              value={ubicacion}
              onChange={(event) =>
                setUbicacion(event.target.value)
              }
            >
              <option value="">
                Todas las ubicaciones
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
            {inventarioFiltrado.length}
          </strong>{" "}
          registros
        </div>

        {inventarioFiltrado.length === 0 ? (
          <div className="empty-state">
            No hay productos que coincidan con
            los filtros seleccionados.
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
                  <th>Punto reorden</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {inventarioFiltrado.map(
                  (item) => {
                    const bajoStock =
                      Number(item.stock_bajo) === 1;

                    return (
                      <tr
                        key={`${item.ubicacion_id}-${item.producto_id}`}
                      >
                        <td>
                          <strong>
                            {item.producto_nombre}
                          </strong>

                          <small className="table-secondary">
                            SKU: {item.sku}
                          </small>
                        </td>

                        <td>
                          {item.categoria_nombre}
                        </td>

                        <td>
                          {item.ubicacion_nombre}
                        </td>

                        <td>
                          <strong>
                            {Number(
                              item.cantidad
                            ).toLocaleString(
                              "es-MX"
                            )}
                          </strong>{" "}
                          {item.unidad_medida}
                        </td>

                        <td>
                          {Number(
                            item.punto_reorden
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
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Inventario;