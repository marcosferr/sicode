/**
 * Carga denuncias FICTICIAS para probar la bandeja, la corroboración y los datos abiertos.
 *   npm run demo
 *
 * Todos los nombres, empresas y entes son inventados. Algunos casos coinciden a propósito
 * con las fuentes de demostración (SICODE_PDN=demo) para mostrar el semáforo en rojo y
 * en amarillo sin acusar a nadie real.
 *
 * El folio y la clave de un caso de prueba quedan en var/demo-seguimiento.txt.
 */
import { mkdirSync, writeFileSync } from "node:fs";

process.loadEnvFile?.(".env.local");

const ENTE = "Instituto Ficticio de Infraestructura de Valle Sereno";

const CASOS = [
  {
    relato:
      "El director de obras entregó cuatro contratos de mantenimiento de caminos a la empresa Constructora Demostrativa del Este, S.A. de C.V. sin concurso. " +
      "Se comenta que es socio de esa empresa. Los trabajos se pagaron completos aunque quedaron a medias.",
    conductas: ["FAVORITISMO_CONTRATO", "CONFLICTO"],
    entidad: "11", municipio: "León", institucion: ENTE,
    involucrados: [
      { tipo: "SERVIDOR_PUBLICO" as const, nombre: "Armando Ficticio Demostrado", cargo: "Director de obras", institucion: ENTE },
      { tipo: "EMPRESA" as const, razonSocial: "Constructora Demostrativa del Este, S.A. de C.V.", rfc: "CDE180312AB7" },
    ],
  },
  {
    relato:
      "En el área de adquisiciones del municipio piden un porcentaje a los proveedores para liberar los pagos. La jefa de adquisiciones es quien lo solicita por medio de su asistente.",
    conductas: ["SOBORNO"],
    entidad: "25", municipio: "Mazatlán", institucion: "Municipio Ficticio de Puerto Calma",
    involucrados: [{ tipo: "SERVIDOR_PUBLICO" as const, nombre: "Rosalba Inventada Ejemplar", cargo: "Jefa de adquisiciones" }],
  },
  {
    relato:
      "Un inspector de la dirección de comercio cobra a los locatarios del mercado para no clausurar sus puestos. Pasa cada quincena y no entrega ningún recibo.",
    conductas: ["EXTORSION"],
    entidad: "14", municipio: "Guadalajara", institucion: "Dirección Ficticia de Comercio de Villa Aurora",
    involucrados: [{ tipo: "SERVIDOR_PUBLICO" as const, nombre: "Ernesto Simulado Prueba", cargo: "Inspector" }],
  },
];

const RELATOS = [
  ["El titular de la oficina contrató a su hermana y a un sobrino en plazas que no se concursaron.", ["NEPOTISMO"]],
  ["Se usan vehículos oficiales y gasolina del ayuntamiento para actividades particulares los fines de semana.", ["DESVIO"]],
  ["En la ventanilla de licencias retrasan los trámites durante semanas si no se entrega una gratificación.", ["SOBORNO", "MAL_SERVICIO"]],
  ["Se avisó con anticipación a una empresa sobre las bases de una licitación de equipo de cómputo.", ["INFORMACION", "FAVORITISMO_CONTRATO"]],
  ["Un funcionario presionó a la contraloría para archivar una auditoría a un programa social.", ["INFLUENCIAS", "ENCUBRIMIENTO"]],
  ["El responsable del almacén reporta como entregados materiales que nunca llegaron a las escuelas.", ["DESVIO"]],
  ["Personal de tránsito detiene a conductores sin motivo y les pide dinero para dejarlos ir.", ["EXTORSION"]],
  ["La atención en el módulo fue grosera y se negaron a recibir mi solicitud sin explicar por qué.", ["MAL_SERVICIO"]],
] as const;

const ENTIDADES = ["09", "09", "09", "09", "15", "15", "15", "14", "14", "19", "19", "21", "21", "30", "11", "11", "02", "31"];
const ESTADOS = ["SIN_TURNAR", "SIN_TURNAR", "TURNADA", "REGISTRADA", "EN_PROCESO", "ATENDIDA", "ATENDIDA", "ATENDIDA", "IMPROCEDENTE"] as const;
const AUTORIDADES = ["Órgano Interno de Control Ficticio A", "Órgano Interno de Control Ficticio A", "Contraloría Ficticia B", "Fiscalía Ficticia C"];

