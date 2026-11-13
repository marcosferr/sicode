import { describe, expect, it } from "vitest";
import { corroborar, coincideEnte } from "@/lib/motor/corroborar";
import { extraer } from "@/lib/motor/extraccion";
import { FuentesEnMemoria } from "@/lib/pdn/fuentes";
import type { ContratoS6 } from "@/lib/pdn/tipos";

// Datos ficticios: ninguna persona ni empresa de estas pruebas existe.
const HOY = new Date("2026-11-13T12:00:00Z");
const contrato = (o: Partial<ContratoS6>): ContratoS6 => ({
  ocid: "ocds-prueba-1", ciclo: 2020, comprador: "Instituto Ficticio de Obras", metodo: "direct",
  oferentes: [], proveedores: [{ id: "CFI150101AB1", nombre: "CONSTRUCCIONES FICTICIAS DEL BAJIO SA DE CV" }],
  montoAdjudicado: 1_000_000, moneda: "MXN", fechaAdjudicacion: "2020-05-01T00:00:00Z", ...o,
});

const denuncia = {
  narracionHechos:
    "El director de obras entregó tres contratos sin concurso a la empresa Construcciones Ficticias del Bajío, S.A. de C.V. " +
    "con RFC CFI150101AB1 por 3 millones de pesos. Le pidió dinero a cambio. Contrato número IFO-2020-0045.",
  conductas: ["FAVORITISMO_CONTRATO"],
  lugar: { entidad: "11", institucion: "Instituto Ficticio de Obras" },
  involucrados: [
    { tipo: "SERVIDOR_PUBLICO" as const, nombre: "Rodrigo Ejemplo Inventado", cargo: "Director de obras", institucion: "Instituto Ficticio de Obras" },
  ],
};

describe("extracción", () => {
  const e = extraer(denuncia);
  it("detecta la empresa con su forma jurídica y el RFC", () => {
    expect(e.empresas.map((x) => x.razonSocial)).toEqual(["Construcciones Ficticias del Bajío, S.A. de C.V."]);
    expect(e.rfcs).toEqual(["CFI150101AB1"]);
  });
  it("detecta montos y referencias de contrato", () => {
    expect(e.montos).toContain("3 millones de pesos");
    expect(e.contratos).toContain("IFO-2020-0045");
  });
  it("no inventa personas a partir del relato", () => {
    expect(e.personas).toHaveLength(1);
  });
});

describe("coincidencia de ente", () => {
  it("acepta siglas expandidas y contención", () => {
    expect(coincideEnte("Municipio de León", "H. Ayuntamiento del Municipio de León, Guanajuato", 0.72)).toBe(true);
    expect(coincideEnte("Municipio de León", "Municipio de Celaya", 0.72)).toBe(false);
  });
});

