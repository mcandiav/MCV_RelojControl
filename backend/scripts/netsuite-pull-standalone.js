#!/usr/bin/env node
/**
 * Pull del dataset NetSuite MCV_cronometro_out ejecutando Node en el HOST (fuera del contenedor Docker).
 *
 * Requisitos:
 * - Variables NETSUITE_* (mismo contrato que el API). Podés usar .env.local en la raíz del repo (no versionado).
 * - Ejecutar desde la carpeta backend:  node scripts/netsuite-pull-standalone.js
 *
 * Modos:
 *   1) Solo imprimir JSON { operations: [...] } por stdout (para inspección o pipe).
 *   2) Enviar al API Cronómetro (DB sigue en el servidor): --sync-api URL --jwt TOKEN
 *
 * Ejemplos:
 *   node scripts/netsuite-pull-standalone.js > netsuite-wip.json
 *   node scripts/netsuite-pull-standalone.js --sync-api https://reloj-api.at-once.cl --jwt "$JWT"
 *   set CRONOMETRO_ADMIN_JWT=... && node scripts/netsuite-pull-standalone.js --sync-api https://reloj-api.at-once.cl
 */

/* eslint-disable no-console */

const path = require('path');
const axios = require('axios');

function resolveAreaFromResource(resourceCode) {
  const code = String(resourceCode || '').trim().toUpperCase();
  if (code.startsWith('ME')) return 'ME';
  if (code.startsWith('ES')) return 'ES';
  return null;
}

function parseArgs(argv) {
  const out = { syncApi: null, jwt: process.env.CRONOMETRO_ADMIN_JWT || '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sync-api' && argv[i + 1]) {
      out.syncApi = String(argv[i + 1]).replace(/\/$/, '');
      i += 1;
    } else if (argv[i] === '--jwt' && argv[i + 1]) {
      out.jwt = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function main() {
  const { syncApi, jwt } = parseArgs(process.argv.slice(2));

  const datasetPath = path.join(__dirname, '../src/services/netsuite/datasetClient');
  const { fetchFullDataset } = require(datasetPath);

  console.error('[netsuite-pull-standalone] Leyendo dataset desde NetSuite…');
  const { rows } = await fetchFullDataset(resolveAreaFromResource);
  console.error(`[netsuite-pull-standalone] Filas listas para upsert: ${rows.length}`);

  const payload = { operations: rows };

  if (syncApi) {
    if (!jwt) {
      console.error('Falta JWT de admin: usá --jwt "..." o variable de entorno CRONOMETRO_ADMIN_JWT.');
      process.exit(1);
    }
    const url = `${syncApi}/chronometer/admin/netsuite-ingest-wip`;
    console.error(`[netsuite-pull-standalone] POST ${url} …`);
    const res = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': jwt
      },
      timeout: 300000
    });
    console.log(JSON.stringify(res.data, null, 2));
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

main().catch((err) => {
  const d = err.response && err.response.data;
  console.error(d ? JSON.stringify(d, null, 2) : err.message || err);
  process.exit(1);
});
