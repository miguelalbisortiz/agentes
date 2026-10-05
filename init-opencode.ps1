<#
.SYNOPSIS
    Inicializa un proyecto nuevo con el pack de opencode COMPLETO.
.DESCRIPTION
    Copia todos los agents, commands y skills del pack, mas plugins,
    scripts, templates, configuracion MCPs y estructura de docs.
.PARAMETER ProjectPath
    Ruta del proyecto destino. Si no se especifica, usa el directorio actual.
.PARAMETER PackPath
    Ruta del pack base. Si se omite, se usa la carpeta del propio script,
    asi funciona en cualquier maquina donde se clone el repositorio.
.PARAMETER Force
    Mantenido por compatibilidad. El instalador no hace ninguna pregunta y
    sobreescribe siempre, asi que este interruptor no cambia el comportamiento.
.PARAMETER SkipInstall
    Omite la instalación de plugins npm.
.PARAMETER SkipDocs
    Omite la creación de carpetas de docs.
.PARAMETER Stack
    Stack a asumir: flutter, node, python, rust, go, java, csharp, cpp, php, swift, kotlin.
    Si se omite, se detecta automaticamente mirando pubspec.yaml / package.json / etc.
.PARAMETER AllAgents
    Copia TODOS los agentes sin filtrar por stack (biblioteca completa).
.EXAMPLE
    .\init-opencode.ps1 -ProjectPath "C:\mi-proyecto"
    .\init-opencode.ps1 -ProjectPath "C:\mi-proyecto" -Force
    .\init-opencode.ps1 -ProjectPath "C:\mi-proyecto" -SkipInstall
    .\init-opencode.ps1 -ProjectPath "C:\mi-proyecto" -Stack flutter
    .\init-opencode.ps1 -ProjectPath "C:\mi-proyecto" -AllAgents
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectPath,
    
    [Parameter(Mandatory=$false)]
    [string]$PackPath,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipInstall,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipDocs,

    [Parameter(Mandatory=$false)]
    [ValidateSet("","flutter","node","python","rust","go","java","csharp","cpp","php","swift","kotlin")]
    [string]$Stack = "",

    [Parameter(Mandatory=$false)]
    [switch]$AllAgents
)

# Si no se especifica ruta, usar directorio actual
if (-not $ProjectPath) {
    $ProjectPath = (Get-Location).Path
}

# Si no se especifica el origen del pack, usar la carpeta del propio script.
# Estaba hardcodeado a D:\open, lo que impedia instalar el pack en cualquier
# otra maquina que lo clonara desde GitHub.
if (-not $PackPath) {
    if ($PSScriptRoot) { $PackPath = $PSScriptRoot }
    else               { $PackPath = Split-Path -Parent $MyInvocation.MyCommand.Path }
}

# Verificar que el pack existe
if (-not (Test-Path $PackPath)) {
    Write-Host "[ERROR] No se encontro el pack en: $PackPath" -ForegroundColor Red
    exit 1
}

# Verificar que lo que hay en esa ruta es realmente el pack
if (-not (Test-Path (Join-Path $PackPath ".opencode"))) {
    Write-Host "[ERROR] No se encontro el pack en: $PackPath" -ForegroundColor Red
    Write-Host "        (la ruta existe pero no contiene .opencode/)" -ForegroundColor Red
    Write-Host "        Indica el origen con: -PackPath <ruta del pack>" -ForegroundColor Yellow
    exit 1
}

# Verificar que el proyecto destino existe
if (-not (Test-Path $ProjectPath)) {
    Write-Host "[INFO] Creando directorio del proyecto: $ProjectPath" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
}

# ============================================================
# DETECCION DE STACK + FILTRO DE AGENTES
# ============================================================
# El pack maestro conserva TODOS los agentes. Aqui se decide con
# cuantos arranca el proyecto: el nucleo spec-driven es identico para
# todos, solo se descartan los reviewers/resolvers de otros lenguajes.

function Detect-Stack {
    param([string]$Path)
    if (Test-Path (Join-Path $Path "pubspec.yaml"))                { return "flutter" }
    if (Test-Path (Join-Path $Path "pyproject.toml"))              { return "python" }
    if (Test-Path (Join-Path $Path "requirements.txt"))            { return "python" }
    if (Test-Path (Join-Path $Path "setup.py"))                    { return "python" }
    if (Test-Path (Join-Path $Path "Cargo.toml"))                  { return "rust" }
    if (Test-Path (Join-Path $Path "go.mod"))                      { return "go" }
    if (Test-Path (Join-Path $Path "*.csproj"))                    { return "csharp" }
    if (Test-Path (Join-Path $Path "pom.xml"))                     { return "java" }
    if (Test-Path (Join-Path $Path "build.gradle"))                { return "kotlin" }
    if (Test-Path (Join-Path $Path "composer.json"))               { return "php" }
    if (Test-Path (Join-Path $Path "Package.swift"))               { return "swift" }
    if (Test-Path (Join-Path $Path "package.json"))                { return "node" }
    return ""
}

