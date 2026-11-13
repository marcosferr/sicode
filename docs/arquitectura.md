# Arquitectura

## Estructura

```
config/criterio_semaforo.json    Criterio del semáforo, versionado
scripts/                         preparar, demo, ingesta de datos, Directus, prueba en vivo
src/app/                         Páginas y rutas (Next.js App Router)
  denunciar/  seguimiento/  datos-abiertos/  privacidad/  operador/
  api/denuncias  api/evidencias  api/seguimiento  api/altcha  api/abiertos  api/operador
src/components/                  Formulario, seguimiento, panel de autoridad, interfaz común
src/datos/municipios.json        Catálogo del INEGI
src/lib/
  texto.ts          Normalización y comparación de nombres
  catalogos.ts      Conductas, entidades y fundamentos legales
  esquema.ts        Validación compartida entre navegador y servidor
  seguridad.ts      Folio, clave, cifrado de contacto
  antibot.ts        Prueba de trabajo ALTCHA
  servicio.ts       Operaciones y reglas de confidencialidad
  almacen/          Directus o archivos locales, misma interfaz
  blindaje/         Limpieza de metadatos y aviso del relato (corren en el navegador)
  motor/            Extracción, corroboración y semáforo
  pdn/              Acceso a S1, S2, S3 y S6; fuentes de demostración
  abiertos/         Tablas agregadas protegidas
tests/                           Pruebas (Vitest)
```

## Flujo

```
Ciudadanía                          Servidor                          Autoridad
──────────                          ────────                          ─────────
relato ── aviso de riesgo (local)
archivo ─ limpieza (local) ───────► limpieza de nuevo, nombre genérico
envío + prueba de trabajo ────────► folio aleatorio, clave derivada,
                                    contacto cifrado, solo el día
◄──────── folio y clave (una vez)
                                    corroboración con S1, S2, S3, S6 ◄── bandeja por semáforo
                                    indicios, hipótesis, semáforo ─────► detalle
folio + clave ────────────────────► estatus y buzón ◄──────────────────── mensajes, turnado, cierre
                                    tablas agregadas protegidas ───────► datos abiertos
```

## Modelo de datos

Una denuncia es un documento (`Denuncia` en `src/lib/tipos.ts`). En Directus se guarda en la colección `sicode_denuncias`, con columnas propias para filtrar (`folio`, `status`, `fecha_recepcion`, `anonimo`, `prioridad`, `semaforo`) y el documento completo en `datos`. Las evidencias van en `sicode_archivos`. Ninguna colección tiene permisos públicos.

Campos sensibles y cómo se guardan:

| Campo | Tratamiento |
|---|---|
| `contactoCifrado` | AES-256-GCM; la llave está en `SICODE_LLAVE_CONTACTO` |
| `secretoHash` | scrypt con sal; la clave original no se guarda |
| `fechaRecepcion` | Solo día |
| `evidencias[].nombre` | Nombre genérico; el original no se guarda |
| `bitacora` | Cada acción de la autoridad, incluida la apertura del contacto |

La vista que recibe la autoridad (`vistaOperador`) excluye `contactoCifrado` y `secretoHash`.

## Integración con el S5

SICODE usa las mismas tecnologías que el prototipo para que sus piezas se puedan adoptar por separado:

- **Blindaje:** `src/lib/blindaje/` no depende de nada más. `limpiarArchivo` y `analizarRelato` se pueden llamar desde el formulario actual del S5.
- **Motor:** `corroborar(denuncia, fuentes)` recibe un objeto con relato, involucrados y lugar. Los nombres de campo siguen los del prototipo donde se conocen (`narracionHechos`, `anonimo`, `status` con `SIN_TURNAR`, `TURNADA`, `REGISTRADA`, `ATENDIDA`).
- **Datos abiertos:** `construirDatosAbiertos(denuncias)` solo necesita fecha, estado, entidad, conductas y modalidad.
- **Fuentes:** la interfaz `FuentesPDN` permite que, dentro de la PDN, las consultas al S1 y al S6 se hagan contra las bases internas en lugar de la API pública.

El código fuente del prototipo no es público, así que la integración directa no se pudo probar.

## Variables de entorno

| Variable | Uso |
|---|---|
| `SICODE_ALMACEN` | `local` o `directus` |
| `SICODE_PDN` | `demo` (registros ficticios) o `real` |
| `SICODE_LLAVE_CONTACTO` | Llave de 32 bytes en base64 para el contacto |
| `SICODE_SECRETO_ALTCHA` | Secreto de la prueba de trabajo |
| `SICODE_K_ANONIMATO` | Umbral de protección de datos abiertos (5) |
| `SICODE_S1` | `off` para no consultar declaraciones |
| `SICODE_DIR_DATOS` | Carpeta de índices, caché y almacén local (`var/`) |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Sesión de autoridades |
| `DIRECTUS_URL`, `DIRECTUS_TOKEN` | Conexión a Directus |
| `SICODE_OPERADOR_CORREO`, `SICODE_OPERADOR_CLAVE_HASH` | Operador de demostración en modo local |
