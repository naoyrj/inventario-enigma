import {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  LockKeyhole,
  Mail,
  KeyRound,
  UserRound,
  MapPin,
  Settings
} from "lucide-react";

import api from "../services/api";

const Login = () => {
  const navigate = useNavigate();

  const [tipoAcceso, setTipoAcceso] =
    useState("personal");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    sucursales,
    setSucursales
  ] = useState([]);

  const [
    sucursalDispositivo,
    setSucursalDispositivo
  ] = useState(() => {
    const guardada =
      localStorage.getItem(
        "sucursal_dispositivo"
      );

    if (!guardada) {
      return null;
    }

    try {
      return JSON.parse(
        guardada
      );
    } catch {
      localStorage.removeItem(
        "sucursal_dispositivo"
      );

      return null;
    }
  });

  const [
    sucursalSeleccionada,
    setSucursalSeleccionada
  ] = useState("");

  const [
    usuariosSucursal,
    setUsuariosSucursal
  ] = useState([]);

  const [
    usuarioSucursal,
    setUsuarioSucursal
  ] = useState("");

  const [pin, setPin] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    cargandoSucursales,
    setCargandoSucursales
  ] = useState(false);

  const [
    cargandoUsuarios,
    setCargandoUsuarios
  ] = useState(false);

  useEffect(() => {
    cargarSucursales();
  }, []);

  useEffect(() => {
    if (
      sucursalDispositivo?.id
    ) {
      cargarUsuariosSucursal(
        sucursalDispositivo.id
      );
    } else {
      setUsuariosSucursal([]);
      setUsuarioSucursal("");
    }
  }, [sucursalDispositivo]);

  const cargarSucursales =
    async () => {
      try {
        setCargandoSucursales(
          true
        );

        const response =
          await api.get(
            "/auth/sucursales"
          );

        setSucursales(
          response.data || []
        );
      } catch (error) {
        console.error(
          "No fue posible cargar las sucursales",
          error
        );
      } finally {
        setCargandoSucursales(
          false
        );
      }
    };

  const cargarUsuariosSucursal =
    async (ubicacionId) => {
      try {
        setCargandoUsuarios(
          true
        );

        setError("");

        const response =
          await api.get(
            "/auth/usuarios-sucursal",
            {
              params: {
                ubicacion_id:
                  Number(
                    ubicacionId
                  )
              }
            }
          );

        setUsuariosSucursal(
          response.data || []
        );

        setUsuarioSucursal("");
      } catch (error) {
        console.error(
          "No fue posible cargar usuarios de sucursal",
          error
        );

        setUsuariosSucursal(
          []
        );

        setError(
          error.response?.data
            ?.message ||
            "No fue posible cargar usuarios de esta sucursal"
        );
      } finally {
        setCargandoUsuarios(
          false
        );
      }
    };

  const configurarSucursal =
    () => {
      setError("");

      const sucursal =
        sucursales.find(
          (item) =>
            Number(item.id) ===
            Number(
              sucursalSeleccionada
            )
        );

      if (!sucursal) {
        setError(
          "Selecciona una sucursal"
        );

        return;
      }

      const configuracion = {
        id: Number(
          sucursal.id
        ),
        nombre:
          sucursal.nombre
      };

      localStorage.setItem(
        "sucursal_dispositivo",
        JSON.stringify(
          configuracion
        )
      );

      setSucursalDispositivo(
        configuracion
      );

      setSucursalSeleccionada(
        ""
      );

      setUsuarioSucursal(
        ""
      );

      setPin("");
    };

  const cambiarSucursal =
    () => {
      const confirmar =
        window.confirm(
          "¿Deseas cambiar la sucursal configurada para este dispositivo?"
        );

      if (!confirmar) {
        return;
      }

      localStorage.removeItem(
        "sucursal_dispositivo"
      );

      setSucursalDispositivo(
        null
      );

      setUsuariosSucursal(
        []
      );

      setUsuarioSucursal(
        ""
      );

      setPin("");
      setError("");
    };

  const guardarSesion = (
    data
  ) => {
    localStorage.setItem(
      "token",
      data.token
    );

    localStorage.setItem(
      "usuario",
      JSON.stringify(
        data.usuario
      )
    );

    navigate(
      "/dashboard"
    );
  };

  const loginPersonal =
    async (event) => {
      event.preventDefault();

      try {
        setLoading(true);
        setError("");

        const response =
          await api.post(
            "/auth/login",
            {
              email,
              password
            }
          );

        guardarSesion(
          response.data
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
            "No fue posible iniciar sesión"
        );
      } finally {
        setLoading(false);
      }
    };

  const loginSucursal =
    async (event) => {
      event.preventDefault();

      if (
        !sucursalDispositivo?.id
      ) {
        setError(
          "Primero configura la sucursal de este dispositivo"
        );

        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await api.post(
            "/auth/login-pin",
            {
              usuario_id:
                Number(
                  usuarioSucursal
                ),

              pin,

              ubicacion_id:
                Number(
                  sucursalDispositivo.id
                )
            }
          );

        guardarSesion(
          response.data
        );
      } catch (error) {
        setError(
          error.response?.data
            ?.message ||
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

          <h1>
            Enigma Rooms
          </h1>

          <p>
            Sistema de Inventario
          </p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={
              tipoAcceso ===
              "personal"
                ? "login-tab active"
                : "login-tab"
            }
            onClick={() => {
              setTipoAcceso(
                "personal"
              );

              setError("");
            }}
          >
            Personal
          </button>

          <button
            type="button"
            className={
              tipoAcceso ===
              "sucursal"
                ? "login-tab active"
                : "login-tab"
            }
            onClick={() => {
              setTipoAcceso(
                "sucursal"
              );

              setError("");
            }}
          >
            Sucursal / PIN
          </button>
        </div>

        {tipoAcceso ===
        "personal" ? (
          <form
            className="login-form"
            onSubmit={
              loginPersonal
            }
          >
            <div className="form-group">
              <label>
                Correo electrónico
              </label>

              <div className="input-with-icon">
                <Mail
                  size={19}
                />

                <input
                  type="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target
                        .value
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
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
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
          <>
            {!sucursalDispositivo ? (
              <div className="login-form">
                <div className="form-group">
                  <label>
                    Configurar sucursal
                    del dispositivo
                  </label>

                  <div className="input-with-icon">
                    <MapPin
                      size={19}
                    />

                    <select
                      value={
                        sucursalSeleccionada
                      }
                      onChange={(
                        event
                      ) =>
                        setSucursalSeleccionada(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        cargandoSucursales
                      }
                    >
                      <option value="">
                        {cargandoSucursales
                          ? "Cargando..."
                          : "Seleccionar sucursal..."}
                      </option>

                      {sucursales.map(
                        (
                          sucursal
                        ) => (
                          <option
                            key={
                              sucursal.id
                            }
                            value={
                              sucursal.id
                            }
                          >
                            {
                              sucursal.nombre
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <p
                  style={{
                    fontSize:
                      "13px",
                    opacity: 0.75,
                    lineHeight: 1.5
                  }}
                >
                  Esta selección se
                  guardará en este
                  navegador para que
                  solo aparezca el
                  personal de esta
                  sucursal.
                </p>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  className="primary-button login-button"
                  onClick={
                    configurarSucursal
                  }
                  disabled={
                    !sucursalSeleccionada
                  }
                >
                  Configurar dispositivo
                </button>
              </div>
            ) : (
              <form
                className="login-form"
                onSubmit={
                  loginSucursal
                }
              >
                <div
                  style={{
                    padding:
                      "12px 14px",
                    marginBottom:
                      "18px",
                    border:
                      "1px solid #ddd",
                    borderRadius:
                      "8px"
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: "12px"
                    }}
                  >
                    <div>
                      <small>
                        Dispositivo
                        configurado para
                      </small>

                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "6px",
                          marginTop:
                            "4px",
                          fontWeight:
                            600
                        }}
                      >
                        <MapPin
                          size={16}
                        />

                        {
                          sucursalDispositivo.nombre
                        }
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        cambiarSucursal
                      }
                      title="Cambiar sucursal"
                      style={{
                        border:
                          "none",
                        background:
                          "transparent",
                        cursor:
                          "pointer"
                      }}
                    >
                      <Settings
                        size={19}
                      />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Selecciona tu
                    nombre
                  </label>

                  <div className="input-with-icon">
                    <UserRound
                      size={19}
                    />

                    <select
                      value={
                        usuarioSucursal
                      }
                      onChange={(
                        event
                      ) =>
                        setUsuarioSucursal(
                          event.target
                            .value
                        )
                      }
                      required
                      disabled={
                        cargandoUsuarios
                      }
                    >
                      <option value="">
                        {cargandoUsuarios
                          ? "Cargando usuarios..."
                          : "Seleccionar usuario..."}
                      </option>

                      {usuariosSucursal.map(
                        (
                          usuario
                        ) => (
                          <option
                            key={
                              usuario.id
                            }
                            value={
                              usuario.id
                            }
                          >
                            {
                              usuario.nombre
                            }
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
                    <KeyRound
                      size={19}
                    />

                    <input
                      type="password"
                      inputMode="numeric"
                      minLength="4"
                      maxLength="6"
                      value={pin}
                      onChange={(
                        event
                      ) => {
                        const valor =
                          event.target.value.replace(
                            /\D/g,
                            ""
                          );

                        setPin(
                          valor
                        );
                      }}
                      placeholder="4 a 6 dígitos"
                      required
                    />
                  </div>
                </div>

                {usuariosSucursal.length ===
                  0 &&
                  !cargandoUsuarios && (
                    <div className="error-message">
                      No hay usuarios
                      activos registrados
                      en esta sucursal.
                    </div>
                  )}

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <button
                  className="primary-button login-button"
                  disabled={
                    loading ||
                    cargandoUsuarios ||
                    !usuarioSucursal ||
                    pin.length < 4
                  }
                >
                  {loading
                    ? "Validando..."
                    : "Ingresar con PIN"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;