# Pool de agentes SOLO ligados a un lenguaje (los demas son multi-stack
# o de proceso y se copian siempre: prd-agent, planner, report-auditor,
# security-reviewer, code-reviewer, tdd-guide, doc-updater, etc.)
$StackAgents = @(
    "angular-build-resolver","angular-reviewer",
    "cpp-build-resolver","cpp-reviewer",
    "csharp-reviewer",
    "dart-build-resolver","flutter-reviewer",
    "django-build-resolver","fastapi-reviewer","pytorch-build-resolver","python-reviewer",
    "go-build-resolver","go-reviewer",
    "harmonyos-app-resolver",
    "java-build-resolver","java-reviewer",
    "kotlin-build-resolver","kotlin-reviewer",
    "php-reviewer",
    "react-build-resolver","react-reviewer","svelte-reviewer","typescript-reviewer","vue-reviewer",
    "rust-build-resolver","rust-reviewer",
    "swift-build-resolver","swift-reviewer"
)

# Que agentes de lenguaje SE CONSERVA por stack
$StackKeep = @{
    flutter = @("dart-build-resolver","flutter-reviewer")
    node    = @("angular-build-resolver","angular-reviewer","react-build-resolver","react-reviewer",
                "svelte-reviewer","typescript-reviewer","vue-reviewer")
    python  = @("django-build-resolver","fastapi-reviewer","pytorch-build-resolver","python-reviewer")
    rust    = @("rust-build-resolver","rust-reviewer")
    go      = @("go-build-resolver","go-reviewer")
    java    = @("java-build-resolver","java-reviewer")
    kotlin  = @("kotlin-build-resolver","kotlin-reviewer","harmonyos-app-resolver")
    csharp  = @("csharp-reviewer")
    cpp     = @("cpp-build-resolver","cpp-reviewer")
    php     = @("php-reviewer")
    swift   = @("swift-build-resolver","swift-reviewer")
}

# --- Skills filtrados por stack ---
# Solo 3 de 40 skills son estrictamente del ecosistema JS/TS: se descartan en
# cualquier stack que no sea node. Los demas se copian SIEMPRE porque son
# multi-stack (docker, github-actions) o estan referenciados por agentes:
#   devops-deploy.md -> vercel-deploy / railway-deploy
#   supabase-patterns y firebase-patterns sirven tambien a Flutter/mobile
# Descartar el skill obliga a podar su fila en router/SKILL.md, o el router
# despacharia a algo inexistente (lo hace el instalador tras copiar .agents/).
$JsOnlySkills = @("drizzle-patterns", "turso-libsql", "clerk-auth")
$StackSkills = @{
    flutter = $JsOnlySkills
    python  = $JsOnlySkills
    rust    = $JsOnlySkills
    go      = $JsOnlySkills
    java    = $JsOnlySkills
    kotlin  = $JsOnlySkills
    csharp  = $JsOnlySkills
    cpp     = $JsOnlySkills
    php     = $JsOnlySkills
    swift   = $JsOnlySkills
    node    = @()   # el ecosistema JS es exactamente donde encajan
}

