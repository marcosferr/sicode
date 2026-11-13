import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Almacén local en una carpeta temporal y llaves solo para la prueba.
const DIR = mkdtempSync(path.join(tmpdir(), "sicode-"));
process.env.SICODE_DIR_DATOS = DIR;
process.env.SICODE_ALMACEN = "local";
process.env.SICODE_LLAVE_CONTACTO = Buffer.alloc(32, 7).toString("base64");

type Servicio = typeof import("@/lib/servicio");
let s: Servicio;
let seg: typeof import("@/lib/seguridad");
let fuentes: typeof import("@/lib/pdn/demo");

const entrada = (o: Record<string, unknown> = {}) => ({
  anonimo: true,
  narracionHechos: "El director de obras entregó contratos sin concurso a Constructora Demostrativa del Este, S.A. de C.V.",
  conductas: ["FAVORITISMO_CONTRATO"],
  lugar: { entidad: "11", institucion: "Instituto Ficticio de Infraestructura de Valle Sereno" },
  involucrados: [{ tipo: "SERVIDOR_PUBLICO" as const, nombre: "Armando Ficticio Demostrado" }],
  evidencias: [],
  altcha: "",
  ...o,
});

beforeAll(async () => {
  s = await import("@/lib/servicio");
  seg = await import("@/lib/seguridad");
  fuentes = await import("@/lib/pdn/demo");
});

describe("folio y clave", () => {
  it("el folio es aleatorio y la clave se verifica sin guardarse", () => {
    const folios = new Set(Array.from({ length: 200 }, () => seg.nuevoFolio()));
    expect(folios.size).toBe(200);
    expect([...folios].every((f) => seg.RE_FOLIO.test(f))).toBe(true);
    const clave = seg.nuevaClave();
    const guardado = seg.derivarClave(clave);
    expect(guardado).not.toContain(clave.replace(/-/g, ""));
    expect(seg.verificarClave(clave.toLowerCase().replace(/-/g, " "), guardado)).toBe(true);
    expect(seg.verificarClave("AAAAA-AAAAA-AAAAA-AAAAA", guardado)).toBe(false);
  });

  it("el contacto se cifra y no se puede alterar", () => {
    const blob = seg.cifrarContacto({ correo: "persona@example.com" });
    expect(blob).not.toContain("persona");
    expect(seg.descifrarContacto(blob).correo).toBe("persona@example.com");
    const alterado = blob.slice(0, -4) + "AAAA";
    expect(() => seg.descifrarContacto(alterado)).toThrow();
  });
});

describe("ciclo de una denuncia", () => {
  it("anónima: seguimiento, buzón y vista de autoridad sin secretos", async () => {
    const { folio, clave } = await s.presentarDenuncia(entrada());
    const vista = await s.consultarSeguimiento(folio.toLowerCase(), clave);
    expect(vista.status).toBe("SIN_TURNAR");
    expect(vista.fechaRecepcion).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const [d] = (await s.listarParaOperador()).filter((x) => x.folio === folio);
    expect(JSON.stringify(d)).not.toMatch(/secretoHash|contactoCifrado|scrypt/);
    expect(d.tieneContacto).toBe(false);

    await s.escribirADenunciante(d.id, "op@example.com", "¿De qué año son los contratos?");
    const tras = await s.responderComoDenunciante(folio, clave, "De 2021.");
    expect(tras.mensajes.map((m) => m.autor)).toEqual(["AUTORIDAD", "DENUNCIANTE"]);
    expect(tras.mensajes.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.fecha))).toBe(true);
    await expect(s.revelarContacto(d.id, "op@example.com", "Motivo suficientemente largo para la bitácora")).rejects.toThrow(/anónima/);
  });

  it("no guarda la hora, la clave ni el contacto en claro", async () => {
    const { clave } = await s.presentarDenuncia(entrada({ anonimo: false, contacto: { correo: "persona.ficticia@example.com", nombre: "Persona Ficticia" } }));
    const crudo = readFileSync(path.join(DIR, "almacen", "denuncias.json"), "utf8");
    expect(crudo).not.toContain(clave);
    expect(crudo).not.toContain(clave.replace(/-/g, ""));
    expect(crudo).not.toContain("persona.ficticia");
    expect(crudo).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // ninguna marca de hora
  });

  it("abrir el contacto exige motivo y queda en bitácora", async () => {
    const { folio } = await s.presentarDenuncia(entrada({ anonimo: false, contacto: { correo: "otra@example.com" } }));
    const d = (await s.listarParaOperador()).find((x) => x.folio === folio)!;
    await expect(s.revelarContacto(d.id, "op@example.com", "corto")).rejects.toThrow(/motivo/);
    const contacto = await s.revelarContacto(d.id, "op@example.com", "Citar a la persona para ratificar la denuncia.");
    expect(contacto.correo).toBe("otra@example.com");
    const tras = await s.detalleParaOperador(d.id);
    expect(tras.bitacora.at(-1)).toMatchObject({ actor: "op@example.com", accion: expect.stringContaining("contacto") });
  });

  it("bloquea el folio tras cinco claves incorrectas, también para la correcta", async () => {
    const { folio, clave } = await s.presentarDenuncia(entrada());
    for (let i = 0; i < 5; i++) await expect(s.consultarSeguimiento(folio, "AAAAA-AAAAA-AAAAA-AAAAA")).rejects.toThrow(/no coinciden/);
    await expect(s.consultarSeguimiento(folio, clave)).rejects.toThrow(/Demasiados intentos/);
  });

  it("un folio inexistente responde igual que una clave incorrecta", async () => {
    await expect(s.consultarSeguimiento("SCD-2026-ZZZZ-ZZZZ", "AAAAA-AAAAA-AAAAA-AAAAA")).rejects.toThrow(/no coinciden/);
  });

  it("corrobora, sugiere prioridad y exige resumen público para cerrar", async () => {
    const { folio, clave } = await s.presentarDenuncia(entrada());
    const d = (await s.listarParaOperador()).find((x) => x.folio === folio)!;
    const c = await s.corroborarDenuncia(d.id, "op@example.com", fuentes.FUENTES_DEMO);
    expect(c.corroboracion?.semaforo.color).toBe("rojo");
    expect(c.prioridad).toBe("ALTA");
    await expect(s.actualizarTramite(d.id, "op@example.com", { status: "ATENDIDA" })).rejects.toThrow(/resumen público/);
    const turnada = await s.actualizarTramite(d.id, "op@example.com", { institucionActual: "Órgano Interno de Control Ficticio" });
    expect(turnada.status).toBe("TURNADA");
    await s.actualizarTramite(d.id, "op@example.com", { status: "ATENDIDA", resumenPublicoCierre: "Se inició el procedimiento correspondiente." });
    const vista = await s.consultarSeguimiento(folio, clave);
    expect(vista).toMatchObject({ status: "ATENDIDA", institucionActual: "Órgano Interno de Control Ficticio", resumenPublicoCierre: expect.stringContaining("procedimiento") });
    // Quien denuncia nunca ve los indicios ni el semáforo.
    expect(JSON.stringify(vista)).not.toMatch(/indicio|semaforo|corroboracion/i);
  });
});
