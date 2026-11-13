/** Validación de lo que entra por el formulario público. Se usa en el navegador y en el servidor. */
import { z } from "zod";
import { CONDUCTAS, ENTIDADES } from "./catalogos";

const texto = (max: number) => z.string().trim().max(max);

export const esquemaInvolucrado = z.object({
  tipo: z.enum(["SERVIDOR_PUBLICO", "EMPRESA", "PARTICULAR"]),
  nombre: texto(120).optional(),
  cargo: texto(120).optional(),
  institucion: texto(200).optional(),
  razonSocial: texto(200).optional(),
  rfc: texto(13)
    .regex(/^$|^[A-Za-zÑñ&]{3,4}\d{6}[A-Za-z0-9]{3}$/, "El RFC no tiene un formato válido.")
    .optional(),
});

export const esquemaInformeLimpieza = z.object({
  tipo: z.string().max(120),
  hallazgos: z.array(z.string().max(300)).max(40),
  advertencias: z.array(z.string().max(500)).max(10),
  limpiado: z.boolean(),
  bytesAntes: z.number().int().nonnegative(),
  bytesDespues: z.number().int().nonnegative(),
});

export const esquemaDenuncia = z
  .object({
    anonimo: z.boolean(),
    contacto: z
      .object({
        correo: z.string().trim().email("Escribe un correo válido.").max(200),
        nombre: texto(120).optional(),
        telefono: texto(30).optional(),
      })
      .optional(),
    narracionHechos: z
      .string()
      .trim()
      .min(40, "Cuéntanos un poco más: al menos 40 caracteres.")
      .max(8000, "El relato no puede pasar de 8,000 caracteres."),
    conductas: z.array(z.enum(CONDUCTAS.map((c) => c.clave) as [string, ...string[]])).max(6),
    fechaHecho: z
      .string()
      .regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/, "Usa el formato año-mes.")
      .optional(),
    lugar: z.object({
      entidad: z.enum(Object.keys(ENTIDADES) as [string, ...string[]]).optional(),
      municipio: texto(120).optional(),
      institucion: texto(200).optional(),
    }),
    involucrados: z.array(esquemaInvolucrado).max(8),
    referenciaContratacion: texto(300).optional(),
    evidencias: z
      .array(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), informe: esquemaInformeLimpieza }))
      .max(8),
    altcha: z.string().max(4000),
  })
  .refine((d) => d.anonimo || Boolean(d.contacto?.correo), {
    message: "Si decides dejar tus datos, necesitamos al menos un correo.",
    path: ["contacto", "correo"],
  });

export type EntradaDenuncia = z.infer<typeof esquemaDenuncia>;

export const LIMITE_ARCHIVO = 15 * 1024 * 1024;
