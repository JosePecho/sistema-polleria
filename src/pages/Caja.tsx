
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import "./Caja.css";

interface ItemPedido {
  nombre: string;
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
  estadoPago?: string;
}

interface CuentaMesa {
  clave: string;
  mesaId?: string;
  numeroMesa: number;
  pedidos: Pedido[];
  total: number;
}

interface Pago {
  id: string;
  numeroMesa: number;
  total: number;
  metodo: string;
  recibido: number;
  vuelto: number;
  fecha?: {
    toDate: () => Date;
  };
}

export default function Caja() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");
  const [recibido, setRecibido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cancelarPedidos = onSnapshot(
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
        setError("No se pudieron cargar los pedidos de Firebase.");
        setCargando(false);
      }
    );

    const cancelarPagos = onSnapshot(
      collection(db, "pagos"),
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Pago[];

        datos.sort((a, b) => {
          const fechaA = a.fecha?.toDate().getTime() || 0;
          const fechaB = b.fecha?.toDate().getTime() || 0;
          return fechaB - fechaA;
        });

        setPagos(datos);
      },
      () => {
        setError("No se pudo cargar el historial de pagos.");
      }
    );

    return () => {
      cancelarPedidos();
      cancelarPagos();
    };
  }, []);

  const cuentas = useMemo(() => {
    const agrupadas = new Map<string, CuentaMesa>();

    pedidos
      .filter((pedido) => pedido.estadoPago !== "Pagado")
      .forEach((pedido) => {
        const clave = pedido.mesaId || `mesa-${pedido.numeroMesa}`;

        if (!agrupadas.has(clave)) {
          agrupadas.set(clave, {
            clave,
            mesaId: pedido.mesaId,
            numeroMesa: pedido.numeroMesa,
            pedidos: [],
            total: 0,
          });
        }

        const cuenta = agrupadas.get(clave)!;
        cuenta.pedidos.push(pedido);
        cuenta.total += Number(pedido.total) || 0;
      });

    return Array.from(agrupadas.values()).sort(
      (a, b) => a.numeroMesa - b.numeroMesa
    );
  }, [pedidos]);

  const cuentaActual = cuentas.find(
    (cuenta) => cuenta.clave === mesaSeleccionada
  );

  const totalPendiente = cuentas.reduce(
    (suma, cuenta) => suma + cuenta.total,
    0
  );

  const montoRecibido = Number(recibido) || 0;
  const vuelto =
    metodo === "Efectivo" && cuentaActual
      ? Math.max(0, montoRecibido - cuentaActual.total)
      : 0;

  const registrarPago = async () => {
    if (!auth.currentUser) {
      alert("Debes iniciar sesión para registrar un pago.");
      return;
    }

    if (!cuentaActual || cuentaActual.pedidos.length === 0) {
      alert("Selecciona una mesa con consumo pendiente.");
      return;
    }

    if (
      metodo === "Efectivo" &&
      montoRecibido < cuentaActual.total
    ) {
      alert("El dinero recibido no cubre el total de la cuenta.");
      return;
    }

    if (guardando) return;

    setGuardando(true);

    try {
      const lote = writeBatch(db);
      const pagoRef = doc(collection(db, "pagos"));

      lote.set(pagoRef, {
        numeroMesa: cuentaActual.numeroMesa,
        mesaId: cuentaActual.mesaId || "",
        pedidosIds: cuentaActual.pedidos.map((pedido) => pedido.id),
        total: cuentaActual.total,
        metodo,
        recibido:
          metodo === "Efectivo" ? montoRecibido : cuentaActual.total,
        vuelto,
        usuarioId: auth.currentUser.uid,
        fecha: serverTimestamp(),
      });

      cuentaActual.pedidos.forEach((pedido) => {
        lote.update(doc(db, "pedidos", pedido.id), {
          estadoPago: "Pagado",
          pagoId: pagoRef.id,
          fechaPago: serverTimestamp(),
        });
      });

      await lote.commit();

      setMesaSeleccionada("");
      setRecibido("");
      setMetodo("Efectivo");

      alert("¡Pago registrado correctamente!");
    } catch (error) {
      console.error("Error al registrar el pago:", error);
      alert("No se pudo registrar el pago. Revisa Firebase.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <main className="caja-contenedor">Cargando caja...</main>;
  }

  return (
    <main className="caja-contenedor">
      <header className="caja-encabezado">
        <div>
          <h1>Gestión de caja</h1>
          <p>Consulta cuentas pendientes y registra los pagos.</p>
        </div>
        <span className="caja-en-vivo">● EN VIVO</span>
      </header>

      {error && <p className="caja-error">{error}</p>}

      <section className="caja-resumen">
        <article className="caja-resumen-card">
          <span>Cuentas pendientes</span>
          <strong>{cuentas.length}</strong>
        </article>

        <article className="caja-resumen-card">
          <span>Total por cobrar</span>
          <strong>S/ {totalPendiente.toFixed(2)}</strong>
        </article>

        <article className="caja-resumen-card">
          <span>Pagos registrados</span>
          <strong>{pagos.length}</strong>
        </article>
      </section>

      <section className="caja-panel">
        <h2>Registrar pago</h2>

        <label htmlFor="caja-mesa">Seleccionar cuenta</label>
        <select
          id="caja-mesa"
          value={mesaSeleccionada}
          onChange={(e) => {
            setMesaSeleccionada(e.target.value);
            setRecibido("");
          }}
        >
          <option value="">Selecciona una mesa</option>
          {cuentas.map((cuenta) => (
            <option value={cuenta.clave} key={cuenta.clave}>
              Mesa {cuenta.numeroMesa} — S/ {cuenta.total.toFixed(2)}
            </option>
          ))}
        </select>

        {cuentaActual && (
          <>
            <div className="caja-detalle">
              <h3>Detalle de mesa {cuentaActual.numeroMesa}</h3>

              {cuentaActual.pedidos.map((pedido) => (
                <div className="caja-pedido" key={pedido.id}>
                  <div>
                    <strong>Pedido {pedido.id.slice(0, 8)}</strong>
                    <span>{pedido.items?.length || 0} producto(s)</span>
                  </div>
                  <strong>S/ {Number(pedido.total).toFixed(2)}</strong>
                </div>
              ))}

              <div className="caja-total">
                <span>Total a pagar</span>
                <strong>S/ {cuentaActual.total.toFixed(2)}</strong>
              </div>
            </div>

            <label htmlFor="caja-metodo">Método de pago</label>
            <select
              id="caja-metodo"
              value={metodo}
              onChange={(e) => {
                setMetodo(e.target.value);
                setRecibido("");
              }}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Yape">Yape</option>
              <option value="Plin">Plin</option>
            </select>

            {metodo === "Efectivo" && (
              <>
                <label htmlFor="caja-recibido">Dinero recibido (S/)</label>
                <input
                  id="caja-recibido"
                  type="number"
                  min="0"
                  step="0.01"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  placeholder="Ejemplo: 50.00"
                />

                <div className="caja-vuelto">
                  <span>Vuelto</span>
                  <strong>S/ {vuelto.toFixed(2)}</strong>
                </div>
              </>
            )}

            <button
              className="caja-boton-pagar"
              onClick={registrarPago}
              disabled={
                guardando ||
                (metodo === "Efectivo" &&
                  montoRecibido < cuentaActual.total)
              }
            >
              {guardando ? "Registrando pago..." : "Confirmar pago"}
            </button>
          </>
        )}

        {!cuentaActual && (
          <p className="caja-vacio">
            Selecciona una mesa para consultar su cuenta pendiente.
          </p>
        )}
      </section>

      <section className="caja-historial">
        <h2>Historial de pagos</h2>

        {pagos.length === 0 ? (
          <p className="caja-vacio">Todavía no hay pagos registrados.</p>
        ) : (
          <div className="caja-tabla-contenedor">
            <table className="caja-tabla">
              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id}>
                    <td>Mesa {pago.numeroMesa}</td>
                    <td>{pago.metodo}</td>
                    <td>S/ {Number(pago.total).toFixed(2)}</td>
                    <td>
                      {pago.fecha
                        ? pago.fecha.toDate().toLocaleString("es-PE")
                        : "Pendiente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
