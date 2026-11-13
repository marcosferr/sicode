/**
 * Genera .env.local con secretos aleatorios y un operador de demostración.
 *   npm run preparar
 * No sobrescribe un .env.local existente.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const RUTA = ".env.local";
if (existsSync(RUTA)) {
  console.log(`${RUTA} ya existe: no se modificó.`);
  process.exit(0);
}
const b64 = (n: number) => randomBytes(n).toString("base64");
const clave = randomBytes(9).toString("base64url");
const sal = randomBytes(16);
const hash = scryptSync(clave, sal, 32).toString("base64");

writeFileSync(
  RUTA,
  `# Generado por \`npm run preparar\`. No lo suba a un repositorio.
SICODE_ALMACEN=local
SICODE_LLAVE_CONTACTO=${b64(32)}
SICODE_SECRETO_ALTCHA=${b64(32)}
SICODE_K_ANONIMATO=5
# demo = registros ficticios de demostración; real = PDN (requiere npm run datos)
SICODE_PDN=demo
NEXTAUTH_SECRET=${b64(32)}
NEXTAUTH_URL=http://localhost:3000

# Operador de demostración (solo para pruebas locales)
SICODE_OPERADOR_CORREO=operador@sicode.test
SICODE_OPERADOR_CLAVE=${clave}
SICODE_OPERADOR_CLAVE_HASH=${sal.toString("base64")}:${hash}

# Para usar Directus (docker compose up -d && npm run directus):
# SICODE_ALMACEN=directus
# DIRECTUS_URL=http://localhost:8055
# DIRECTUS_TOKEN=
`,
  { mode: 0o600 },
);
console.log(`Listo: ${RUTA} creado. El correo y la contraseña del operador de demostración están en ese archivo.`);
