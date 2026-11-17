
import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../services/firebase";
import "./Productos.css";

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  disponible: boolean;
}

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("Pollos a la brasa");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [stockEditado, setStockEditado] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // ESCUCHAR LOS PRODUCTOS EN FIREBASE
  useEffect(() => {
    const cancelar = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const lista: Producto[] = snapshot.docs.map((documento) => {
          const datos = documento.data();

          return {
            id: documento.id,
            nombre: datos.nombre,
            categoria: datos.categoria,
            precio: datos.precio,
            stock: datos.stock,
            disponible: datos.disponible,
          };
        });

        setProductos(lista);
        setCargando(false);
      },
      (error) => {
        console.error("Error al cargar productos:", error);
        alert("No se pudieron cargar los productos. Revisa Firebase.");
        setCargando(false);
      }
    );

    return () => cancelar();
  }, []);

  // REGISTRAR PRODUCTO
  const agregarProducto = async () => {
    if (
      !nombre.trim() ||
      precio.trim() === "" ||
      stock.trim() === "" ||
      !Number.isFinite(Number(precio)) ||
      Number(precio) <= 0 ||
      !Number.isInteger(Number(stock)) ||
      Number(stock) < 0
    ) {
      alert("Completa los datos correctamente.");
      return;
    }

    try {
      setGuardando(true);

      await addDoc(collection(db, "productos"), {
        nombre: nombre.trim(),
        categoria,
        precio: Number(precio),
        stock: Number(stock),
        disponible: Number(stock) > 0,
        fechaRegistro: serverTimestamp(),
      });

      setNombre("");
      setPrecio("");
      setStock("");
      alert("Producto guardado en Firebase.");
    } catch (error) {
      console.error("Error al registrar:", error);
      alert("No se pudo guardar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  // ACTUALIZAR STOCK
  const actualizarStock = async (id: string) => {
    const cantidad = stockEditado[id];

    if (
      cantidad === undefined ||
      cantidad.trim() === "" ||
      !Number.isInteger(Number(cantidad)) ||
      Number(cantidad) < 0
    ) {
      alert("Ingresa una cantidad entera válida.");
      return;
    }

    try {
      const producto = productos.find((p) => p.id === id);
      if (!producto) return;

      await updateDoc(doc(db, "productos", id), {
        stock: Number(cantidad),
        disponible: Number(cantidad) > 0 && producto.disponible,
      });

      setStockEditado((actual) => {
        const copia = { ...actual };
        delete copia[id];
        return copia;
      });
    } catch (error) {
      console.error("Error al actualizar stock:", error);
      alert("No se pudo actualizar el stock.");
    }
  };

  // ACTIVAR O DESACTIVAR
  const cambiarDisponibilidad = async (producto: Producto) => {
    if (!producto.disponible && producto.stock <= 0) {
      alert("No puedes activar un producto sin stock.");
      return;
    }

    try {
      await updateDoc(doc(db, "productos", producto.id), {
        disponible: !producto.disponible,
      });
    } catch (error) {
      console.error("Error al cambiar disponibilidad:", error);
      alert("No se pudo cambiar la disponibilidad.");
    }
  };

  // ELIMINAR PRODUCTO
  const eliminarProducto = async (id: string) => {
    if (!confirm("¿Deseas eliminar este producto?")) return;

    try {
      await deleteDoc(doc(db, "productos", id));
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar el producto.");
    }
  };

  const disponibles = productos.filter((p) => p.disponible).length;
  const stockTotal = productos.reduce((suma, p) => suma + p.stock, 0);
  const stockBajo = productos.filter(
    (p) => p.stock > 0 && p.stock <= 5
  ).length;

  return (
    <main className="productos-page">
      <div className="productos-heading">
        <h1>Gestión de productos</h1>
        <p>Administra la carta digital y el stock de POLLERÍA PRO.</p>
      </div>

      <section className="producto-form">
        <h2>Registrar producto</h2>

        <div className="producto-form-fields">
          <input
            type="text"
            placeholder="Nombre del producto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option>Pollos a la brasa</option>
            <option>Mostritos</option>
            <option>Parrillas</option>
            <option>Salchipapas</option>
            <option>Bebidas</option>
            <option>Complementos</option>
            <option>Promociones</option>
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Precio S/"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />

          <input
            type="number"
            min="0"
            step="1"
            placeholder="Cantidad inicial"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />

          <button
            className="btn-agregar"
            onClick={agregarProducto}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "+ Agregar producto"}
          </button>
        </div>
      </section>

      <div className="productos-resumen">
        <span>Total de productos:<strong>{productos.length}</strong></span>
        <span>Disponibles:<strong>{disponibles}</strong></span>
        <span>Unidades en stock:<strong>{stockTotal}</strong></span>
        <span>Stock bajo:<strong>{stockBajo}</strong></span>
      </div>

      {cargando ? (
        <p>Cargando productos desde Firebase...</p>
      ) : productos.length === 0 ? (
        <p>Todavía no hay productos registrados en Firebase.</p>
      ) : (
        <section className="productos-grid">
          {productos.map((producto) => (
            <article className="producto-card" key={producto.id}>
              <div className="producto-informacion">
                <span className="producto-categoria">
                  {producto.categoria}
                </span>

                <h2>{producto.nombre}</h2>

                <p className="producto-precio">
                  S/ {producto.precio.toFixed(2)}
                </p>

                <p
                  className={
                    producto.stock === 0
                      ? "stock-agotado"
                      : producto.stock <= 5
                      ? "stock-bajo"
                      : "stock-normal"
                  }
                >
                  {producto.stock === 0
                    ? "● Agotado"
                    : producto.stock <= 5
                    ? "● Stock bajo"
                    : "● Stock disponible"}
                </p>

                <div className="stock-cantidad">
                  <span>Stock actual:</span>
                  <strong>{producto.stock} unidades</strong>
                </div>

                <div className="stock-editor">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Nueva cantidad"
                    value={stockEditado[producto.id] ?? ""}
                    onChange={(e) =>
                      setStockEditado((actual) => ({
                        ...actual,
                        [producto.id]: e.target.value,
                      }))
                    }
                  />

                  <button onClick={() => actualizarStock(producto.id)}>
                    Actualizar
                  </button>
                </div>

                <p
                  className={
                    producto.disponible
                      ? "estado-disponible"
                      : "estado-no-disponible"
                  }
                >
                  {producto.disponible
                    ? "Disponible para pedidos"
                    : "No disponible"}
                </p>
              </div>

              <div className="producto-acciones">
                <button
                  className="btn-estado"
                  onClick={() => cambiarDisponibilidad(producto)}
                >
                  {producto.disponible ? "Desactivar" : "Activar"}
                </button>

                <button
                  className="btn-eliminar"
                  onClick={() => eliminarProducto(producto.id)}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
