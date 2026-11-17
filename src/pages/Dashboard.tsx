import { useNavigate } from "react-router-dom";
import {
  Armchair,
  Package,
  ClipboardList,
  ChefHat,
  ListChecks,
  Receipt,
  Wallet,
  ChartColumn,
} from "lucide-react";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();

  const modulos = [
    { nombre: "Mesas", icono: <Armchair size={21} />, descripcion: "Administrar mesas", ruta: "/mesas" },
    { nombre: "Productos", icono: <Package size={21} />, descripcion: "Administrar productos", ruta: "/productos" },
    { nombre: "Pedidos", icono: <ClipboardList size={21} />, descripcion: "Registrar y gestionar pedidos", ruta: "/pedidos" },
    { nombre: "Cocina", icono: <ChefHat size={21} />, descripcion: "Preparación de comandas", ruta: "/cocina" },
    { nombre: "Seguimiento", icono: <ListChecks size={21} />, descripcion: "Consultar estados de pedidos", ruta: "/seguimiento" },
    { nombre: "Consumo", icono: <Receipt size={21} />, descripcion: "Consultar consumo por mesa", ruta: "/consumo" },
    { nombre: "Caja", icono: <Wallet size={21} />, descripcion: "Control de pagos", ruta: "/caja" },
    { nombre: "Reportes", icono: <ChartColumn size={21} />, descripcion: "Consultar ventas y estadísticas", ruta: "/reportes" },
  ];

  return (
    <main className="dashboard">
      <div className="dashboard-heading">
        <h1>Panel principal</h1>
        <p>Bienvenido al sistema de gestión de POLLERÍA PRO</p>
      </div>

      <div className="dashboard-section-label">
        <div><span>Espacio de trabajo</span><h2>Accesos rápidos</h2></div>
        <span className="dashboard-module-count">{modulos.length} módulos</span>
      </div>

      <section className="dashboard-grid">
        {modulos.map((modulo) => (
          <article className="dashboard-card" key={modulo.nombre}>
            <span className="dashboard-icon">{modulo.icono}</span>
            <h2>{modulo.nombre}</h2>
            <p>{modulo.descripcion}</p>
            <button onClick={() => navigate(modulo.ruta)}>Abrir módulo <span aria-hidden="true">↗</span></button>
          </article>
        ))}
      </section>
    </main>
  );
}
