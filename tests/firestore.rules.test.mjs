
import { readFile } from 'node:fs/promises';
import { before, after, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const projectId = 'demo-polleria-security';

const ids = {
  administrador: 'zhna1hR5hQRCeJlMA8Dv9RixFxp2',
  mozo: 'QbOlGLwqCyd7hI4pOzpZVWLNsOo1',
  cocina: 'JLKu48xES2MCBC8OTQaQPnsHyQG2',
  cajero: 'X5vmpaCQr9TrY4dmXV4gU14QCv63',
};

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: await readFile(
        new URL('../firestore.rules', import.meta.url),
        'utf8'
      ),
    },
  });
});

after(async () => {
  await environment?.cleanup();
});

beforeEach(async () => {
  await environment.clearFirestore();

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    for (const [rol, uid] of Object.entries(ids)) {
      await setDoc(doc(db, 'usuarios', uid), {
        uid,
        rol,
        activo: true,
        nombre: rol,
      });
    }

    await setDoc(doc(db, 'mesas', 'mesa-1'), {
      numero: 1,
      capacidad: 4,
      estado: 'Ocupada',
      cliente: 'Prueba',
      fechaActualizacion: new Date(),
    });

    await setDoc(doc(db, 'productos', 'producto-1'), {
      nombre: 'Pollo',
      categoria: 'Pollos a la brasa',
      precio: 50,
      stock: 10,
      disponible: true,
    });

    await setDoc(doc(db, 'pedidos', 'pedido-1'), {
      numeroMesa: 1,
      mesaId: 'mesa-1',
      items: [
        {
          productoId: 'producto-1',
          nombre: 'Pollo',
          precio: 50,
          cantidad: 1,
          subtotal: 50,
        },
      ],
      total: 50,
      observaciones: '',
      estado: 'Pendiente',
      tipo: 'Comanda',
      usuarioId: ids.mozo,
      fechaCreacion: new Date(),
      estadoPago: 'Pendiente',
    });

    await setDoc(doc(db, 'pagos', 'pago-fixture'), {
      numeroMesa: 1,
      mesaId: 'mesa-1',
      pedidosIds: ['pedido-1'],
      total: 50,
      metodo: 'Efectivo',
      recibido: 50,
      vuelto: 0,
      usuarioId: ids.cajero,
      fecha: new Date(),
    });
  });
});

const asRole = (rol) =>
  environment.authenticatedContext(ids[rol]).firestore();

test('cada rol puede leer su propio perfil, pero no otro perfil ni listar usuarios', async () => {
  for (const [rol, uid] of Object.entries(ids)) {
    const db = asRole(rol);

    await assertSucceeds(getDoc(doc(db, 'usuarios', uid)));

    await assertFails(
      getDoc(
        doc(
          db,
          'usuarios',
          ids.administrador === uid ? ids.mozo : ids.administrador
        )
      )
    );

    await assertFails(getDocs(collection(db, 'usuarios')));

    await assertFails(
      updateDoc(doc(db, 'usuarios', uid), {
        rol: 'administrador',
      })
    );

    await assertFails(
      updateDoc(doc(db, 'usuarios', uid), {
        activo: true,
      })
    );
  }
});

test('lecturas reflejan los cuatro roles asignados', async () => {
  for (const rol of ['administrador', 'mozo']) {
    const db = asRole(rol);

    await assertSucceeds(getDocs(collection(db, 'mesas')));
    await assertSucceeds(getDocs(collection(db, 'productos')));
  }

  for (const rol of Object.keys(ids)) {
    await assertSucceeds(
      getDocs(collection(asRole(rol), 'pedidos'))
    );
  }

  for (const rol of ['administrador', 'cajero']) {
    await assertSucceeds(
      getDocs(collection(asRole(rol), 'pagos'))
    );
  }

  for (const rol of ['mozo', 'cocina']) {
    await assertFails(
      getDocs(collection(asRole(rol), 'pagos'))
    );
  }

  for (const rol of ['cocina', 'cajero']) {
    await assertFails(
      getDocs(collection(asRole(rol), 'mesas'))
    );
  }
});

