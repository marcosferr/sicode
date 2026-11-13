/**
 * Operaciones del sistema. Todo lo que toca una denuncia pasa por aquí, para que las
 * reglas de confidencialidad estén en un solo lugar:
 *
 * - No se lee ni se guarda la IP ni el navegador de quien denuncia.
 * - La vista de operador nunca incluye el contacto ni la derivación de la clave.
 * - Abrir el contacto exige un motivo y queda en la bitácora de la denuncia.
 * - La vista pública de seguimiento solo muestra días, no horas.
 */
import { almacen } from "./almacen";
import { informeSinValores, limpiarArchivo, TIPOS_ACEPTADOS } from "./blindaje/metadatos";
import type { EntradaDenuncia } from "./esquema";
import { LIMITE_ARCHIVO } from "./esquema";
import { corroborar } from "./motor/corroborar";
import { FuentesReales } from "./pdn/fuentes";
import type { FuentesPDN } from "./pdn/tipos";
import {
  cifrarContacto,
  derivarClave,
  descifrarContacto,
  idAleatorio,
  normalizarFolio,
  nuevaClave,
  nuevoFolio,
  RE_FOLIO,
  sha256,
  soloDia,
  verificarClave,
  type Contacto,
} from "./seguridad";
import { ESTADOS, type Denuncia, type EstadoDenuncia, type Evidencia, type Mensaje } from "./tipos";

export class ErrorServicio extends Error {
  constructor(
    mensaje: string,
    public estado = 400,
  ) {
    super(mensaje);
  }
}

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

/* ---------- Lado ciudadano ---------- */

export async function recibirEvidencia(bytes: Uint8Array, nombre: string): Promise<Evidencia> {
  if (bytes.length > LIMITE_ARCHIVO) throw new ErrorServicio("El archivo pasa de 15 MB.", 413);
  // Segunda barrera: aunque el navegador ya limpió, el servidor vuelve a limpiar.
  const { bytes: limpio, informe } = await limpiarArchivo(bytes, nombre);
  if (!TIPOS_ACEPTADOS.includes(informe.tipo)) {
    throw new ErrorServicio("Solo se aceptan fotos JPG o PNG, PDF y documentos de Word, Excel o PowerPoint.", 415);
  }
  if (!informe.limpiado) throw new ErrorServicio("No se pudo limpiar el archivo, así que no se guardó.", 422);
  const id = idAleatorio();
  // El nombre original puede identificar ("Escaneo_Juan_Perez.pdf"): se guarda uno neutro.
  const extension = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }[informe.tipo] ?? nombre.split(".").pop() ?? "bin";
  const nombreNeutro = `evidencia-${id.slice(0, 6)}.${extension}`;
  await almacen().guardarArchivo(id, { bytes: limpio, tipo: informe.tipo, nombre: nombreNeutro });
  return { id, nombre: nombreNeutro, tipo: informe.tipo, tamano: limpio.length, sha256: sha256(limpio), limpieza: informeSinValores(informe) };
}

export async function presentarDenuncia(e: EntradaDenuncia): Promise<{ folio: string; clave: string }> {
  const evidencias: Evidencia[] = [];
  for (const { id, informe } of e.evidencias) {
    const a = await almacen().leerArchivo(id);
    if (!a) throw new ErrorServicio("Una de las evidencias no se encontró. Vuelve a subirla.");
    evidencias.push({
      id,
      nombre: a.nombre,
      tipo: a.tipo,
      tamano: a.bytes.length,
      sha256: sha256(a.bytes),
      // Informe del navegador, sin valores: dice qué clase de dato se quitó, no cuál era.
      limpieza: informeSinValores({ ...informe, tipo: a.tipo, advertencias: [], bytesDespues: a.bytes.length }),
    });
  }
  let folio = nuevoFolio();
  while (await almacen().porFolio(folio)) folio = nuevoFolio();
  const clave = nuevaClave();
  const hoy = soloDia();
  const limpio = (s?: string) => s?.trim() || undefined;
  const d: Denuncia = {
    id: idAleatorio(),
    folio,
    status: "SIN_TURNAR",
    fechaRecepcion: hoy,
    fechaActualizacion: hoy,
    anonimo: e.anonimo,
    contactoCifrado: !e.anonimo && e.contacto ? cifrarContacto(e.contacto as Contacto) : undefined,
    narracionHechos: e.narracionHechos,
    conductas: e.conductas,
    fechaHecho: limpio(e.fechaHecho),
    lugar: { entidad: e.lugar.entidad, municipio: limpio(e.lugar.municipio), institucion: limpio(e.lugar.institucion) },
    involucrados: e.involucrados
      .map((i) => ({
        tipo: i.tipo,
        nombre: limpio(i.nombre),
        cargo: limpio(i.cargo),
        institucion: limpio(i.institucion),
        razonSocial: limpio(i.razonSocial),
        rfc: limpio(i.rfc)?.toUpperCase(),
      }))
      .filter((i) => i.nombre || i.razonSocial),
    referenciaContratacion: limpio(e.referenciaContratacion),
    evidencias,
    secretoHash: derivarClave(clave),
    intentosFallidos: 0,
    mensajes: [],
    bitacora: [{ fecha: hoy, actor: "sistema", accion: "Denuncia recibida" }],
  };
  await almacen().crear(d);
  return { folio, clave };
}

