import { describe, expect, it } from "vitest";
import { claveEmpresa, esRfcPlausible, normalizar, partirNombre, similitud, similitudPersona } from "@/lib/texto";

describe("normalización", () => {
  it("quita acentos, puntuación y mayúsculas", () => {
    expect(normalizar("  Hernández-López, José ")).toBe("HERNANDEZ LOPEZ JOSE");
  });
  it("separa la forma jurídica mexicana", () => {
    expect(claveEmpresa("Telefonía IP, S.A. de C.V.")).toBe("TELEFONIA IP");
    expect(claveEmpresa("WYNNMEX TECHNOLOGIES S DE RL DE CV")).toBe("WYNNMEX TECHNOLOGIES");
    expect(claveEmpresa("Wynnmex Technologies, S. de R.L. de C.V.")).toBe("WYNNMEX TECHNOLOGIES");
  });
});

describe("similitud", () => {
  it("reconoce el mismo nombre en otro orden", () => {
    expect(similitud("PÉREZ LÓPEZ JUAN", "Juan Pérez López")).toBeGreaterThan(0.95);
  });
  it("no confunde personas con otro primer apellido", () => {
    const a = partirNombre("Juan Carlos Pérez López");
    expect(similitudPersona(a, { nombres: "JUAN CARLOS", primerApellido: "PEREA", segundoApellido: "LOPEZ" })).toBe(0);
    expect(similitudPersona(a, { nombres: "JUAN CARLOS", primerApellido: "PÉREZ", segundoApellido: "LÓPEZ" })).toBe(1);
  });
  it("descarta a quien solo comparte apellidos", () => {
    const a = partirNombre("María Pérez López");
    expect(similitudPersona(a, { nombres: "JOSE", primerApellido: "PEREZ", segundoApellido: "LOPEZ" })).toBe(0);
  });
  it("parte nombres con partículas", () => {
    expect(partirNombre("María de la Cruz Hernández")).toEqual({
      nombres: "María", primerApellido: "de la Cruz", segundoApellido: "Hernández",
    });
  });
});

describe("RFC", () => {
  it("valida la fecha embebida", () => {
    expect(esRfcPlausible("WTE1307027J7")).toBe(true);
    expect(esRfcPlausible("ABC9913401X2")).toBe(false);
  });
});
