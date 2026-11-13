import { describe, expect, it } from "vitest";
import { aCsv, construirDatosAbiertos, proteger } from "@/lib/abiertos/agregacion";
import type { Denuncia } from "@/lib/tipos";

const base = (o: Partial<Denuncia>): Denuncia => ({
  id: Math.random().toString(16).slice(2), folio: "SCD-2026-AAAA-BBBB", status: "SIN_TURNAR",
  fechaRecepcion: "2026-10-05", fechaActualizacion: "2026-10-05", anonimo: true,
  narracionHechos: "RELATO SECRETO con nombre de Fulano", conductas: ["SOBORNO"], lugar: { entidad: "09", municipio: "Coyoacán", institucion: "Ente Ficticio" },
  involucrados: [{ tipo: "SERVIDOR_PUBLICO", nombre: "Fulano Inventado" }], evidencias: [], secretoHash: "x", intentosFallidos: 0, mensajes: [], bitacora: [], ...o,
});

describe("datos abiertos", () => {
  it("protege celdas con menos de K", () => {
    expect(proteger(0, 5)).toEqual({ valor: 0, suprimida: false });
    expect(proteger(4, 5)).toEqual({ valor: null, suprimida: true });
    expect(proteger(5, 5)).toEqual({ valor: 5, suprimida: false });
  });

  it("suprime celdas chicas y redondea el total para que no se despejen", () => {
    const denuncias = [
      ...Array.from({ length: 7 }, () => base({ lugar: { entidad: "09" } })),
      ...Array.from({ length: 2 }, () => base({ lugar: { entidad: "14" } })),
    ];
    const t = construirDatosAbiertos(denuncias).tablas.find((x) => x.id === "por_entidad")!;
    expect(t.filas).toEqual([
      { entidad: "Ciudad de México", denuncias: 7, nota: null },
      { entidad: "Jalisco", denuncias: null, nota: "menos de 5" },
      { entidad: "Total", denuncias: 10, nota: "redondeado a múltiplos de 5" },
    ]);
    // Con el total real (9) se despejaría Jalisco = 2.
    expect(t.proteccion).toEqual({ celdasSuprimidas: 1, totalRedondeado: true });
  });

  it("nunca incluye relatos, nombres, folios, municipios ni entes denunciados", () => {
    const c = construirDatosAbiertos(Array.from({ length: 12 }, () => base({})));
    const todo = JSON.stringify(c) + c.tablas.map(aCsv).join("");
    expect(todo).not.toMatch(/RELATO|Fulano|SCD-|Coyoacán|Ente Ficticio/);
  });

  it("solo publica tiempos de autoridades con K o más cierres", () => {
    const cerrada = (autoridad: string) =>
      base({ status: "ATENDIDA", institucionActual: autoridad, fechaRecepcion: "2026-10-01", fechaActualizacion: "2026-10-11" });
    const c = construirDatosAbiertos([...Array.from({ length: 5 }, () => cerrada("OIC Grande")), cerrada("OIC Chico")]);
    const t = c.tablas.find((x) => x.id === "tiempos_por_autoridad")!;
    expect(t.filas[0]).toEqual({ autoridad: "OIC Grande", denuncias_cerradas: 5, mediana_dias: 10 });
    expect(JSON.stringify(t.filas)).not.toContain("OIC Chico");
  });

  it("genera CSV válido", () => {
    const t = construirDatosAbiertos(Array.from({ length: 6 }, () => base({}))).tablas[0];
    expect(aCsv(t).split("\n")[0]).toBe("mes,denuncias,nota");
    expect(aCsv(t)).toContain("2026-10,6,");
  });
});
