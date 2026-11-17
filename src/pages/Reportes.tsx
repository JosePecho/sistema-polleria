
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";
import "./Reportes.css";

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

// La fecha se obtiene al cargar el módulo, fuera del renderizado.
const FECHA_REFERENCIA = new Date();

export default function Reportes() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [periodo, setPeriodo] = useState("hoy");

  // Escuchar los pagos de Firebase en tiempo real.
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "pagos"),
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Pago[];

        setPagos(datos);
        setCargando(false);
        setError("");
      },
      () => {
        setError("No se pudieron cargar los reportes de Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  // Filtrar pagos sin duplicar información en otro estado.
  const pagosFiltrados = useMemo(() => {
    const ahora = FECHA_REFERENCIA;

    return pagos.filter((pago) => {
      if (!pago.fecha) return false;

      const fecha = pago.fecha.toDate();

      if (periodo === "hoy") {
        return (
          fecha.getFullYear() === ahora.getFullYear() &&
          fecha.getMonth() === ahora.getMonth() &&
          fecha.getDate() === ahora.getDate()
        );
      }

      if (periodo === "semana") {
        const inicioSemana = new Date(ahora);
        const dia = (ahora.getDay() + 6) % 7;

        inicioSemana.setDate(ahora.getDate() - dia);
        inicioSemana.setHours(0, 0, 0, 0);

        return fecha >= inicioSemana && fecha <= ahora;
      }

      if (periodo === "mes") {
        return (
          fecha.getFullYear() === ahora.getFullYear() &&
          fecha.getMonth() === ahora.getMonth()
        );
      }

      return true;
    });
  }, [pagos, periodo]);

  // Resumen de ventas.
  const totalVentas = pagosFiltrados.reduce(
    (suma, pago) => suma + (Number(pago.total) || 0),
    0
  );

  const cantidadVentas = pagosFiltrados.length;

  const promedioVenta =
    cantidadVentas > 0 ? totalVentas / cantidadVentas : 0;

  // Ventas agrupadas por método de pago.
  const metodosPago = useMemo(() => {
    const resumen: Record<string, number> = {};

    pagosFiltrados.forEach((pago) => {
      const metodo = pago.metodo || "No especificado";

      resumen[metodo] =
        (resumen[metodo] || 0) + (Number(pago.total) || 0);
    });

    return Object.entries(resumen).sort((a, b) => b[1] - a[1]);
  }, [pagosFiltrados]);

  // Ventas agrupadas por mesa.
  const ventasPorMesa = useMemo(() => {
    const resumen: Record<number, number> = {};

    pagosFiltrados.forEach((pago) => {
      const mesa = Number(pago.numeroMesa) || 0;

      resumen[mesa] =
        (resumen[mesa] || 0) + (Number(pago.total) || 0);
    });

    return Object.entries(resumen)
      .map(([mesa, total]) => ({
        mesa: Number(mesa),
        total,
      }))
      .sort((a, b) => a.mesa - b.mesa);
  }, [pagosFiltrados]);

  // Exportar reporte a CSV.
  const exportarCSV = () => {
    if (pagosFiltrados.length === 0) {
      alert("No hay ventas para exportar.");
      return;
    }

    const filas = [
      ["Fecha", "Mesa", "Metodo de pago", "Total", "Recibido", "Vuelto"],
      ...pagosFiltrados.map((pago) => [
        pago.fecha?.toDate().toLocaleString("es-PE") || "",
        String(pago.numeroMesa),
        pago.metodo,
        Number(pago.total).toFixed(2),
        Number(pago.recibido).toFixed(2),
        Number(pago.vuelto).toFixed(2),
      ]),
    ];

    const contenido = filas
      .map((fila) =>
        fila
          .map((celda) => `"${String(celda).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const archivo = new Blob(["\uFEFF" + contenido], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = "reporte-ventas-polleria.csv";
    enlace.click();

    URL.revokeObjectURL(url);
  };

  if (cargando) {
    return <main className="reportes-contenedor">Cargando reportes...</main>;
  }

  return (
    <main className="reportes-contenedor">
      <header className="reportes-encabezado">
        <div>
          <h1>Reportes y estadísticas</h1>
          <p>Consulta las ventas y los ingresos registrados en caja.</p>
        </div>

        <button className="reportes-exportar" onClick={exportarCSV}>
          Exportar CSV
        </button>
      </header>

      {error && <p className="reportes-error">{error}</p>}

      <section className="reportes-filtro">
        <label htmlFor="periodo-reporte">Periodo del reporte:</label>

        <select
          id="periodo-reporte"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
        >
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="todo">Todo el historial</option>
        </select>
      </section>

      <section className="reportes-resumen">
        <article className="reportes-card">
          <span>Ventas cobradas</span>
          <strong>S/ {totalVentas.toFixed(2)}</strong>
        </article>

        <article className="reportes-card">
          <span>Pagos registrados</span>
          <strong>{cantidadVentas}</strong>
        </article>

        <article className="reportes-card">
          <span>Promedio por pago</span>
          <strong>S/ {promedioVenta.toFixed(2)}</strong>
        </article>
      </section>

      <section className="reportes-panel">
        <h2>Ventas por método de pago</h2>

        {metodosPago.length === 0 ? (
          <p className="reportes-vacio">No hay ventas en este periodo.</p>
        ) : (
          metodosPago.map(([metodo, total]) => (
            <div className="reportes-barra-fila" key={metodo}>
              <div className="reportes-barra-info">
                <span>{metodo}</span>
                <strong>S/ {total.toFixed(2)}</strong>
              </div>

              <div className="reportes-barra-fondo">
                <div
                  className="reportes-barra-valor"
                  style={{
                    width: `${
                      totalVentas > 0 ? (total / totalVentas) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="reportes-panel">
        <h2>Ventas por mesa</h2>

        {ventasPorMesa.length === 0 ? (
          <p className="reportes-vacio">No hay ventas por mesa.</p>
        ) : (
          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Total vendido</th>
                </tr>
              </thead>

              <tbody>
                {ventasPorMesa.map((venta) => (
                  <tr key={venta.mesa}>
                    <td>Mesa {venta.mesa}</td>
                    <td>S/ {venta.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="reportes-panel">
        <h2>Historial de pagos</h2>

        {pagosFiltrados.length === 0 ? (
          <p className="reportes-vacio">
            Todavía no hay pagos registrados en este periodo.
          </p>
        ) : (
          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Mesa</th>
                  <th>Método</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {pagosFiltrados.map((pago) => (
                  <tr key={pago.id}>
                    <td>
                      {pago.fecha?.toDate().toLocaleString("es-PE") || "-"}
                    </td>
                    <td>Mesa {pago.numeroMesa}</td>
                    <td>{pago.metodo}</td>
                    <td>S/ {Number(pago.total).toFixed(2)}</td>
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