if ($AllAgents) {
    $DetectedStack = "all"
    $AgentsToDrop = @()
    $SkillsToDrop = @()
    Write-Host "[INFO] -AllAgents: se copian todos los agentes (sin filtro de stack)." -ForegroundColor Yellow
} else {
    if (-not $Stack) { $Stack = Detect-Stack -Path $ProjectPath }
    $DetectedStack = if ($Stack) { $Stack } else { "unknown" }

    if ($Stack -and $StackKeep.ContainsKey($Stack)) {
        $keep  = $StackKeep[$Stack]
        $AgentsToDrop = @($StackAgents | Where-Object { $keep -notcontains $_ })
    } else {
        # Stack desconocido -> conservar todo antes que filtrar de mas
        $AgentsToDrop = @()
    }

    # Skills: mismo criterio conservador. Stack desconocido o node -> todo.
    if ($Stack -and $StackSkills.ContainsKey($Stack)) {
        $SkillsToDrop = @($StackSkills[$Stack])
    } else {
        $SkillsToDrop = @()
    }

    if ($AgentsToDrop.Count -gt 0) {
        Write-Host "[STACK] Detectado: $DetectedStack  ·  agentes de lenguaje que NO aplican: $($AgentsToDrop.Count)" -ForegroundColor Cyan
        Write-Host "        (nucleo spec-driven completo: prd, plan, tasks, verify, audit, trace, security, testing)" -ForegroundColor DarkGray
    } elseif ($DetectedStack -eq "unknown") {
        Write-Host "[STACK] No detecte stack en el proyecto -> copio todos los agentes." -ForegroundColor Yellow
        Write-Host "        Usa -Stack flutter para filtrar, o -AllAgents para forzar la biblioteca completa." -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   PACK OPENCODE COMPLETO - INSTALADOR" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pack origen:      $PackPath" -ForegroundColor Gray
Write-Host "Proyecto destino: $ProjectPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Contenido del pack:" -ForegroundColor Yellow
$pkAgents   = (Get-ChildItem (Join-Path $PackPath ".opencode\agents\*.md") -ErrorAction SilentlyContinue).Count
$pkCommands = (Get-ChildItem (Join-Path $PackPath ".opencode\commands\*.md") -ErrorAction SilentlyContinue).Count
$pkSkills   = (Get-ChildItem (Join-Path $PackPath ".agents\skills") -Directory -ErrorAction SilentlyContinue).Count
$pkMcpCfg   = Join-Path $PackPath "opencode.json"
$pkMcpNames = @()
if (Test-Path $pkMcpCfg) { try { $pkMcpNames = @((Get-Content $pkMcpCfg -Raw | ConvertFrom-Json).mcp.PSObject.Properties.Name) } catch {} }
$pkMcpLine  = if ($pkMcpNames.Count) { "$($pkMcpNames.Count) MCPs ($($pkMcpNames -join ', '))" } else { "MCPs: sin configurar" }
Write-Host "  - $pkAgents agents especializados" -ForegroundColor White
Write-Host "  - $pkCommands slash commands" -ForegroundColor White
Write-Host "  - $pkSkills skills" -ForegroundColor White
Write-Host "  - $pkMcpLine" -ForegroundColor White
Write-Host "  - 16+ CLI scripts" -ForegroundColor White
Write-Host "  - Plugins (vibeguard, pty, dcp)" -ForegroundColor White
Write-Host "  - Manual completo" -ForegroundColor White
if ($AgentsToDrop.Count -gt 0) {
    Write-Host "  - Filtro de stack '$DetectedStack': $($AgentsToDrop.Count) agentes de lenguaje NO se copian" -ForegroundColor DarkCyan
} elseif ($AllAgents) {
    Write-Host "  - Sin filtro: se copian todos los agentes (-AllAgents)" -ForegroundColor DarkCyan
}
Write-Host ""

# Funcion para copiar con conteo
function Copy-ItemSafe {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Description,
        [switch]$IsFile
    )
    
    if (-not (Test-Path $Source)) {
        Write-Host "  [SKIP] $Description" -ForegroundColor Yellow
        $script:skipped++
        return
    }
    
    try {
        if ($IsFile) {
            $destDir = Split-Path $Destination -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -Path $Source -Destination $Destination -Force -ErrorAction Stop
        }
        else {
            # NUNCA copiar la carpeta completa contra un destino ya existente:
            #   Copy-Item D:\pack\.opencode  D:\proj\.opencode -Recurse
            # crea D:\proj\.opencode\.opencode  (y .agents/.agents/). El destino
            # existe siempre en una actualizacion, asi que el bug se disparaba
            # en cada re-instalacion. Se copian los HIJOS contra el padre.
            if (-not (Test-Path $Destination)) {
                New-Item -ItemType Directory -Path $Destination -Force | Out-Null
            }
            foreach ($child in (Get-ChildItem -LiteralPath $Source -Force)) {
                # -Force sin condicion: hace falta para arrastrar ocultos
                # (p.ej. .opencode/.gitignore) y para sobreescribir.
                Copy-Item -LiteralPath $child.FullName -Destination $Destination -Recurse -Force -ErrorAction Stop
            }
        }
        Write-Host "  [OK] $Description" -ForegroundColor Green
        $script:copied++
    }
    catch {
        Write-Host "  [ERROR] $Description - $($_.Exception.Message)" -ForegroundColor Red
        $script:errors++
    }
}

# --- Fusion conservadora de archivos raiz ---
# Regla: el proyecto MANDA. Solo se añaden del pack las entradas que faltan.
# Nunca se pisa lo que el proyecto ya tenia (perderia .env, build/, MCPs propios...).
function Merge-Gitignore {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path $Source)) { $script:skipped++; return }
    if (-not (Test-Path $Destination)) {
        Copy-ItemSafe -Source $Source -Destination $Destination -Description ".gitignore" -IsFile
        return
    }
    try {
        $dest = @(Get-Content $Destination -ErrorAction Stop)
        $pack = @(Get-Content $Source -ErrorAction Stop)
        $missing = @($pack | Where-Object { $_.Trim().Length -gt 0 -and ($dest -cnotcontains $_) })
        if ($missing.Count -eq 0) {
            Write-Host "  [OK] .gitignore (sin cambios: $($dest.Count) entradas propias ya cubren el pack)" -ForegroundColor Green
            $script:copied++
            return
        }
        Add-Content -Path $Destination -Value "" -Encoding UTF8
        Add-Content -Path $Destination -Value $missing -Encoding UTF8
        Write-Host "  [OK] .gitignore (fusionado: +$($missing.Count) del pack, $($dest.Count) propias conservadas)" -ForegroundColor Green
        $script:copied++
    } catch {
        Write-Host "  [ERROR] .gitignore - $($_.Exception.Message)" -ForegroundColor Red
        $script:errors++
    }
}

