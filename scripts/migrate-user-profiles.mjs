import { strict as assert } from 'node:assert';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'node:util';

const perfiles = [
  { uid: 'zhna1hR5hQRCeJlMA8Dv9RixFxp2', rol: 'administrador' },
  { uid: 'QbOlGLwqCyd7hI4pOzpZVWLNsOo1', rol: 'mozo' },
  { uid: 'JLKu48xES2MCBC8OTQaQPnsHyQG2', rol: 'cocina' },
  { uid: 'X5vmpaCQr9TrY4dmXV4gU14QCv63', rol: 'cajero' },
];
const aplicar = process.argv.includes('--apply');
if (process.argv.some((arg) => arg.startsWith('--') && arg !== '--apply')) {
  throw new Error('Uso: node scripts/migrate-user-profiles.mjs [--apply]');
}
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Define FIREBASE_PROJECT_ID para el proyecto de destino.');
if (process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Este script requiere un proyecto Firebase real y rechaza el emulador.');
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const firestore = getFirestore(app);
const collection = firestore.collection('usuarios');
const planes = [];

for (const asignacion of perfiles) {
  const resultados = await collection.where('uid', '==', asignacion.uid).limit(2).get();
  assert.equal(resultados.size, 1, `UID ${asignacion.uid}: se esperaba exactamente un perfil antiguo; encontrados ${resultados.size}.`);
  const origen = resultados.docs[0];
  const perfil = origen.data();
  assert.equal(perfil.uid, asignacion.uid, `El campo uid no coincide en ${origen.ref.path}.`);
  assert.equal(String(perfil.rol ?? '').trim().toLowerCase(), asignacion.rol, `El rol del documento ${origen.ref.path} no coincide con ${asignacion.rol}.`);
  assert.equal(typeof perfil.activo, 'boolean', `El campo activo de ${origen.ref.path} debe ser boolean.`);
  await auth.getUser(asignacion.uid);

  const destino = collection.doc(asignacion.uid);
  const destinoActual = await destino.get();
  const datosDestino = { ...perfil, uid: asignacion.uid, rol: asignacion.rol };
  if (destinoActual.exists && !isDeepStrictEqual(destinoActual.data(), datosDestino)) {
    throw new Error(`Conflicto: ${destino.path} ya existe con contenido distinto. No se escribió ningún perfil.`);
  }
  planes.push({ uid: asignacion.uid, rol: asignacion.rol, origenId: origen.id, destinoId: asignacion.uid, activo: perfil.activo, destinoExiste: destinoActual.exists, datosDestino });
}

console.log(`${aplicar ? 'APLICAR' : 'SIMULACIÓN'}: ${planes.length} perfil(es) verificados.`);
for (const { uid, rol, origenId, destinoId, activo, destinoExiste } of planes) {
  console.log(`${rol}: ${uid} | origen=${origenId} | destino=${destinoId} | activo=${activo} | destino=${destinoExiste ? 'ya existe idéntico' : 'se crearía'}`);
}
if (!aplicar) {
  console.log('Modo simulación: no se escribió ni eliminó ningún documento.');
  process.exit(0);
}

const batch = firestore.batch();
for (const plan of planes) {
  if (!plan.destinoExiste) batch.create(collection.doc(plan.destinoId), plan.datosDestino);
}
await batch.commit();
console.log('Migración completada: perfiles destino creados donde faltaban. No se eliminaron ni modificaron los documentos antiguos.');
