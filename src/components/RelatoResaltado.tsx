import type { HallazgoRelato } from "@/lib/blindaje/relato";

/** Muestra el relato con las frases de riesgo subrayadas. El color va acompañado del listado de avisos. */
export function RelatoResaltado({ texto, hallazgos }: { texto: string; hallazgos: HallazgoRelato[] }) {
  const partes: React.ReactNode[] = [];
  let cursor = 0;
  hallazgos.forEach((h, i) => {
    if (h.inicio > cursor) partes.push(texto.slice(cursor, h.inicio));
    partes.push(
      <mark key={i} className={h.nivel === "alto" ? "resalte-alto text-inherit" : "resalte-medio text-inherit"} title={h.titulo}>
        {texto.slice(h.inicio, h.fin)}
      </mark>,
    );
    cursor = h.fin;
  });
  partes.push(texto.slice(cursor));
  return (
    <details className="mt-3 rounded-lg border border-border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Ver las frases marcadas dentro de tu relato</summary>
      <p className="mt-2 whitespace-pre-wrap leading-7">{partes}</p>
    </details>
  );
}
