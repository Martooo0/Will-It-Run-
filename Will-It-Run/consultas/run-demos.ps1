#Requires -Version 5.1
<#
  run-demos.ps1  ·  Will It Run?
  -----------------------------------------------------------------------------
  Corre las tres demos (MongoDB, Neo4j, Redis) contra los contenedores Docker y
  guarda transcripciones LIMPIAS en consultas/outputs/ para pegar (o sacar
  screenshot) en el documento final como "Imagen Salida".

  Uso (desde cualquier carpeta del proyecto):
      .\consultas\run-demos.ps1            # corre las demos y captura outputs
      .\consultas\run-demos.ps1 -Seed      # ademas recarga el dataset real

  Requisitos:
      - Docker Desktop corriendo.
      - Node/npm solo si se usa -Seed (carga del dataset con npm run seed:all).

  Si Windows bloquea el script por ExecutionPolicy, correlo asi:
      powershell -ExecutionPolicy Bypass -File .\consultas\run-demos.ps1
  -----------------------------------------------------------------------------
#>
[CmdletBinding()]
param(
    [switch]$Seed
)

$ErrorActionPreference = "Stop"

# --- Rutas (relativas al script, no al CWD) ---
$ConsultasDir = $PSScriptRoot
$ProjectRoot  = Split-Path $ConsultasDir -Parent
$OutDir       = Join-Path $ConsultasDir "outputs"
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# --- 1) Docker disponible ---
Write-Step "Verificando Docker"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "No se encontro 'docker'. Abri Docker Desktop y volve a intentar." -ForegroundColor Red
    exit 1
}

# --- 2) Contenedores arriba ---
$contenedores = @("wir-mongo", "wir-neo4j", "wir-redis")
$corriendo = docker ps --format "{{.Names}}"
$faltan = $contenedores | Where-Object { $corriendo -notcontains $_ }
if ($faltan.Count -gt 0) {
    Write-Step "Levantando contenedores (faltan: $($faltan -join ', '))"
    docker compose -f (Join-Path $ProjectRoot "docker-compose.yml") up -d
    Write-Host "Esperando 12s a que las bases acepten conexiones (Neo4j tarda en el primer arranque)..."
    Start-Sleep -Seconds 12
} else {
    Write-Host "Contenedores OK: $($contenedores -join ', ')" -ForegroundColor Green
}

# --- 3) Seed opcional (carga REAL del dataset) ---
if ($Seed) {
    Write-Step "Recargando dataset (npm run seed:all)"
    Push-Location $ProjectRoot
    try {
        npm run seed:all
    } catch {
        Write-Host "El seed fallo: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Las demos siguen corriendo con los datos que ya esten cargados." -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# --- 4) Correr cada demo y capturar su salida ---
function Invoke-Demo {
    param(
        [string]$Titulo,
        [string]$Archivo,
        [string]$Contenedor,
        [string[]]$Comando,   # programa + args dentro del contenedor
        [string]$Salida
    )
    Write-Step "Demo: $Titulo"
    $ruta = Join-Path $ConsultasDir $Archivo
    if (-not (Test-Path $ruta)) {
        Write-Host "  (falta $Archivo, se saltea)" -ForegroundColor Yellow
        return
    }
    $destino = Join-Path $OutDir $Salida
    $dockerArgs = @("exec", "-i", $Contenedor) + $Comando
    # Pipe del archivo al stdin del contenedor; capturamos stdout.
    $texto = Get-Content $ruta | & docker $dockerArgs
    $texto | Out-File -FilePath $destino -Encoding utf8
    $texto | Write-Output
    Write-Host "  -> guardado en consultas\outputs\$Salida" -ForegroundColor Green
}

Invoke-Demo -Titulo "MongoDB" -Archivo "mongo-consultas.mongodb.js" -Contenedor "wir-mongo" `
    -Comando @("mongosh", "willitrun", "--quiet") -Salida "mongo.txt"

Invoke-Demo -Titulo "Neo4j (Cypher)" -Archivo "neo4j-demo.cypher" -Contenedor "wir-neo4j" `
    -Comando @("cypher-shell", "-u", "neo4j", "-p", "willitrun123") -Salida "neo4j.txt"

Invoke-Demo -Titulo "Redis" -Archivo "redis-demo.txt" -Contenedor "wir-redis" `
    -Comando @("redis-cli") -Salida "redis.txt"

Write-Step "Listo"
Write-Host "Transcripciones en: $OutDir"
Write-Host "Abrilas en WebStorm o saca screenshot por consulta para la 'Imagen Salida' del documento."
