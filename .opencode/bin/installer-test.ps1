<#
  installer-test.ps1 - verifica que init-opencode.ps1 no rompa nada

  Cubre los riesgos reales detectados en el pack:
    T1  instalacion limpia desde cero (stack filtrado) -> smoke-test + 0 huerfanos
        + skills podados y router de skills podado en consecuencia
    T2  fusion conservadora -> NO achaquera .gitignore ni opencode.json del proyecto
    T3  idempotencia -> la 2a corrida no cambia nada ni duplica
    T4  -AllAgents -> biblioteca completa, sin marcador .stack
    T5  PackPath invalido -> falla limpio sin instalar a medias
    T6  stack node -> NO descarta los skills JS/TS (se aplican ahi)
    T7  scaffolders -> generan frontmatter valido y refrescan ## Counts

  Uso:
    powershell -ExecutionPolicy Bypass -File .opencode/bin/installer-test.ps1

  Exit codes:
    0 = todo OK
    1 = al menos un fallo
#>

param(
    [string]$WorkDir = (Join-Path $env:LOCALAPPDATA 'opencode\installer-test')
)

$ErrorActionPreference = 'Stop'
$pack = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$init = Join-Path $pack 'init-opencode.ps1'
$script:pass = 0
$script:fail = 0

function Ok($msg)   { Write-Host "  PASS  $msg" -ForegroundColor Green;  $script:pass++ }
function Bad($msg)  { Write-Host "  FAIL  $msg" -ForegroundColor Red;    $script:fail++ }
function Head($msg) { Write-Host ''; Write-Host "=== $msg ===" -ForegroundColor Yellow }

function New-Project([string]$Path, [string]$Marker = 'pubspec.yaml') {
    if (Test-Path $Path) { Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    # El marker va ANTES de init: asi Detect-Stack ve el stack real
    if ($Marker) { Set-Content -Path (Join-Path $Path $Marker) -Value 'name: x' }
    return $Path
}

function Run-Init([string]$Path, [switch]$AllAgents) {
    # $LASTEXITCODE solo lo fija un comando nativo o un `exit`; se limpia antes
    # para que un valor viejo no se atribuya a init.
    $global:LASTEXITCODE = 0
    if ($AllAgents) {
        & $init -ProjectPath $Path -SkipInstall -SkipDocs -Force -AllAgents 6>&1 | Out-Null
    } else {
        & $init -ProjectPath $Path -SkipInstall -SkipDocs -Force 6>&1 | Out-Null
    }
    if ($LASTEXITCODE -ne 0) { throw "init devolvio exit $LASTEXITCODE" }
}

function Get-Orphans([string]$Path) {
    $agents = @(Get-ChildItem (Join-Path $Path '.opencode\agents\*.md') -ErrorAction SilentlyContinue |
                ForEach-Object { $_.BaseName })
    $bad = @()
    foreach ($f in @(Get-ChildItem (Join-Path $Path '.opencode\commands\*.md') -ErrorAction SilentlyContinue)) {
        $raw = [System.IO.File]::ReadAllText($f.FullName)
        $m = [regex]::Match($raw, '(?ms)^---\r?\n([\s\S]*?)\r?\n---')
        if (-not $m.Success) { continue }
        $a = [regex]::Match($m.Groups[1].Value, '(?m)^\s*agent:\s*(\S+)')
        if (-not $a.Success) { continue }
        $name = $a.Groups[1].Value.Trim()
        if ($name -eq 'build') { continue }
        if ($agents -notcontains $name) { $bad += "$($f.BaseName) -> $name" }
    }
    return $bad
}

function Test-Smoke([string]$Path) {
    Push-Location $Path
    try { return (node .opencode\bin\smoke-test.js 2>&1 | Select-String 'SMOKE TEST PASSED').Count -gt 0 }
    finally { Pop-Location }
}

function Test-Counts([string]$Path) {
    # counts.js --check solo es util si valida algo: exige que los bloques
    # ## Counts del proyecto coincidan con lo que realmente hay en disco.
    Push-Location $Path
    try { node .opencode\bin\counts.js --check 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) }
    finally { Pop-Location }
}

function Get-Nesting([string]$Path) {
    # Restos del bug de `Copy-Item <dir> -Dest <dir existente>`.
    return @('.opencode\.opencode', '.agents\.agents') | Where-Object {
        Test-Path (Join-Path $Path $_)
    }
}

