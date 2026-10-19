# Spec — `redactor`: redacción propia de secretos y PII para OpenCode 2.0

> **Fecha:** 2026-10-19
> **Tipo:** spec de diseño
> **Estado:** diseño aprobado por el usuario · pendiente de plan e implementación
> **Proyecto:** pack `agentes` (`D:\open`)

---

## 1. Contexto y objetivo

### Problema

`opencode-vibeguard` era el plugin que debía impedir que secretos y datos
personales llegaran al modelo. Está **roto por versión**:

- depende de la **API V1** (`@opencode-ai/plugin`), y OpenCode 2.0 **no ejecuta
  implementaciones V1** (error observado en log:
  `Plugin must export a default definition with an id and an effect or setup function`)
- solo tiene **una versión** (0.1.0, publicada 2026-02-28) → **no hay versión
  compatible**, está abandonado
- además estaba **desactivado** (`"enabled": false` en `vibeguard.config.json`),
  así que en la práctica no protegía nada

Se evaluaron sustitutos de terceros (`@kkchengg/opencode-redact`,
`@bandonker/opencode-secret-shield`, `opencode-env-protect`,
`opencode-secret-redactor`, `opencode-redact`, `@renjfk/opencode-secret-tools`).
Ninguno cubre a la vez **secretos y PII** con la confianza requerida: unos son
V1, otros tienen autoría de baja adopción sin auditar, y el más limpio
(`opencode-redact`) **no cubre PII**.

### Decisión

**Construir nuestro propio plugin**, en la misma línea que `hookify.ts`, que ya
está portado a V2, auditado y verificado funcionando. Cero código de terceros,
alcance exacto al que pide el usuario, y control total sobre reglas y exclusiones.

### Objetivo

Un plugin V2 que:

1. **oculte** secretos y PII en todo lo que viaja hacia el modelo,
2. **devuelva** los valores reales justo antes de que corra una herramienta, para
   que nada se rompa,
3. funcione en **silencio** dejando **bitácora**,
4. sea **fail-safe**: ante la duda, ocultar o bloquear — nunca filtrar.

---

## 2. Arquitectura

### 2.1 Separación respecto a `hookify`

Dos plugins independientes, cada uno con un propósito:

| Plugin | Responsabilidad | Estado |
|---|---|---|
| `.opencode/plugins/hookify.ts` | Bloquea **escribir** en ficheros de secretos · audita comandos destructivos | ✅ portado a V2 y verificado |
| `.opencode/plugins/redactor/` | Oculta lo que **viaja hacia el modelo** y lo devuelve a las herramientas | 🆕 este spec |

Se separan porque son fines distintos (escritura de ficheros vs. contenido de la
conversación) y porque un único fichero quedaría demasiado grande.

### 2.2 Estructura de ficheros

OpenCode carga `.opencode/plugins/<nombre>/index.ts` (documentado en la guía
oficial de plugins). El instalador copia `.opencode/plugins` entero, por lo que
**no requiere cambios en `init-opencode.js`**.

```
.opencode/plugins/redactor/
├── index.ts     Plugin.define({ id: "redactor" }) y registro de hooks
├── rules.ts     reglas de secretos, reglas de PII, exclusiones
├── engine.ts    escanear, ocultar, mapa en memoria, rehidratar
├── config.ts    lee redactor.config.json solo si existe (opcional)
└── log.ts       .opencode/logs/redact.log
```

### 2.3 Unidades y sus fronteras

| Unidad | Pregunta que responde | Depende de |
|---|---|---|
| `rules.ts` | ¿qué se busca? | nada |
| `engine.ts` | ¿cómo se oculta y se devuelve? | `rules.ts` |
| `config.ts` | ¿qué cambia este proyecto? | nada |
| `log.ts` | ¿cómo se deja constancia? | nada |
| `index.ts` | ¿dónde se conecta con OpenCode? | todo lo anterior |

`engine.ts` es **puro**: entrada de texto, salida de texto. No toca OpenCode ni
el sistema de ficheros, de modo que se prueba con node a secas.

---

## 3. Flujo de datos

### 3.1 Mecanismo elegido

Se **redacta por mensaje**, no por HTTP, usando los *model request hooks*:

```ts
await ctx.session.hook("context",     (event) => { /* event.system, event.messages */ })
await ctx.session.hook("compaction",  (event) => { /* messages = transcript resumido */ })
await ctx.session.hook("generate",    (event) => { /* llamadas transitorias */ })
await ctx.session.hook("title",       (event) => { /* generación de título */ })
await ctx.tool.hook("execute.before", (event) => { /* rehidratación */ })
```