async function main() {
  const { almacen } = await import("../src/lib/almacen");
  const servicio = await import("../src/lib/servicio");
  const { fuentesConfiguradas, modoDemo } = await import("../src/lib/pdn/demo");

  if ((await almacen().listar()).length) {
    console.log("Ya hay denuncias en el almacén: no se cargó nada. Borre var/almacen para empezar de cero.");
    return;
  }
  const base = { anonimo: true, evidencias: [], altcha: "", fechaHecho: "", referenciaContratacion: "" };
  let comprobante = "";

  for (const [i, c] of CASOS.entries()) {
    const { folio, clave } = await servicio.presentarDenuncia({
      ...base,
      anonimo: i !== 1,
      contacto: i === 1 ? { correo: "persona.ficticia@ejemplo.test", nombre: "Persona Ficticia" } : undefined,
      narracionHechos: c.relato,
      conductas: [...c.conductas],
      lugar: { entidad: c.entidad, municipio: c.municipio, institucion: c.institucion },
      involucrados: c.involucrados,
    });
    if (i === 0) comprobante = `Folio: ${folio}\nClave de seguimiento: ${clave}\n`;
  }

  // Relleno para que los datos abiertos tengan volumen: distintos meses, estados y etapas.
  let n = 0;
  for (const entidad of ENTIDADES) {
    for (let k = 0; k < 2; k++, n++) {
      const [relato, conductas] = RELATOS[n % RELATOS.length];
      await servicio.presentarDenuncia({
        ...base,
        anonimo: n % 5 !== 0,
        contacto: n % 5 === 0 ? { correo: `persona${n}@ejemplo.test` } : undefined,
        narracionHechos: `${relato} (Caso ficticio de demostración número ${n + 1}.)`,
        conductas: [...conductas],
        lugar: { entidad },
        involucrados: [],
      });
    }
  }

  // Se reparten fechas y etapas, escribiendo directamente en el almacén.
  const todas = await almacen().listar();
  for (const [i, d] of todas.entries()) {
    if (i < CASOS.length) continue;
    const mes = ["2026-08", "2026-09", "2026-09", "2026-10", "2026-10", "2026-10", "2026-11"][i % 7];
    const dia = String(1 + ((i * 7) % 27)).padStart(2, "0");
    d.fechaRecepcion = `${mes}-${dia}`;
    d.status = ESTADOS[i % ESTADOS.length];
    d.fechaActualizacion = d.fechaRecepcion;
    if (d.status !== "SIN_TURNAR") d.institucionActual = AUTORIDADES[i % AUTORIDADES.length];
    if (d.status === "ATENDIDA" || d.status === "IMPROCEDENTE") {
      const cierre = new Date(Date.parse(d.fechaRecepcion) + (6 + (i % 9) * 3) * 86_400_000);
      d.fechaActualizacion = cierre.toISOString().slice(0, 10);
      d.resumenPublicoCierre =
        d.status === "ATENDIDA"
          ? "La autoridad revisó los hechos e inició el procedimiento correspondiente. (Texto ficticio de demostración.)"
          : "La información no permitió identificar los hechos ni a las personas involucradas. (Texto ficticio de demostración.)";
    }
    d.bitacora[0].fecha = d.fechaRecepcion;
    await almacen().guardar(d);
  }

  // Corroboración de los tres casos principales con las fuentes configuradas.
  for (const d of todas.slice(0, CASOS.length)) {
    const r = await servicio.corroborarDenuncia(d.id, "demostracion", fuentesConfiguradas());
    console.log(`${d.folio}: semáforo ${r.corroboracion?.semaforo.color}, ${r.corroboracion?.indicios.length} indicio(s)`);
  }

  mkdirSync("var", { recursive: true });
  writeFileSync("var/demo-seguimiento.txt", comprobante, { mode: 0o600 });
  console.log(`Listo: ${todas.length} denuncias ficticias. Fuentes: ${modoDemo() ? "demostración" : "PDN real"}.`);
  console.log("Folio y clave de un caso de prueba: var/demo-seguimiento.txt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
