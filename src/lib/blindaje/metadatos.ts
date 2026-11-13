/**
 * Limpieza de metadatos de evidencias.
 *
 * Corre en el navegador de quien denuncia, antes de subir nada: el archivo original nunca
 * sale del dispositivo. El servidor vuelve a pasar la misma función como segunda barrera.
 *
 * Qué limpia:
 * - JPEG: EXIF (GPS, cámara, fechas, número de serie), XMP, IPTC y comentarios.
 * - PNG: textos incrustados, EXIF y fecha de modificación.
 * - PDF: título, autor, programa, fechas y XMP.
 * - Word, Excel y PowerPoint (.docx, .xlsx, .pptx): autor, última persona que modificó,
 *   empresa, y autores de comentarios y cambios con seguimiento.
 *
 * Qué no puede hacer: borrar lo que se ve en el contenido (una cara, un nombre en una
 * captura, un membrete). Eso se avisa como advertencia.
 */
import type { InformeLimpieza } from "../tipos";

export interface ResultadoLimpieza {
  bytes: Uint8Array;
  informe: InformeLimpieza;
}

const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
const empieza = (b: Uint8Array, firma: number[], desde = 0) => firma.every((v, i) => b[desde + i] === v);

export function detectarTipo(b: Uint8Array, nombre = ""): string {
  if (empieza(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empieza(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (empieza(b, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = nombre.toLowerCase().split(".").pop();
    if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return "application/zip";
  }
  if (ascii(b, 4, 4) === "ftyp") {
    const marca = ascii(b, 8, 4);
    return /hei[cfx]|mif1|msf1/.test(marca) ? "image/heic" : "video/mp4";
  }
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(b, 0, 4) === "OggS") return "audio/ogg";
  return "application/octet-stream";
}

export const TIPOS_ACEPTADOS = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/* ---------- JPEG ---------- */

/** EXIF mínimo que conserva solo la orientación, para que la foto no quede girada. */
function exifSoloOrientacion(orientacion: number): Uint8Array {
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big endian, IFD0 en el byte 8
    0x00, 0x01, // una entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientacion & 0xff, 0x00, 0x00, // Orientation (SHORT)
    0x00, 0x00, 0x00, 0x00, // sin siguiente IFD
  ];
  const cuerpo = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"
  const largo = cuerpo.length + 2;
  return new Uint8Array([0xff, 0xe1, largo >> 8, largo & 0xff, ...cuerpo]);
}

function leerOrientacion(exif: Uint8Array): number {
  // exif empieza en "Exif\0\0"; el TIFF arranca en el byte 6.
  try {
    const v = new DataView(exif.buffer, exif.byteOffset + 6, exif.byteLength - 6);
    const le = v.getUint16(0) === 0x4949;
    const ifd = v.getUint32(4, le);
    const n = v.getUint16(ifd, le);
    for (let i = 0; i < n; i++) {
      const p = ifd + 2 + i * 12;
      if (v.getUint16(p, le) === 0x0112) return v.getUint16(p + 8, le);
    }
  } catch {
    /* EXIF dañado: se trata como sin orientación */
  }
  return 1;
}

function limpiarJpeg(b: Uint8Array): { bytes: Uint8Array; quitados: string[] } {
  const partes: Uint8Array[] = [b.subarray(0, 2)];
  const quitados = new Set<string>();
  let orientacion = 1;
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marca = b[i + 1];
    if (marca === 0xda) break; // inicio de los datos de imagen
    const largo = (b[i + 2] << 8) | b[i + 3];
    const segmento = b.subarray(i, i + 2 + largo);
    const cuerpo = segmento.subarray(4);
    let conservar = true;
    if (marca === 0xe1) {
      conservar = false;
      if (ascii(cuerpo, 0, 4) === "Exif") {
        orientacion = leerOrientacion(cuerpo);
        quitados.add("datos EXIF");
      } else quitados.add("datos XMP");
    } else if (marca === 0xed) {
      conservar = false;
      quitados.add("datos IPTC");
    } else if (marca === 0xfe) {
      conservar = false;
      quitados.add("comentarios");
    } else if (marca >= 0xe3 && marca <= 0xef && marca !== 0xee) {
      conservar = false; // segmentos de aplicación propietarios (MakerNotes, miniaturas, etc.)
      quitados.add("datos propietarios del fabricante");
    }
    if (conservar) partes.push(segmento);
    i += 2 + largo;
  }
  if (orientacion > 1 && orientacion <= 8) partes.splice(1, 0, exifSoloOrientacion(orientacion));
  partes.push(b.subarray(i));
  return { bytes: unir(partes), quitados: [...quitados] };
}

/* ---------- PNG ---------- */

function limpiarPng(b: Uint8Array): { bytes: Uint8Array; quitados: string[] } {
  const partes: Uint8Array[] = [b.subarray(0, 8)];
  const quitados = new Set<string>();
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 8;
  while (i + 12 <= b.length) {
    const largo = v.getUint32(i);
    const tipo = ascii(b, i + 4, 4);
    const fin = i + 12 + largo;
    if (["tEXt", "zTXt", "iTXt"].includes(tipo)) quitados.add("textos incrustados");
    else if (tipo === "eXIf") quitados.add("datos EXIF");
    else if (tipo === "tIME") quitados.add("fecha de modificación");
    else partes.push(b.subarray(i, fin));
    i = fin;
    if (tipo === "IEND") break;
  }
  return { bytes: unir(partes), quitados: [...quitados] };
}

function unir(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const salida = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    salida.set(p, o);
    o += p.length;
  }
  return salida;
}

