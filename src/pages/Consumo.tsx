
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import "./Consumo.css";

interface ItemPedido {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

interface Pedido {
  id: string;
  mesaId?: string;
  numeroMesa: number;
  items: ItemPedido[];
  total: number;
  estado: string;
  fechaCreacion?: {
    toDate: () => Date;
  };
}

interface ConsumoMesa {
  mesaId: string;
  numeroMesa: number;
  pedidos: Pedido[];
  items: ItemPedido[];
  total: number;
}

export default function Consumo() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mesaSeleccionada, setMesaSeleccionada] = useState<string>("Todas");

  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "pedidos"),
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
        setError("No se pudieron cargar los consumos desde Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  const consumos = useMemo(() => {
    const agrupados = new Map<string, ConsumoMesa>();

    pedidos.forEach((pedido) => {
      const clave = pedido.mesaId || `mesa-${pedido.numeroMesa}`;

      if (!agrupados.has(clave)) {
        agrupados.set(clave, {
          mesaId: clave,
          numeroMesa: pedido.numeroMesa,
          pedidos: [],
          items: [],
          total: 0,
        });
      }

      const consumo = agrupados.get(clave)!;
      consumo.pedidos.push(pedido);
      consumo.total += Number(pedido.total) || 0;

      (pedido.items || []).forEach((item) => {
        consumo.items.push(item);
      });
    });

    return Array.from(agrupados.values()).sort(
      (a, b) => a.numeroMesa - b.numeroMesa
    );
  }, [pedidos]);

  const consumosFiltrados =
    mesaSeleccionada === "Todas"
      ? consumos
      : consumos.filter(
          (consumo) => consumo.mesaId === mesaSeleccionada
        );

  const totalGeneral = consumos.reduce(
    (suma, consumo) => suma + consumo.total,
    0
  );

  const cantidadPedidos = pedidos.length;

  if (cargando) {
    return (
      <main className="consumo-contenedor">
        Cargando consumos...
      </main>
    );
  }

  return (
    <main className="consumo-contenedor">
      <header className="consumo-encabezado">
        <div>
          <h1>Consumo por mesa</h1>
          <p>Consulta los pedidos y el importe acumulado de cada mesa.</p>
        </div>
        <span className="consumo-en-vivo">● EN VIVO</span>
      </header>

      {error && <p className="consumo-error">{error}</p>}

      <section className="consumo-resumen">
        <article className="consumo-resumen-card">
          <span>Mesas con pedidos</span>
          <strong>{consumos.length}</strong>
        </article>

        <article className="consumo-resumen-card">
          <span>Pedidos registrados</span>
          <strong>{cantidadPedidos}</strong>
        </article>

        <article className="consumo-resumen-card">
          <span>Consumo acumulado</span>
          <strong>S/ {totalGeneral.toFixed(2)}</strong>
        </article>
      </section>

      <section className="consumo-filtro">
        <label htmlFor="filtro-mesa-consumo">Filtrar por mesa</label>
        <select
          id="filtro-mesa-consumo"
          value={mesaSeleccionada}
          onChange={(e) => setMesaSeleccionada(e.target.value)}
        >
          <option value="Todas">Todas las mesas</option>
          {consumos.map((consumo) => (
            <option value={consumo.mesaId} key={consumo.mesaId}>
              Mesa {consumo.numeroMesa}
            </option>
          ))}
        </select>
      </section>

      <section className="consumo-listado">
        {consumosFiltrados.length === 0 ? (
          <div className="consumo-vacio">
            <span>🧾</span>
            <h2>No hay consumos registrados</h2>
            <p>Cuando registres pedidos, aparecerán aquí.</p>
          </div>
        ) : (
          consumosFiltrados.map((consumo) => (
            <article className="consumo-card" key={consumo.mesaId}>
              <div className="consumo-card-encabezado">
                <div>
                  <h2>Mesa {consumo.numeroMesa}</h2>
                  <p>{consumo.pedidos.length} pedido(s) registrado(s)</p>
                </div>
                <strong>S/ {consumo.total.toFixed(2)}</strong>
              </div>

              <div className="consumo-detalle">
                <h3>Detalle de productos</h3>

                {consumo.items.map((item, index) => (
                  <div className="consumo-item" key={`${item.productoId}-${index}`}>
                    <div>
                      <strong>{item.nombre}</strong>
                      <span>
                        {item.cantidad} × S/ {Number(item.precio).toFixed(2)}
                      </span>
                    </div>
                    <strong>
                      S/ {Number(item.subtotal).toFixed(2)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="consumo-pedidos">
                <span>Pedidos incluidos</span>
                <strong>{consumo.pedidos.length}</strong>
              </div>
            </article>
          ))
        )}
      </section>

      <footer className="consumo-nota">
        Los importes mostrados son consumos registrados, todavía no representan
        pagos confirmados.
      </footer>
    </main>
  );
}