**Por qué no `http.request`:** el cuerpo es un *stream* de un solo uso y su
formato difiere por proveedor (Anthropic ≠ OpenAI ≠ Gemini). Aplicar regex sobre
JSON de protocolo es frágil y se rompe en silencio si el proveedor cambia. Los
*mensajes* son texto legible y estables.

**Regla oficial aplicada:** *«un hook que debe valer para toda petición tiene que
registrarse en cada tipo»* → se registran los **4** tipos de sesión.

**Garantía oficial aprovechada:** *«los cambios afectan solo a la llamada saliente;
no al historial guardado ni a la configuración»*. El historial local queda intacto;
solo se maquilla lo que viaja.

### 3.2 Recorrido completo

Con una clave OpenAI presente en la conversación:

```
1. SALIDA     redactor recorre event.system + event.messages
              sk-...  →  [REDACTED:openai-key:0f3a1c9d]
              valor real → mapa en memoria
              ✔ el modelo nunca ve la clave

2. MODELO     devuelve un comando que incluye 0f3a1c9d

3. LLEGADA    se disparan LOS DOS plugins en tool.execute.before:

   redactor   [REDACTED:openai-key:0f3a1c9d]  →  sk-...   ✔ el comando funciona
   hookify    ¿escribe en .env?  → bloquea
              ¿es rm -rf /?      → lo anota en destructive.log
```

### 3.3 Convivencia con `hookify`

- Comparten el gancho `tool.execute.before` pero vigilan cosas distintas:
  `redactor` mira **qué valores** viajan, `hookify` mira **qué hace** el agente.
- **El orden no afecta al resultado**: rehidratar un valor no cambia que un
  camino sea `.env`, así que `hookify` lo bloquea igual.
- Ambos escriben en `.opencode/logs/`, en ficheros distintos.

### 3.4 Corrección en código existente

`hookify.ts` escribe el comando crudo en `destructive.log`. Un comando como
`git push https://token@github.com --force` **dejaría el token en el fichero**.

**Cambio:** pasar el texto por el motor del redactor **antes** de escribirlo en
`destructive.log`. Si el redactor no está disponible, se degrada a escribir tal
cual (no se rompe el log por falta del otro plugin).

---

## 4. Qué se oculta

### 4.1 Marcador

Formato: `[REDACTED:<tipo>:<8 hex>]`

- **estable**: el mismo dato produce siempre el mismo marcador → el modelo ve
  consistencia, puede comparar UUIDs o claves entre turnos, y el mapa encuentra
  el valor a la primera.

### 4.2 Secretos — siempre activos

| Categoría | Ejemplo |
|---|---|
| AWS | `AKIA…`, `ASIA…` |
| OpenAI | `sk-…`, `sk-proj-…` |
| Anthropic | `sk-ant-…` |
| GitHub | `ghp_…`, `gho_…`, `github_pat_…` |
| GitLab | `glpat-…` |
| Stripe | `sk_live_…`, `rk_live_…`, `sk_test_…` |
| npm | `npm_…` |
| PyPI | `pypi-…` |
| Slack | `xox…` |
| JWT | `eyJ….eyJ….…` |
| Claves privadas | bloque completo `-----BEGIN … PRIVATE KEY-----` … `-----END …` |
| Credenciales genéricas | `password=`, `passwd=`, `secret:`, `api_key=`, `token=` con valor |

### 4.3 PII — siempre activos

- correos electrónicos
- IPv4 **fuera de rangos privados y reservados** (lista exhaustiva en 4.4)
- direcciones MAC
- **UUID** *(incluido a petición del usuario; se había propuesto excluirlos por
  ruido, y la decisión final fue mantenerlos como el vibeguard original)*

### 4.4 Exclusiones — no se toca

**Red de host** (cualquier IP de estas listas **nunca** se redacta):

- `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`
- privados: `10.x.x.x`, `172.16.0.0 – 172.31.255.255`, `192.168.x.x`,
  `fc00::/7`, `fe80::/10`
- reservados: `169.254.x.x` (enlace local, incluye `169.254.169.254`),
  `100.64.0.0/10`, `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`,
  `224.0.0.0/4` (multidifusión), `240.0.0.0/4`, `255.255.255.255`

**Dominios y direcciones**:

- `example.com`, `example.org`, `example.net`, `*.test`, `*.local`
- correos cuyo dominio esté en la lista anterior
- correos cuyo *local-part* sea exactamente `noreply`, `no-reply` o
  `notifications` (sea cual sea el dominio)

### 4.5 Configuración opcional

`redactor.config.json` — **nunca obligatorio**. Si no existe, manda lo base.

Permite:

- añadir reglas propias
- añadir exclusiones
- apagar una categoría entera

Si el fichero está corrupto o ilegible: una línea en `redact.log` y se siguen
las reglas base. La sesión no se rompe.