/* ---------- Lectura de lo que revelaba una foto ---------- */

async function hallazgosFoto(b: Uint8Array): Promise<string[]> {
  const hallazgos: string[] = [];
  try {
    const exifr = (await import("exifr")).default;
    const m = (await exifr.parse(b, { gps: true, tiff: true, exif: true, xmp: false, iptc: false })) as
      | Record<string, unknown>
      | undefined;
    if (!m) return hallazgos;
    if (typeof m.latitude === "number" && typeof m.longitude === "number") {
      hallazgos.push(`Ubicación exacta donde se tomó la foto (${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)})`);
    }
    const equipo = [m.Make, m.Model].filter(Boolean).join(" ");
    if (equipo) hallazgos.push(`Marca y modelo del dispositivo (${equipo})`);
    const fecha = m.DateTimeOriginal ?? m.CreateDate ?? m.ModifyDate;
    if (fecha) hallazgos.push(`Fecha y hora de la toma (${fecha instanceof Date ? fecha.toISOString().slice(0, 16).replace("T", " ") : String(fecha)})`);
    for (const [k, etiqueta] of [
      ["BodySerialNumber", "Número de serie del dispositivo"],
      ["SerialNumber", "Número de serie del dispositivo"],
      ["LensSerialNumber", "Número de serie del lente"],
      ["Artist", "Nombre del autor"],
      ["OwnerName", "Nombre del propietario del dispositivo"],
      ["Copyright", "Texto de derechos de autor"],
      ["Software", "Programa o versión del sistema"],
      ["HostComputer", "Nombre del equipo"],
    ] as const) {
      if (m[k]) hallazgos.push(`${etiqueta} (${String(m[k])})`);
    }
  } catch {
    /* sin EXIF legible */
  }
  return hallazgos;
}

/* ---------- PDF ---------- */

