/**
 * Extrae de una denuncia lo que se puede cruzar con datos públicos.
 *
 * Sin modelos de lenguaje ni servicios externos: el texto de una denuncia no sale del
 * servidor. Las personas solo se toman de los campos estructurados; del relato libre se
 * extraen únicamente patrones inequívocos (RFC de empresas, razones sociales con forma
 * jurídica, montos y referencias de contratación).
 */
import type { Corroboracion, Denuncia } from "../tipos";
import { claveEmpresa, esRfcPlausible, normalizar, RE_RFC_MORAL } from "../texto";

const RE_EMPRESA =
  /((?:[A-ZÁÉÍÓÚÑ0-9&][\wÁÉÍÓÚÑáéíóúñ&.\-]*,?\s+){1,7}?)(S\.?\s?A\.?\s?P\.?\s?I\.?\s+de\s+C\.?\s?V\.?|S\.?\s?A\.?\s?B\.?\s+de\s+C\.?\s?V\.?|S\.?\s?A\.?\s+de\s+C\.?\s?V\.?|S\.?\s+de\s+R\.?\s?L\.?(?:\s+de\s+C\.?\s?V\.?)?|S\.?\s?A\.?\s?S\.?(?:\s+de\s+C\.?\s?V\.?)?)(?=[\s.,;:)]|$)/gi;

const RE_MONTO =
  /\$\s?\d[\d.,]*(?:\s?(?:mil(?:lones)?|mdp|MXN))?|\b\d[\d.,]*\s?(?:mil(?:lones)?\s+de\s+)?pesos\b/gi;

const RE_CONTRATO =
  /\b(?:contrato|licitaci[oó]n|adjudicaci[oó]n|pedido|procedimiento)\s+(?:p[uú]blic[ao]\s+)?(?:n[uú]m(?:ero)?\.?|no\.?|#)?\s*([A-Z0-9][A-Z0-9\-\/]{5,})/gi;

const RE_OCID = /\bocds-[a-z0-9]+-\d+\b/gi;

const unicos = (lista: string[]) => [...new Set(lista.map((x) => x.trim()).filter(Boolean))];

/** Quita del inicio palabras que no forman parte de la razón social ("la empresa", "a"). */
function limpiarRazonSocial(candidata: string): string {
  const palabras = candidata.trim().split(/\s+/);
  const inicio = palabras.findIndex((p) => /^[A-ZÁÉÍÓÚÑ0-9&]/.test(p) && !/^(La|El|Los|Las|A|De|Con|Empresa|Proveedor|Compañía|Sociedad)$/.test(p));
  return palabras.slice(Math.max(inicio, 0)).join(" ");
}

export function extraer(d: Pick<Denuncia, "narracionHechos" | "involucrados" | "lugar" | "referenciaContratacion">): Corroboracion["entidadesExtraidas"] {
  const texto = `${d.narracionHechos}\n${d.referenciaContratacion ?? ""}`;

  const personas = d.involucrados
    .filter((i) => i.tipo !== "EMPRESA" && i.nombre?.trim())
    .map((i) => ({ nombre: i.nombre!.trim(), cargo: i.cargo?.trim() || undefined, institucion: i.institucion?.trim() || undefined }));

  const empresas = new Map<string, { razonSocial: string; rfc?: string }>();
  const agregarEmpresa = (razonSocial: string, rfc?: string) => {
    const clave = claveEmpresa(razonSocial);
    if (clave.length < 3) return;
    const previa = empresas.get(clave);
    if (previa) previa.rfc ??= rfc;
    else empresas.set(clave, { razonSocial: razonSocial.trim(), rfc });
  };
  for (const i of d.involucrados) {
    if (i.tipo === "EMPRESA" && i.razonSocial?.trim()) {
      agregarEmpresa(i.razonSocial, i.rfc?.toUpperCase().trim() || undefined);
    }
  }
  for (const m of texto.matchAll(RE_EMPRESA)) {
    agregarEmpresa(`${limpiarRazonSocial(m[1])} ${m[2]}`);
  }

  const rfcs = unicos([...(texto.toUpperCase().match(RE_RFC_MORAL) ?? [])].filter(esRfcPlausible));

  const entes = unicos(
    [d.lugar.institucion, ...d.involucrados.map((i) => i.institucion)].filter((x): x is string => Boolean(x)),
  ).filter((e, i, lista) => lista.findIndex((x) => normalizar(x) === normalizar(e)) === i);

  return {
    personas,
    empresas: [...empresas.values()],
    entes,
    rfcs,
    montos: unicos(texto.match(RE_MONTO) ?? []),
    contratos: unicos([
      ...[...texto.matchAll(RE_CONTRATO)].map((m) => m[1]).filter((x) => /\d/.test(x)),
      ...(texto.match(RE_OCID) ?? []),
    ]),
  };
}
