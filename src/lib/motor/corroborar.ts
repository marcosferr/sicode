/**
 * Corroboración de una denuncia con datos públicos de la PDN.
 *
 * Idea central: cuanto más se puede comprobar una denuncia con registros oficiales, menos
 * necesita la autoridad saber quién la presentó. El motor nunca usa datos de quien
 * denuncia: solo el relato, las personas y empresas señaladas, y el ente público.
 *
 * Reglas de prudencia (se aplican en el código, no solo en la documentación):
 * - Un indicio describe un dato con su fuente. No califica a nadie.
 * - Coincidir solo en el nombre es confiabilidad C: puede ser un homónimo.
 * - La confiabilidad A exige un identificador (RFC de persona moral).
 * - Una regla dura solo cuenta sobre un hecho A o B.
 * - Una fuente caída queda anotada como brecha: no se asume "sin resultados".
 */
import { clasificar, FALTAS_S3_EQUIVALENTES } from "../catalogos";
import type { ContratoS6, FuentesPDN, ResultadoFuente, SancionParticular } from "../pdn/tipos";
import { URL_PDN } from "../pdn/tipos";
import {
  claveEmpresa,
  nombreCompleto,
  partirNombre,
  similitud,
  similitudPersona,
  tokens,
  type NombrePersona,
} from "../texto";
import type { Confiabilidad, Consulta, Corroboracion, Denuncia, Fuente, Hipotesis, Indicio, Sistema } from "../tipos";
import { extraer } from "./extraccion";
import { calcularSemaforo, criterioVigente } from "./semaforo";

export type DenunciaCorroborable = Pick<
  Denuncia,
  "narracionHechos" | "involucrados" | "lugar" | "referenciaContratacion" | "conductas"
>;

const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

/** Dos nombres de ente se consideran el mismo si se parecen o si uno contiene al otro. */
export function coincideEnte(a: string | undefined, b: string | undefined, umbral: number): boolean {
  if (!a || !b) return false;
  if (similitud(a, b) >= umbral) return true;
  const ta = tokens(a, true);
  const tb = tokens(b, true);
  const [corto, largo] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  return corto.length >= 2 && corto.every((t) => largo.has(t));
}