if (-not (Test-Path $init)) { Write-Host "  FAIL  init-opencode.ps1 no encontrado: $init" -ForegroundColor Red; exit 1 }
Write-Host "Pack: $pack" -ForegroundColor DarkGray
Write-Host "Work: $WorkDir" -ForegroundColor DarkGray

# ---------------------------------------------------------------- T1
Head 'T1 - instalacion limpia con filtro de stack'
try {
    $t1 = New-Project (Join-Path $WorkDir 't1-flutter')
    Run-Init $t1
    $ag = @(Get-ChildItem (Join-Path $t1 '.opencode\agents\*.md')).Count
    $cm = @(Get-ChildItem (Join-Path $t1 '.opencode\commands\*.md')).Count
    if ($ag -gt 0 -and $ag -lt 85) { Ok "agents filtrados: $ag (pack completo=85)" } else { Bad "agents=$ag, se esperaba un conteo filtrado" }
    if ($cm -gt 0) { Ok "commands: $cm" } else { Bad 'no hay commands' }
    $or = Get-Orphans $t1
    if ($or.Count -eq 0) { Ok '0 comandos huerfanos' } else { Bad ("huerfanos: " + ($or -join ', ')) }
    if (Test-Path (Join-Path $t1 '.opencode\.stack')) { Ok "marcador .stack = $(Get-Content (Join-Path $t1 '.opencode\.stack'))" } else { Bad 'falta .opencode/.stack' }
    $sk = @(Get-ChildItem (Join-Path $t1 '.agents\skills') -Directory -ErrorAction SilentlyContinue).Count
    if ($sk -ge 35 -and $sk -lt 40) { Ok "skills filtrados: $sk (pack=40)" } else { Bad "skills=$sk, se esperaba un conteo filtrado (<40)" }
    if (-not (Test-Path (Join-Path $t1 '.agents\skills\drizzle-patterns'))) { Ok 'skill JS/TS descartado (drizzle-patterns)' } else { Bad 'drizzle-patterns no se descarto' }
    if (Test-Path (Join-Path $t1 '.agents\skills\supabase-patterns')) { Ok 'skill multi-stack conservado (supabase-patterns)' } else { Bad 'se descarto un skill multi-stack' }
    $r = [System.IO.File]::ReadAllText((Join-Path $t1 '.agents\skills\router\SKILL.md'))
    if ($r -notmatch '`drizzle-patterns`') { Ok 'fila del router podada con el skill' } else { Bad 'el router sigue apuntando a un skill borrado' }
    if ($r -match '`supabase-patterns`') { Ok 'fila del router multi-stack intacta' } else { Bad 'se podo una fila que debia conservarse' }
    $nest = @(Get-Nesting $t1)
    if ($nest.Count -eq 0) { Ok 'sin anidados residuales (.opencode/.opencode)' } else { Bad ("anidados: " + ($nest -join ', ')) }
    $rd = Get-Content (Join-Path $t1 '.opencode\README.md') -Raw
    if ($rd -match ('\*\*' + $ag + '\*\* agents')) { Ok "conteos del README regenerados ($ag agents)" } else { Bad 'el README sigue con los conteos del maestro' }
    if (Test-Counts $t1) { Ok 'counts --check PASS' } else { Bad 'counts --check FAIL' }
    if (Test-Smoke $t1) { Ok 'smoke-test PASSED' } else { Bad 'smoke-test FAILED' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- T2
Head 'T2 - fusion conservadora (NO pisa archivos del proyecto)'
try {
    $t2 = New-Project (Join-Path $WorkDir 't2-merge')
    Set-Content (Join-Path $t2 '.gitignore') "# PROYECTO`nbuild/`n.dart_tool/`nreportes/"
    $custom = @{ theme = 'mi-tema'; model = 'mi-modelo';
                 mcp = @{ 'mi-mcp' = @{ type = 'local'; command = @('npx','-y','x@1') } } } | ConvertTo-Json -Depth 10
    Set-Content (Join-Path $t2 'opencode.json') $custom

    Run-Init $t2

    $g = Get-Content (Join-Path $t2 '.gitignore')
    foreach ($need in @('build/', '.dart_tool/', 'reportes/')) {
        if ($g -contains $need) { Ok ".gitignore conserva '$need'" } else { Bad ".gitignore PERDIO '$need'" }
    }
    if (($g -join '|') -match '\.opencode/agent') { Ok '.gitignore añade el bloque de junctions del pack' } else { Bad 'falta el bloque de junctions' }

    $j = Get-Content (Join-Path $t2 'opencode.json') -Raw | ConvertFrom-Json
    if ($j.theme -eq 'mi-tema') { Ok 'opencode.json conserva theme propio' } else { Bad 'opencode.json PERDIO theme propio' }
    if ($j.model -eq 'mi-modelo') { Ok 'opencode.json conserva model propio' } else { Bad 'opencode.json PERDIO model propio' }
    if ($null -ne $j.mcp.'mi-mcp') { Ok 'opencode.json conserva MCP propio' } else { Bad 'opencode.json PERDIO MCP propio' }
    if ($null -ne $j.mcp.context7 -and $null -ne $j.mcp.stripe) { Ok 'opencode.json añade los MCPs del pack' } else { Bad 'faltan MCPs del pack' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- T3
Head 'T3 - idempotencia (2a corrida no cambia nada)'
try {
    $t3 = New-Project (Join-Path $WorkDir 't3-idem')
    Run-Init $t3

    $h1g = (Get-FileHash (Join-Path $t3 '.gitignore')).Hash
    $h1o = (Get-FileHash (Join-Path $t3 'opencode.json')).Hash
    $a1  = @(Get-ChildItem (Join-Path $t3 '.opencode\agents\*.md')).Count

    Run-Init $t3

    $h2g = (Get-FileHash (Join-Path $t3 '.gitignore')).Hash
    $h2o = (Get-FileHash (Join-Path $t3 'opencode.json')).Hash
    $a2  = @(Get-ChildItem (Join-Path $t3 '.opencode\agents\*.md')).Count

    if ($h1g -eq $h2g) { Ok '.gitignore estable en la 2a corrida' } else { Bad '.gitignore cambio en la 2a corrida' }
    if ($h1o -eq $h2o) { Ok 'opencode.json estable en la 2a corrida' } else { Bad 'opencode.json cambio en la 2a corrida' }
    if ($a1 -eq $a2)   { Ok "agents no se duplican ($a1 -> $a2)" } else { Bad "agents cambieron ($a1 -> $a2)" }
    $nest = @(Get-Nesting $t3)
    if ($nest.Count -eq 0) { Ok 'la 2a corrida no crea anidados' } else { Bad ("anidados: " + ($nest -join ', ')) }
    if (Test-Counts $t3) { Ok 'counts --check PASS tras 2 corridas' } else { Bad 'counts --check FAIL tras 2 corridas' }
    if (Test-Smoke $t3) { Ok 'smoke-test PASSED tras 2 corridas' } else { Bad 'smoke-test FAILED tras 2 corridas' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- T4
Head 'T4 - -AllAgents (biblioteca completa)'
try {
    $t4 = New-Project (Join-Path $WorkDir 't4-all')
    Run-Init $t4 -AllAgents
    $ag = @(Get-ChildItem (Join-Path $t4 '.opencode\agents\*.md')).Count
    if ($ag -ge 80) { Ok "biblioteca completa: $ag agents" } else { Bad "solo $ag agents, se esperaba >= 80" }
    if (Test-Path (Join-Path $t4 '.opencode\.stack')) { Bad 'no deberia haber marcador .stack con -AllAgents' } else { Ok 'sin marcador .stack (pack completo)' }
    $nest = @(Get-Nesting $t4)
    if ($nest.Count -eq 0) { Ok 'sin anidados residuales' } else { Bad ("anidados: " + ($nest -join ', ')) }
    if (Test-Counts $t4) { Ok 'counts --check PASS' } else { Bad 'counts --check FAIL' }
    if (Test-Smoke $t4) { Ok 'smoke-test PASSED' } else { Bad 'smoke-test FAILED' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- T5
Head 'T5 - valida un PackPath invalido (falla limpio)'
try {
    $t5 = Join-Path $WorkDir 't5-badpack'
    if (Test-Path $t5) { Remove-Item $t5 -Recurse -Force }
    New-Item -ItemType Directory -Path $t5 -Force | Out-Null
    Set-Content (Join-Path $t5 'pubspec.yaml') 'name: x'
    # 6>&1 porque init reporta el error con Write-Host (stream de informacion)
    $out = & $init -ProjectPath $t5 -PackPath (Join-Path $WorkDir 'no-existe') -SkipInstall -SkipDocs -Force 6>&1 2>&1
    if (($out -join "`n") -match 'No se encontro el pack') { Ok 'PackPath invalido -> error claro' } else { Bad "no reporto el error de PackPath (salida: $out)" }
    if (-not (Test-Path (Join-Path $t5 '.opencode\agents'))) { Ok 'no instalo nada a medias' } else { Bad 'instalo parcialmente con PackPath invalido' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- T6
Head 'T6 - stack node NO descarta skills JS/TS'
try {
    $t6 = New-Project (Join-Path $WorkDir 't6-node') 'package.json'
    Run-Init $t6
    $sk = @(Get-ChildItem (Join-Path $t6 '.agents\skills') -Directory -ErrorAction SilentlyContinue).Count
    if ($sk -ge 35) { Ok "skills: $sk" } else { Bad "skills=$sk, muy pocos" }
    if (Test-Path (Join-Path $t6 '.agents\skills\drizzle-patterns')) { Ok 'drizzle-patterns conservado (aplica a node)' } else { Bad 'se descarto un skill que si aplica a node' }
    if (Test-Path (Join-Path $t6 '.agents\skills\turso-libsql')) { Ok 'turso-libsql conservado (aplica a node)' } else { Bad 'se descarto turso-libsql en node' }
    $ag = @(Get-ChildItem (Join-Path $t6 '.opencode\agents\*.md')).Count
    if ($ag -gt 0 -and $ag -lt 85) { Ok "agents filtrados para node: $ag" } else { Bad "agents=$ag" }
    $or = Get-Orphans $t6
    if ($or.Count -eq 0) { Ok '0 comandos huerfanos' } else { Bad ("huerfanos: " + ($or -join ', ')) }
    $nest = @(Get-Nesting $t6)
    if ($nest.Count -eq 0) { Ok 'sin anidados residuales' } else { Bad ("anidados: " + ($nest -join ', ')) }
    if (Test-Counts $t6) { Ok 'counts --check PASS' } else { Bad 'counts --check FAIL' }
    if (Test-Smoke $t6) { Ok 'smoke-test PASSED' } else { Bad 'smoke-test FAILED' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- T7
Head 'T7 - scaffolders generan artefactos VALIDOS'
try {
    $t7 = New-Project (Join-Path $WorkDir 't7-scaffold')
    Run-Init $t7
    Push-Location $t7
    try {
        node .opencode\bin\scaffold-new-agent.js zz-scaffold 2>&1 | Out-Null
        if (Test-Path (Join-Path $t7 '.opencode\agents\zz-scaffold.md')) {
            Ok 'scaffold-new-agent crea el archivo'
        } else { Bad 'scaffold-new-agent no creo nada' }

        node .opencode\bin\scaffold-new-skill.js zz-scaffold-skill 2>&1 | Out-Null
        if (Test-Path (Join-Path $t7 '.agents\skills\zz-scaffold-skill\SKILL.md')) {
            Ok 'scaffold-new-skill crea el archivo'
        } else { Bad 'scaffold-new-skill no creo nada' }

        node .opencode\bin\validate-frontmatter.js 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Ok 'validate-frontmatter PASS con lo recien creado' }
        else { Bad 'validate-frontmatter FAIL con lo recien creado (frontmatter del scaffolder roto)' }

        node .opencode\bin\counts.js --check 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Ok 'counts --check PASS (scaffolder refresco conteos)' }
        else { Bad 'counts --check FAIL: el scaffolder no refresco ## Counts' }
    } finally { Pop-Location }
    if (Test-Counts $t7) { Ok 'counts --check PASS' } else { Bad 'counts --check FAIL' }
    if (Test-Smoke $t7) { Ok 'smoke-test PASSED' } else { Bad 'smoke-test FAILED' }
} catch { Bad "excepcion: $($_.Exception.Message)" }

# ---------------------------------------------------------------- resumen
Write-Host ''
Write-Host '================================' -ForegroundColor Cyan
Write-Host "  PASS: $script:pass   FAIL: $script:fail" -ForegroundColor $(if ($script:fail -eq 0) { 'Green' } else { 'Red' })
Write-Host '================================' -ForegroundColor Cyan
if ($script:fail -gt 0) { Write-Host '  INSTALLER TEST FAILED' -ForegroundColor Red; exit 1 }
Write-Host '  INSTALLER TEST PASSED' -ForegroundColor Green
exit 0