async function autenticar(folio: string, clave: string): Promise<Denuncia> {
  const f = normalizarFolio(folio);
  const generico = new ErrorServicio("El folio o la clave no coinciden.", 401);
  if (!RE_FOLIO.test(f)) throw generico;
  const d = await almacen().porFolio(f);
  if (!d) {
    // Mismo costo que una verificación real, para no delatar qué folios existen.
    verificarClave(clave, "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    throw generico;
  }
  if (d.bloqueadoHasta && d.bloqueadoHasta > new Date().toISOString()) {
    throw new ErrorServicio(`Demasiados intentos. Vuelve a intentarlo en ${BLOQUEO_MIN} minutos.`, 429);
  }
  if (!verificarClave(clave, d.secretoHash)) {
    d.intentosFallidos++;
    if (d.intentosFallidos >= MAX_INTENTOS) {
      d.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MIN * 60_000).toISOString();
      d.intentosFallidos = 0;
    }
    await almacen().guardar(d);
    throw generico;
  }
  if (d.intentosFallidos || d.bloqueadoHasta) {
    d.intentosFallidos = 0;
    d.bloqueadoHasta = undefined;
    await almacen().guardar(d);
  }
  return d;
}

export interface VistaSeguimiento {
  folio: string;
  status: EstadoDenuncia;
  etiqueta: string;
  descripcion: string;
  fechaRecepcion: string;
  fechaActualizacion: string;
  institucionActual?: string;
  resumenPublicoCierre?: string;
  mensajes: Mensaje[];
  evidencias: number;
}

const vistaSeguimiento = (d: Denuncia): VistaSeguimiento => ({
  folio: d.folio,
  status: d.status,
  etiqueta: ESTADOS[d.status].etiqueta,
  descripcion: ESTADOS[d.status].descripcion,
  fechaRecepcion: d.fechaRecepcion,
  fechaActualizacion: d.fechaActualizacion,
  institucionActual: d.institucionActual,
  resumenPublicoCierre: d.resumenPublicoCierre,
  mensajes: d.mensajes,
  evidencias: d.evidencias.length,
});

export async function consultarSeguimiento(folio: string, clave: string): Promise<VistaSeguimiento> {
  return vistaSeguimiento(await autenticar(folio, clave));
}

/** Buzón de ida y vuelta: quien denuncia responde con su folio y su clave, sin correo ni cuenta. */
export async function responderComoDenunciante(folio: string, clave: string, texto: string): Promise<VistaSeguimiento> {
  const d = await autenticar(folio, clave);
  const limpio = texto.trim();
  if (limpio.length < 2 || limpio.length > 4000) throw new ErrorServicio("El mensaje debe tener entre 2 y 4,000 caracteres.");
  const hoy = soloDia();
  d.mensajes.push({ id: idAleatorio(), autor: "DENUNCIANTE", texto: limpio, fecha: hoy });
  d.fechaActualizacion = hoy;
  d.bitacora.push({ fecha: hoy, actor: "denunciante", accion: "Respondió por el buzón anónimo" });
  await almacen().guardar(d);
  return vistaSeguimiento(d);
}

/* ---------- Lado operador ---------- */

export type VistaOperador = Omit<Denuncia, "secretoHash" | "contactoCifrado" | "intentosFallidos" | "bloqueadoHasta"> & {
  tieneContacto: boolean;
};

export function vistaOperador(d: Denuncia): VistaOperador {
  // Se listan las propiedades que NO salen, para que un campo nuevo no se filtre por descuido.
  const { secretoHash: _s, contactoCifrado, intentosFallidos: _i, bloqueadoHasta: _b, ...resto } = d;
  void _s; void _i; void _b;
  return { ...resto, tieneContacto: Boolean(contactoCifrado) };
}

export async function listarParaOperador(): Promise<VistaOperador[]> {
  const orden = { rojo: 0, amarillo: 1, verde: 2 } as const;
  return (await almacen().listar())
    .map(vistaOperador)
    .sort(
      (a, b) =>
        (orden[a.corroboracion?.semaforo.color ?? "verde"] ?? 3) - (orden[b.corroboracion?.semaforo.color ?? "verde"] ?? 3) ||
        b.fechaRecepcion.localeCompare(a.fechaRecepcion),
    );
}

