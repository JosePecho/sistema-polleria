
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../services/firebase";
import "./Mesas.css";

interface Mesa {
  id: string;
  numero: number;
  capacidad: number;
  estado: "Disponible" | "Ocupada";
  cliente?: string;
}

export default function Mesas() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const referencia = collection(db, "mesas");

    const cancelar = onSnapshot(
      referencia,
      async (snapshot) => {
        try {
          if (snapshot.empty) {
            for (let numero = 1; numero <= 8; numero++) {
              await setDoc(doc(db, "mesas", `mesa-${numero}`), {
                numero,
                capacidad: 4,
                estado: "Disponible",
                cliente: "",
                fechaActualizacion: serverTimestamp(),
              });
            }
            return;
          }

          const datos = snapshot.docs.map((documento) => ({
            id: documento.id,
            ...(documento.data() as Omit<Mesa, "id">),
          }));

          datos.sort((a, b) => a.numero - b.numero);
          setMesas(datos);
          setCargando(false);
          setError("");
        } catch {
          setError("No se pudieron cargar las mesas.");
          setCargando(false);
        }
      },
      () => {
        setError("Error de conexión o permisos de Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  const ocuparMesa = async (mesa: Mesa) => {
    const cliente = window.prompt(
      `Nombre del cliente para la mesa ${mesa.numero}:`
    );

    if (cliente === null) return;

    if (!cliente.trim()) {
      alert("Escribe el nombre del cliente.");
      return;
    }

    try {
      const referenciaMesa = doc(db, "mesas", mesa.id);

      await runTransaction(db, async (transaction) => {
        const documento = await transaction.get(referenciaMesa);

        if (!documento.exists()) {
          throw new Error("MESA_NO_EXISTE");
        }

        const datosActuales = documento.data();

        if (datosActuales.estado !== "Disponible") {
          throw new Error("MESA_YA_OCUPADA");
        }

        transaction.update(referenciaMesa, {
          estado: "Ocupada",
          cliente: cliente.trim(),
          fechaActualizacion: serverTimestamp(),
        });
      });

      alert(`Mesa ${mesa.numero} ocupada correctamente.`);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "MESA_YA_OCUPADA"
      ) {
        alert(
          `La mesa ${mesa.numero} ya fue ocupada por otro usuario. Actualiza la pantalla y selecciona otra mesa.`
        );
      } else {
        console.error("Error al ocupar mesa:", error);
        alert("No se pudo ocupar la mesa. Revisa los permisos de Firebase.");
      }
    }
  };

  const liberarMesa = async (mesa: Mesa) => {
    const confirmar = window.confirm(
      `¿Deseas liberar la mesa ${mesa.numero}?`
    );

    if (!confirmar) return;

    try {
      await updateDoc(doc(db, "mesas", mesa.id), {
        estado: "Disponible",
        cliente: "",
        fechaActualizacion: serverTimestamp(),
      });
    } catch {
      alert("No se pudo liberar la mesa.");
    }
  };

  const ocupadas = mesas.filter((mesa) => mesa.estado === "Ocupada").length;
  const disponibles = mesas.length - ocupadas;

  if (cargando) {
    return <div className="mesas-contenedor">Cargando mesas...</div>;
  }

  return (
    <main className="mesas-contenedor">
      <header className="mesas-encabezado">
        <div>
          <h1>Gestión de mesas</h1>
          <p>Administra la disponibilidad de las mesas del restaurante.</p>
        </div>
      </header>

      <section className="mesas-resumen">
        <article className="mesa-resumen-card">
          <span>Total de mesas</span>
          <strong>{mesas.length}</strong>
        </article>

        <article className="mesa-resumen-card">
          <span>Disponibles</span>
          <strong>{disponibles}</strong>
        </article>

        <article className="mesa-resumen-card">
          <span>Ocupadas</span>
          <strong>{ocupadas}</strong>
        </article>
      </section>

      {error && <p className="mesas-error">{error}</p>}

      <section className="mesas-grid">
        {mesas.map((mesa) => (
          <article
            className={`mesa-card ${
              mesa.estado === "Ocupada" ? "mesa-ocupada" : "mesa-disponible"
            }`}
            key={mesa.id}
          >
            <div className="mesa-card-superior">
              <h2>Mesa {mesa.numero}</h2>
              <span className="mesa-estado">{mesa.estado}</span>
            </div>

            <div className="mesa-icono">🍽️</div>

            <p>Capacidad: {mesa.capacidad} personas</p>

            {mesa.estado === "Ocupada" && mesa.cliente && (
              <p className="mesa-cliente">Cliente: {mesa.cliente}</p>
            )}

            {mesa.estado === "Disponible" ? (
              <button
                className="mesa-boton mesa-boton-ocupar"
                onClick={() => ocuparMesa(mesa)}
              >
                Ocupar mesa
              </button>
            ) : (
              <button
                className="mesa-boton mesa-boton-liberar"
                onClick={() => liberarMesa(mesa)}
              >
                Liberar mesa
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