async function limpiarPdf(b: Uint8Array): Promise<{ bytes: Uint8Array; hallazgos: string[]; advertencias: string[] }> {
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const doc = await PDFDocument.load(b, { updateMetadata: false, ignoreEncryption: false });
  const hallazgos: string[] = [];
  const dato = (etiqueta: string, v: string | Date | undefined) => {
    if (v) hallazgos.push(`${etiqueta} (${v instanceof Date ? v.toISOString().slice(0, 10) : v})`);
  };
  dato("Autor del documento", doc.getAuthor());
  dato("Título interno", doc.getTitle());
  dato("Programa con el que se creó", doc.getCreator());
  dato("Programa que generó el PDF", doc.getProducer());
  dato("Fecha de creación", doc.getCreationDate());
  dato("Fecha de modificación", doc.getModificationDate());
  dato("Asunto", doc.getSubject());
  dato("Palabras clave", doc.getKeywords());
  if (doc.catalog.has(PDFName.of("Metadata"))) hallazgos.push("Bloque XMP con datos del autor y del programa");

  // Se elimina el diccionario de información completo y el bloque XMP.
  const info = doc.context.trailerInfo.Info;
  if (info) doc.context.delete(info as never);
  doc.context.trailerInfo.Info = undefined;
  doc.catalog.delete(PDFName.of("Metadata"));
  const bytes = await doc.save({ useObjectStreams: true });

  const advertencias: string[] = [];
  if (doc.catalog.has(PDFName.of("AcroForm"))) advertencias.push("El PDF tiene campos de formulario o firmas: revisa que no incluyan tu nombre.");
  return { bytes, hallazgos, advertencias };
}

/* ---------- Office ---------- */

const CORE_VACIO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
  'xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>';
const APP_VACIO =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>';

async function limpiarOffice(b: Uint8Array): Promise<{ bytes: Uint8Array; hallazgos: string[]; advertencias: string[] }> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(b);
  const hallazgos: string[] = [];
  const advertencias: string[] = [];
  const etiqueta = (xml: string, nombre: string) => xml.match(new RegExp(`<${nombre}[^>]*>([^<]+)</${nombre}>`))?.[1];

  const core = await zip.file("docProps/core.xml")?.async("string");
  if (core) {
    const autor = etiqueta(core, "dc:creator");
    const ultimo = etiqueta(core, "cp:lastModifiedBy");
    if (autor) hallazgos.push(`Autor del documento (${autor})`);
    if (ultimo) hallazgos.push(`Última persona que lo modificó (${ultimo})`);
    if (etiqueta(core, "dcterms:created")) hallazgos.push(`Fecha de creación (${etiqueta(core, "dcterms:created")!.slice(0, 10)})`);
    zip.file("docProps/core.xml", CORE_VACIO);
  }
  const app = await zip.file("docProps/app.xml")?.async("string");
  if (app) {
    const empresa = etiqueta(app, "Company");
    const gerente = etiqueta(app, "Manager");
    if (empresa) hallazgos.push(`Organización registrada en el programa (${empresa})`);
    if (gerente) hallazgos.push(`Responsable registrado (${gerente})`);
    zip.file("docProps/app.xml", APP_VACIO);
  }
  if (zip.file("docProps/custom.xml")) {
    hallazgos.push("Propiedades personalizadas del documento");
    zip.remove("docProps/custom.xml");
  }

  // Autores de comentarios y de cambios con seguimiento.
  const autores = new Set<string>();
  for (const ruta of Object.keys(zip.files)) {
    if (!/^(word|xl|ppt)\/.*\.xml$/.test(ruta)) continue;
    const xml = await zip.file(ruta)!.async("string");
    if (!/(w:author|w:initials|<author>|<cp:lastModifiedBy|p:cmAuthor)/.test(xml)) continue;
    let nuevo = xml.replace(/\b(w:author|w:initials)="([^"]*)"/g, (_m, attr: string, valor: string) => {
      if (attr === "w:author" && valor) autores.add(valor);
      return `${attr}="${attr === "w:author" ? "Anónimo" : "A"}"`;
    });
    nuevo = nuevo.replace(/<author>([^<]*)<\/author>/g, (_m, valor: string) => {
      if (valor) autores.add(valor);
      return "<author>Anónimo</author>";
    });
    nuevo = nuevo.replace(/(<p:cmAuthor\b[^>]*\bname=")([^"]*)(")/g, (_m, a: string, valor: string, c: string) => {
      if (valor) autores.add(valor);
      return `${a}Anónimo${c}`;
    });
    if (nuevo !== xml) zip.file(ruta, nuevo);
  }
  if (autores.size) hallazgos.push(`Nombre en comentarios o cambios con seguimiento (${[...autores].join(", ")})`);

  const documento = await zip.file("word/document.xml")?.async("string");
  if (documento && /<w:(ins|del)\b/.test(documento)) {
    advertencias.push("El documento tiene cambios con seguimiento: el texto borrado sigue dentro del archivo. Acéptalos o recházalos antes de enviarlo.");
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { bytes, hallazgos, advertencias };
}

