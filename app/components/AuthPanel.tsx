"use client";
// app/components/AuthPanel.tsx — Ingreso / registro / salida con email y contraseña.
import { useState, type FormEvent } from "react";
import { ingresar, registrar, salir, useUsuario } from "@/lib/auth";

export default function AuthPanel() {
  const { usuario, cargando } = useUsuario();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const modo = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    try {
      if (modo === "registrar") {
        const nombre = String(f.get("nombre")).trim();
        if (!nombre) throw new Error("Para crear la cuenta indicá tu nombre.");
        await registrar(nombre.slice(0, 80), email, password);
      } else {
        await ingresar(email, password);
      }
      setError(null);
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (cargando) return <p className="hint">Verificando sesión…</p>;

  if (usuario) {
    return (
      <p className="auth">
        Hola, <strong>{usuario.displayName ?? usuario.email}</strong>{" "}
        <button type="button" className="chip" onClick={() => salir()}>
          Salir
        </button>
      </p>
    );
  }

  return (
    <form className="auth" onSubmit={onSubmit}>
      <input name="nombre" placeholder="Nombre (solo al crear cuenta)" maxLength={80} aria-label="Nombre" />
      <input name="email" type="email" placeholder="Email" required aria-label="Email" />
      <input name="password" type="password" placeholder="Contraseña (mín. 6)" minLength={6} required aria-label="Contraseña" />
      <button type="submit" value="ingresar" className="chip">
        Ingresar
      </button>
      <button type="submit" value="registrar" className="chip">
        Crear cuenta
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
