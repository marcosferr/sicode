/**
 * Conversión de los registros crudos de la PDN a los tipos mínimos del motor.
 * Se usa tanto al ingerir las descargas masivas como al leer las API.
 *
 * Minimización: aquí se descartan CURP, RFC de personas físicas, domicilios, correos y
 * teléfonos que vienen en las fuentes. El motor no los necesita.
 */
import type {
  ContratoS6,
  DeclaracionS1,
  Falta,
  InteresDeclarado,
  Sancion,
  SancionParticular,
  SancionServidor,
  ServidorContrataciones,
} from "./tipos";

type Crudo = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const txt = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s && s !== "--" ? s : undefined;
};

function faltas(c: Crudo): Falta[] {
  return (Array.isArray(c.faltaCometida) ? c.faltaCometida : []).map((f: Crudo) => ({
    clave: txt(f.clave) ?? "OTRO",
    valor: txt(f.valor),
    descripcion: txt(f.descripcionHechos),
  }));
}

function sanciones(c: Crudo): Sancion[] {
  return (Array.isArray(c.tipoSancion) ? c.tipoSancion : []).map((s: Crudo) => ({
    clave: txt(s.clave) ?? "OTRO",
    inhabilitacionHasta: txt(s.inhabilitacion?.fechaFinal ?? s.inhabilitado?.fechaFinal),
  }));
}

export function aSancionServidor(c: Crudo, proveedor: string): SancionServidor | null {
  const g = c.datosGenerales ?? {};
  if (!txt(g.primerApellido) && !txt(g.nombres)) return null; // las no graves no publican nombre
  const e = c.empleoCargoComision ?? {};
  return {
    id: txt(c.id) ?? txt(c.expediente) ?? "",
    proveedor,
    expediente: txt(c.expediente),
    fecha: txt(c.fecha),
    persona: {
      nombres: txt(g.nombres),
      primerApellido: txt(g.primerApellido),
      segundoApellido: txt(g.segundoApellido),
    },
    ente: txt(e.nombreEntePublico),
    entidadFederativa: txt(e.entidadFederativa),
    cargo: txt(e.denominacion),
    faltas: faltas(c),
    sanciones: sanciones(c),
    urlResolucion: txt(c.resolucion?.urlResolucionFirme) ?? txt(c.resolucion?.urlResolucion),
  };
}

export function aSancionParticular(
  c: Crudo,
  proveedor: string,
  tipo: "MORAL" | "FISICA",
): SancionParticular {
  const g = c.datosGenerales ?? {};
  return {
    id: txt(c.id) ?? txt(c.expediente) ?? "",
    proveedor,
    expediente: txt(c.expediente),
    fecha: txt(c.fecha),
    tipo,
    razonSocial: tipo === "MORAL" ? txt(g.nombreRazonSocial) : undefined,
    // El RFC de una persona moral es un identificador empresarial público; el de una física no se conserva.
    rfc: tipo === "MORAL" ? txt(g.rfc) : undefined,
    persona:
      tipo === "FISICA"
        ? {
            nombres: txt(g.nombres),
            primerApellido: txt(g.primerApellido),
            segundoApellido: txt(g.segundoApellido),
          }
        : undefined,
    ente: txt(c.dondeCometioLaFalta?.nombreEntePublico),
    faltas: faltas(c),
    sanciones: sanciones(c),
    urlResolucion: txt(c.resolucion?.urlResolucionFirme) ?? txt(c.resolucion?.urlResolucion),
  };
}

const valores = (lista: unknown): string[] =>
  (Array.isArray(lista) ? lista : [])
    .map((x) => (typeof x === "string" ? x : txt((x as Crudo)?.valor)))
    .filter((x): x is string => Boolean(x))
    .map((x) => x.toUpperCase());

/** El S2 llega en dos formatos: el estándar (camelCase) y el de la carga federal (snake_case). */
export function aServidorContrataciones(c: Crudo, proveedor: string): ServidorContrataciones | null {
  const estandar = "primerApellido" in c || "institucionDependencia" in c;
  const persona = estandar
    ? { nombres: txt(c.nombres), primerApellido: txt(c.primerApellido), segundoApellido: txt(c.segundoApellido) }
    : { nombres: txt(c.nombres), primerApellido: txt(c.primer_apellido), segundoApellido: txt(c.segundo_apellido) };
  if (!persona.primerApellido && !persona.nombres) return null;
  if (estandar) {
    return {
      proveedor,
      persona,
      institucion: txt(c.institucionDependencia?.nombre),
      puesto: txt(c.puesto?.nombre),
      nivelesResponsabilidad: valores(c.nivelResponsabilidad),
      tiposProcedimiento: valores(c.tipoProcedimiento),
      ejercicio: txt(c.ejercicioFiscal),
    };
  }
  const lista = (v: unknown) =>
    Array.isArray(v) ? valores(v) : txt(v) ? [String(v).toUpperCase()] : [];
  return {
    proveedor,
    persona,
    institucion: txt(c.dependencia?.nombre ?? c.dependencia),
    puesto: txt(c.puesto?.nombre ?? c.puesto),
    nivelesResponsabilidad: lista(c.nivel_responsabilidad),
    tiposProcedimiento: lista(c.tipo_procedimiento),
    ejercicio: txt(c.ejercicio_fiscal),
  };
}

