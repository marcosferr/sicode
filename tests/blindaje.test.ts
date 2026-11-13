import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { detectarTipo, informeSinValores, limpiarArchivo } from "@/lib/blindaje/metadatos";
import { analizarRelato } from "@/lib/blindaje/relato";

/** JPEG mínimo con un EXIF que declara marca de cámara y orientación 6. */
function jpegConExif(): Uint8Array {
  const marca = [...Buffer.from("CamaraDePrueba\0")]; // 15 bytes
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    0x00, 0x02,
    0x01, 0x0f, 0x00, 0x02, 0x00, 0x00, 0x00, marca.length, 0x00, 0x00, 0x00, 0x26, // Make → offset 38
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, // Orientation = 6
    0x00, 0x00, 0x00, 0x00,
    ...marca,
  ];
  const cuerpo = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const largo = cuerpo.length + 2;
  const comentario = [...Buffer.from("tomada por Fulano")];
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // JFIF
    0xff, 0xe1, largo >> 8, largo & 0xff, ...cuerpo,
    0xff, 0xfe, 0x00, comentario.length + 2, ...comentario,
    0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33, 0xff, 0xd9,
  ]);
}

const contiene = (b: Uint8Array, texto: string) => Buffer.from(b).includes(Buffer.from(texto));

describe("limpieza de evidencias", () => {
  it("quita EXIF y comentarios de un JPEG y conserva la orientación", async () => {
    const original = jpegConExif();
    expect(contiene(original, "CamaraDePrueba")).toBe(true);
    const { bytes, informe } = await limpiarArchivo(original, "foto.jpg");
    expect(informe.limpiado).toBe(true);
    expect(contiene(bytes, "CamaraDePrueba")).toBe(false);
    expect(contiene(bytes, "Fulano")).toBe(false);
    expect(informe.hallazgos.join(" ")).toMatch(/CamaraDePrueba/);
    // Queda un EXIF mínimo solo con la orientación, y los datos de imagen intactos.
    expect(contiene(bytes, "Exif")).toBe(true);
    expect([...bytes.subarray(-5)]).toEqual([0x11, 0x22, 0x33, 0xff, 0xd9]);
    // Limpiar dos veces da el mismo resultado.
    expect((await limpiarArchivo(bytes, "foto.jpg")).bytes).toEqual(bytes);
  });

  it("quita textos incrustados de un PNG", async () => {
    const chunk = (tipo: string, datos: number[]) => [0, 0, 0, datos.length, ...Buffer.from(tipo), ...datos, 0, 0, 0, 0];
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk("IHDR", new Array(13).fill(1)),
      ...chunk("tEXt", [...Buffer.from("Author\0Fulano de Tal")]),
      ...chunk("IDAT", [9, 9, 9]),
      ...chunk("IEND", []),
    ]);
    const { bytes, informe } = await limpiarArchivo(png, "captura.png");
    expect(contiene(bytes, "Fulano")).toBe(false);
    expect(contiene(bytes, "IDAT")).toBe(true);
    expect(informe.hallazgos).toContain("Se quitaron textos incrustados");
  });

  it("quita autor y programa de un PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setAuthor("Fulano de Tal");
    doc.setCreator("Editor Secreto 3.1");
    const { bytes, informe } = await limpiarArchivo(await doc.save({ useObjectStreams: false }), "oficio.pdf");
    expect(informe.hallazgos.join(" ")).toMatch(/Autor del documento \(Fulano de Tal\)/);
    const limpio = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(limpio.getAuthor()).toBeUndefined();
    expect(limpio.getCreator()).toBeUndefined();
    expect(contiene(bytes, "Fulano")).toBe(false);
    expect(limpio.getPageCount()).toBe(1);
  });

  it("quita autor, empresa y autores de comentarios de un Word", async () => {
    const zip = new JSZip();
    zip.file("docProps/core.xml", "<cp:coreProperties><dc:creator>Fulano de Tal</dc:creator><cp:lastModifiedBy>Mengana</cp:lastModifiedBy></cp:coreProperties>");
    zip.file("docProps/app.xml", "<Properties><Company>Secretaría Ficticia</Company></Properties>");
    zip.file("word/document.xml", '<w:document><w:ins w:author="Fulano de Tal" w:id="1"><w:t>hola</w:t></w:ins></w:document>');
    zip.file("word/comments.xml", '<w:comments><w:comment w:author="Mengana" w:initials="M"/></w:comments>');
    const entrada = await zip.generateAsync({ type: "uint8array" });
    const { bytes, informe } = await limpiarArchivo(entrada, "informe.docx");
    const salida = await JSZip.loadAsync(bytes);
    const todo = (await Promise.all(Object.values(salida.files).map((f) => f.async("string")))).join("\n");
    expect(todo).not.toMatch(/Fulano|Mengana|Secretaría Ficticia/);
    expect(todo).toContain("hola");
    expect(informe.advertencias.join(" ")).toMatch(/cambios con seguimiento/);
  });

  it("no acepta a ciegas lo que no sabe limpiar", async () => {
    const { informe } = await limpiarArchivo(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), "audio.mp3");
    expect(informe.limpiado).toBe(false);
    expect(detectarTipo(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
  });

  it("el informe que viaja al servidor no lleva los valores quitados", () => {
    const i = informeSinValores({
      tipo: "image/jpeg", limpiado: true, bytesAntes: 10, bytesDespues: 5, advertencias: [],
      hallazgos: ["Ubicación exacta donde se tomó la foto (19.4326, -99.1332)", "Nombre del autor (Fulano de Tal)"],
    });
    expect(i.hallazgos).toEqual(["Ubicación exacta donde se tomó la foto", "Nombre del autor"]);
  });
});

