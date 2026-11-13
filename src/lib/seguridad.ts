/**
 * Piezas criptográficas del resguardo de identidad. Solo corre en el servidor.
 *
 * - Folio: aleatorio, no secuencial. Un folio consecutivo revela cuántas denuncias hay y
 *   en qué orden llegaron.
 * - Clave de seguimiento: 100 bits aleatorios que se muestran una sola vez. El servidor
 *   guarda únicamente su derivación con scrypt: ni un operador ni una copia de la base
 *   permiten suplantar a quien denunció.
 * - Datos de contacto (cuando la persona decide dejarlos): AES-256-GCM con una llave que
 *   no vive en la base de datos. Abrirlos exige un motivo y queda en bitácora.
 * - Fechas: se guarda el día, no la hora. La hora exacta de envío se puede cruzar con
 *   registros de acceso a un edificio o a una red.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

// Alfabeto sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/I/L).
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function aleatorio(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

export const PREFIJO_FOLIO = "SCD";

export function nuevoFolio(hoy: Date = new Date()): string {
  return `${PREFIJO_FOLIO}-${hoy.getUTCFullYear()}-${aleatorio(4)}-${aleatorio(4)}`;
}

export const RE_FOLIO = /^SCD-\d{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

export function normalizarFolio(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, "");
}

/** Cuatro grupos de cinco caracteres: unos 99 bits de entropía. */
export function nuevaClave(): string {
  return [aleatorio(5), aleatorio(5), aleatorio(5), aleatorio(5)].join("-");
}

export function normalizarClave(texto: string): string {
  return texto.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function derivarClave(clave: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(normalizarClave(clave), sal, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export function verificarClave(clave: string, guardado: string): boolean {
  const [esquema, sal, hash] = guardado.split("$");
  if (esquema !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const obtenido = scryptSync(normalizarClave(clave), Buffer.from(sal, "base64"), esperado.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(esperado, obtenido);
}

/** Llave de 32 bytes para los datos de contacto. En producción debe venir de un gestor de secretos. */
function llaveContacto(): Buffer {
  const valor = process.env.SICODE_LLAVE_CONTACTO;
  if (!valor) throw new Error("Falta SICODE_LLAVE_CONTACTO (32 bytes en base64). Vea .env.example.");
  const llave = Buffer.from(valor, "base64");
  if (llave.length !== 32) throw new Error("SICODE_LLAVE_CONTACTO debe tener 32 bytes en base64.");
  return llave;
}

export interface Contacto {
  correo: string;
  nombre?: string;
  telefono?: string;
}

export function cifrarContacto(c: Contacto): string {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", llaveContacto(), iv);
  const cuerpo = Buffer.concat([cifrador.update(JSON.stringify(c), "utf8"), cifrador.final()]);
  return ["v1", iv.toString("base64"), cifrador.getAuthTag().toString("base64"), cuerpo.toString("base64")].join(".");
}

export function descifrarContacto(blob: string): Contacto {
  const [version, iv, etiqueta, cuerpo] = blob.split(".");
  if (version !== "v1") throw new Error("Formato de contacto desconocido.");
  const descifrador = createDecipheriv("aes-256-gcm", llaveContacto(), Buffer.from(iv, "base64"));
  descifrador.setAuthTag(Buffer.from(etiqueta, "base64"));
  const claro = Buffer.concat([descifrador.update(Buffer.from(cuerpo, "base64")), descifrador.final()]);
  return JSON.parse(claro.toString("utf8")) as Contacto;
}

export const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

/** Solo el día (AAAA-MM-DD), en la zona horaria del centro de México. */
export function soloDia(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
}

export const idAleatorio = () => randomBytes(12).toString("hex");
