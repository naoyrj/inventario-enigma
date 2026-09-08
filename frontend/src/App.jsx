import {
  Navigate,
  Route,
  Routes
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Solicitudes from "./pages/Solicitudes";
import Envios from "./pages/Envios";
import Proveedores from "./pages/Proveedores";
import Compras from "./pages/Compras";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import Ubicaciones from "./pages/Ubicaciones";
import Categorias from "./pages/Categorias";

import Layout from "./components/Layout";

const ProtectedRoute = ({ children }) => {
  const token =
    localStorage.getItem("token");

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
};

const PrincipalRoute = ({
  children,
  adminOnly = false
}) => {
  const usuario = JSON.parse(
    localStorage.getItem("usuario") ||
      "{}"
  );

  if (usuario.rol !== "principal") {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  if (
    adminOnly &&
    usuario.nivel_permiso !==
      "aprobador_admin"
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/inventario"
          element={<Inventario />}
        />

        <Route
          path="/categorias"
          element={<Categorias />}
        />

        <Route
          path="/solicitudes"
          element={<Solicitudes />}
        />

        <Route
          path="/envios"
          element={<Envios />}
        />

        <Route
          path="/reportes"
          element={<Reportes />}
        />

        <Route
          path="/proveedores"
          element={
            <PrincipalRoute>
              <Proveedores />
            </PrincipalRoute>
          }
        />

        <Route
          path="/compras"
          element={
            <PrincipalRoute>
              <Compras />
            </PrincipalRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <PrincipalRoute adminOnly>
              <Usuarios />
            </PrincipalRoute>
          }
        />

        <Route
          path="/ubicaciones"
          element={
            <PrincipalRoute adminOnly>
              <Ubicaciones />
            </PrincipalRoute>
          }
        />
      </Route>

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
};

export default App;