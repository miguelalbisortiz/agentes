---
description: "Valida la salud del pack completo. Detecta frontmatter invalido, agents duplicados, commands huerfanos, skills sin descripcion, permalinks rotos, archivos >800 lineas."
agent: build
---

# Pack Doctor Command

Diagnosticar la salud del pack: $ARGUMENTS

## Tu Task

Ejecutar checks de salud sobre `.opencode/` y reportar PASS/WARN/FAIL.

### Checks obligatorios

#### 1. Frontmatter de agents
- Cada `agents/*.md` debe tener frontmatter valido con: `description`, `mode`.
- Si `mode: subagent`, no requiere name explicito (se infiere del archivo).
- Si `mode: primary` o `all`, requiere `description` clara.

```bash
for f in .opencode/agents/*.md; do
  case "$(basename "$f")" in INDEX.md) continue ;; esac
  head -n 5 "$f" | grep -q "^---$" || echo "FAIL: $f no tiene frontmatter"
done
```

#### 2. Frontmatter de skills
- Cada `skills/*/SKILL.md` debe tener: `name`, `description`.
- `description` 1-1024 chars.
- `description` empieza con "Use when" (o similar tercera persona).

#### 3. Frontmatter de commands
- Cada `commands/*.md` debe tener frontmatter con: `description`, `agent`.
- El `agent` referenciado debe existir (built-in de opencode o archivo en `agents/`). Verificamos en check 5.

#### 4. Agents duplicados
- No debe haber 2+ agents con el mismo `description` (mismo rol).

```bash
grep -h "^description:" .opencode/agents/*.md | sort | uniq -c | sort -rn | head
```

#### 5. Commands huerfanos
- Cada `agent:` en un command debe corresponder a un agent existente.
- **Built-ins de opencode** (whitelist): `build`, `plan`, `general`, `explore`, `compaction`, `title`. Verificar lista con `opencode debug v2` si hay duda.
- Resto: archivo en `agents/`.

```bash
BUILTINS="build plan general explore compaction title"
for cmd in .opencode/commands/*.md; do
  agent=$(grep "^agent:" "$cmd" | awk -F': *' '{print $2}' | head -1)
  [ -z "$agent" ] && continue
  [ -f ".opencode/agents/${agent}.md" ] && continue
  echo " $BUILTINS " | grep -q " $agent " && continue
  echo "WARN: $cmd referencia agent inexistente: $agent"
done
```

#### 6. Permalinks rotos
- Cualquier path en `.opencode/INSTRUCTIONS.md`, `.opencode/AGENTS.md`, o `*.md` del pack que apunte a archivo inexistente.
- **Excluir** paths con placeholders (`{name}`, `{slug}`, `YYYY-MM-DD`, `HHMM`, etc).

```bash
grep -rohE '`[^`]+\.(md|ts|js|json|jsonc|yml|yaml)`' .opencode/commands/ .opencode/agents/ .agents/skills/ .opencode/AGENTS.md 2>/dev/null | tr -d '`' | sort -u | while read p; do
  # Skip templates placeholders
  case "$p" in
    *"{name}"*|*"YYYY-MM-DD"*|*"HHMM"*|*"${ARGUMENTS}"*|*"YYYY"*|*"HHMM"*|*{slug}*) continue ;;
  esac
  [ ! -e "$p" ] && echo "WARN: path posiblemente roto: $p"
done
```

#### 7. Tamanio de archivos
- Agents y skills no deben superar 800 lineas (regla del proyecto).
- Commands no deben superar 400 lineas (son prompts).

```bash
find .opencode/agents .agents/skills -name "*.md" -exec wc -l {} \; | awk '$1 > 800 {print "WARN:", $2, $1, "lineas"}'
```

#### 8. Stats del pack
- Contar: agents, skills, commands, PRDs, reports, audits.

```bash
echo "Agents: $(ls .opencode/agents/*.md | wc -l)"
echo "Skills: $(ls -d .agents/skills/*/ 2>/dev/null | wc -l)"
echo "Commands: $(ls .opencode/commands/*.md | wc -l)"
echo "PRDs: $(ls docs/prds/*.md 2>/dev/null | wc -l)"
echo "Reports: $(ls docs/reports/*.md 2>/dev/null | grep -v INDEX | wc -l)"
echo "Audits: $(ls docs/audits/*.md 2>/dev/null | wc -l)"
```

#### 9. PRDs y reports huerfanos
- PRDs en `DRAFT` mas de 7 dias sin movimiento.
- Reports con `## Auditoria` y veredicto FAIL mas de 14 dias sin accion.

```bash
find docs/prds -name "*.md" -mtime +7 -exec grep -l "Status.*DRAFT" {} \;
```

#### 10. Junctions
- `.opencode/agent` y `.opencode/skill` deben existir como junctions (opencode 1.17.x compat).

```bash
[ ! -L .opencode/agent ] && echo "FAIL: junction .opencode/agent no existe"
[ ! -L .opencode/skill ] && echo "FAIL: junction .opencode/skill no existe"
```

### Salida

```
=== Pack Doctor ===

[1/10] Frontmatter agents    PASS
[2/10] Frontmatter skills    PASS
[3/10] Frontmatter commands  PASS
[4/10] Agents duplicados     PASS
[5/10] Commands huerfanos    PASS
[6/10] Permalinks rotos      WARN: 2 paths posiblemente rotos
[7/10] Tamanio archivos      PASS
[8/10] Stats                 3 PRDs, 7 reports, 0 audits
[9/10] PRDs huerfanos        WARN: 1 PRD en DRAFT >7d (ex006-csv-import)
[10/10] Junctions            PASS

Total: 8 PASS, 2 WARN, 0 FAIL

Accion recomendada:
- Resolver 2 permalinks rotos
- Cerrar o archivar 1 PRD en DRAFT >7d

Ejecutar `/pack-doctor --fix` para auto-resolver (con confirmacion por cambio).
```

### Flags

- `--fix`: auto-resuelve lo que se puede (re-genera INDEX, mueve PRDs viejos, etc). Pide confirmacion por cambio.
- `--json`: salida en JSON para CI.
- `--quiet`: solo muestra FAILs y resumen.

## Cuando correr

- Despues de agregar un nuevo agent o command.
- Antes de un release del pack.
- Si un flow se comporta raro (sospecha de config rota).
- En CI (con `--json`).
