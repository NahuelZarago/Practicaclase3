// lib/auth.ts — Auth con email y contraseña + hook useUsuario() (base de la clase 2).
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

/** Usuario actual (null si no hay sesión). `cargando` es true hasta que Auth responde la primera vez. */
export function useUsuario(): { usuario: User | null; cargando: boolean } {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth(), (u) => {
      setUsuario(u);
      setCargando(false);
    });
  }, []);

  return { usuario, cargando };
}

export async function registrar(nombre: string, email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(auth(), email, password);
  // El nombre para mostrar es el que se copia como `autor` en cada reseña.
  await updateProfile(cred.user, { displayName: nombre.trim() });
}

export async function ingresar(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth(), email, password);
}

export async function salir(): Promise<void> {
  await signOut(auth());
}