function dias(a?: string, b?: string): number | undefined {
  if (!a || !b) return undefined;
  const d = (Date.parse(b) - Date.parse(a)) / 86_400_000;
  return Number.isFinite(d) && d >= 0 ? Math.round(d) : undefined;
}

export function aContratoS6(c: Crudo): ContratoS6 {
  const t = c.tender ?? {};
  const adjudicaciones: Crudo[] = Array.isArray(c.awards) ? c.awards : [];
  const proveedores = new Map<string, { id?: string; nombre: string }>();
  let monto = 0;
  let moneda: string | undefined;
  let fecha: string | undefined;
  let url: string | undefined;
  for (const a of adjudicaciones) {
    for (const s of Array.isArray(a.suppliers) ? a.suppliers : []) {
      const nombre = txt(s.name);
      if (nombre) proveedores.set(txt(s.id) ?? nombre, { id: txt(s.id), nombre });
    }
    const v = Number(a.value?.amount);
    if (Number.isFinite(v)) monto += v;
    moneda = moneda ?? txt(a.value?.currency);
    url = url ?? txt(a.documents?.[0]?.url);
  }
  for (const k of Array.isArray(c.contracts) ? c.contracts : []) fecha = fecha ?? txt(k.dateSigned);
  const oferentes = (Array.isArray(t.tenderers) ? t.tenderers : [])
    .map((x: Crudo) => ({ id: txt(x.id), nombre: txt(x.name) ?? "" }))
    .filter((x: { nombre: string }) => x.nombre);
  return {
    ocid: txt(c.ocid) ?? "",
    ciclo: Number(c.cycle) || Number(String(txt(c.date) ?? "").slice(0, 4)) || undefined,
    comprador: txt(c.buyer?.name),
    titulo: txt(t.title) ?? txt(adjudicaciones[0]?.title),
    metodo: txt(t.procurementMethod),
    justificacion: txt(t.procurementMethodRationale),
    numOferentes: Number.isFinite(Number(t.numberOfTenderers)) ? Number(t.numberOfTenderers) : undefined,
    oferentes,
    proveedores: [...proveedores.values()],
    montoAdjudicado: monto || undefined,
    moneda,
    fechaAdjudicacion: fecha ?? txt(t.awardPeriod?.endDate) ?? txt(c.date),
    diasParaOfertar: dias(txt(t.tenderPeriod?.startDate), txt(t.tenderPeriod?.endDate)),
    url: url ?? txt(t.documents?.[0]?.url),
  };
}

export function aDeclaracionS1(c: Crudo, proveedor: string): DeclaracionS1 {
  const d = c.declaracion ?? {};
  const g = d.situacionPatrimonial?.datosGenerales ?? {};
  const e = d.situacionPatrimonial?.datosEmpleoCargoComision ?? {};
  const i = d.interes ?? {};
  const intereses: InteresDeclarado[] = [];
  const agrega = (tipo: InteresDeclarado["tipo"], empresa: unknown, rfc: unknown, detalle?: unknown) => {
    const n = txt(empresa);
    if (n) intereses.push({ tipo, empresa: n, rfc: txt(rfc), detalle: txt(detalle) });
  };
  for (const p of i.participacion?.participacion ?? [])
    agrega("PARTICIPACION", p.nombreEmpresaSociedadAsociacion, p.rfc, p.tipoParticipacion?.valor);
  for (const p of i.participacionTomaDecisiones?.participacion ?? [])
    agrega("TOMA_DECISIONES", p.nombreInstitucion, p.rfc, p.puestoRol);
  for (const p of i.representacion?.representacion ?? [])
    agrega("REPRESENTACION", p.nombreRazonSocial, p.rfc, p.tipoRepresentacion);
  for (const p of i.clientesPrincipales?.cliente ?? [])
    agrega("CLIENTE", p.clientePrincipal?.nombreRazonSocial ?? p.empresa?.nombreEmpresaServicio, p.clientePrincipal?.rfc ?? p.empresa?.rfc);
  return {
    id: txt(c.id) ?? "",
    proveedor,
    persona: {
      // Algunos proveedores anteponen una clave al nombre ("01FGR0026U NORMA ELIZABETH").
      nombres: txt(g.nombre)?.replace(/^\d\w+\s+/, ""),
      primerApellido: txt(g.primerApellido),
      segundoApellido: txt(g.segundoApellido),
    },
    institucion: txt(e.nombreEntePublico) ?? txt(c.metadata?.institucion),
    cargo: txt(e.empleoCargoComision),
    tipo: txt(c.metadata?.tipo),
    actualizacion: txt(c.metadata?.actualizacion),
    intereses,
  };
}
