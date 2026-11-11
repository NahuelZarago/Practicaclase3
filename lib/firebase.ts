// lib/firebase.ts — Inicialización del SDK web de Firebase (base de la clase 2: Auth).
// En desarrollo (`npm run dev`) todo apunta a los emuladores locales; en producción usa
// la configuración pública de tu proyecto (NEXT_PUBLIC_FIREBASE_*, ver .env.example).
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

const enDesarrollo = process.env.NODE_ENV === "development";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? (enDesarrollo ? "demo-api-key" : undefined),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? (enDesarrollo ? "demo-resenas" : undefined),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** App de Firebase (se crea una sola vez). */
export function firebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

let authInstancia: Auth | null = null;

/** Auth, conectado al emulador (127.0.0.1:9099) cuando se corre `npm run dev`. */
export function auth(): Auth {
  if (authInstancia) return authInstancia;
  authInstancia = getAuth(firebaseApp());
  if (enDesarrollo) connectAuthEmulator(authInstancia, "http://127.0.0.1:9099", { disableWarnings: true });
  return authInstancia;
}
