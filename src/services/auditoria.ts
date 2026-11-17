
import {
  collection,
  doc,
  serverTimestamp,
  type WriteBatch,
  type Transaction,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export type TipoAuditoria =
  | "COMANDA_CREADA"
  | "PEDIDO_ESTADO_CAMBIADO"
  | "PAGO_REGISTRADO";

interface DatosAuditoria {
  accion: TipoAuditoria;
  descripcion: string;
  entidadId: string;
  mesaId?: string;
  numeroMesa?: number;
  detalles?: Record<string, unknown>;
}

function obtenerDatosAuditoria(datos: DatosAuditoria) {
  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error(
      "No hay un usuario autenticado para registrar la auditoría."
    );
  }

  return {
    ...datos,
    usuarioId: usuario.uid,
    correo: usuario.email ?? "",
    fecha: serverTimestamp(),
  };
}

// Para operaciones que utilizan WriteBatch.
export function agregarAuditoriaAlLote(
  lote: WriteBatch,
  datos: DatosAuditoria
) {
  const auditoriaRef = doc(collection(db, "auditoria"));

  lote.set(auditoriaRef, obtenerDatosAuditoria(datos));

  return auditoriaRef.id;
}

// Para operaciones que utilizan Transaction.
export function agregarAuditoriaATransaccion(
  transaccion: Transaction,
  datos: DatosAuditoria
) {
  const auditoriaRef = doc(collection(db, "auditoria"));

  transaccion.set(
    auditoriaRef,
    obtenerDatosAuditoria(datos)
  );

  return auditoriaRef.id;
}
