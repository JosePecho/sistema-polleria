
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyChg7OBU4MwVD64Dni_pzYDqv40LwGKrG0",
  authDomain: "sistema-polleria-1487c.firebaseapp.com",
  projectId: "sistema-polleria-1487c",
  storageBucket: "sistema-polleria-1487c.firebasestorage.app",
  messagingSenderId: "775936488168",
  appId: "1:775936488168:web:1f689da8e8ed9052870f5d",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Autenticación de usuarios
export const auth = getAuth(app);

// Base de datos Cloud Firestore
export const db = getFirestore(app);

export default app;
