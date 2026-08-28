import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Truck,
  Building2,
  ShoppingCart,
  BarChart3,
  Users,
  LogOut
} from "lucide-react";

const Sidebar = () => {
  const navigate = useNavigate();

  const usuario = JSON.parse(
    localStorage.getItem("usuario") || "{}"
  );

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");

    navigate("/login");
  };

  const esPrincipal =
    usuario.rol === "principal";

  const esSucursal =
    usuario.rol === "sucursal";

  const esEquipoInterno =
    usuario.rol === "equipo_interno";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>ENIGMA</h2>
        <span>Inventario</span>
      </div>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {usuario.nombre
            ? usuario.nombre
                .charAt(0)
                .toUpperCase()
            : "U"}
        </div>

        <div>
          <strong>
            {usuario.nombre ||
              "Usuario"}
          </strong>

          <small>
            {usuario.ubicacion_nombre ||
              "Sin ubicación"}
          </small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard">
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>

        <NavLink to="/inventario">
          <Package size={20} />
          Inventario
        </NavLink>

        <NavLink to="/solicitudes">
          <ClipboardList size={20} />
          Solicitudes
        </NavLink>

        <NavLink to="/envios">
          <Truck size={20} />
          Envíos
        </NavLink>

        {esPrincipal && (
          <>
            <NavLink to="/proveedores">
              <Building2 size={20} />
              Proveedores
            </NavLink>

            <NavLink to="/compras">
              <ShoppingCart size={20} />
              Compras
            </NavLink>

            <NavLink to="/reportes">
              <BarChart3 size={20} />
              Reportes
            </NavLink>

            {usuario.nivel_permiso ===
              "aprobador_admin" && (
              <NavLink to="/usuarios">
                <Users size={20} />
                Usuarios
              </NavLink>
            )}
          </>
        )}

        {esEquipoInterno && (
          <NavLink to="/reportes">
            <BarChart3 size={20} />
            Reportes
          </NavLink>
        )}

        {esSucursal && (
          <NavLink to="/reportes">
            <BarChart3 size={20} />
            Reportes
          </NavLink>
        )}
      </nav>

      <button
        className="logout-button"
        onClick={cerrarSesion}
      >
        <LogOut size={20} />
        Cerrar sesión
      </button>
    </aside>
  );
};

export default Sidebar;