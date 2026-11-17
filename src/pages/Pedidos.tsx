
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChefHat,
  Clock3,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Users,
} from "lucide-react";

import {
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  runTransaction,
} from "firebase/firestore";

import { auth, db } from "../services/firebase";
import { agregarAuditoriaATransaccion } from "../services/auditoria";
import "./Pedidos.css";

interface Producto {
  id: string;
  nombre: string;
  categoria?: string;
  precio: number;
  stock: number;
  disponible: boolean;
}

interface Mesa {
  id: string;
  numero: number;
  estado: string;
  cliente?: string;
}

interface ItemSeleccionado {
  productoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
}

interface Pedido {
  id: string;
  numeroMesa: number;
  items: ItemSeleccionado[];
  total: number;
  estado: string;
  fechaCreacion?: {
    toDate: () => Date;
  };
}

export default function Pedidos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState("");
  const [carrito, setCarrito] = useState<ItemSeleccionado[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("Todos");
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cancelarProductos = onSnapshot(
      collection(db, "productos"),
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Producto[];

        setProductos(datos);
      },
      () => setError("No se pudieron cargar los productos.")
    );

    const cancelarMesas = onSnapshot(
      collection(db, "mesas"),
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Mesa[];

        datos.sort((a, b) => a.numero - b.numero);
        setMesas(datos);
      },
      () => setError("No se pudieron cargar las mesas.")
    );

    const consultaPedidos = query(
      collection(db, "pedidos"),
      orderBy("fechaCreacion", "desc")
    );

    const cancelarPedidos = onSnapshot(
      consultaPedidos,
      (snapshot) => {
        const datos = snapshot.docs.map((documento) => ({
          id: documento.id,
          ...documento.data(),
        })) as Pedido[];

        setPedidos(datos);
        setCargando(false);
      },
      () => {
        setError("No se pudieron cargar los pedidos anteriores.");
        setCargando(false);
      }
    );

    return () => {
      cancelarProductos();
      cancelarMesas();
      cancelarPedidos();
    };
  }, []);

  const agregarProducto = (producto: Producto) => {
    if (producto.stock <= 0 || producto.disponible === false) {
      alert("Este producto no está disponible.");
      return;
    }

    setCarrito((actual) => {
      const existente = actual.find(
        (item) => item.productoId === producto.id
      );

      const cantidadActual = existente?.cantidad ?? 0;

      if (cantidadActual >= producto.stock) {
        alert("No hay suficiente stock disponible.");
        return actual;
      }

      if (existente) {
        return actual.map((item) =>
          item.productoId === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: (item.cantidad + 1) * item.precio,
              }
            : item
        );
      }

      return [
        ...actual,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          precio: Number(producto.precio),
          cantidad: 1,
          subtotal: Number(producto.precio),
        },
      ];
    });
  };

  const cambiarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad < 1) {
      setCarrito((actual) =>
        actual.filter((item) => item.productoId !== productoId)
      );
      return;
    }

    const producto = productos.find((p) => p.id === productoId);

    if (producto && cantidad > producto.stock) {
      alert("La cantidad supera el stock disponible.");
      return;
    }

    setCarrito((actual) =>
      actual.map((item) =>
        item.productoId === productoId
          ? {
              ...item,
              cantidad,
              subtotal: cantidad * item.precio,
            }
          : item
      )
    );
  };

  const total = carrito.reduce(
    (suma, item) => suma + item.subtotal,
    0
  );

  const categorias = useMemo(
    () => [
      "Todos",
      ...new Set(
        productos.map((producto) => producto.categoria || "Otros")
      ),
    ],
    [productos]
  );

  const productosFiltrados = productos.filter((producto) => {
    const coincideBusqueda = producto.nombre
      .toLocaleLowerCase("es")
      .includes(busqueda.trim().toLocaleLowerCase("es"));

    const coincideCategoria =
      categoriaActiva === "Todos" ||
      (producto.categoria || "Otros") === categoriaActiva;

    return coincideBusqueda && coincideCategoria;
  });

  const mesaActual = mesas.find(
    (mesa) => mesa.id === mesaSeleccionada
  );

  const cantidadItems = carrito.reduce(
    (suma, item) => suma + item.cantidad,
    0
  );

  // Registrar pedido, descontar stock y guardar auditoría juntos.
  const registrarPedido = async () => {
    if (guardando) return;

    if (!mesaSeleccionada) {
      alert("Selecciona una mesa.");
      return;
    }

    if (carrito.length === 0) {
      alert("Agrega al menos un producto al pedido.");
      return;
    }

    const usuario = auth.currentUser;

    if (!usuario) {
      alert("Debes iniciar sesión para registrar un pedido.");
      return;
    }

    const mesa = mesas.find(
      (item) => item.id === mesaSeleccionada
    );

    if (!mesa || mesa.estado !== "Ocupada") {
      alert("Selecciona una mesa que esté ocupada.");
      return;
    }

    setGuardando(true);

    try {
      // Agrupar cantidades por producto para evitar duplicados.
      const cantidades = new Map<string, number>();

      carrito.forEach((item) => {
        cantidades.set(
          item.productoId,
          (cantidades.get(item.productoId) ?? 0) + item.cantidad
        );
      });

      const productosAActualizar = Array.from(cantidades.entries());

      // Crear referencias antes de iniciar la transacción.
      const pedidoRef = doc(collection(db, "pedidos"));

      const referenciasProductos = productosAActualizar.map(
        ([productoId]) => ({
          id: productoId,
          referencia: doc(db, "productos", productoId),
        })
      );

      await runTransaction(db, async (transaction) => {
        // Leer todos los productos antes de realizar escrituras.
        const documentosProductos = await Promise.all(
          referenciasProductos.map(({ referencia }) =>
            transaction.get(referencia)
          )
        );

        const nuevosStocks = documentosProductos.map(
          (documento, indice) => {
            if (!documento.exists()) {
              throw new Error("PRODUCTO_NO_EXISTE");
            }

            const stockActual = Number(documento.data().stock);
            const cantidadSolicitada =
              productosAActualizar[indice][1];

            if (
              !Number.isFinite(stockActual) ||
              stockActual < cantidadSolicitada
            ) {
              throw new Error(
                `STOCK_INSUFICIENTE:${documento.data().nombre ?? "Producto"}`
              );
            }

            return {
              referencia: referenciasProductos[indice].referencia,
              nuevoStock: stockActual - cantidadSolicitada,
            };
          }
        );

        // Descontar el stock real de Firebase.
        nuevosStocks.forEach(({ referencia, nuevoStock }) => {
          transaction.update(referencia, {
            stock: nuevoStock,
            disponible: nuevoStock > 0,
          });
        });

        // Guardar la nueva comanda.
        transaction.set(pedidoRef, {
          numeroMesa: mesa.numero,
          mesaId: mesa.id,
          items: carrito,
          total,
          observaciones: observaciones.trim(),
          estado: "Pendiente",
          tipo: "Comanda",
          usuarioId: usuario.uid,
          fechaCreacion: serverTimestamp(),
        });

        // Guardar auditoría dentro de la misma transacción.
        agregarAuditoriaATransaccion(transaction, {
          accion: "COMANDA_CREADA",
          descripcion: `Se creó una comanda para la mesa ${mesa.numero}.`,
          entidadId: pedidoRef.id,
          mesaId: mesa.id,
          numeroMesa: mesa.numero,
          detalles: {
            total,
            cantidadItems,
            estado: "Pendiente",
            productos: carrito.map((item) => ({
              productoId: item.productoId,
              nombre: item.nombre,
              cantidad: item.cantidad,
            })),
          },
        });
      });

      setCarrito([]);
      setObservaciones("");

      alert(
        "¡Pedido registrado correctamente! El stock se actualizó y la comanda ya puede aparecer en Cocina."
      );
    } catch (error) {
      console.error("Error al registrar pedido:", error);

      if (
        error instanceof Error &&
        error.message.startsWith("STOCK_INSUFICIENTE:")
      ) {
        const nombreProducto = error.message.split(":")[1];

        alert(
          `Stock insuficiente de ${nombreProducto}. No se registró el pedido. Actualiza el carrito y vuelve a intentarlo.`
        );
      } else if (
        error instanceof Error &&
        error.message === "PRODUCTO_NO_EXISTE"
      ) {
        alert(
          "Uno de los productos ya no existe. Actualiza el pedido."
        );
      } else {
        alert(
          "No se pudo registrar el pedido. Revisa los permisos de Firebase."
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <main className="pedidos-contenedor">
        Cargando pedidos...
      </main>
    );
  }

  return (
    <main className="pedidos-contenedor">
      <header className="pedidos-encabezado">
        <div>
          <h1>Gestión de pedidos</h1>
          <p>Registra pedidos y envía comandas a cocina.</p>
        </div>
      </header>

      {error && (
        <p className="pedidos-error">{error}</p>
      )}

      <section className="pedidos-formulario">
        <div className="pedidos-seccion">
          <h2>
            <span className="pedidos-paso">01</span>
            Selecciona una mesa
          </h2>

          <div className="pedidos-mesas-grid">
            {mesas.map((mesa) => {
              const ocupada = mesa.estado === "Ocupada";
              const seleccionada =
                mesaSeleccionada === mesa.id;

              return (
                <button
                  type="button"
                  key={mesa.id}
                  className={`pedidos-mesa-card ${
                    ocupada ? "mesa-ocupada" : "mesa-disponible"
                  } ${
                    seleccionada ? "mesa-seleccionada" : ""
                  }`}
                  disabled={!ocupada}
                  aria-pressed={seleccionada}
                  onClick={() =>
                    setMesaSeleccionada(mesa.id)
                  }
                >
                  <span className="pedidos-mesa-icon">
                    <Users size={18} />
                  </span>

                  {seleccionada && (
                    <span className="pedidos-mesa-check">
                      <Check size={13} />
                    </span>
                  )}

                  <strong>Mesa {mesa.numero}</strong>

                  <span className="pedidos-mesa-cliente">
                    {mesa.cliente ||
                      (ocupada ? "En servicio" : "Disponible")}
                  </span>

                  <span className="pedidos-mesa-status">
                    <i />
                    {mesa.estado}
                  </span>
                </button>
              );
            })}

            {mesas.length === 0 && (
              <p className="pedidos-vacio">
                No hay mesas registradas.
              </p>
            )}
          </div>
        </div>

        <div className="pedidos-seccion">
          <h2>
            <span className="pedidos-paso">02</span>
            Menú
          </h2>

          <label className="pedidos-busqueda">
            <Search size={18} />

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              aria-label="Buscar productos"
            />
          </label>

          <div className="pedidos-categorias">
            {categorias.map((categoria) => (
              <button
                type="button"
                key={categoria}
                className={
                  categoriaActiva === categoria
                    ? "categoria-activa"
                    : ""
                }
                onClick={() =>
                  setCategoriaActiva(categoria)
                }
              >
                {categoria}
              </button>
            ))}
          </div>

          <div className="pedidos-productos-grid">
            {productosFiltrados.map((producto) => {
              const disponible =
                producto.disponible !== false &&
                producto.stock > 0;

              return (
                <article
                  className={`pedidos-producto-card ${
                    !disponible ? "producto-agotado" : ""
                  }`}
                  key={producto.id}
                >
                  <div className="producto-visual">
                    <span>
                      <ChefHat size={24} />
                    </span>

                    <small
                      className={
                        disponible
                          ? "producto-disponible"
                          : "producto-no-disponible"
                      }
                    >
                      <i />
                      {disponible ? "Disponible" : "Agotado"}
                    </small>
                  </div>

                  <span className="producto-categoria">
                    {producto.categoria || "Otros"}
                  </span>

                  <h3>{producto.nombre}</h3>

                  <span className="producto-stock">
                    {disponible
                      ? `Stock: ${producto.stock}`
                      : "Sin stock"}
                  </span>

                  <div className="producto-compra">
                    <strong>
                      S/ {Number(producto.precio).toFixed(2)}
                    </strong>

                    <button
                      onClick={() => agregarProducto(producto)}
                      disabled={!disponible}
                    >
                      <Plus size={16} />
                      Añadir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {productos.length === 0 && (
            <p className="pedidos-vacio">
              Todavía no hay productos registrados.
            </p>
          )}
        </div>

        <div className="pedidos-seccion">
          <h2>
            <ShoppingBag size={19} />
            Tu pedido
            <span className="resumen-cantidad">
              {cantidadItems} ítems
            </span>
          </h2>

          <div className="resumen-mesa-mini">
            <span>Mesa seleccionada</span>

            <strong>
              {mesaActual
                ? `Mesa ${mesaActual.numero}`
                : "Sin seleccionar"}
            </strong>

            {mesaActual?.cliente && (
              <small>{mesaActual.cliente}</small>
            )}
          </div>

          {carrito.length === 0 ? (
            <p className="pedidos-vacio">
              Todavía no agregaste productos.
            </p>
          ) : (
            <div className="pedidos-carrito">
              {carrito.map((item) => (
                <div
                  className="pedidos-carrito-item"
                  key={item.productoId}
                >
                  <div>
                    <strong>{item.nombre}</strong>
                    <p>
                      S/ {item.precio.toFixed(2)} por unidad
                    </p>
                  </div>

                  <div className="pedidos-cantidad">
                    <button
                      type="button"
                      onClick={() =>
                        cambiarCantidad(
                          item.productoId,
                          item.cantidad - 1
                        )
                      }
                    >
                      −
                    </button>

                    <span>{item.cantidad}</span>

                    <button
                      type="button"
                      onClick={() =>
                        cambiarCantidad(
                          item.productoId,
                          item.cantidad + 1
                        )
                      }
                    >
                      +
                    </button>
                  </div>

                  <strong>
                    S/ {item.subtotal.toFixed(2)}
                  </strong>

                  <button
                    type="button"
                    className="pedidos-eliminar"
                    aria-label={`Eliminar ${item.nombre}`}
                    onClick={() =>
                      cambiarCantidad(item.productoId, 0)
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label
            className="pedidos-label"
            htmlFor="observaciones-pedido"
          >
            Observaciones para cocina
          </label>

          <textarea
            id="observaciones-pedido"
            value={observaciones}
            onChange={(e) =>
              setObservaciones(e.target.value)
            }
            placeholder="Ejemplo: sin ensalada, extra de cremas..."
            rows={3}
          />

          <div className="pedidos-total">
            <span>Total del pedido</span>
            <strong>S/ {total.toFixed(2)}</strong>
          </div>

          <div className="pedidos-subtotal">
            <span>Subtotal</span>
            <strong>S/ {total.toFixed(2)}</strong>
          </div>

          <button
            className="pedidos-registrar"
            onClick={registrarPedido}
            disabled={
              guardando ||
              carrito.length === 0 ||
              !mesaSeleccionada
            }
          >
            {guardando ? (
              "Registrando..."
            ) : (
              <>
                <ShoppingBag size={17} />
                Confirmar pedido
              </>
            )}
          </button>

          <p className="pedidos-resumen-nota">
            <Clock3 size={14} />
            La comanda se enviará a cocina al confirmar.
          </p>
        </div>
      </section>

      <section className="pedidos-historial">
        <h2>Pedidos registrados</h2>

        {pedidos.length === 0 ? (
          <p className="pedidos-vacio">
            Todavía no hay pedidos registrados.
          </p>
        ) : (
          <div className="pedidos-tabla-contenedor">
            <table className="pedidos-tabla">
              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td>Mesa {pedido.numeroMesa}</td>

                    <td>
                      {pedido.items
                        ?.map(
                          (item) =>
                            `${item.cantidad} × ${item.nombre}`
                        )
                        .join(", ")}
                    </td>

                    <td>
                      S/ {Number(pedido.total).toFixed(2)}
                    </td>

                    <td>{pedido.estado}</td>
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
