# Metodología de corroboración

## Idea

Una denuncia anónima suele perder fuerza porque no hay a quién preguntarle. SICODE invierte el problema: en lugar de pedir más datos a quien denuncia, busca en registros públicos lo que la denuncia afirma. Cada afirmación comprobable se convierte en una **hipótesis**, cada dato encontrado en un **indicio con su fuente**, y el conjunto en un **semáforo** que ordena la bandeja de la autoridad.

El método viene de la investigación con fuentes abiertas sobre contrataciones públicas: hipótesis redactadas en neutro, una forma de verificar cada una y la regla de que nada pasa a indicio sin un registro que lo respalde.

## Paso 1. Extracción

De la denuncia se toma solo lo que se puede cruzar (`src/lib/motor/extraccion.ts`):

- **Personas:** únicamente las que quien denuncia anotó en los campos estructurados. Del relato libre no se extraen nombres: el riesgo de inventar un señalado a partir de una frase es demasiado alto.
- **Empresas:** las anotadas, más las razones sociales con forma jurídica que aparezcan en el relato ("…, S.A. de C.V.").
- **RFC de personas morales**, validando la fecha embebida.
- **Entes públicos, montos y referencias de contratación.**

No interviene ningún modelo de lenguaje ni servicio externo. El texto de una denuncia no sale del servidor.

## Paso 2. Consultas

| Sistema de la PDN | Qué se busca | Vía | Tamaño |
|---|---|---|---|
| S3 Sancionados | Sanciones por faltas graves a la persona; sanciones a la empresa; antecedentes del ente | Copia local | 565 servidores, 34 particulares, 858 entes |
| S2 Servidores en contrataciones | Si la persona interviene en contrataciones, concesiones o enajenaciones, y con qué nivel de responsabilidad | Copia local | 64,633 registros únicos |
| S6 Contrataciones | Contratos adjudicados a la empresa, en especial con el ente señalado | API con caché | 1,060,983 procedimientos (2015–2021, federal) |
| S1 Declaraciones | Que la persona ocupa el cargo; intereses declarados en la empresa señalada | API con caché | 30 proveedores de datos |

Las copias locales se arman con `npm run datos`, que descarga los archivos oficiales, guarda su sha256 en `var/pdn/manifiesto.json` y descarta CURP, RFC de personas físicas, domicilios, correos y teléfonos.

Particularidades de las API que el código compensa:

- Distinguen acentos ("HERNÁNDEZ" no encuentra "HERNANDEZ"). Se normaliza antes de comparar y se prueban las dos escrituras.
- La búsqueda de proveedores del S6 devuelve registros que contengan cualquiera de las palabras. Se sondea cada palabra distintiva de la razón social y se usa la búsqueda más acotada.
- El S6 numera las páginas desde cero.
- El filtro por comprador no es fiable por sí solo. Se filtra en local.

## Paso 3. Coincidencias

`src/lib/texto.ts` normaliza (mayúsculas, sin acentos ni puntuación), separa la forma jurídica y compara.

- **Personas:** el primer apellido debe coincidir casi exacto, debe compartirse al menos un nombre de pila y, si ambos traen segundo apellido, también debe coincidir. Umbral de similitud: 0.88.
- **Empresas:** por RFC cuando lo hay; si no, por razón social sin forma jurídica. Umbral: 0.86.
- **Entes:** por similitud (0.72) o porque todas las palabras significativas del nombre corto están en el largo.

## Paso 4. Indicios y confiabilidad

Cada indicio lleva sujeto, descripción neutra, detalle con cifras, fuente con enlace para comprobarlo, y **otra lectura posible** del mismo dato.

| Nivel | Significado | Ejemplo |
|---|---|---|
| A | Registro oficial confirmado con identificador | Sanción a una empresa con el mismo RFC |
| B | Registro oficial; coinciden nombre y ente | Persona con ese nombre sancionada en ese mismo ente |
| C | Coincide solo el nombre | Persona con ese nombre sancionada en otro ente: puede ser un homónimo |
| D | Sin respaldo suficiente | No mueve el semáforo; genera una tarea de verificación |

El S2 y el S3 no publican un identificador de persona, así que una coincidencia de persona nunca pasa de B.

### Banderas de contratación

Sobre los contratos de la empresa con el ente señalado, inspiradas en la guía de banderas rojas de Open Contracting Partnership:

- Adjudicación directa en 80 % o más de al menos tres contratos.
- Procedimientos competitivos con un solo oferente.
- Licitaciones públicas con menos de 10 días para ofertar.
- Más de 60 % del monto con un solo comprador.
- Contratos con fecha posterior a una sanción registrada.

Cada bandera recuerda su explicación inocente. Por ejemplo, cerca del 83 % de los procedimientos del S6 son adjudicaciones directas (882,585 de 1,060,983).

## Paso 5. Semáforo

Definido en `config/criterio_semaforo.json`:

1. **Reglas duras.** Un hecho con confiabilidad A o B que active una de estas reglas lleva a rojo: empresa con inhabilitación vigente confirmada por RFC; persona con sanción grave en el mismo ente; contratos posteriores a una sanción, confirmados por RFC. Si el dato no alcanza A o B, la regla baja a posible alerta.
2. **Puntaje.** Suma de severidad de la categoría por confianza de la fuente (A = 1, B = 0.7, C = 0.4, D = 0).
3. **Umbrales.** Puntaje 0 es verde; desde 5 es rojo; lo demás es amarillo.

El resultado incluye qué lo cambiaría ("si I-3 se confirmara con un identificador, su aporte pasaría de 1.4 a 2") y las fuentes que no respondieron. La versión del criterio y su sha256 quedan registrados con cada corroboración.

**Qué significa cada color.** Verde: las fuentes consultadas no aportaron respaldo, lo que no implica que la denuncia sea falsa. Amarillo: respaldo parcial. Rojo: respaldo documental fuerte, se sugiere atención prioritaria. El semáforo ordena la atención; no califica a nadie.

## Reglas de prudencia

Están en el código, no solo aquí:

- Un indicio describe un dato. Nunca usa "culpable", "corrupto" ni "delito" para referirse a una persona.
- Coincidir en el nombre no identifica a nadie.
- Una fuente caída se anota como brecha y la hipótesis queda abierta. No se asume "sin resultados".
- Una relación contractual o un interés declarado no son irregularidades: son contexto.
- La clasificación jurídica es orientativa y la decide la autoridad.

## Clasificación orientativa

A partir de las conductas marcadas y de palabras del relato se sugieren fundamentos (`src/lib/catalogos.ts`): faltas graves de la Ley General de Responsabilidades Administrativas (arts. 52 a 63 Bis), faltas de particulares (arts. 66 a 70), faltas no graves (art. 49) y delitos del Código Penal Federal (arts. 217 a 224). Debe validarla el área jurídica.

## Evaluación

`npm test` corre casos sintéticos que fijan el comportamiento esperado: sin datos queda en verde y lo explica; una sanción en el mismo ente activa la regla dura; un homónimo en otro ente no pasa de posible alerta; una fuente caída deja la hipótesis abierta; ningún dato de quien denuncia aparece en el resultado.

## Límites

- Cobertura del S6: federal, 2015–2021.
- El S3 solo publica nombres en faltas graves.
- Un relato sin nombres, empresas ni ente no se puede corroborar: el semáforo queda en verde.
- Los umbrales son una propuesta inicial, sin calibrar con casos reales.
