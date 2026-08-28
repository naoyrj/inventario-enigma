import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Mail,
  KeyRound,
  UserRound
} from "lucide-react";
import api from "../services/api";

const Login = () => {
  const navigate = useNavigate();

  const [tipoAcceso, setTipoAcceso] =
    useState("personal");

  const [email, setEmail] =
    useState("admin@enigma.local");

  const [password, setPassword] =
    useState("Admin123!");

  const [usuariosSucursal, setUsuariosSucursal] =
    useState([]);

  const [usuarioSucursal, setUsuarioSucursal] =
    useState("");

  const [pin, setPin] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarUsuariosSucursal();
  }, []);

  const cargarUsuariosSucursal = async () => {
    try {
      const response = await api.get(
        "/auth/usuarios-sucursal"
      );

      setUsuariosSucursal(
        response.data || []
      );
    } catch (error) {
      console.error(
        "No fue posible cargar usuarios de sucursal",
        error
      );
    }
  };

  const guardarSesion = (data) => {
    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "usuario",
      JSON.stringify(data.usuario)
    );

    navigate("/dashboard");
  };

  const loginPersonal = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const response = await api.post(
        "/auth/login",
        {
          email,
          password
        }
      );

      guardarSesion(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible iniciar sesión"
      );
    } finally {
      setLoading(false);
    }
  };

  const loginSucursal = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const response = await api.post(
        "/auth/login-pin",
        {
          usuario_id: Number(
            usuarioSucursal
          ),
          pin
        }
      );

      guardarSesion(response.data);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "No fue posible validar el PIN"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-brand">
          <div className="login-logo">
            E
          </div>

          <h1>Enigma Rooms</h1>

          <p>
            Sistema de Inventario
          </p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={
              tipoAcceso === "personal"
                ? "login-tab active"
                : "login-tab"
            }
            onClick={() => {
              setTipoAcceso("personal");
              setError("");
            }}
          >
            Personal
          </button>

          <button
            type="button"
            className={
              tipoAcceso === "sucursal"
                ? "login-tab active"
                : "login-tab"
            }
            onClick={() => {
              setTipoAcceso("sucursal");
              setError("");
            }}
          >
            Sucursal / PIN
          </button>
        </div>

        {tipoAcceso === "personal" ? (
          <form
            className="login-form"
            onSubmit={loginPersonal}
          >
            <div className="form-group">
              <label>
                Correo electrónico
              </label>

              <div className="input-with-icon">
                <Mail size={19} />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="correo@enigma.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                Contraseña
              </label>

              <div className="input-with-icon">
                <LockKeyhole
                  size={19}
                />

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Contraseña"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              className="primary-button login-button"
              disabled={loading}
            >
              {loading
                ? "Ingresando..."
                : "Iniciar sesión"}
            </button>
          </form>
        ) : (
          <form
            className="login-form"
            onSubmit={loginSucursal}
          >
            <div className="form-group">
              <label>
                Selecciona tu nombre
              </label>

              <div className="input-with-icon">
                <UserRound size={19} />

                <select
                  value={usuarioSucursal}
                  onChange={(event) =>
                    setUsuarioSucursal(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Seleccionar usuario...
                  </option>

                  {usuariosSucursal.map(
                    (usuario) => (
                      <option
                        key={usuario.id}
                        value={usuario.id}
                      >
                        {usuario.nombre}
                        {" — "}
                        {
                          usuario.ubicacion_nombre
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>
                PIN
              </label>

              <div className="input-with-icon">
                <KeyRound size={19} />

                <input
                  type="password"
                  inputMode="numeric"
                  maxLength="6"
                  value={pin}
                  onChange={(event) => {
                    const valor =
                      event.target.value.replace(
                        /\D/g,
                        ""
                      );

                    setPin(valor);
                  }}
                  placeholder="4 a 6 dígitos"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <button
              className="primary-button login-button"
              disabled={loading}
            >
              {loading
                ? "Validando..."
                : "Ingresar con PIN"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;