export async function corroborar(
  d: DenunciaCorroborable,
  fuentes: FuentesPDN,
  hoy: Date = new Date(),
): Promise<Corroboracion> {
  const c = criterioVigente();
  const P = c.criterio.parametros;
  const fechaConsulta = hoy.toISOString().slice(0, 10);
  const ext = extraer(d);
  // Un único RFC en el relato y una única empresa sin RFC: se asume que van juntos.
  if (ext.rfcs.length === 1 && ext.empresas.length === 1 && !ext.empresas[0].rfc) {
    ext.empresas[0].rfc = ext.rfcs[0];
  }

  const indicios: Indicio[] = [];
  const consultas: Consulta[] = [];
  const hipotesis: Hipotesis[] = [];
  let n = 0;

  const anotar = (i: Omit<Indicio, "id">): string => {
    const id = `I-${++n}`;
    indicios.push({ id, ...i });
    return id;
  };
  const registrar = <T>(sistema: Sistema, descripcion: string, r: ResultadoFuente<T>, utiles: number) => {
    consultas.push({
      sistema,
      descripcion,
      modo: r.modo,
      estado: r.estado === "no_accesible" ? "no_accesible" : utiles ? "ok" : "sin_resultados",
      resultados: utiles,
      ms: r.ms,
      detalle: [r.detalle, r.truncado ? "Hubo más resultados de los que se revisaron." : ""].filter(Boolean).join(" ") || undefined,
    });
  };
  const fuente = (sistema: Exclude<Sistema, "S5">, modo: "local" | "api", extra: Partial<Fuente> = {}): Fuente => ({
    sistema,
    modo,
    fechaConsulta,
    url: URL_PDN[sistema],
    ...extra,
  });
  const hipotesisDe = (enunciado: string, comoVerificar: string, ids: string[], accesible: boolean) => {
    hipotesis.push({
      id: `H-${hipotesis.length + 1}`,
      enunciado,
      comoVerificar,
      estado: ids.length ? "con_respaldo" : accesible ? "sin_respaldo" : "abierta",
      indicios: ids,
    });
  };

  const entesDenunciados = ext.entes;
  const enteDe = (institucion?: string) => institucion ?? entesDenunciados[0];

  /* ---------- Empresas: sanciones (S3) y contratos (S6) ---------- */

  const sancionesPorEmpresa = new Map<string, { s: SancionParticular; porRfc: boolean }[]>();
  const contratosPorEmpresa = new Map<string, { k: ContratoS6; conf: Confiabilidad }[]>();

  // Todas las consultas salen a la vez; los indicios se anotan después, en orden estable.
  const respEmpresas = await Promise.all(
    ext.empresas.map((e) =>
      Promise.all([
        fuentes.sancionesParticular({ razonSocial: e.razonSocial, rfc: e.rfc }),
        fuentes.contratosProveedor({ razonSocial: e.razonSocial, rfc: e.rfc }),
      ]),
    ),
  );
  const respPersonas = await Promise.all(
    ext.personas.map((p) => {
      const persona = partirNombre(p.nombre);
      return persona.primerApellido
        ? Promise.all([
            fuentes.sancionesServidor(persona),
            fuentes.servidoresContrataciones(persona),
            fuentes.declaraciones(persona),
          ])
        : null;
    }),
  );

  for (const [iEmpresa, e] of ext.empresas.entries()) {
    const etiqueta = e.razonSocial;
    const clave = claveEmpresa(e.razonSocial);
    const [rS3, rS6] = respEmpresas[iEmpresa];

    const coincidenciasS3 = rS3.datos
      .filter((s) => s.tipo === "MORAL")
      .map((s) => ({
        s,
        porRfc: Boolean(e.rfc && s.rfc && s.rfc.toUpperCase() === e.rfc.toUpperCase()),
        sim: s.razonSocial ? similitud(claveEmpresa(s.razonSocial), clave) : 0,
      }))
      .filter((x) => x.porRfc || x.sim >= P.similitud_empresa_minima);
    registrar("S3", `Sanciones a particulares: ${etiqueta}`, rS3, coincidenciasS3.length);
    sancionesPorEmpresa.set(clave, coincidenciasS3);

    const idsSancion: string[] = [];
    for (const { s, porRfc } of coincidenciasS3) {
      const vigente = s.sanciones.find((x) => x.inhabilitacionHasta && x.inhabilitacionHasta >= fechaConsulta);
      const faltas = s.faltas.map((f) => f.valor ?? f.clave).join(", ");
      idsSancion.push(
        anotar({
          categoria: porRfc ? "empresa_sancionada" : "empresa_sancionada_solo_nombre",
          tipo: porRfc ? "hecho" : "posible_alerta",
          reglaDura: porRfc && vigente ? "empresa_inhabilitada_vigente" : undefined,
          sujeto: etiqueta,
          confiabilidad: porRfc ? "A" : "C",
          descripcion: porRfc
            ? `El S3 registra una sanción a ${s.razonSocial} (RFC ${s.rfc}), expediente ${s.expediente ?? "sin número"}.`
            : `El S3 registra una sanción a una empresa de nombre similar: ${s.razonSocial}.`,
          detalle:
            `Falta: ${faltas || "no especificada"}. Sanción: ${s.sanciones.map((x) => x.clave).join(", ") || "no especificada"}` +
            (vigente ? `, con inhabilitación vigente hasta ${vigente.inhabilitacionHasta}.` : ".") +
            (s.ente ? ` Ente donde se cometió: ${s.ente}.` : ""),
          fuente: fuente("S3", rS3.modo, { proveedor: s.proveedor, referencia: s.expediente, url: s.urlResolucion ?? URL_PDN.S3 }),
          explicacionAlternativa: porRfc
            ? "La sanción pudo ser impugnada o haber concluido. Revisar la resolución."
            : "Sin RFC no se puede descartar que sea otra empresa con nombre parecido.",
        }),
      );
    }
    hipotesisDe(
      `La empresa ${etiqueta} tiene sanciones registradas.`,
      "Buscar la razón social y el RFC en particulares sancionados del S3.",
      idsSancion,
      rS3.estado !== "no_accesible",
    );

    const propios = rS6.datos
      .map((k) => {
        const lista = [...k.proveedores];
        const porRfc = Boolean(e.rfc && lista.some((x) => x.id?.toUpperCase() === e.rfc!.toUpperCase()));
        const sim = Math.max(0, ...lista.map((x) => similitud(claveEmpresa(x.nombre), clave)));
        return { k, porRfc, sim };
      })
      .filter((x) => x.porRfc || x.sim >= P.similitud_empresa_minima)
      .map((x) => ({ k: x.k, conf: (x.porRfc ? "A" : "B") as Confiabilidad }));
    registrar("S6", `Contratos adjudicados a ${etiqueta} (el S6 publicado cubre 2015–2021, ámbito federal)`, rS6, propios.length);
    contratosPorEmpresa.set(clave, propios);

    const conEnte = propios.filter((x) => entesDenunciados.some((en) => coincideEnte(x.k.comprador, en, P.similitud_ente_minima)));
    const idsContrato: string[] = [];
    if (conEnte.length) {
      const total = conEnte.reduce((s, x) => s + (x.k.montoAdjudicado ?? 0), 0);
      const mejor = conEnte.some((x) => x.conf === "A") ? "A" : "B";
      idsContrato.push(
        anotar({
          categoria: "contratos_empresa_con_ente",
          tipo: "hecho",
          sujeto: etiqueta,
          confiabilidad: mejor,
          descripcion: `El S6 registra ${conEnte.length} contratación(es) de ${conEnte[0].k.comprador} adjudicada(s) a ${etiqueta}.`,
          detalle:
            `Monto adjudicado: ${pesos(total)}. Procedimientos: ` +
            conEnte.slice(0, 5).map((x) => `${x.k.ocid} (${x.k.ciclo ?? "s/f"}, ${metodo(x.k.metodo)})`).join("; ") +
            (conEnte.length > 5 ? "; y otros." : "."),
          fuente: fuente("S6", rS6.modo, { referencia: conEnte[0].k.ocid, url: conEnte[0].k.url ?? URL_PDN.S6 }),
          explicacionAlternativa:
            "Que exista una relación contractual es un dato de contexto; por sí solo no indica irregularidad." +
            (total > 1e9 ? " El monto es el que publica la fuente y es inusualmente alto: conviene verificarlo en el expediente." : ""),
        }),
      );
    } else if (propios.length) {
      const total = propios.reduce((s, x) => s + (x.k.montoAdjudicado ?? 0), 0);
      anotar({
        categoria: "contratos_empresa_otros_entes",
        tipo: "contexto",
        sujeto: etiqueta,
        confiabilidad: propios.some((x) => x.conf === "A") ? "A" : "B",
        descripcion: `El S6 registra ${propios.length} contratación(es) adjudicada(s) a ${etiqueta}, ninguna con el ente señalado.`,
        detalle: `Monto adjudicado: ${pesos(total)}. Compradores: ${[...new Set(propios.map((x) => x.k.comprador))].slice(0, 4).join("; ")}.`,
        fuente: fuente("S6", rS6.modo, { referencia: propios[0].k.ocid, url: propios[0].k.url ?? URL_PDN.S6 }),
      });
    }
    hipotesisDe(
      `La empresa ${etiqueta} ha recibido contratos del ente señalado.`,
      "Buscar al proveedor en el S6 y filtrar por comprador.",
      idsContrato,
      rS6.estado !== "no_accesible",
    );

    // Banderas sobre los contratos con el ente (o sobre todos, si no hay ninguno con el ente).
    const base = conEnte.length ? conEnte : propios;
    const conf: Confiabilidad = base.some((x) => x.conf === "A") ? "A" : "B";
    const idsBandera = banderas(base.map((x) => x.k), etiqueta, conf, P, anotar, (extra) => fuente("S6", rS6.modo, extra));

    // Contratos posteriores a una sanción confirmada por RFC.
    for (const { s, porRfc } of coincidenciasS3) {
      if (!s.fecha) continue;
      const posteriores = propios.filter((x) => (x.k.fechaAdjudicacion ?? "") > s.fecha!);
      if (!posteriores.length) continue;
      const confirmado = porRfc && posteriores.some((x) => x.conf === "A");
      idsBandera.push(
        anotar({
          categoria: "empresa_sancionada",
          tipo: confirmado ? "hecho" : "posible_alerta",
          reglaDura: "contrato_posterior_a_sancion",
          sujeto: etiqueta,
          confiabilidad: confirmado ? "A" : "C",
          descripcion: `${posteriores.length} contratación(es) a ${etiqueta} tienen fecha posterior a la sanción del ${s.fecha}.`,
          detalle: posteriores.slice(0, 5).map((x) => `${x.k.ocid} (${x.k.fechaAdjudicacion?.slice(0, 10)}, ${x.k.comprador})`).join("; "),
          fuente: fuente("S6", rS6.modo, { referencia: posteriores[0].k.ocid, url: posteriores[0].k.url ?? URL_PDN.S6 }),
          explicacionAlternativa: "La sanción pudo no incluir inhabilitación, o esta pudo haber concluido antes del contrato.",
        }),
      );
    }
    if (base.length) {
      hipotesisDe(
        `Las contrataciones de ${etiqueta} muestran señales de competencia limitada.`,
        "Revisar modalidad, número de oferentes, plazos y concentración por comprador en el S6.",
        idsBandera,
        true,
      );
    }
  }

  /* ---------- Personas: sanciones (S3), contrataciones (S2), declaraciones (S1) ---------- */

  for (const [iPersona, p] of ext.personas.entries()) {
    const persona: NombrePersona = partirNombre(p.nombre);
    const etiqueta = p.nombre;
    const ente = enteDe(p.institucion);
    const sim = (otra: NombrePersona) => similitudPersona(persona, otra);
    const resp = respPersonas[iPersona];
    if (!persona.primerApellido || !resp) {
      consultas.push({
        sistema: "S3", descripcion: `Persona señalada: ${etiqueta}`, modo: "local", estado: "sin_resultados", resultados: 0, ms: 0,
        detalle: "Se necesita al menos un nombre y un apellido para cruzar sin riesgo de homónimos.",
      });
      continue;
    }

    const [rS3, rS2, rS1] = resp;

    const sancionados = rS3.datos.filter((s) => sim(s.persona) >= P.similitud_persona_minima);
    registrar("S3", `Sanciones por faltas graves: ${etiqueta}`, rS3, sancionados.length);
    const idsSancion = sancionados.map((s) => {
      const mismoEnte = coincideEnte(s.ente, ente, P.similitud_ente_minima);
      return anotar({
        categoria: mismoEnte ? "servidor_sancion_grave" : "servidor_sancion_solo_nombre",
        tipo: mismoEnte ? "hecho" : "posible_alerta",
        reglaDura: mismoEnte ? "servidor_sancion_grave_mismo_ente" : undefined,
        sujeto: etiqueta,
        confiabilidad: mismoEnte ? "B" : "C",
        descripcion: mismoEnte
          ? `El S3 registra una sanción por falta grave a ${nombreCompleto(s.persona)} en ${s.ente}.`
          : `El S3 registra una sanción por falta grave a una persona de nombre coincidente (${nombreCompleto(s.persona)}) en otro ente: ${s.ente ?? "no especificado"}.`,
        detalle:
          `Expediente ${s.expediente ?? "sin número"}. Falta: ${s.faltas.map((f) => f.clave).join(", ") || "no especificada"}. ` +
          `Sanción: ${s.sanciones.map((x) => x.clave).join(", ") || "no especificada"}.`,
        fuente: fuente("S3", rS3.modo, { proveedor: s.proveedor, referencia: s.expediente, url: s.urlResolucion ?? URL_PDN.S3 }),
        explicacionAlternativa: mismoEnte
          ? "Coinciden nombre y ente, pero el S3 no publica un identificador de la persona. Confirmar con el expediente."
          : "Puede tratarse de un homónimo.",
      });
    });
    hipotesisDe(
      `${etiqueta} tiene antecedentes de sanción por faltas graves.`,
      "Buscar nombre y apellidos en servidores públicos sancionados del S3 y comparar el ente.",
      idsSancion,
      rS3.estado !== "no_accesible",
    );

    const enContrataciones = rS2.datos.filter((s) => sim(s.persona) >= P.similitud_persona_minima);
    const delEnte = enContrataciones.filter((s) => coincideEnte(s.institucion, ente, P.similitud_ente_minima));
    registrar("S2", `Servidores que intervienen en contrataciones: ${etiqueta}`, rS2, enContrataciones.length);
    const idsS2: string[] = [];
    for (const s of (delEnte.length ? delEnte : enContrataciones).slice(0, 3)) {
      const mismoEnte = delEnte.includes(s);
      idsS2.push(
        anotar({
          categoria: "servidor_interviene_en_contrataciones",
          tipo: mismoEnte ? "hecho" : "posible_alerta",
          sujeto: etiqueta,
          confiabilidad: mismoEnte ? "B" : "C",
          descripcion: mismoEnte
            ? `El S2 registra a ${nombreCompleto(s.persona)} como persona servidora pública que interviene en procedimientos en ${s.institucion}.`
            : `El S2 registra a una persona de nombre coincidente (${nombreCompleto(s.persona)}) en ${s.institucion ?? "un ente no especificado"}.`,
          detalle:
            `Puesto: ${s.puesto ?? "no especificado"}. Nivel de responsabilidad: ${s.nivelesResponsabilidad.join(", ") || "no especificado"}. ` +
            `Procedimientos: ${s.tiposProcedimiento.join(", ") || "no especificado"}.` +
            (s.ejercicio ? ` Ejercicio ${s.ejercicio}.` : ""),
          fuente: fuente("S2", rS2.modo, { proveedor: s.proveedor }),
          explicacionAlternativa: mismoEnte
            ? "Intervenir en contrataciones es parte normal de muchos puestos. Indica que la persona tenía la oportunidad, no que cometió la conducta."
            : "Puede tratarse de un homónimo.",
        }),
      );
    }
    hipotesisDe(
      `${etiqueta} interviene en contrataciones u otros procedimientos del ente señalado.`,
      "Buscar nombre y apellidos en el S2 y comparar institución y puesto.",
      idsS2,
      rS2.estado !== "no_accesible",
    );

    const declarantes = rS1.datos.filter((x) => sim(x.persona) >= P.similitud_persona_minima);
    registrar("S1", `Declaraciones patrimoniales y de intereses: ${etiqueta}`, rS1, declarantes.length);
    const idsCargo: string[] = [];
    const idsInteres: string[] = [];
    const vistos = new Set<string>();
    for (const x of declarantes) {
      const mismoEnte = coincideEnte(x.institucion, ente, P.similitud_ente_minima);
      const claveCargo = `${x.institucion}|${x.cargo}`;
      if (mismoEnte && !vistos.has(claveCargo)) {
        vistos.add(claveCargo);
        idsCargo.push(
          anotar({
            categoria: "cargo_confirmado",
            tipo: "hecho",
            sujeto: etiqueta,
            confiabilidad: "B",
            descripcion: `El S1 registra una declaración de ${nombreCompleto(x.persona)} con cargo en ${x.institucion}.`,
            detalle: `Cargo declarado: ${x.cargo ?? "no especificado"}. Tipo: ${x.tipo ?? "s/d"}${x.actualizacion ? `, actualizada el ${x.actualizacion.slice(0, 10)}` : ""}.`,
            fuente: fuente("S1", rS1.modo, { proveedor: x.proveedor, referencia: x.id }),
            explicacionAlternativa: "Confirma que la persona existe y ocupa u ocupó el cargo. No dice nada sobre la conducta denunciada.",
          }),
        );
      }
      for (const interes of x.intereses) {
        const empresa = ext.empresas.find(
          (e) =>
            (e.rfc && interes.rfc && e.rfc.toUpperCase() === interes.rfc.toUpperCase()) ||
            similitud(claveEmpresa(interes.empresa), claveEmpresa(e.razonSocial)) >= P.similitud_empresa_minima,
        );
        if (!empresa) continue;
        idsInteres.push(
          anotar({
            categoria: "interes_declarado_en_empresa",
            tipo: mismoEnte ? "hecho" : "posible_alerta",
            sujeto: `${etiqueta} / ${empresa.razonSocial}`,
            confiabilidad: mismoEnte ? "B" : "C",
            descripcion: `En su declaración de intereses, ${nombreCompleto(x.persona)} reporta un vínculo con ${interes.empresa}.`,
            detalle: `Tipo de vínculo: ${etiquetaInteres(interes.tipo)}${interes.detalle ? ` (${interes.detalle})` : ""}.`,
            fuente: fuente("S1", rS1.modo, { proveedor: x.proveedor, referencia: x.id }),
            explicacionAlternativa:
              "Declarar el interés es lo que la ley exige. Lo relevante es si la persona se excusó de intervenir en asuntos de esa empresa.",
          }),
        );
      }
    }
    hipotesisDe(
      `${etiqueta} ocupa u ocupó un cargo en el ente señalado.`,
      "Buscar su declaración patrimonial en el S1 y comparar institución y cargo.",
      [...idsCargo, ...idsS2.filter((id) => indicios.find((i) => i.id === id)?.tipo === "hecho")],
      rS1.estado !== "no_accesible" || rS2.estado !== "no_accesible",
    );
    if (ext.empresas.length) {
      hipotesisDe(
        `Existe un vínculo declarado entre ${etiqueta} y alguna empresa señalada.`,
        "Revisar la sección de intereses de sus declaraciones en el S1.",
        idsInteres,
        rS1.estado !== "no_accesible",
      );
    }
  }

  /* ---------- Ente: antecedentes (S3) ---------- */

  const clasificacion = clasificar(d.conductas, d.narracionHechos);
  const faltasEquivalentes = new Set(clasificacion.flatMap((k) => FALTAS_S3_EQUIVALENTES[k.clave] ?? []));

  for (const ente of entesDenunciados) {
    const r = await fuentes.sancionesEnte(ente, d.lugar.entidad);
    registrar("S3", `Antecedentes de sanciones en el ente: ${ente}`, r, r.datos.length);
    const ids: string[] = [];
    for (const e of r.datos.slice(0, 1)) {
      const mismas = Object.entries(e.porFalta).filter(([k]) => faltasEquivalentes.has(k));
      const nMismas = mismas.reduce((s, [, v]) => s + v, 0);
      ids.push(
        anotar({
          categoria: "ente_con_antecedentes",
          tipo: nMismas ? "posible_alerta" : "contexto",
          sujeto: e.ente,
          confiabilidad: "B",
          descripcion: nMismas
            ? `El S3 registra ${nMismas} sanción(es) previas en ${e.ente} por conductas del mismo tipo que la denunciada.`
            : `El S3 registra ${e.total} sanción(es) previas en ${e.ente}.`,
          detalle:
            `Total: ${e.total} (${e.graves} graves, ${e.noGraves} no graves)` +
            (e.ultimoAnio ? `, la más reciente de ${e.ultimoAnio}` : "") +
            `. Por tipo de falta: ${Object.entries(e.porFalta).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} (${v})`).join(", ")}.`,
          fuente: fuente("S3", r.modo, { proveedor: e.proveedor }),
          explicacionAlternativa: "Describe al ente, no a la persona señalada. Un ente con más sanciones puede ser simplemente uno que investiga más.",
        }),
      );
    }
    hipotesisDe(
      `El ente ${ente} registra sanciones previas.`,
      "Agrupar las sanciones del S3 por ente público y tipo de falta.",
      ids,
      r.estado !== "no_accesible",
    );
  }

  return {
    fecha: fechaConsulta,
    entidadesExtraidas: ext,
    hipotesis,
    indicios,
    consultas,
    semaforo: calcularSemaforo(indicios, consultas, c),
    clasificacion,
  };
}

const metodo = (m?: string) =>
  ({ open: "licitación pública", selective: "invitación restringida", direct: "adjudicación directa" })[m ?? ""] ?? m ?? "modalidad no especificada";

const etiquetaInteres = (t: string) =>
  ({
    PARTICIPACION: "participación en la empresa",
    REPRESENTACION: "representación",
    CLIENTE: "cliente principal",
    TOMA_DECISIONES: "participación en la toma de decisiones",
  })[t] ?? t;

/** Banderas de competencia limitada (inspiradas en la guía de Open Contracting Partnership). */
function banderas(
  contratos: ContratoS6[],
  sujeto: string,
  confiabilidad: Confiabilidad,
  P: ReturnType<typeof criterioVigente>["criterio"]["parametros"],
  anotar: (i: Omit<Indicio, "id">) => string,
  fuente: (extra: Partial<Fuente>) => Fuente,
): string[] {
  const ids: string[] = [];
  if (!contratos.length) return ids;
  const ref = (k: ContratoS6) => ({ referencia: k.ocid, url: k.url ?? URL_PDN.S6 });

  const directas = contratos.filter((k) => k.metodo === "direct");
  if (
    contratos.length >= P.adjudicacion_directa_minimo_contratos &&
    directas.length / contratos.length >= P.adjudicacion_directa_proporcion
  ) {
    ids.push(
      anotar({
        categoria: "bandera_adjudicacion_directa",
        tipo: "posible_alerta",
        sujeto,
        confiabilidad,
        descripcion: `${directas.length} de ${contratos.length} contrataciones revisadas de ${sujeto} fueron por adjudicación directa.`,
        detalle: `Fundamentos citados: ${[...new Set(directas.map((k) => k.justificacion).filter(Boolean))].slice(0, 3).join("; ") || "no especificados"}.`,
        fuente: fuente(ref(directas[0])),
        explicacionAlternativa: "La adjudicación directa es legal en los supuestos de excepción. En el S6, cerca del 83 % de los procedimientos lo son.",
      }),
    );
  }

  const unicos = contratos.filter((k) => k.metodo !== "direct" && k.numOferentes === 1);
  if (unicos.length) {
    ids.push(
      anotar({
        categoria: "bandera_oferente_unico",
        tipo: "posible_alerta",
        sujeto,
        confiabilidad,
        descripcion: `${unicos.length} procedimiento(s) competitivo(s) ganados por ${sujeto} tuvieron un solo oferente.`,
        detalle: unicos.slice(0, 5).map((k) => `${k.ocid} (${k.comprador ?? "comprador s/d"})`).join("; "),
        fuente: fuente(ref(unicos[0])),
        explicacionAlternativa: "En mercados con pocos proveedores es normal recibir una sola oferta.",
      }),
    );
  }

  const cortos = contratos.filter(
    (k) => k.metodo === "open" && k.diasParaOfertar !== undefined && k.diasParaOfertar < P.plazo_corto_dias,
  );
  if (cortos.length) {
    ids.push(
      anotar({
        categoria: "bandera_plazo_corto",
        tipo: "posible_alerta",
        sujeto,
        confiabilidad,
        descripcion: `${cortos.length} licitación(es) pública(s) ganadas por ${sujeto} dieron menos de ${P.plazo_corto_dias} días para presentar ofertas.`,
        detalle: cortos.slice(0, 5).map((k) => `${k.ocid} (${k.diasParaOfertar} días)`).join("; "),
        fuente: fuente(ref(cortos[0])),
        explicacionAlternativa: "La ley permite reducir plazos por causas justificadas. Revisar la justificación en la convocatoria.",
      }),
    );
  }

  const porComprador = new Map<string, number>();
  let total = 0;
  for (const k of contratos) {
    const m = k.montoAdjudicado ?? 0;
    total += m;
    porComprador.set(k.comprador ?? "s/d", (porComprador.get(k.comprador ?? "s/d") ?? 0) + m);
  }
  const [mayor, monto] = [...porComprador.entries()].sort((a, b) => b[1] - a[1])[0];
  if (contratos.length >= 3 && porComprador.size >= 2 && total > 0 && monto / total >= P.concentracion_comprador_proporcion) {
    ids.push(
      anotar({
        categoria: "bandera_concentracion_comprador",
        tipo: "posible_alerta",
        sujeto,
        confiabilidad,
        descripcion: `${Math.round((monto / total) * 100)} % del monto adjudicado a ${sujeto} proviene de un solo comprador: ${mayor}.`,
        detalle: `Monto con ese comprador: ${pesos(monto)} de ${pesos(total)} en ${contratos.length} contrataciones.`,
        fuente: fuente(ref(contratos[0])),
        explicacionAlternativa: "Algunos proveedores se especializan en un solo ente o sector.",
      }),
    );
  }
  return ids;
}
