"use client";

import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Boton, Campo, Tarjeta } from "./ui";

export function IngresoOperador() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError("");
    const r = await signIn("credentials", { correo, clave, redirect: false });
    setCargando(false);
    if (r?.error) return setError("El correo o la contraseña no coinciden.");
    router.push("/operador/bandeja");
    router.refresh();
  };

  return (
    <Tarjeta className="mt-8">
      <form onSubmit={entrar} className="space-y-4" noValidate>
        <Campo id="correo" type="email" etiqueta="Correo institucional" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        <Campo id="clave" type="password" etiqueta="Contraseña" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
        <Boton type="submit" className="w-full" disabled={cargando || !correo || !clave}>
          {cargando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} Entrar
        </Boton>
      </form>
    </Tarjeta>
  );
}