---

## 5. Manejo de errores

**Principio: fail-safe.** Ante la duda, ocultar o bloquear. Nunca dejar pasar
un secreto.

| Fallo | Comportamiento |
|---|---|
| No existe `redactor.config.json` | Normal → reglas base (es el diseño, no un error) |
| Config corrupta o ilegible | Aviso en `redact.log` → reglas base. La sesión no se rompe |
| Mapa perdido (reinicio) y la herramienta necesita un secreto | **Bloquear** con mensaje: el secreto ya no está disponible; volver a proporcionarlo |
| Llega un marcador ausente del mapa | **Bloquear** — nunca se ejecuta un marcador como si fuese valor |
| Desbordamiento del mapa | Tope **4096** entradas, FIFO: se caen las más viejas → si se piden después, caen en el caso anterior y **se bloquean** |
| Fallo al escribir la bitácora | `try/catch` vacío (mismo criterio que `hookify`): un log nunca rompe una sesión |
| Falsa alarma | Se corrige añadiendo una exclusión en la config; sin tocar código |
| El plugin no llega a cargar | OpenCode lo anuncia en su log; la sesión continúa sin esa capa. Se detecta con `opencode plugin list` |

---

## 6. Verificación

### Nivel ① — motor puro (sin OpenCode)

Pruebas con node sobre `engine.ts`, ya que no toca OpenCode:

- cada regla dispara sobre su caso de prueba
- cada regla **no** dispara sobre negativos: `localhost`, `127.0.0.1`,
  `192.168.1.5`, `example.com`, `noreply@`
- **propiedad de ida y vuelta:** `rehidratar(ocultar(x)) === x` para todo lo
  ocultado. Si falla, los comandos se rompen
- estabilidad: mismo dato → mismo marcador
- el mapa respeta el tope de 4096 y descarta las más viejas primero

### Nivel ② — sobre OpenCode real

- `opencode plugin list` muestra `redactor` **sin avisos**
- sesión real con un secreto inventado en el prompt → se escribe `redact.log` y
  **la respuesta no contiene el secreto**, solo el marcador
- con el mapa vacío → la herramienta **queda bloqueada** con el mensaje previsto
- un UUID aparece oculto y con marcador estable

### Nivel ③ — regresión de `hookify`

- `hookify` sigue funcionando tras la corrección: `destructive.log` se sigue
  escribiendo, **pero ya sin secretos dentro**

### Criterio de éxito

🔴 **No se aprueba** si el modelo ve un secreto, si un comando se rompe por el
marcador, o si algo se filtra en un log.

🟢 **Se aprueba** solo si los tres niveles dan verde.

---

## 7. Alcance y no-alcance

### En alcance

- plugin `redactor/` con los cinco ficheros descritos
- corrección de `hookify.ts` para sanitizar `destructive.log`
- pruebas de los tres niveles

### Fuera de alcance (YAGNI)

- sustituir o retirar `opencode-vibeguard` de `opencode.json` — decisión aparte
- protección de PII en el **historial guardado** (solo se maquilla lo saliente)
- modo «observación» sin redactar
- persistir el mapa en disco
- sustituir `opencode-pty` (tema aparte, pendiente de decisión)
- LSP: **no interviene** — la config de Dart está limpia y no es origen de fallos

---

## 8. Decisiones registradas

| # | Decisión |
|---|---|
| 1 | Construir plugin propio en vez de adoptar un sustituto de terceros |
| 2 | Mecanismo: **model request hooks** (por mensaje), no `http.request` |
| 3 | Severidad: **seguro por defecto** con exclusiones de desarrollo |
| 4 | Reglas: **base + config opcional** |
| 5 | Mapa en **memoria**; si falta → **bloquear** (no persistir en disco) |
| 6 | **Silencioso + bitácora** en `.opencode/logs/redact.log` |
| 7 | Separado de `hookify`, en directorio con módulos |
| 8 | Incluir **UUID** en PII |
| 9 | Corregir `hookify` para que no deposite secretos en `destructive.log` |

---

## 9. Riesgos conocidos

1. **Ruido por UUID**: aparecerán en IDs de base de datos y sesiones. Se mitiga
   con marcador estable (comparaciones siguen funcionando) y rehidratación
   (los comandos se ejecutan con el valor real). Si resulta molesto, se apaga
   por config sin tocar código.
2. **Reinicio a mitad de sesión**: el mapa se pierde y las herramientas que
   necesiten un secreto quedan bloqueadas hasta que se vuelva a proporcionar.
   Es el comportamiento elegido.
3. **Proveedores que cambien el formato de `event.messages`**: riesgo bajo, es
   una superficie estable frente al cuerpo HTTP de protocolo.
