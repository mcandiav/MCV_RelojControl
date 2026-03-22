/**
 * Genera seed-wip-ot1-9-adminer.csv desde wip-upsert-ot1-9.json
 * Uso: node backend/scripts/generate-seed-wip-csv.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'wip-upsert-ot1-9.json');
const out = path.join(__dirname, 'seed-wip-ot1-9-adminer.csv');

const j = JSON.parse(fs.readFileSync(root, 'utf8'));

function esc(v) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (/[,"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Orden de columnas igual que en MariaDB (sin id): planned_quantity/completed_quantity al final.
const header =
  'ot_number,operation_sequence,operation_code,operation_name,resource_code,area,' +
  'planned_setup_minutes,planned_operation_minutes,' +
  'netsuite_work_order_id,netsuite_operation_id,source_status,last_synced_at,createdAt,updatedAt,' +
  'planned_quantity,completed_quantity';

const ts = '2026-03-19 12:00:00';

const rows = j.operations.map((op) =>
  [
    op.ot_number,
    op.operation_sequence,
    op.operation_code || '',
    op.operation_name,
    op.resource_code,
    op.area,
    op.planned_setup_minutes ?? '',
    op.planned_operation_minutes ?? '',
    '',
    '',
    op.source_status,
    '',
    ts,
    ts,
    op.planned_quantity ?? '',
    op.completed_quantity ?? ''
  ]
    .map(esc)
    .join(',')
);

fs.writeFileSync(out, [header, ...rows].join('\n'), 'utf8');
console.log('Written', out, 'rows:', rows.length);