function Merge-JsonConservative {
    param([string]$Source, [string]$Destination, [string]$Description)
    if (-not (Test-Path $Source)) { $script:skipped++; return }
    if (-not (Test-Path $Destination)) {
        Copy-ItemSafe -Source $Source -Destination $Destination -Description $Description -IsFile
        return
    }
    try {
        $dstRaw = Get-Content $Destination -Raw -ErrorAction Stop
        $srcRaw = Get-Content $Source -Raw -ErrorAction Stop
        $dst = $dstRaw | ConvertFrom-Json -ErrorAction Stop
        $src = $srcRaw | ConvertFrom-Json -ErrorAction Stop
        $changed = $false
        foreach ($p in $src.PSObject.Properties) {
            if (-not $dst.PSObject.Properties[$p.Name]) {
                $dst | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value
                $changed = $true
                continue
            }
            # Objetos anidados que crecen por claves: mcp / skills / plugin
            if ($p.Value -is [System.Management.Automation.PSCustomObject] -and
                $dst.$($p.Name) -is [System.Management.Automation.PSCustomObject]) {
                foreach ($k in $p.Value.PSObject.Properties) {
                    if (-not $dst.$($p.Name).PSObject.Properties[$k.Name]) {
                        $dst.$($p.Name) | Add-Member -NotePropertyName $k.Name -NotePropertyValue $k.Value
                        $changed = $true
                    }
                }
            }
        }
        if (-not $changed) {
            Write-Host "  [OK] $Description (sin cambios: lo del proyecto ya lo cubre)" -ForegroundColor Green
            $script:copied++
            return
        }
        $newJson = $dst | ConvertTo-Json -Depth 32
        # Comprobacion de integridad antes de escribir
        $null = $newJson | ConvertFrom-Json
        Set-Content -Path $Destination -Value $newJson -Encoding UTF8
        Write-Host "  [OK] $Description (fusionado conservador: solo claves nuevas del pack)" -ForegroundColor Green
        $script:copied++
    } catch {
        # Si algo no parsea, no toco el archivo del proyecto
        Write-Host "  [WARN] $Description ilegible -> se conserva el del proyecto (no se sobreescribe)" -ForegroundColor Yellow
        $script:skipped++
    }
}

# Contadores
$script:copied = 0
$script:skipped = 0
$script:errors = 0

# ============================================================
# FASE 1: ARCHIVOS RAIZ
# ============================================================
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[1/7] Archivos raiz..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

# Fusion conservadora: el proyecto manda, el pack solo aporta lo que falta.
Merge-JsonConservative -Source (Join-Path $PackPath "opencode.json") -Destination (Join-Path $ProjectPath "opencode.json") -Description "opencode.json (MCP activo: context7; el resto, opt-in)"
Merge-JsonConservative -Source (Join-Path $PackPath "skills-lock.json") -Destination (Join-Path $ProjectPath "skills-lock.json") -Description "skills-lock.json"
Merge-Gitignore -Source (Join-Path $PackPath ".gitignore") -Destination (Join-Path $ProjectPath ".gitignore")

# ============================================================
# FASE 2: .opencode/ COMPLETO
# ============================================================
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[2/7] Carpeta .opencode/ completa..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

Copy-ItemSafe -Source (Join-Path $PackPath ".opencode") -Destination (Join-Path $ProjectPath ".opencode") -Description ".opencode/ (agents, commands, plugins, bin, manual, templates, etc.)"

# --- Filtro de agentes por stack (solo si corresponde) ---
if ($AgentsToDrop.Count -gt 0) {
    $agentsDir = Join-Path $ProjectPath ".opencode\agents"
    $dropped = 0
    foreach ($name in $AgentsToDrop) {
        $f = Join-Path $agentsDir "$name.md"
        if (Test-Path $f) {
            Remove-Item $f -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $f)) { $dropped++ }
        }
    }
    $remaining = (Get-ChildItem (Join-Path $ProjectPath ".opencode\agents\*.md") -ErrorAction SilentlyContinue).Count
    Write-Host "  [OK] Agentes: $remaining en el proyecto ($dropped descartados por stack '$DetectedStack')" -ForegroundColor Green
} else {
    $remaining = (Get-ChildItem (Join-Path $ProjectPath ".opencode\agents\*.md") -ErrorAction SilentlyContinue).Count
    Write-Host "  [OK] Agentes: $remaining en el proyecto (sin filtro)" -ForegroundColor Green
}

