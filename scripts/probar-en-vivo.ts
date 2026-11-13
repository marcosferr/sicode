/**
 * Corre el motor contra la PDN real desde la terminal, sin pasar por la interfaz.
 *
 *   npx tsx scripts/probar-en-vivo.ts --persona "Nombre Apellido Apellido" --ente "Nombre del ente" \
 *        --empresa "Razón social, S.A. de C.V." --rfc ABC010101AB1 --relato "Texto del relato"
 *
 * No trae ejemplos con nombres reales a propósito: un caso de prueba que acuse a una
 * persona o empresa real, aunque sea inventado, no debe quedar escrito en el repositorio.
 */
import { corroborar } from "../src/lib/motor/corroborar";
import { FuentesReales } from "../src/lib/pdn/fuentes";
import type { Involucrado } from "../src/lib/tipos";

const arg = (nombre: string) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const persona = arg("persona");
const empresa = arg("empresa");
const ente = arg("ente");
if (!persona && !empresa) {
  console.error('Indique al menos --persona "Nombre Apellidos" o --empresa "Razón social".');
  process.exit(1);
}

const involucrados: Involucrado[] = [];
if (persona) involucrados.push({ tipo: "SERVIDOR_PUBLICO", nombre: persona, institucion: ente });
if (empresa) involucrados.push({ tipo: "EMPRESA", razonSocial: empresa, rfc: arg("rfc") });

corroborar(
  { narracionHechos: arg("relato") ?? "", conductas: [], lugar: { institucion: ente }, involucrados },
  new FuentesReales(),
).then((r) => {
  for (const q of r.consultas) console.log(`[${q.sistema} ${q.modo} ${q.estado} ${q.resultados} ${q.ms}ms] ${q.descripcion} ${q.detalle ?? ""}`);
  for (const i of r.indicios) console.log(`\n${i.id} [${i.tipo} ${i.confiabilidad}${i.reglaDura ? ", regla dura" : ""}] ${i.descripcion}\n     ${i.detalle ?? ""}\n     Fuente: ${i.fuente.sistema} ${i.fuente.url}`);
  console.log("\nHipótesis:");
  for (const h of r.hipotesis) console.log(`  ${h.id} (${h.estado}) ${h.enunciado}`);
  console.log(`\nSemáforo: ${r.semaforo.color} (puntaje ${r.semaforo.puntaje})`);
  for (const l of r.semaforo.queCambiaria) console.log("  - " + l);
});
