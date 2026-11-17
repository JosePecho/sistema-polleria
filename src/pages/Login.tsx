
import { useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../services/firebase";
import "./Login.css";

export type RolUsuario = "administrador" | "mozo" | "cocina" | "cajero";

interface LoginProps {
  sessionError: string;
  onLoginAttempt: () => void;
}

export default function Login({ sessionError, onLoginAttempt }: LoginProps) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const iniciarSesion = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    onLoginAttempt();

    if (!correo.trim() || !password) {
      setError("Ingresa tu correo y contraseña.");
      return;
    }

    try {
      setCargando(true);

      await signInWithEmailAndPassword(
        auth,
        correo.trim(),
        password
      );
    } catch (err: unknown) {
      const codigo = (err as { code?: string }).code;

      if (
        codigo === "auth/invalid-credential" ||
        codigo === "auth/wrong-password" ||
        codigo === "auth/user-not-found"
      ) {
        setError("Correo o contraseña incorrectos.");
      } else if (codigo === "auth/too-many-requests") {
        setError("Demasiados intentos. Inténtalo más tarde.");
      } else if (codigo === "auth/invalid-email") {
        setError("El correo electrónico no es válido.");
      } else {
        console.error(err);
        setError("No se pudo iniciar sesión. Verifica tu conexión.");
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-header">
          <div className="login-logo">♨</div>

          <h1>
            POLLERÍA <span>PRO</span>
          </h1>

          <p>Sistema de gestión de pedidos</p>
        </header>

        <div className="login-welcome">
          <h2>¡Bienvenido!</h2>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        <form onSubmit={iniciarSesion} autoComplete="off">
          <div className="form-group">
            <label htmlFor="correo">Correo electrónico</label>

            <div className="input-container">
              <span className="input-icon">✉</span>

              <input
                id="correo"
                name="correo-acceso"
                type="email"
                placeholder="ejemplo@correo.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>

            <div className="input-container">
              <span className="input-icon">♙</span>

              <input
                id="password"
                name="clave-acceso"
                type={mostrarPassword ? "text" : "password"}
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
                required
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                aria-label="Mostrar u ocultar contraseña"
              >
                {mostrarPassword ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          {(error || sessionError) && (
            <div className="login-error">
              {error || sessionError}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={cargando}
          >
            {cargando ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>

        <footer className="login-footer">
          <strong>POLLERÍA PRO © 2026</strong>
          <p>Sistema de gestión interno</p>
        </footer>
      </section>
    </main>
  );
}
