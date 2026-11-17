
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./services/firebase";

import Login, { type RolUsuario } from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Mesas from "./pages/Mesas";
import Pedidos from "./pages/Pedidos";
import Cocina from "./pages/Cocina";
import Caja from "./pages/Caja";
import Productos from "./pages/Productos";
import Reportes from "./pages/Reportes";
import Seguimiento from "./pages/Seguimiento";
import Consumo from "./pages/Consumo";
import "./App.css";

const nombresRuta: Record<string, string> = {
  "/mesas": "Mesas",
  "/productos": "Productos",
  "/pedidos": "Pedidos",
  "/cocina": "Cocina",
  "/seguimiento": "Seguimiento",
  "/consumo": "Consumo",
  "/caja": "Caja",
  "/reportes": "Reportes",
};

const rutasPorRol: Record<RolUsuario, string[]> = {
  administrador: [
    "/",
    "/mesas",
    "/productos",
    "/pedidos",
    "/cocina",
    "/seguimiento",
    "/consumo",
    "/caja",
    "/reportes",
  ],
  mozo: ["/mesas", "/pedidos"],
  cocina: ["/cocina", "/seguimiento"],
  cajero: ["/consumo", "/caja", "/seguimiento"],
};

const rolesPermitidos: RolUsuario[] = [
  "administrador",
  "mozo",
  "cocina",
  "cajero",
];

function esRolUsuario(rol: unknown): rol is RolUsuario {
  return (
    typeof rol === "string" &&
    rolesPermitidos.includes(rol as RolUsuario)
  );
}

function Aplicacion() {
  const [rol, setRol] = useState<RolUsuario | null>(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);
  const [errorSesion, setErrorSesion] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let activa = true;

    const cancelar = onAuthStateChanged(auth, async (usuario) => {
      if (!activa) return;

      if (!usuario) {
        setRol(null);
        setVerificandoSesion(false);
        return;
      }

      setVerificandoSesion(true);
      setRol(null);
      setErrorSesion("");

      try {
        const perfilRef = doc(db, "usuarios", usuario.uid);
        const resultado = await getDoc(perfilRef);

        if (!activa || auth.currentUser?.uid !== usuario.uid) return;

        if (!resultado.exists()) {
          console.error("No existe el perfil:", usuario.uid);
          setErrorSesion(
            "El usuario no tiene un perfil registrado en el sistema."
          );
          await signOut(auth);
          return;
        }

        const perfil = resultado.data();

        // DIAGNÓSTICO TEMPORAL
        console.log("PERFIL RECIBIDO:", perfil);
        console.log("ROL RECIBIDO:", JSON.stringify(perfil.rol));
        console.log("UID AUTENTICADO:", usuario.uid);
        console.log("UID DEL PERFIL:", perfil.uid);

        if (perfil.uid !== usuario.uid) {
          setErrorSesion(
            "El perfil del usuario no coincide con su identidad."
          );
          await signOut(auth);
          return;
        }

        if (perfil.activo !== true) {
          setErrorSesion(
            "Tu cuenta está desactivada. Contacta al administrador."
          );
          await signOut(auth);
          return;
        }

        if (!esRolUsuario(perfil.rol)) {
          console.error(
            "ROL NO VÁLIDO:",
            JSON.stringify(perfil.rol),
            typeof perfil.rol
          );

          setErrorSesion("El rol de este usuario no es válido.");
          await signOut(auth);
          return;
        }

        setRol(perfil.rol);
      } catch (error) {
        console.error(
          "No se pudo verificar el perfil del usuario:",
          error
        );

        if (activa) {
          setErrorSesion(
            "No se pudo verificar tu perfil. Se cerró la sesión; revisa tu conexión o los permisos."
          );

          try {
            await signOut(auth);
          } catch (errorAlCerrar) {
            console.error(
              "No se pudo cerrar la sesión inválida:",
              errorAlCerrar
            );
          }
        }
      } finally {
        if (activa) {
          setVerificandoSesion(false);
        }
      }
    });

    return () => {
      activa = false;
      cancelar();
    };
  }, []);

  const cerrarSesion = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("No se pudo cerrar la sesión.");
    }
  };

  if (verificandoSesion) {
    return (
      <main
        className="login-page"
        aria-live="polite"
        aria-busy="true"
      >
        <section className="login-card">
          <header className="login-header">
            <div className="login-logo">♨</div>
            <h1>
              POLLERÍA <span>PRO</span>
            </h1>
            <p>Sistema de gestión de pedidos</p>
          </header>

          <div className="login-success">
            <div className="success-icon">…</div>
            <h2>Verificando sesión</h2>
            <p>Estamos validando tu acceso al sistema.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!rol) {
    return (
      <Login
        sessionError={errorSesion}
        onLoginAttempt={() => setErrorSesion("")}
      />
    );
  }

  const rutasPermitidas = rutasPorRol[rol];
  const rutaInicial =
    rol === "administrador" ? "/" : rutasPermitidas[0];

  const rutaActual = location.pathname;
  const rutaAutorizada = rutasPermitidas.includes(rutaActual);

  return (
    <>
      <header className="app-topbar">
        <Link className="app-brand" to={rutaInicial}>
          <span className="app-brand-mark">P</span>
          <span>
            POLLERÍA <b>PRO</b>
            <small>GESTIÓN RESTAURANTE</small>
          </span>
        </Link>

        <nav
          className="app-nav"
          aria-label="Navegación principal"
        >
          {rutasPermitidas
            .filter((ruta) => ruta !== "/")
            .map((ruta) => (
              <Link
                className={
                  rutaActual === ruta
                    ? "app-nav-link active"
                    : "app-nav-link"
                }
                key={ruta}
                to={ruta}
              >
                {nombresRuta[ruta]}
              </Link>
            ))}
        </nav>

        <div className="app-user-tools">
          <span className="app-role">
            <i />
            {rol}
          </span>

          <button
            className="app-logout"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {!rutaAutorizada ? (
        <Navigate to={rutaInicial} replace />
      ) : rutaActual === "/" ? (
        <Dashboard />
      ) : (
        <Routes>
          <Route path="/mesas" element={<Mesas />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/cocina" element={<Cocina />} />
          <Route path="/seguimiento" element={<Seguimiento />} />
          <Route path="/consumo" element={<Consumo />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route
            path="*"
            element={<Navigate to={rutaInicial} replace />}
          />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Aplicacion />
    </BrowserRouter>
  );
}