test('solo administrador crea y elimina productos; mozo actualiza una mesa', async () => {
  const admin = asRole('administrador');
  const mozo = asRole('mozo');
  const cocina = asRole('cocina');

  await assertSucceeds(
    setDoc(doc(admin, 'productos', 'producto-nuevo'), {
      nombre: 'Chicha',
      categoria: 'Bebidas',
      precio: 8,
      stock: 4,
      disponible: true,
      fechaRegistro: serverTimestamp(),
    })
  );

  await assertSucceeds(
    deleteDoc(doc(admin, 'productos', 'producto-1'))
  );

  await assertFails(
    deleteDoc(doc(mozo, 'productos', 'producto-1'))
  );

  await assertFails(
    setDoc(doc(mozo, 'productos', 'producto-nuevo'), {
      nombre: 'x',
    })
  );

  await assertSucceeds(
    updateDoc(doc(mozo, 'mesas', 'mesa-1'), {
      estado: 'Disponible',
      cliente: '',
      fechaActualizacion: serverTimestamp(),
    })
  );

  await assertFails(
    updateDoc(doc(cocina, 'mesas', 'mesa-1'), {
      estado: 'Disponible',
      cliente: '',
      fechaActualizacion: serverTimestamp(),
    })
  );
});

test('mozo crea pedidos; cocina solo cambia el estado de comanda', async () => {
  const mozo = asRole('mozo');
  const cocina = asRole('cocina');

  await assertSucceeds(
    setDoc(doc(mozo, 'pedidos', 'pedido-nuevo'), {
      numeroMesa: 1,
      mesaId: 'mesa-1',
      items: [
        {
          productoId: 'producto-1',
          nombre: 'Pollo',
          precio: 50,
          cantidad: 1,
          subtotal: 50,
        },
      ],
      total: 50,
      observaciones: '',
      estado: 'Pendiente',
      tipo: 'Comanda',
      usuarioId: ids.mozo,
      fechaCreacion: serverTimestamp(),
    })
  );

  await assertSucceeds(
    updateDoc(doc(cocina, 'pedidos', 'pedido-1'), {
      estado: 'Preparando',
    })
  );

  await assertFails(
    updateDoc(doc(cocina, 'pedidos', 'pedido-1'), {
      total: 1,
    })
  );

  await assertFails(
    updateDoc(doc(mozo, 'pedidos', 'pedido-1'), {
      estado: 'Listo',
    })
  );
});

test('cajero registra pago y actualiza pedido en un lote; roles sin permiso fallan', async () => {
  const cajero = asRole('cajero');
  const pagoId = 'pago-nuevo';

  const batch = writeBatch(cajero);

  batch.set(doc(cajero, 'pagos', pagoId), {
    numeroMesa: 1,
    mesaId: 'mesa-1',
    pedidosIds: ['pedido-1'],
    total: 50,
    metodo: 'Efectivo',
    recibido: 60,
    vuelto: 10,
    usuarioId: ids.cajero,
    fecha: serverTimestamp(),
  });

  batch.update(doc(cajero, 'pedidos', 'pedido-1'), {
    estadoPago: 'Pagado',
    pagoId,
    fechaPago: serverTimestamp(),
  });

  await assertSucceeds(batch.commit());

  await assertFails(
    deleteDoc(doc(cajero, 'pagos', pagoId))
  );

  // Corrección: se utiliza una sola instancia de Firestore.
  const cocina = asRole('cocina');
  const cocinaBatch = writeBatch(cocina);

  cocinaBatch.set(
    doc(cocina, 'pagos', 'pago-no-autorizado'),
    {
      numeroMesa: 1,
      mesaId: 'mesa-1',
      pedidosIds: ['pedido-1'],
      total: 50,
      metodo: 'Efectivo',
      recibido: 50,
      vuelto: 0,
      usuarioId: ids.cocina,
      fecha: serverTimestamp(),
    }
  );

  await assertFails(cocinaBatch.commit());
});

test('rechaza perfiles ausentes, inactivos y con UID no coincidente', async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'usuarios', 'inactivo'), {
      uid: 'inactivo',
      rol: 'mozo',
      activo: false,
    });

    await setDoc(doc(db, 'usuarios', 'uid-incorrecto'), {
      uid: 'otro',
      rol: 'mozo',
      activo: true,
    });
  });

  for (const uid of ['sin-perfil', 'inactivo', 'uid-incorrecto']) {
    const db = environment.authenticatedContext(uid).firestore();

    await assertFails(
      getDocs(collection(db, 'pedidos'))
    );
  }
});