async function cargar(id: string): Promise<Denuncia> {
  const d = await almacen().porId(id);
  if (!d) throw new ErrorServicio("No se encontró la denuncia.", 404);
  return d;
}

export async function detalleParaOperador(id: string): Promise<VistaOperador> {
  return vistaOperador(await cargar(id));
}

async function registrar(d: Denuncia, actor: string, accion: string, detalle?: string) {
  const hoy = soloDia();
  d.fechaActualizacion = hoy;
  d.bitacora.push({ fecha: hoy, actor, accion, detalle });
  await almacen().guardar(d);
}

export async function corroborarDenuncia(id: string, actor: string, fuentes: FuentesPDN = new FuentesReales()) {
  const d = await cargar(id);
  d.corroboracion = await corroborar(d, fuentes);
  d.prioridad ??= ({ rojo: "ALTA", amarillo: "MEDIA", verde: "BAJA" } as const)[d.corroboracion.semaforo.color];
  await registrar(
    d,
    actor,
    "Corroboración con datos de la PDN",
    `Semáforo ${d.corroboracion.semaforo.color}, ${d.corroboracion.indicios.length} indicio(s). Criterio ${d.corroboracion.semaforo.criterio.version}.`,
  );
  return vistaOperador(d);
}

export async function actualizarTramite(
  id: string,
  actor: string,
  cambio: { status?: EstadoDenuncia; institucionActual?: string; prioridad?: Denuncia["prioridad"]; resumenPublicoCierre?: string },
) {
  const d = await cargar(id);
  const partes: string[] = [];
  if (cambio.status && cambio.status !== d.status) {
    if ((cambio.status === "ATENDIDA" || cambio.status === "IMPROCEDENTE") && !(cambio.resumenPublicoCierre ?? d.resumenPublicoCierre)?.trim()) {
      throw new ErrorServicio("Para cerrar una denuncia hay que escribir el resumen público del resultado.");
    }
    partes.push(`Estado: ${ESTADOS[d.status].etiqueta} → ${ESTADOS[cambio.status].etiqueta}`);
    d.status = cambio.status;
  }
  if (cambio.institucionActual !== undefined && cambio.institucionActual.trim() !== (d.institucionActual ?? "")) {
    d.institucionActual = cambio.institucionActual.trim() || undefined;
    partes.push(`Autoridad: ${d.institucionActual ?? "sin asignar"}`);
    if (d.status === "SIN_TURNAR" && d.institucionActual) {
      d.status = "TURNADA";
      partes.push("Estado: Sin turnar → Turnada");
    }
  }
  if (cambio.prioridad && cambio.prioridad !== d.prioridad) {
    d.prioridad = cambio.prioridad;
    partes.push(`Prioridad: ${cambio.prioridad}`);
  }
  if (cambio.resumenPublicoCierre !== undefined) d.resumenPublicoCierre = cambio.resumenPublicoCierre.trim() || undefined;
  if (!partes.length && cambio.resumenPublicoCierre === undefined) return vistaOperador(d);
  await registrar(d, actor, "Actualización del trámite", partes.join(". ") || "Resumen público actualizado");
  return vistaOperador(d);
}

export async function escribirADenunciante(id: string, actor: string, texto: string) {
  const d = await cargar(id);
  const limpio = texto.trim();
  if (limpio.length < 2 || limpio.length > 4000) throw new ErrorServicio("El mensaje debe tener entre 2 y 4,000 caracteres.");
  d.mensajes.push({ id: idAleatorio(), autor: "AUTORIDAD", texto: limpio, fecha: soloDia() });
  await registrar(d, actor, "Mensaje a quien denunció por el buzón anónimo");
  return vistaOperador(d);
}

/** Abre los datos de contacto. Exige un motivo y deja rastro: es la única vía para verlos. */
export async function revelarContacto(id: string, actor: string, motivo: string): Promise<Contacto> {
  const d = await cargar(id);
  if (!d.contactoCifrado) throw new ErrorServicio("Esta denuncia es anónima: no hay datos de contacto.", 404);
  if (motivo.trim().length < 20) throw new ErrorServicio("Escribe el motivo (al menos 20 caracteres). Quedará en la bitácora.");
  const contacto = descifrarContacto(d.contactoCifrado);
  await registrar(d, actor, "Abrió los datos de contacto de quien denunció", `Motivo: ${motivo.trim()}`);
  return contacto;
}

export async function leerEvidencia(idDenuncia: string, idArchivo: string) {
  const d = await cargar(idDenuncia);
  if (!d.evidencias.some((e) => e.id === idArchivo)) throw new ErrorServicio("La evidencia no pertenece a esta denuncia.", 404);
  const a = await almacen().leerArchivo(idArchivo);
  if (!a) throw new ErrorServicio("No se encontró el archivo.", 404);
  return a;
}
