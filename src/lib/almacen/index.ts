/**
 * Almacén de denuncias. Dos implementaciones con la misma interfaz:
 *
 * - `directus`: el mismo backend que usa el prototipo del S5 (colección `sicode_denuncias`
 *   y archivos de Directus). Es el modo previsto para integrarse con el S5.
 * - `local`: archivos JSON en var/almacen. Sirve para probar sin Docker.
 *
 * Se elige con SICODE_ALMACEN=directus|local (por defecto, local).
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDirectus, createItem, readItems, rest, staticToken, updateItem } from "@directus/sdk";
import type { Denuncia } from "../tipos";

export interface Archivo {
  bytes: Uint8Array;
  tipo: string;
  nombre: string;
}

export interface Almacen {
  crear(d: Denuncia): Promise<void>;
  guardar(d: Denuncia): Promise<void>;
  porId(id: string): Promise<Denuncia | null>;
  porFolio(folio: string): Promise<Denuncia | null>;
  listar(): Promise<Denuncia[]>;
  guardarArchivo(id: string, a: Archivo): Promise<void>;
  leerArchivo(id: string): Promise<Archivo | null>;
}

/* ---------- Local ---------- */

class AlmacenLocal implements Almacen {
  private dir = path.join(process.env.SICODE_DIR_DATOS ?? path.join(process.cwd(), "var"), "almacen");
  private archivo = path.join(this.dir, "denuncias.json");
  private cola: Promise<unknown> = Promise.resolve();

  private async leer(): Promise<Denuncia[]> {
    if (!existsSync(this.archivo)) return [];
    return JSON.parse(await readFile(this.archivo, "utf8")) as Denuncia[];
  }

  /** Las escrituras van en fila y se reemplaza el archivo de forma atómica. */
  private mutar(f: (lista: Denuncia[]) => Denuncia[]): Promise<void> {
    const paso = this.cola.then(async () => {
      await mkdir(this.dir, { recursive: true });
      const temporal = this.archivo + ".tmp";
      await writeFile(temporal, JSON.stringify(f(await this.leer())));
      await rename(temporal, this.archivo);
    });
    this.cola = paso.catch(() => undefined);
    return paso;
  }

  crear(d: Denuncia) {
    return this.mutar((lista) => [...lista, d]);
  }
  guardar(d: Denuncia) {
    return this.mutar((lista) => lista.map((x) => (x.id === d.id ? d : x)));
  }
  async porId(id: string) {
    return (await this.leer()).find((d) => d.id === id) ?? null;
  }
  async porFolio(folio: string) {
    return (await this.leer()).find((d) => d.folio === folio) ?? null;
  }
  listar() {
    return this.leer();
  }
  async guardarArchivo(id: string, a: Archivo) {
    const dir = path.join(this.dir, "archivos");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, id), a.bytes);
    await writeFile(path.join(dir, id + ".json"), JSON.stringify({ tipo: a.tipo, nombre: a.nombre }));
  }
  async leerArchivo(id: string) {
    if (!/^[a-f0-9]{24}$/.test(id)) return null;
    const ruta = path.join(this.dir, "archivos", id);
    if (!existsSync(ruta)) return null;
    const meta = JSON.parse(await readFile(ruta + ".json", "utf8")) as { tipo: string; nombre: string };
    return { bytes: new Uint8Array(await readFile(ruta)), ...meta };
  }
}

/* ---------- Directus ---------- */

interface FilaDirectus {
  id: string;
  folio: string;
  status: string;
  fecha_recepcion: string;
  anonimo: boolean;
  prioridad: string | null;
  semaforo: string | null;
  datos: Denuncia;
}
interface FilaArchivo {
  id: string;
  nombre: string;
  tipo: string;
  contenido: string;
}
interface Esquema {
  sicode_denuncias: FilaDirectus[];
  sicode_archivos: FilaArchivo[];
}

class AlmacenDirectus implements Almacen {
  private cliente = createDirectus<Esquema>(process.env.DIRECTUS_URL ?? "http://localhost:8055")
    .with(staticToken(process.env.DIRECTUS_TOKEN ?? ""))
    .with(rest());

  /** Columnas propias para filtrar y ordenar en Directus; el documento completo va en `datos`. */
  private fila(d: Denuncia): FilaDirectus {
    return {
      id: d.id,
      folio: d.folio,
      status: d.status,
      fecha_recepcion: d.fechaRecepcion,
      anonimo: d.anonimo,
      prioridad: d.prioridad ?? null,
      semaforo: d.corroboracion?.semaforo.color ?? null,
      datos: d,
    };
  }

  async crear(d: Denuncia) {
    await this.cliente.request(createItem("sicode_denuncias", this.fila(d)));
  }
  async guardar(d: Denuncia) {
    await this.cliente.request(updateItem("sicode_denuncias", d.id, this.fila(d)));
  }
  private async uno(filtro: Record<string, unknown>): Promise<Denuncia | null> {
    const filas = await this.cliente.request(
      readItems("sicode_denuncias", { filter: filtro as never, fields: ["datos"], limit: 1 }),
    );
    return (filas[0]?.datos as Denuncia | undefined) ?? null;
  }
  porId(id: string) {
    return this.uno({ id: { _eq: id } });
  }
  porFolio(folio: string) {
    return this.uno({ folio: { _eq: folio } });
  }
  async listar() {
    const filas = await this.cliente.request(readItems("sicode_denuncias", { fields: ["datos"], limit: -1 }));
    return filas.map((f) => f.datos as Denuncia);
  }
  async guardarArchivo(id: string, a: Archivo) {
    await this.cliente.request(
      createItem("sicode_archivos", { id, nombre: a.nombre, tipo: a.tipo, contenido: Buffer.from(a.bytes).toString("base64") }),
    );
  }
  async leerArchivo(id: string) {
    const filas = await this.cliente.request(readItems("sicode_archivos", { filter: { id: { _eq: id } }, limit: 1 }));
    const f = filas[0];
    return f ? { bytes: new Uint8Array(Buffer.from(f.contenido, "base64")), tipo: f.tipo, nombre: f.nombre } : null;
  }
}

let instancia: Almacen | null = null;

export function almacen(): Almacen {
  instancia ??= process.env.SICODE_ALMACEN === "directus" ? new AlmacenDirectus() : new AlmacenLocal();
  return instancia;
}

/** Solo para pruebas. */
export function reiniciarAlmacen() {
  instancia = null;
}