/* ---------- Entrada única ---------- */

const ADVERTENCIA_CONTENIDO =
  "La limpieza quita datos ocultos, no lo que se ve: revisa que el contenido no muestre tu nombre, tu cara, tu usuario o tu número.";

export async function limpiarArchivo(entrada: Uint8Array, nombre: string): Promise<ResultadoLimpieza> {
  const tipo = detectarTipo(entrada, nombre);
  const base = { tipo, bytesAntes: entrada.length };
  try {
    if (tipo === "image/jpeg") {
      const hallazgos = await hallazgosFoto(entrada);
      const { bytes, quitados } = limpiarJpeg(entrada);
      return {
        bytes,
        informe: {
          ...base,
          hallazgos: hallazgos.length ? hallazgos : quitados.map((q) => `Se quitaron ${q}`),
          advertencias: [ADVERTENCIA_CONTENIDO],
          limpiado: true,
          bytesDespues: bytes.length,
        },
      };
    }
    if (tipo === "image/png") {
      const { bytes, quitados } = limpiarPng(entrada);
      return {
        bytes,
        informe: {
          ...base,
          hallazgos: quitados.map((q) => `Se quitaron ${q}`),
          advertencias: [ADVERTENCIA_CONTENIDO],
          limpiado: true,
          bytesDespues: bytes.length,
        },
      };
    }
    if (tipo === "application/pdf") {
      const { bytes, hallazgos, advertencias } = await limpiarPdf(entrada);
      return {
        bytes,
        informe: { ...base, hallazgos, advertencias: [ADVERTENCIA_CONTENIDO, ...advertencias], limpiado: true, bytesDespues: bytes.length },
      };
    }
    if (tipo.includes("officedocument")) {
      const { bytes, hallazgos, advertencias } = await limpiarOffice(entrada);
      return {
        bytes,
        informe: { ...base, hallazgos, advertencias: [ADVERTENCIA_CONTENIDO, ...advertencias], limpiado: true, bytesDespues: bytes.length },
      };
    }
  } catch (e) {
    return {
      bytes: entrada,
      informe: {
        ...base,
        hallazgos: [],
        advertencias: [
          `No se pudo limpiar este archivo (${e instanceof Error ? e.message : "formato no reconocido"}). ` +
            "Si es una imagen o un documento, toma una captura de pantalla y envía la captura.",
        ],
        limpiado: false,
        bytesDespues: entrada.length,
      },
    };
  }
  return {
    bytes: entrada,
    informe: {
      ...base,
      hallazgos: [],
      advertencias: [
        "Este tipo de archivo no se puede limpiar automáticamente. Para fotos usa JPG o PNG; para documentos, PDF o Word. " +
          "En audio y video, la voz y las imágenes pueden identificarte.",
      ],
      limpiado: false,
      bytesDespues: entrada.length,
    },
  };
}

/**
 * El informe completo dice qué revelaba el archivo ("Autor del documento (Juan Pérez)").
 * Ese detalle es para quien denuncia y se queda en su navegador. Al servidor solo viaja
 * la categoría de lo que se quitó, sin el valor: si no, la limpieza no serviría de nada.
 */
export function informeSinValores(i: InformeLimpieza): InformeLimpieza {
  return { ...i, hallazgos: [...new Set(i.hallazgos.map((h) => h.replace(/\s*\(.*\)\s*$/, "").trim()))] };
}
