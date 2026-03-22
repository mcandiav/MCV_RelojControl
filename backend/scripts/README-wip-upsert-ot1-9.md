# Cargar OT1–OT9 en MariaDB **sin redeploy** (Windows)

No se hace POST a MariaDB: el motor SQL no expone HTTP. Hay que:

1. **POST al API** `https://reloj-api.at-once.cl/chronometer/wip/upsert` con JWT de **admin**, **o**
2. Ejecutar SQL a mano (Adminer / `mysql`).

Este archivo describe la opción **1** con **PowerShell** en tu PC.

## Qué carga

- **OT1 … OT9** (nueve órdenes).
- **4 a 8 operaciones** por OT (patrón 4,5,6,7,8 según el índice).
- **ME / ES** mezclados.
- **`operation_name`** tipo `OT3 OP2 ME — CUAD B` para reconocer bien en el tablero de cuadrantes.

**Total filas:** 52 (mismo cuerpo que `seedWipSample` en el backend cuando actualices imagen).

## Paso 1 — Token JWT de admin

1. Entrá al front como **administrador** (usuario / contraseña que uses en sandbox).
2. En el navegador: **F12 → Application → Local Storage** (o Storage) del dominio del front.
3. Buscá la clave del token (suele ser algo como `token_<nombreVentana>`). Copiá el **valor** (el JWT largo).

*(Obtener el token por otra vía que ya usen en el equipo también sirve.)*

**Importante:** el backend **no** usa `Authorization: Bearer`. Espera el header **`x-access-token`** (igual que axios en el front).

## Paso 2 — PowerShell (desde la carpeta del repo)

Ajustá `$token` y, si hace falta, la URL del API.

```powershell
$token = "PEGAR_AQUI_EL_JWT_SIN_COMILLAS_EXTRA"
$api = "https://reloj-api.at-once.cl"
$jsonPath = Join-Path $PSScriptRoot "wip-upsert-ot1-9.json"

Invoke-RestMethod -Uri "$api/chronometer/wip/upsert" `
  -Method POST `
  -Headers @{ "x-access-token" = $token } `
  -ContentType "application/json; charset=utf-8" `
  -InFile $jsonPath
```

Si ejecutás el comando **desde otra carpeta**, cambiá `$jsonPath` a la ruta completa de `wip-upsert-ot1-9.json`.

Respuesta esperada: `message`, `total: 52`.

## Alternativa: curl (Git Bash / WSL)

```bash
export TOKEN="PEGAR_JWT"
curl -sS -X POST "https://reloj-api.at-once.cl/chronometer/wip/upsert" \
  -H "x-access-token: $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @wip-upsert-ot1-9.json
```

## Regenerar el JSON

Si cambiás el formato, podés regenerar con Node desde la raíz del repo:

```bash
node -e "const fs=require('fs');const ops=[];for(let i=1;i<=9;i++){const n=4+((i-1)%5);for(let j=0;j<n;j++){const area=(i-1+j)%2===0?'ES':'ME';const seq=(j+1)*10;const L=String.fromCharCode(65+j);ops.push({ot_number:'OT'+i,operation_sequence:seq,operation_code:area+'-'+seq,operation_name:'OT'+i+' OP'+(j+1)+' '+area+' — CUAD '+L,resource_code:(area+' OT'+i+' S'+seq+' '+L).slice(0,64),area,planned_setup_minutes:null,planned_operation_minutes:30+((i*3+j*7)%90),planned_quantity:1+((i+j)%5),completed_quantity:0,source_status:'WIP'});}}fs.writeFileSync('backend/scripts/wip-upsert-ot1-9.json',JSON.stringify({operations:ops},null,2));console.log(ops.length);"
```

## Nota de seguridad

El JWT es una **credencial**. No lo pegues en chats públicos ni lo commitees.