# --- Marcador de stack instalado ---
# Lo lee smoke-test.js para exigir el umbral de agents correcto:
# filtrado por stack (~50) vs pack maestro (~85).
$stackMarkerFile = Join-Path $ProjectPath ".opencode\.stack"
if ($AgentsToDrop.Count -gt 0) {
    Set-Content -Path $stackMarkerFile -Value $DetectedStack -NoNewline -Encoding ascii
} elseif (Test-Path $stackMarkerFile) {
    Remove-Item $stackMarkerFile -Force -ErrorAction SilentlyContinue
}

# --- Poda de comandos huerfanos ---
# Un comando cuyo frontmatter `agent:` apunta a un agente que se filtro por stack
# quedaria roto: OpenCode no encontraria el agente. Se descarta junto con el.
# `build` es un agente built-in de OpenCode (no es un archivo .md): no aplica.
if ($AgentsToDrop.Count -gt 0) {
    $cmdsDir = Join-Path $ProjectPath ".opencode\commands"
    $droppedCmds = 0
    foreach ($f in (Get-ChildItem (Join-Path $cmdsDir "*.md") -ErrorAction SilentlyContinue)) {
        $hit = Select-String -Path $f.FullName -Pattern '^\s*agent:\s*(\S+)' -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $hit) { continue }
        $cmdAgent = $hit.Matches[0].Groups[1].Value
        if ($cmdAgent -eq "build") { continue }
        if ($AgentsToDrop -contains $cmdAgent) {
            Remove-Item $f.FullName -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $f.FullName)) { $droppedCmds++ }
        }
    }
    if ($droppedCmds -gt 0) {
        Write-Host "  [OK] Commands: $droppedCmds descartados (su agent se filtro por stack)" -ForegroundColor Green
    }
}

# ============================================================
# FASE 3: .agents/ (SKILLS)
# ============================================================
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[3/7] Carpeta .agents/ (40 skills)..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

Copy-ItemSafe -Source (Join-Path $PackPath ".agents") -Destination (Join-Path $ProjectPath ".agents") -Description ".agents/ (40 skills incluyendo: stripe, clerk, supabase, firebase, docker, github-actions, vercel, railway, turso, drizzle)"

# --- Poda de skills que no aplican al stack ---
# 1) se borra la carpeta del skill
# 2) se borra su fila en router/SKILL.md (si no, el router despacha a algo
#    inexistente). Se reescriben bytes para respetar el BOM del original:
#    meter/quitar el BOM haria fallar el parser de frontmatter.
if ($SkillsToDrop.Count -gt 0) {
    $skillsDir = Join-Path $ProjectPath ".agents\skills"
    $droppedSkills = 0
    foreach ($s in $SkillsToDrop) {
        $dir = Join-Path $skillsDir $s
        if (Test-Path $dir) {
            Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $dir)) { $droppedSkills++ }
        }
    }

    if ($droppedSkills -gt 0) {
        $routerSkill = Join-Path $skillsDir "router\SKILL.md"
        if (Test-Path $routerSkill) {
            $bytes = [System.IO.File]::ReadAllBytes($routerSkill)
            $hadBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
            $raw = [System.Text.Encoding]::UTF8.GetString($bytes)
            if ($hadBom) { $raw = $raw.Substring(1) }
            foreach ($s in $SkillsToDrop) {
                # solo filas cuyo destino es ese skill (entre backticks)
                $raw = [regex]::Replace($raw, '(?m)^[^\r\n]*`' + [regex]::Escape($s) + '`[^\r\n]*(\r?\n|$)', '')
            }
            [System.IO.File]::WriteAllText($routerSkill, $raw, (New-Object System.Text.UTF8Encoding($hadBom)))
        }
        Write-Host "  [OK] Skills: $droppedSkills descartados por stack (JS/TS): $($SkillsToDrop -join ', ')" -ForegroundColor Green
    }
}

# --- Auto-limpieza de anidados ---
# El bug anterior (`Copy-Item <dir> -Dest <dir existente> -Recurse`) dejo
# `.opencode/.opencode/` (~360 archivos) y `.agents/.agents/` en proyectos ya
# instalados. El pack nunca contiene esas rutas, asi que siempre son restos:
# un `git status` limpio no los escondia y solo los crecian en cada corrida.
foreach ($nested in @(".opencode\.opencode", ".agents\.agents")) {
    $junk = Join-Path $ProjectPath $nested
    if (Test-Path $junk) {
        $n = @(Get-ChildItem $junk -Recurse -File -Force -ErrorAction SilentlyContinue).Count
        Remove-Item $junk -Recurse -Force -ErrorAction SilentlyContinue
        if (-not (Test-Path $junk)) {
            Write-Host "  [OK] Limpieza: $nested eliminado ($n archivos residuales del bug de copia)" -ForegroundColor Green
        }
    }
}