describe("riesgo de identificación en el relato", () => {
  const tipos = (t: string) => analizarRelato(t).hallazgos.map((h) => h.tipo);

  it("un relato impersonal no levanta avisos", () => {
    const r = analizarRelato(
      "El director de obras del municipio entregó tres contratos sin concurso a una empresa de su cuñado durante 2024. Los pagos se hicieron por adelantado.",
    );
    expect(r.nivel).toBe("bajo");
    expect(r.hallazgos).toHaveLength(0);
  });

  it("marca puesto propio, unicidad y grupos pequeños como riesgo alto", () => {
    expect(tipos("Soy la única contadora del área y vi las facturas.")).toContain("unicidad");
    expect(tipos("Trabajo como auxiliar de almacén en la clínica.")).toContain("rol_propio");
    expect(tipos("En la reunión éramos solo tres personas.")).toContain("grupo_pequeno");
    expect(analizarRelato("Me llamo Juana Ejemplo Inventada y quiero denunciar.").nivel).toBe("alto");
  });

  it("marca datos de contacto e identificadores", () => {
    expect(tipos("Pueden escribirme a alguien@ejemplo.org o al 55 1234 5678.")).toEqual(["contacto", "contacto"]);
    expect(tipos("Mi número de empleado es 48213.")).toContain("identificador");
  });

  it("no confunde montos con teléfonos", () => {
    expect(tipos("Se pagaron $1,250,000.00 por adelantado y luego 3500000 pesos más.")).toEqual([]);
  });

  it("marca vínculos, área propia y hora exacta como riesgo medio", () => {
    const r = analizarRelato("Mi jefe me citó en mi oficina. Yo estaba ahí a las 9:15 de la mañana cuando recibió el sobre.");
    expect(r.nivel).toBe("medio");
    expect(r.hallazgos.map((h) => h.tipo)).toEqual(expect.arrayContaining(["relacion", "area_propia", "presencia"]));
  });

  it("no marca el parentesco de la persona denunciada como puesto propio", () => {
    expect(tipos("La beneficiada es la esposa del tesorero.")).toEqual([]);
  });

  it("devuelve la posición exacta de cada fragmento", () => {
    const texto = "Hechos: soy el único que tiene la llave.";
    const [h] = analizarRelato(texto).hallazgos;
    expect(texto.slice(h.inicio, h.fin).trim()).toBe(h.fragmento);
  });
});
