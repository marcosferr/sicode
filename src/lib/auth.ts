/**
 * Acceso de autoridades (operadores) con NextAuth, como en el prototipo del S5.
 * - Con SICODE_ALMACEN=directus, las credenciales se validan contra Directus.
 * - En modo local, contra el operador de demostración definido en .env.local.
 */
import { scryptSync, timingSafeEqual } from "node:crypto";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { ErrorServicio } from "./servicio";

function verificarLocal(correo: string, clave: string): boolean {
  const esperado = process.env.SICODE_OPERADOR_CORREO;
  const guardado = process.env.SICODE_OPERADOR_CLAVE_HASH;
  if (!esperado || !guardado || correo.toLowerCase() !== esperado.toLowerCase()) return false;
  const [sal, hash] = guardado.split(":");
  if (!sal || !hash) return false;
  const a = Buffer.from(hash, "base64");
  const b = scryptSync(clave, Buffer.from(sal, "base64"), a.length);
  return timingSafeEqual(a, b);
}

async function verificarDirectus(correo: string, clave: string): Promise<boolean> {
  try {
    const r = await fetch(`${process.env.DIRECTUS_URL ?? "http://localhost:8055"}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo, password: clave }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export const opcionesAuth: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 3600 },
  pages: { signIn: "/operador" },
  providers: [
    CredentialsProvider({
      name: "Autoridad",
      credentials: { correo: { label: "Correo", type: "email" }, clave: { label: "Contraseña", type: "password" } },
      async authorize(c) {
        const correo = c?.correo?.trim() ?? "";
        const clave = c?.clave ?? "";
        if (!correo || !clave) return null;
        const valido =
          process.env.SICODE_ALMACEN === "directus"
            ? (await verificarDirectus(correo, clave)) || verificarLocal(correo, clave)
            : verificarLocal(correo, clave);
        return valido ? { id: correo, email: correo, name: correo.split("@")[0] } : null;
      },
    }),
  ],
};

/** Devuelve el correo del operador con sesión, o lanza 401. */
export async function operadorActual(): Promise<string> {
  const sesion = await getServerSession(opcionesAuth);
  const correo = sesion?.user?.email;
  if (!correo) throw new ErrorServicio("Inicia sesión como autoridad.", 401);
  return correo;
}

export async function hayOperador(): Promise<string | null> {
  return (await getServerSession(opcionesAuth))?.user?.email ?? null;
}
