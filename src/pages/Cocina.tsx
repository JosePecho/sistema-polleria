
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../services/firebase";
import "./Cocina.css";

interface ItemPedido {
  nombre: string;
  cantidad: number;
  observaciones?: string;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  items: ItemPedido[];
  total: number;
  observaciones?: string;
  estado: string;
  fechaCreacion?: {
    toDate: () => Date;
  };
}

export default function Cocina() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState("Todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const consulta = query(
      collection(db, "pedidos"),
      orderBy("fechaCreacion", "desc")
    );

    const cancelar = onSnapshot(
      consulta,
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Pedido[];

        setPedidos(datos);
        setCargando(false);
        setError("");
      },
      () => {
        setError("No se pudieron cargar las comandas. Revisa Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  const cambiarEstado = async (pedidoId: string, nuevoEstado: string) => {
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), {
        estado: nuevoEstado,
      });
    } catch {
      alert("No se pudo actualizar el pedido. Revisa los permisos.");
    }
  };

  const pedidosFiltrados =
    filtro === "Todos"
      ? pedidos
      : pedidos.filter((pedido) => pedido.estado === filtro);

  const pendientes = pedidos.filter(
    (pedido) => pedido.estado === "Pendiente"
  ).length;

  const preparando = pedidos.filter(
    (pedido) => pedido.estado === "Preparando"
  ).length;

  const listos = pedidos.filter(
    (pedido) => pedido.estado === "Listo"
  ).length;

  if (cargando) {
    return <main className="cocina-contenedor">Cargando comandas...</main>;
  }

  return (
    <main className="cocina-contenedor">
      <header className="cocina-encabezado">
        <div>
          <h1>Panel de cocina</h1>
          <p>Control de comandas y preparación de pedidos.</p>
        </div>
        <span className="cocina-en-vivo">● EN VIVO</span>
      </header>

      <section className="cocina-resumen">
        <article className="cocina-resumen-card">
          <span>Pendientes</span>
          <strong>{pendientes}</strong>
        </article>
        <article className="cocina-resumen-card">
          <span>Preparando</span>
          <strong>{preparando}</strong>
        </article>
        <article className="cocina-resumen-card">
          <span>Listos</span>
          <strong>{listos}</strong>
        </article>
      </section>

      <section className="cocina-listado">
        <div className="cocina-listado-encabezado">
          <h2>Comandas recibidas</h2>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="Todos">Todos los pedidos</option>
            <option value="Pendiente">Pendientes</option>
            <option value="Preparando">Preparando</option>
            <option value="Listo">Listos</option>
            <option value="Entregado">Entregados</option>
          </select>
        </div>

        {error && <p className="cocina-error">{error}</p>}

        {pedidosFiltrados.length === 0 ? (
          <div className="cocina-vacio">
            <span>🍽️</span>
            <h3>No hay comandas</h3>
            <p>Los nuevos pedidos aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          <div className="cocina-grid">
            {pedidosFiltrados.map((pedido) => (
              <article className="cocina-pedido" key={pedido.id}>
                <div className="cocina-pedido-superior">
                  <h3>Mesa {pedido.numeroMesa}</h3>
                  <span
                    className={`cocina-estado estado-${pedido.estado.toLowerCase()}`}
                  >
                    {pedido.estado}
                  </span>
                </div>

                <div className="cocina-productos">
                  {pedido.items?.map((item, index) => (
                    <div className="cocina-producto" key={index}>
                      <strong>{item.cantidad} ×</strong>
                      <span>{item.nombre}</span>
                    </div>
                  ))}
                </div>

                {pedido.observaciones && (
                  <div className="cocina-observaciones">
                    <strong>Observaciones:</strong>
                    <p>{pedido.observaciones}</p>
                  </div>
                )}

                <div className="cocina-acciones">
                  {pedido.estado === "Pendiente" && (
                    <button
                      onClick={() =>
                        cambiarEstado(pedido.id, "Preparando")
                      }
                    >
                      Iniciar preparación
                    </button>
                  )}

                  {pedido.estado === "Preparando" && (
                    <button
                      onClick={() => cambiarEstado(pedido.id, "Listo")}
                    >
                      Marcar como listo
                    </button>
                  )}

                  {pedido.estado === "Listo" && (
                    <button
                      onClick={() =>
                        cambiarEstado(pedido.id, "Entregado")
                      }
                    >
                      Marcar como entregado
                    </button>
                  )}

                  {pedido.estado === "Entregado" && (
                    <p className="cocina-finalizado">
                      Pedido entregado
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