# --- Refresca los bloques ## Counts del proyecto instalado ---
# Los README se copian del pack ya con los numeros del MAESTRO (85/71/40).
# Sin regenerarlos, un proyecto filtrado diria "85 agents" cuando tiene 59.
# counts.js --update solo toca los archivos que traen marcadores en su propia
# linea, asi que un README sin bloque queda intacto.
$countsScript = Join-Path $ProjectPath ".opencode\bin\counts.js"
$countTargets = @(
    (Join-Path $ProjectPath ".opencode\README.md"),
    (Join-Path $ProjectPath ".opencode\manual\README.md")
) | Where-Object { $_ -and (Test-Path $_) }
if ((Test-Path $countsScript) -and $countTargets -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Push-Location $ProjectPath
    try {
        & node $countsScript --update @countTargets 6>&1 | Out-Null
        Write-Host "  [OK] Conteos (## Counts) regenerados para este proyecto" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] No pude regenerar los conteos: $($_.Exception.Message.Split("`n")[0])" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# --- Regenera los indices generados ---
# AGENTS_INDEX.md y .agents/skills/INDEX.md los escanean en disco: su pie
# `**Total**: N agents` es un numero real, no una cita. Copiados desde el
# pack traerian el total del MAESTRO y mentirian en un proyecto filtrado.
$indexBuilders = @(
    (Join-Path $ProjectPath ".opencode\bin\build-agents-index.js"),
    (Join-Path $ProjectPath ".opencode\bin\build-skills-index.js")
) | Where-Object { $_ -and (Test-Path $_) }
if ($indexBuilders -and (Get-Command node -ErrorAction SilentlyContinue)) {
    Push-Location $ProjectPath
    try {
        foreach ($b in $indexBuilders) { & node $b 6>&1 | Out-Null }
        Write-Host "  [OK] Indices regenerados (AGENTS_INDEX, skills/INDEX)" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] No pude regenerar los indices: $($_.Exception.Message.Split("`n")[0])" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# --- Junctions de compatibilidad (opencode 1.17.x) ---
# Se crean DESPUES de copiar .agents/ porque .opencode/skill apunta ahi.
# No se trackean en git (ver .gitignore): indexarlos hace que `git add -A`
# traverse el junction y duplice todo el arbol de agents/skills.
function Ensure-Junction {
    param([string]$LinkPath, [string]$TargetPath)
    if (-not (Test-Path $TargetPath)) { return $false }
    $item = Get-Item $LinkPath -Force -ErrorAction SilentlyContinue
    if ($item -and $item.LinkType) { return $true }          # ya es junction/symlink
    if (Test-Path $LinkPath) { Remove-Item $LinkPath -Recurse -Force -ErrorAction SilentlyContinue }
    try {
        New-Item -ItemType Junction -Path $LinkPath -Target $TargetPath -ErrorAction Stop | Out-Null
        return $true
    } catch {
        Write-Host "  [WARN] No pude crear junction $LinkPath -> $($_.Exception.Message.Split("`n")[0])" -ForegroundColor Yellow
        return $false
    }
}
$okAgent = Ensure-Junction -LinkPath (Join-Path $ProjectPath ".opencode\agent") -TargetPath (Join-Path $ProjectPath ".opencode\agents")
$okSkill = Ensure-Junction -LinkPath (Join-Path $ProjectPath ".opencode\skill") -TargetPath (Join-Path $ProjectPath ".agents\skills")
Write-Host "  [$(if($okAgent -and $okSkill){'OK'}else{'WARN'})] Junctions compat 1.17.x: agent=$(if($okAgent){'ok'}else{'no'}) skill=$(if($okSkill){'ok'}else{'no'})" -ForegroundColor $(if($okAgent -and $okSkill){'Green'}else{'Yellow'})

# ============================================================
# FASE 4: ESTRUCTURA DOCS
# ============================================================
if (-not $SkipDocs) {
    Write-Host ""
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[4/7] Estructura docs/..." -ForegroundColor Yellow
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
    
    $docFolders = @(
        "docs",
        "docs\audits",
        "docs\instincts",
        "docs\plans",
        "docs\prds",
        "docs\reports",
        "docs\sessions",
        "docs\state"
    )
    
    foreach ($folder in $docFolders) {
        $source = Join-Path $PackPath $folder
        $dest = Join-Path $ProjectPath $folder
        
        if (-not (Test-Path $dest)) {
            try {
                New-Item -ItemType Directory -Path $dest -Force | Out-Null
                Write-Host "  [OK] $folder/" -ForegroundColor Green
                $script:copied++
            }
            catch {
                Write-Host "  [ERROR] $folder/ - $($_.Exception.Message)" -ForegroundColor Red
                $script:errors++
            }
        }
        else {
            Write-Host "  [SKIP] $folder/ (ya existe)" -ForegroundColor Yellow
            $script:skipped++
        }
    }
    
    # Copiar archivos .gitkeep si existen
    $gitkeepSource = Join-Path $PackPath "docs"
    $gitkeeps = Get-ChildItem -Path $gitkeepSource -Filter ".gitkeep" -Recurse -File -ErrorAction SilentlyContinue
    foreach ($gk in $gitkeeps) {
        $relativePath = $gk.FullName.Replace($gitkeepSource, "").TrimStart("\")
        $destGk = Join-Path (Join-Path $ProjectPath "docs") $relativePath
        $destDir = Split-Path $destGk -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        if (-not (Test-Path $destGk)) {
            Copy-Item -Path $gk.FullName -Destination $destGk -Force
        }
    }
}
else {
    Write-Host ""
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[4/7] Estructura docs/ (OMITIDO)" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
}

# ============================================================
# FASE 5: DOCUMENTACION DEL PACK
# ============================================================
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[5/7] Documentacion del pack..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

# Copiar README.md del pack si el destino no tiene uno
$readmeDest = Join-Path $ProjectPath "README.md"
if (-not (Test-Path $readmeDest)) {
    Copy-ItemSafe -Source (Join-Path $PackPath "docs\README.md") -Destination $readmeDest -Description "README.md" -IsFile
}
else {
    Write-Host "  [SKIP] README.md (ya existe en destino)" -ForegroundColor Yellow
    $script:skipped++
}

# Copiar PROJECT.md si existe.
# Se copia SIN el bloque "## Recent Activity": ese historial es del pack, no del
# proyecto de destino, y sus enlaces apuntan a docs/plans|audits|sessions, que no
# se instalan. Sin este recorte, el PROJECT.md de toda instalacion arranca con
# enlaces muertos que project-init nunca llega a corregir (no se ejecuta aqui).
# project-init --refresh lo rellena despues con los ficheros reales del proyecto.
$projectSrc = Join-Path $PackPath "docs\PROJECT.md"
$projectDest = Join-Path $ProjectPath "docs\PROJECT.md"
Copy-ItemSafe -Source $projectSrc -Destination $projectDest -Description "docs/PROJECT.md" -IsFile
if (Test-Path $projectDest) {
    try {
        $raw = [System.IO.File]::ReadAllText($projectDest)
        $marker = '## Recent Activity'
        $idx = $raw.IndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase)
        if ($idx -ge 0) {
            $head = $raw.Substring(0, $idx).TrimEnd(' ', "`r", "`n")
            $clean = $head + "`r`n`r`n" + $marker + "`r`n" +
                     "<!-- auto-managed: appended by project-init.js. Do not edit by hand. -->`r`n`r`n" +
                     "<!-- (no activity detected yet) -->`r`n"
            # UTF-8 SIN BOM: Set-Content/Out-File -Encoding utf8 lo aniade en PS5.1
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($projectDest, $clean, $utf8NoBom)
        }
    }
    catch {
        Write-Host "  [WARN] no se pudo recortar PROJECT.md: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ============================================================
# FASE 6: INSTALAR DEPENDENCIAS NPM
# ============================================================
if (-not $SkipInstall) {
    Write-Host ""
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[6/7] Instalando plugins npm..." -ForegroundColor Yellow
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
    
    $opencodeDir = Join-Path $ProjectPath ".opencode"
    $packageJson = Join-Path $opencodeDir "package.json"
    
    if (Test-Path $packageJson) {
        Push-Location $opencodeDir
        try {
            Write-Host "  Ejecutando npm install..." -ForegroundColor Gray
            npm install --silent 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Plugins instalados correctamente" -ForegroundColor Green
                $script:copied++
            }
            else {
                Write-Host "  [WARN] npm termino con codigo: $LASTEXITCODE" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "  [ERROR] Fallo npm install: $($_.Exception.Message)" -ForegroundColor Red
            $script:errors++
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Host "  [SKIP] package.json no encontrado" -ForegroundColor Yellow
        $script:skipped++
    }
}
else {
    Write-Host ""
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "[6/7] Instalacion npm (OMITIDA)" -ForegroundColor Yellow
    Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
}

# ============================================================
# FASE 7: VERIFICACION FINAL
# ============================================================
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[7/7] Verificacion final..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

# El minimo de agentes depende de si se filtro por stack:
#  - sin filtro  -> se esperan los ~84 del pack maestro
#  - con filtro  -> se esperan los del nucleo + el stack detectado (~56-75)
$agentsMin = if ($AgentsToDrop.Count -gt 0) { 50 } else { 80 }

$checks = @(
    @{ Path = ".opencode\agents"; Name = "Agents"; MinCount = $agentsMin },
    @{ Path = ".opencode\commands"; Name = "Commands"; MinCount = 60 },
    @{ Path = ".agents\skills"; Name = "Skills"; MinCount = 35; CountDir = $true },
    @{ Path = ".opencode\plugins"; Name = "Plugins"; MinCount = 1 },
    @{ Path = ".opencode\bin"; Name = "CLI Scripts"; MinCount = 10 },
    @{ Path = ".opencode\manual"; Name = "Manual"; MinCount = 5 },
    @{ Path = ".opencode\templates"; Name = "Templates"; MinCount = 1 },
    @{ Path = "opencode.json"; Name = "Config (MCPs)"; MinCount = 1 }
)

$allGood = $true
foreach ($check in $checks) {
    $fullPath = Join-Path $ProjectPath $check.Path
    if (Test-Path $fullPath) {
        # Skills se cuentan por carpeta: -Recurse -File incluye los assets de
        # cada skill y pinta un numero mayor que el de skills reales.
        if ($check.CountDir) {
            $count = (Get-ChildItem -Path $fullPath -Directory -ErrorAction SilentlyContinue).Count
        } else {
            $count = (Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue).Count
        }
        $icon = if ($count -ge $check.MinCount) { "[OK]" } else { "[WARN]" }
        $color = if ($count -ge $check.MinCount) { "Green" } else { "Yellow" }
        Write-Host "  $icon $($check.Name): $count archivos (min: $($check.MinCount))" -ForegroundColor $color
        if ($count -lt $check.MinCount) { $allGood = $false }
    }
    else {
        Write-Host "  [FAIL] $($check.Name): No encontrado" -ForegroundColor Red
        $allGood = $false
    }
}

# Verificar MCPs en opencode.json
$mcpConfig = Join-Path $ProjectPath "opencode.json"
if (Test-Path $mcpConfig) {
    $config = Get-Content $mcpConfig -Raw | ConvertFrom-Json
    $mcpCount = ($config.mcp | Get-Member -MemberType NoteProperty).Count
    $mcpList = (@($config.mcp | Get-Member -MemberType NoteProperty) | ForEach-Object { $_.Name }) -join ', '
    Write-Host "  [OK] MCPs configurados: $mcpCount ($mcpList)" -ForegroundColor Green
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   RESUMEN" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Copiados:  $($script:copied) elementos" -ForegroundColor Green
Write-Host "  Omitidos:  $($script:skipped) elementos" -ForegroundColor Yellow
Write-Host "  Errores:   $($script:errors) elementos" -ForegroundColor Red
Write-Host ""

if ($allGood -and $script:errors -eq 0) {
    $finAgents   = (Get-ChildItem (Join-Path $ProjectPath ".opencode\agents\*.md") -ErrorAction SilentlyContinue).Count
    $finCommands = (Get-ChildItem (Join-Path $ProjectPath ".opencode\commands\*.md") -ErrorAction SilentlyContinue).Count
    $finSkills   = (Get-ChildItem (Join-Path $ProjectPath ".agents\skills") -Directory -ErrorAction SilentlyContinue).Count
    $finMcpCount = 0; $finMcpNames = @()
    if (Test-Path $mcpConfig) { try { $cfg = Get-Content $mcpConfig -Raw | ConvertFrom-Json; $finMcpNames = @($cfg.mcp.PSObject.Properties.Name); $finMcpCount = $finMcpNames.Count } catch {} }

    Write-Host "  [EXITO] Pack instalado correctamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Contenido instalado:" -ForegroundColor Cyan
    Write-Host "    - $finAgents agents $(if ($AgentsToDrop.Count -gt 0) { "(filtrados por stack '$DetectedStack'; $($AgentsToDrop.Count) de lenguaje descartados)" } else { "(biblioteca completa)" })" -ForegroundColor White
    Write-Host "    - $finCommands slash commands" -ForegroundColor White
    Write-Host "    - $finSkills skills (stripe, clerk, supabase, docker, vercel, etc.)" -ForegroundColor White
    Write-Host "    - $finMcpCount MCPs$(if ($finMcpNames.Count) { ' (' + ($finMcpNames -join ', ') + ')' })" -ForegroundColor White
    Write-Host "    - CLI scripts de validacion y utilidades" -ForegroundColor White
    Write-Host "    - Plugins (vibeguard, pty, dcp)" -ForegroundColor White
    Write-Host "    - Manual completo" -ForegroundColor White
    Write-Host "    - Templates y estructura docs" -ForegroundColor White
    Write-Host ""
    Write-Host "  Ciclo Spec-Driven disponible desde el minuto 1:" -ForegroundColor Cyan
    Write-Host "    /prd -> /spec-lint -> /plan -> /tasks -> /verify -> /audit-report -> /trace" -ForegroundColor DarkCyan
    Write-Host "    (+ /change-request cuando el requisito cambie a mitad de ciclo)" -ForegroundColor DarkCyan
    Write-Host ""
    Write-Host "  Siguiente paso:" -ForegroundColor Cyan
    Write-Host "    cd $ProjectPath" -ForegroundColor White
    Write-Host "    opencode ." -ForegroundColor White
    Write-Host ""
    Write-Host "  Ejemplos de uso:" -ForegroundColor Cyan
    Write-Host '    "Crea una app SaaS con login y pagos"' -ForegroundColor White
    Write-Host '    "Deploy a Vercel"' -ForegroundColor White
    Write-Host '    "Crea app móvil con React Native"' -ForegroundColor White
}
else {
    Write-Host "  [AVISO] Instalacion completada con advertencias" -ForegroundColor Yellow
    Write-Host "  Revisa los errores arriba" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
