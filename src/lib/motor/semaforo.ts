/**
 * Semáforo sugerido y explicable.
 *
 * 1. Reglas duras: un hecho con confiabilidad A o B que active una regla decide el color.
 * 2. Puntaje: suma de severidad(categoría) × confianza(fuente).
 * 3. Umbrales del criterio.
 *
 * El semáforo ordena la atención; no califica a nadie. La decisión la toma una persona.
 */
import { createHash } from "node:crypto";
import criterioBase from "../../../config/criterio_semaforo.json";
import type { Consulta, Indicio, Semaforo } from "../tipos";

export type Criterio = typeof criterioBase;
type Color = Semaforo["color"];

const ORDEN: Record<Color, number> = { verde: 0, amarillo: 1, rojo: 2 };

export function criterioVigente(): { criterio: Criterio; sha256: string } {
  const sha256 = createHash("sha256").update(JSON.stringify(criterioBase)).digest("hex");
  return { criterio: criterioBase, sha256 };
}

export function colorPorPuntaje(p: number, umbrales: Criterio["umbrales"]): Color {
  if (p <= umbrales.verde_si_puntaje_igual_a) return "verde";
  if (p >= umbrales.rojo_desde) return "rojo";
  return "amarillo";
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularSemaforo(
  indicios: Indicio[],
  consultas: Consulta[],
  c: { criterio: Criterio; sha256: string } = criterioVigente(),
): Semaforo {
  const { criterio } = c;
  const confianza = criterio.confianza as Record<string, number>;
  const severidades = criterio.severidades as Record<string, number>;
  const reglas = new Map(criterio.reglas_duras.map((r) => [r.id, r]));

  const reglasDuras: Semaforo["reglasDuras"] = [];
  const contribuciones: Semaforo["contribuciones"] = [];

  for (const i of indicios) {
    if (i.tipo === "contexto") continue;
    const dura = i.reglaDura ? reglas.get(i.reglaDura) : undefined;
    const confirmada = dura && i.tipo === "hecho" && (i.confiabilidad === "A" || i.confiabilidad === "B");
    if (dura && confirmada) {
      reglasDuras.push({ regla: dura.id, descripcion: dura.descripcion, indicio: i.id });
      continue;
    }
    // Una regla dura sin confirmar baja a posible alerta con su propia severidad.
    const categoria = dura ? criterio.categoria_regla_dura_no_confirmada : i.categoria;
    const severidad = severidades[categoria] ?? severidades.otra ?? 1;
    const conf = confianza[i.confiabilidad] ?? 0;
    contribuciones.push({
      indicio: i.id,
      categoria,
      severidad,
      confiabilidad: i.confiabilidad,
      aporte: redondear(severidad * conf),
    });
  }

  const puntaje = redondear(contribuciones.reduce((s, x) => s + x.aporte, 0));
  const colorPuntaje = colorPorPuntaje(puntaje, criterio.umbrales);
  const color = reglasDuras.length ? "rojo" : colorPuntaje;

  const tareasVerificacion = indicios
    .filter((i) => i.tipo !== "contexto" && (i.confiabilidad === "D" || i.confiabilidad === "C"))
    .map((i) => ({
      indicio: i.id,
      motivo:
        i.confiabilidad === "D"
          ? "Sin respaldo suficiente: no mueve el color. Verificar con otra fuente."
          : "Coincide solo el nombre: puede ser un homónimo. Confirmar con el ente, el cargo o un identificador.",
    }));

  const brechas = consultas
    .filter((q) => q.estado === "no_accesible")
    .map((q) => `${q.sistema}: ${q.descripcion}${q.detalle ? ` (${q.detalle})` : ""}`);

  return {
    color: ORDEN[color] >= ORDEN[colorPuntaje] ? color : colorPuntaje,
    puntaje,
    colorPorPuntaje: colorPuntaje,
    reglasDuras,
    contribuciones: contribuciones.sort((a, b) => b.aporte - a.aporte),
    tareasVerificacion,
    brechas,
    queCambiaria: queCambiaria(color, puntaje, reglasDuras, contribuciones, brechas, criterio),
    criterio: { version: criterio.version, sha256: c.sha256 },
  };
}

/** Lo que cambiaría el resultado si apareciera un dato nuevo o se descartara uno existente. */
function queCambiaria(
  color: Color,
  puntaje: number,
  duras: Semaforo["reglasDuras"],
  contribuciones: Semaforo["contribuciones"],
  brechas: string[],
  criterio: Criterio,
): string[] {
  const rojo = criterio.umbrales.rojo_desde;
  const salida: string[] = [];
  if (duras.length) {
    salida.push("El rojo viene de una regla dura: solo cambia si el dato que la activa se desmiente en la fuente.");
  } else if (puntaje < rojo) {
    salida.push(`Faltan ${redondear(rojo - puntaje)} puntos para rojo (umbral ${rojo}).`);
  }
  for (const c of contribuciones) {
    if (c.confiabilidad === "B" || c.confiabilidad === "C") {
      const nuevo = redondear(c.severidad * criterio.confianza.A);
      salida.push(
        `Si ${c.indicio} se confirmara con un identificador, su aporte pasaría de ${c.aporte} a ${nuevo}; ` +
          `si se descartara, el puntaje bajaría a ${redondear(puntaje - c.aporte)}.`,
      );
    }
  }
  for (const b of brechas.slice(0, 6)) {
    salida.push(`Fuente no disponible: ${b}. Un resultado ahí podría cambiar el color.`);
  }
  if (color === "verde") {
    salida.push("Verde no descarta la denuncia: solo indica que las fuentes públicas consultadas no aportaron respaldo.");
  }
  return salida;
}
