/**
 * Corre el motor contra la PDN real con un caso armado a partir de registros públicos.
 *   npx tsx scripts/probar-en-vivo.ts
 */
import { corroborar } from "../src/lib/motor/corroborar";
import { FuentesReales } from "../src/lib/pdn/fuentes";

const denuncia = {
  narracionHechos:
    "En el fideicomiso le dan siempre los contratos de telefonía y cámaras a la empresa Wynnmex Technologies, S. de R.L. de C.V. " +
    "sin que compita nadie más. Creo que alguien de administración les avisa antes.",
  conductas: ["FAVORITISMO_CONTRATO"],
  lugar: { entidad: "09", institucion: "Fideicomiso de Formación y Capacitación para el Personal de la Marina Mercante Nacional" },
  involucrados: [
    { tipo: "SERVIDOR_PUBLICO" as const, nombre: process.argv[2] ?? "Michael Sebastian Hernández Hidalgo", institucion: process.argv[3] ?? "Municipio de León" },
  ],
};

corroborar(denuncia, new FuentesReales()).then((r) => {
  console.log("EXTRAÍDO", JSON.stringify(r.entidadesExtraidas));
  for (const q of r.consultas) console.log(`  [${q.sistema} ${q.modo} ${q.estado} ${q.resultados} ${q.ms}ms] ${q.descripcion} ${q.detalle ?? ""}`);
  for (const i of r.indicios) console.log(`  ${i.id} [${i.tipo} ${i.confiabilidad}${i.reglaDura ? " DURA" : ""}] ${i.categoria}: ${i.descripcion}\n       ${i.detalle ?? ""}`);
  for (const h of r.hipotesis) console.log(`  ${h.id} (${h.estado}) ${h.enunciado} -> ${h.indicios.join(",")}`);
  console.log("SEMÁFORO", r.semaforo.color, r.semaforo.puntaje, r.semaforo.reglasDuras.map((x) => x.regla));
  console.log(r.semaforo.queCambiaria.join("\n"));
});
