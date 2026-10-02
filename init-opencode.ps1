<#
.SYNOPSIS
    Inicializa un proyecto nuevo con el pack de opencode COMPLETO.
.DESCRIPTION
    Copia TODOS los agents (83), commands (68), skills (40), plugins, 
    scripts, templates, configuración MCPs y estructura de docs.
.PARAMETER ProjectPath
    Ruta del proyecto destino. Si no se especifica, usa el directorio actual.
.PARAMETER PackPath
    Ruta del pack base. Default: D:\open
.PARAMETER Force
    Sobreescribe archivos existentes sin preguntar.
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
    [string]$PackPath = "D:\open",
    
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

# Verificar que el pack existe
if (-not (Test-Path $PackPath)) {
    Write-Host "[ERROR] No se encontro el pack en: $PackPath" -ForegroundColor Red
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

if ($AllAgents) {
    $DetectedStack = "all"
    $AgentsToDrop = @()
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
            Copy-Item -Path $Source -Destination $Destination -Recurse -Force:$Force -ErrorAction Stop
        }
        Write-Host "  [OK] $Description" -ForegroundColor Green
        $script:copied++
    }
    catch {
        Write-Host "  [ERROR] $Description - $($_.Exception.Message)" -ForegroundColor Red
        $script:errors++
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

Copy-ItemSafe -Source (Join-Path $PackPath "opencode.json") -Destination (Join-Path $ProjectPath "opencode.json") -Description "opencode.json (MCPs: context7, supabase, vercel, stripe)" -IsFile
Copy-ItemSafe -Source (Join-Path $PackPath "skills-lock.json") -Destination (Join-Path $ProjectPath "skills-lock.json") -Description "skills-lock.json" -IsFile
Copy-ItemSafe -Source (Join-Path $PackPath ".gitignore") -Destination (Join-Path $ProjectPath ".gitignore") -Description ".gitignore" -IsFile

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

# ============================================================
# FASE 3: .agents/ (SKILLS)
# ============================================================
Write-Host ""
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray
Write-Host "[3/7] Carpeta .agents/ (40 skills)..." -ForegroundColor Yellow
Write-Host "----------------------------------------------------" -ForegroundColor DarkGray

Copy-ItemSafe -Source (Join-Path $PackPath ".agents") -Destination (Join-Path $ProjectPath ".agents") -Description ".agents/ (40 skills incluyendo: stripe, clerk, supabase, firebase, docker, github-actions, vercel, railway, turso, drizzle)"

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

# Copiar PROJECT.md si existe
Copy-ItemSafe -Source (Join-Path $PackPath "docs\PROJECT.md") -Destination (Join-Path $ProjectPath "docs\PROJECT.md") -Description "docs/PROJECT.md" -IsFile

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
    @{ Path = ".agents\skills"; Name = "Skills"; MinCount = 35 },
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
        $count = (Get-ChildItem -Path $fullPath -Recurse -File -ErrorAction SilentlyContinue).Count
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
    Write-Host "    - 16+ CLI scripts" -ForegroundColor White
    Write-Host "    - Plugins (vibeguard, pty, dcp)" -ForegroundColor White
    Write-Host "    - Manual completo" -ForegroundColor White
    Write-Host "    - Templates y estructura docs" -ForegroundColor White
    Write-Host ""
    Write-Host "  Ciclo Spec-Driven disponible desde el minuto 1:" -ForegroundColor Cyan
    Write-Host "    /prd -> /spec-lint -> /plan -> /tasks -> /verify -> /eval -> /audit-report -> /trace" -ForegroundColor DarkCyan
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
