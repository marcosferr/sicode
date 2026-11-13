# Datos abiertos del sistema de denuncias

El S5 puede generar información útil para la política anticorrupción: cuántas denuncias llegan, de qué tipo, dónde y cuánto tarda cada autoridad en atenderlas. El riesgo es que una cifra pequeña equivale a publicar la denuncia. SICODE publica las cifras y bloquea ese riesgo.

## Qué se publica

| Tabla | Contenido |
|---|---|
| `por_mes` | Denuncias recibidas por mes |
| `por_estado_tramite` | Denuncias por etapa del trámite |
| `por_entidad` | Denuncias por entidad federativa donde ocurrieron los hechos |
| `por_conducta` | Denuncias por tipo de conducta marcada |
| `por_modalidad` | Anónimas y con datos de contacto |
| `por_corroboracion` | Denuncias por nivel de respaldo en datos públicos |
| `tiempos_por_autoridad` | Mediana de días de atención por autoridad |

## Qué no se publica nunca

Relatos, nombres, folios, evidencias, municipios, entes denunciados, días exactos ni filas por denuncia.

## Cómo se protege

1. **Agregación.** El tiempo se publica por mes y el territorio por entidad federativa.
2. **Supresión.** Toda cifra mayor que cero y menor que K se publica sin valor. K es 5 por defecto (`SICODE_K_ANONIMATO`).
3. **Redondeo contra la resta.** Si alguna tabla tiene una cifra suprimida, todas las cifras de todas las tablas se redondean al múltiplo de K más cercano.
4. **Umbral por autoridad.** Los tiempos de atención solo se publican para autoridades con K o más denuncias cerradas.

### Por qué no basta con ocultar la cifra pequeña

Con 7 denuncias en una entidad y 2 en otra, ocultar el 2 y mostrar el total de 9 permite calcularlo: 9 − 7 = 2. Redondear solo el total tampoco alcanza, porque otra tabla sin cifras ocultas (por ejemplo, la de meses) suma el total exacto. Por eso el redondeo se aplica a todo el conjunto. Las pruebas `tests/abiertos.test.ts` cubren ambos casos.

## Formatos

- CSV por tabla: `/api/abiertos/<tabla>.csv` (UTF-8). Una celda vacía significa "protegido", no cero.
- JSON por tabla: `/api/abiertos/<tabla>.json`
- Conjunto completo: `/api/abiertos/todo.json`
- Descriptor [Frictionless Data Package](https://specs.frictionlessdata.io/data-package/): `/api/abiertos/datapackage.json`

Licencia de los datos: Creative Commons Atribución 4.0.

## Diccionario

| Columna | Tipo | Descripción |
|---|---|---|
| `mes` | texto | Año y mes de recepción (AAAA-MM) |
| `estado_tramite` | texto | Sin turnar, Turnada, Registrada, En proceso, Atendida o Improcedente |
| `entidad` | texto | Nombre de la entidad federativa según el INEGI |
| `conducta` | texto | Descripción en lenguaje llano de la conducta marcada |
| `modalidad` | texto | Anónima o Con datos de contacto |
| `nivel` | texto | Respaldo fuerte, parcial, sin respaldo o aún sin corroborar |
| `denuncias` | entero | Número de denuncias; vacío si está protegido |
| `nota` | texto | "menos de K" o "redondeado a múltiplos de K" |
| `autoridad` | texto | Autoridad que atendió |
| `denuncias_cerradas` | entero | Denuncias atendidas o declaradas improcedentes |
| `mediana_dias` | número | Mediana de días entre recepción y cierre |

## Límites

El umbral protege cada tabla y el conjunto contra la resta. No sustituye la revisión de quien publica: si en el futuro se agregan tablas cruzadas (por ejemplo, entidad por conducta), hay que volver a evaluar el riesgo.
