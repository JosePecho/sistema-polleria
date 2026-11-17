
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../services/firebase";
import "./Seguimiento.css";

interface ItemPedido {
  nombre: string;
  cantidad: number;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  items: ItemPedido[];
  total: number;
  estado: string;
  observaciones?: string;
}

const estados = ["Pendiente", "Preparando", "Listo", "Entregado"];

export default function Seguimiento() {
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
        setError("No se pudo conectar con los pedidos de Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  const pedidosFiltrados =
    filtro === "Todos"
      ? pedidos
      : pedidos.filter((pedido) => pedido.estado === filtro);

  const obtenerPaso = (estado: string) => {
    const posicion = estados.indexOf(estado);
    return posicion >= 0 ? posicion : 0;
  };

  if (cargando) {
    return (
      <main className="seguimiento-contenedor">
        Cargando seguimiento...
      </main>
    );
  }

  return (
    <main className="seguimiento-contenedor">
      <header className="seguimiento-encabezado">
        <div>
          <h1>Seguimiento de pedidos</h1>
          <p>Consulta el estado de las comandas en tiempo real.</p>
        </div>
        <span className="seguimiento-en-vivo">● EN VIVO</span>
      </header>

      {error && <p className="seguimiento-error">{error}</p>}

      <section className="seguimiento-filtros">
        <label htmlFor="filtro-seguimiento">Filtrar pedidos:</label>
        <select
          id="filtro-seguimiento"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        >
          <option value="Todos">Todos</option>
          {estados.map((estado) => (
            <option value={estado} key={estado}>
              {estado}
            </option>
          ))}
        </select>
      </section>

      <section className="seguimiento-listado">
        {pedidosFiltrados.length === 0 ? (
          <div className="seguimiento-vacio">
            <span>📋</span>
            <h2>No hay pedidos para mostrar</h2>
            <p>Los pedidos registrados aparecerán aquí.</p>
          </div>
        ) : (
          pedidosFiltrados.map((pedido) => {
            const pasoActual = obtenerPaso(pedido.estado);

            return (
              <article className="seguimiento-card" key={pedido.id}>
                <div className="seguimiento-card-encabezado">
                  <div>
                    <h2>Pedido · Mesa {pedido.numeroMesa}</h2>
                    <span className="seguimiento-id">
                      Código: {pedido.id.slice(0, 8)}
                    </span>
                  </div>

                  <span
                    className={`seguimiento-estado seguimiento-${pedido.estado.toLowerCase()}`}
                  >
                    {pedido.estado}
                  </span>
                </div>

                <div className="seguimiento-productos">
                  {pedido.items?.map((item, index) => (
                    <div key={index} className="seguimiento-producto">
                      <span>{item.cantidad} × {item.nombre}</span>
                    </div>
                  ))}
                </div>

                {pedido.observaciones && (
                  <p className="seguimiento-observaciones">
                    <strong>Observaciones:</strong> {pedido.observaciones}
                  </p>
                )}

                <div className="seguimiento-progreso">
                  {estados.map((estado, index) => (
                    <div
                      className={`seguimiento-paso ${
                        index <= pasoActual ? "paso-completado" : ""
                      } ${index === pasoActual ? "paso-actual" : ""}`}
                      key={estado}
                    >
                      <span className="seguimiento-circulo">
                        {index < pasoActual ? "✓" : index + 1}
                      </span>
                      <span className="seguimiento-paso-texto">
                        {estado}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="seguimiento-total">
                  Total: S/ {Number(pedido.total).toFixed(2)}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
