/**
 * Verificación anti-bots con ALTCHA (prueba de trabajo), igual que el prototipo del S5.
 * Se aloja aquí mismo: no hay un tercero que vea quién entra a denunciar.
 * Como el sistema no guarda IP, esta prueba es también el freno contra envíos masivos y
 * contra adivinar claves de seguimiento.
 */
import { createChallenge, randomInt, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";

const secreto = () => {
  const s = process.env.SICODE_SECRETO_ALTCHA;
  if (!s) throw new Error("Falta SICODE_SECRETO_ALTCHA. Ejecute `npm run preparar`.");
  return s;
};

/** Retos ya usados, para que una solución no sirva dos veces. Se limpian al expirar. */
const usados = new Map<string, number>();

export async function nuevoReto() {
  return createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: 5_000,
    counter: randomInt(5_000, 10_000),
    deriveKey,
    expiresAt: new Date(Date.now() + 10 * 60_000),
    hmacSignatureSecret: secreto(),
    hmacKeySignatureSecret: secreto() + ":clave",
  });
}

export async function verificarReto(payload: string | undefined | null): Promise<boolean> {
  if (!payload) return false;
  try {
    const datos = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as { challenge: never; solution: never };
    const firma = JSON.stringify(datos.challenge);
    const ahora = Date.now();
    for (const [k, vence] of usados) if (vence < ahora) usados.delete(k);
    if (usados.has(firma)) return false;
    const r = await verifySolution({
      challenge: datos.challenge,
      solution: datos.solution,
      deriveKey,
      hmacSignatureSecret: secreto(),
      hmacKeySignatureSecret: secreto() + ":clave",
    });
    if (r.verified) usados.set(firma, ahora + 15 * 60_000);
    return r.verified;
  } catch {
    return false;
  }
}