describe("corroboración", () => {
  it("sin datos públicos queda en verde y lo explica", async () => {
    const r = await corroborar(denuncia, new FuentesEnMemoria({}), HOY);
    expect(r.semaforo.color).toBe("verde");
    expect(r.indicios).toHaveLength(0);
    expect(r.semaforo.queCambiaria.join(" ")).toMatch(/no descarta la denuncia/);
    expect(r.hipotesis.every((h) => h.estado === "sin_respaldo")).toBe(true);
  });

  it("una sanción grave en el mismo ente activa la regla dura", async () => {
    const fuentes = new FuentesEnMemoria({
      servidores: [{
        id: "1", proveedor: "Guanajuato", expediente: "FG 1/2020",
        persona: { nombres: "RODRIGO", primerApellido: "EJEMPLO", segundoApellido: "INVENTADO" },
        ente: "Instituto Ficticio de Obras", faltas: [{ clave: "COHECHO" }], sanciones: [{ clave: "INHABILITACION" }],
      }],
    });
    const r = await corroborar(denuncia, fuentes, HOY);
    expect(r.semaforo.color).toBe("rojo");
    expect(r.semaforo.reglasDuras[0].regla).toBe("servidor_sancion_grave_mismo_ente");
  });

  it("un homónimo en otro ente no pasa de posible alerta", async () => {
    const fuentes = new FuentesEnMemoria({
      servidores: [{
        id: "1", proveedor: "Jalisco",
        persona: { nombres: "RODRIGO", primerApellido: "EJEMPLO", segundoApellido: "INVENTADO" },
        ente: "Sistema de Agua de Otro Estado", faltas: [{ clave: "PECULADO" }], sanciones: [],
      }],
    });
    const r = await corroborar(denuncia, fuentes, HOY);
    expect(r.semaforo.reglasDuras).toHaveLength(0);
    expect(r.indicios[0]).toMatchObject({ tipo: "posible_alerta", confiabilidad: "C" });
    expect(r.semaforo.color).toBe("amarillo");
    expect(r.semaforo.tareasVerificacion).toHaveLength(1);
  });

  it("cruza contratos con el ente, banderas e interés declarado", async () => {
    const fuentes = new FuentesEnMemoria({
      contratos: [contrato({ ocid: "ocds-prueba-1" }), contrato({ ocid: "ocds-prueba-2" }), contrato({ ocid: "ocds-prueba-3" })],
      s2: [{
        proveedor: "guanajuato", persona: { nombres: "RODRIGO", primerApellido: "EJEMPLO", segundoApellido: "INVENTADO" },
        institucion: "INSTITUTO FICTICIO DE OBRAS", puesto: "DIRECTOR DE OBRAS",
        nivelesResponsabilidad: ["RESOLUCIÓN"], tiposProcedimiento: ["CONTRATACIONES PÚBLICAS"],
      }],
      declaraciones: [{
        id: "d1", proveedor: "GUANAJUATO", persona: { nombres: "RODRIGO", primerApellido: "EJEMPLO", segundoApellido: "INVENTADO" },
        institucion: "Instituto Ficticio de Obras", cargo: "DIRECTOR DE OBRAS",
        intereses: [{ tipo: "PARTICIPACION", empresa: "Construcciones Ficticias del Bajio SA de CV" }],
      }],
    });
    const r = await corroborar(denuncia, fuentes, HOY);
    const categorias = r.indicios.map((i) => i.categoria);
    expect(categorias).toEqual(expect.arrayContaining([
      "contratos_empresa_con_ente", "bandera_adjudicacion_directa", "servidor_interviene_en_contrataciones",
      "cargo_confirmado", "interes_declarado_en_empresa",
    ]));
    // El contrato se confirma por RFC: confiabilidad A.
    expect(r.indicios.find((i) => i.categoria === "contratos_empresa_con_ente")?.confiabilidad).toBe("A");
    expect(r.semaforo.color).toBe("rojo");
    expect(r.semaforo.reglasDuras).toHaveLength(0);
    expect(r.indicios.every((i) => i.fuente.url.startsWith("https://"))).toBe(true);
  });

  it("empresa inhabilitada confirmada por RFC y contrato posterior a la sanción", async () => {
    const fuentes = new FuentesEnMemoria({
      particulares: [{
        id: "p1", proveedor: "Guanajuato", tipo: "MORAL", expediente: "X-1", fecha: "2019-01-10",
        razonSocial: "CONSTRUCCIONES FICTICIAS DEL BAJIO S.A. DE C.V.", rfc: "CFI150101AB1",
        faltas: [{ clave: "OTRO", valor: "SOBORNO" }], sanciones: [{ clave: "INHABILITACION", inhabilitacionHasta: "2027-01-10" }],
      }],
      contratos: [contrato({})],
    });
    const r = await corroborar(denuncia, fuentes, HOY);
    expect(r.semaforo.reglasDuras.map((x) => x.regla).sort()).toEqual(["contrato_posterior_a_sancion", "empresa_inhabilitada_vigente"]);
  });

  it("una fuente caída queda como brecha y la hipótesis sigue abierta", async () => {
    const r = await corroborar(denuncia, new FuentesEnMemoria({ caidas: ["S6", "S1"] }), HOY);
    expect(r.semaforo.brechas.length).toBeGreaterThanOrEqual(2);
    expect(r.hipotesis.find((h) => h.enunciado.includes("ha recibido contratos"))?.estado).toBe("abierta");
  });

  it("no usa ningún dato de quien denuncia", async () => {
    const r = await corroborar({ ...denuncia, ...({ contactoCifrado: "secreto", anonimo: false } as object) }, new FuentesEnMemoria({}), HOY);
    expect(JSON.stringify(r)).not.toContain("secreto");
  });

  it("sugiere fundamentos de la LGRA y del CPF", async () => {
    const r = await corroborar(denuncia, new FuentesEnMemoria({}), HOY);
    const claves = r.clasificacion.map((c) => c.clave);
    expect(claves).toEqual(expect.arrayContaining(["CONTRATACION_INDEBIDA", "COHECHO"]));
  });
});
