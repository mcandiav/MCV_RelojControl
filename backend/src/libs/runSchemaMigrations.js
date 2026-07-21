/**
 * Migraciones idempotentes antes de db.sync({ alter: true }).
 * V5: permite varios operation_timers por work_order_operation_id.
 */
async function indexExists(sequelize, tableName, indexName) {
  const dialect = sequelize.getDialect();
  if (dialect === 'mssql') {
    const [rows] = await sequelize.query(
      `
      SELECT 1 AS found
      FROM sys.indexes i
      INNER JOIN sys.objects o ON i.object_id = o.object_id
      WHERE o.name = :tableName AND i.name = :indexName
      `,
      { replacements: { tableName, indexName } }
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = :indexName`, {
    replacements: { indexName }
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function replaceLegacyUniqueOpIdIndex(sequelize, indexName) {
  const dialect = sequelize.getDialect();
  const tableName = 'operation_timers';
  if (!(await indexExists(sequelize, tableName, indexName))) return false;

  console.log(`[migrate] V5: reemplazando índice único legacy ${indexName} por índice no único (FK)...`);
  if (dialect === 'mssql') {
    await sequelize.query(`DROP INDEX [${indexName}] ON [${tableName}]`);
    await sequelize.query(`
      CREATE INDEX [${indexName}] ON [${tableName}] ([work_order_operation_id])
    `);
    return true;
  }

  // MariaDB/MySQL: DROP + ADD en la misma ALTER para no romper la FK que usa ese índice.
  await sequelize.query(`
    ALTER TABLE \`${tableName}\`
      DROP INDEX \`${indexName}\`,
      ADD INDEX \`${indexName}\` (\`work_order_operation_id\`)
  `);
  return true;
}

async function ensureNonUniqueOpIdIndex(sequelize) {
  const dialect = sequelize.getDialect();
  if (dialect !== 'mariadb' && dialect !== 'mysql') return;

  const [rows] = await sequelize.query('SHOW INDEX FROM `operation_timers`');
  const hasNonUniqueOpId = (rows || []).some(
    (row) =>
      String(row.Column_name) === 'work_order_operation_id' &&
      Number(row.Non_unique) === 1 &&
      String(row.Key_name) !== 'uk_op_timer_user_station'
  );
  if (hasNonUniqueOpId) return;

  const indexName = 'operation_timers_work_order_operation_id';
  if (await indexExists(sequelize, 'operation_timers', indexName)) return;

  console.log('[migrate] V5: creando índice no único en work_order_operation_id...');
  await sequelize.query(`
    ALTER TABLE \`operation_timers\`
      ADD INDEX \`${indexName}\` (\`work_order_operation_id\`)
  `);
}

async function findLegacySingleOperationUniqueIndexes(sequelize) {
  const dialect = sequelize.getDialect();
  if (dialect === 'mssql') {
    return ['operation_timers_work_order_operation_id'];
  }

  const [rows] = await sequelize.query('SHOW INDEX FROM `operation_timers`');
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.Key_name;
    if (!key || key === 'PRIMARY' || key === 'uk_op_timer_user_station') continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const legacy = [];
  for (const [key, cols] of byKey.entries()) {
    const sorted = [...cols].sort((a, b) => a.Seq_in_index - b.Seq_in_index);
    const isUnique = sorted.length > 0 && Number(sorted[0].Non_unique) === 0;
    const onlyOpId =
      sorted.length === 1 && String(sorted[0].Column_name) === 'work_order_operation_id';
    if (isUnique && onlyOpId) legacy.push(key);
  }
  return legacy;
}

async function runV5MultioperarioTimerMigration(sequelize) {
  const dialect = sequelize.getDialect();
  if (dialect !== 'mariadb' && dialect !== 'mysql' && dialect !== 'mssql') {
    console.log(`[migrate] V5 timer migration skipped (dialect=${dialect}).`);
    return;
  }

  console.log('[migrate] V5 multioperario: normalizando station_id...');
  if (dialect === 'mssql') {
    await sequelize.query(`
      UPDATE operation_timers SET station_id = '' WHERE station_id IS NULL
    `);
  } else {
    await sequelize.query(`
      UPDATE operation_timers SET station_id = '' WHERE station_id IS NULL
    `);
  }

  const legacyIndexes = await findLegacySingleOperationUniqueIndexes(sequelize);
  for (const indexName of legacyIndexes) {
    await replaceLegacyUniqueOpIdIndex(sequelize, indexName);
  }
  await ensureNonUniqueOpIdIndex(sequelize);

  if (!(await indexExists(sequelize, 'operation_timers', 'uk_op_timer_user_station'))) {
    console.log('[migrate] V5: creando índice uk_op_timer_user_station...');
    if (dialect === 'mssql') {
      await sequelize.query(`
        CREATE UNIQUE INDEX uk_op_timer_user_station
        ON operation_timers (work_order_operation_id, current_user_id, station_id)
      `);
    } else {
      await sequelize.query(`
        CREATE UNIQUE INDEX uk_op_timer_user_station
        ON operation_timers (work_order_operation_id, current_user_id, station_id)
      `);
    }
  } else {
    console.log('[migrate] V5: índice uk_op_timer_user_station ya existe.');
  }
}

/**
 * MariaDB/MySQL: Sequelize sync({ alter: true }) con unique en columna puede
 * agregar un índice UNIQUE nuevo en cada arranque (CHANGE ... UNIQUE) sin
 * borrar el anterior. Al llegar a 64 índices: ER_TOO_MANY_KEYS.
 * Deja un solo índice por firma (unique + columnas); prioriza keepName.
 */
async function tableExists(sequelize, tableName) {
  const dialect = sequelize.getDialect();
  if (dialect !== 'mariadb' && dialect !== 'mysql') return false;
  const [rows] = await sequelize.query(
    `
    SELECT 1 AS found
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = :tableName
    LIMIT 1
    `,
    { replacements: { tableName } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

function groupIndexesBySignature(indexRows) {
  const byKey = new Map();
  for (const row of indexRows || []) {
    const key = row.Key_name;
    if (!key || key === 'PRIMARY') continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const bySignature = new Map();
  for (const [key, cols] of byKey.entries()) {
    const sorted = [...cols].sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index));
    const isUnique = sorted.length > 0 && Number(sorted[0].Non_unique) === 0;
    const colSig = sorted.map((c) => String(c.Column_name)).join(',');
    const signature = `${isUnique ? 'U' : 'N'}:${colSig}`;
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature).push(key);
  }
  return bySignature;
}

async function dedupeIndexesOnTable(sequelize, tableName, preferredNames = []) {
  const dialect = sequelize.getDialect();
  if (dialect !== 'mariadb' && dialect !== 'mysql') return;
  if (!(await tableExists(sequelize, tableName))) return;

  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${tableName}\``);
  const bySignature = groupIndexesBySignature(rows);
  const preferred = new Set(preferredNames.filter(Boolean));
  let dropped = 0;

  for (const [, names] of bySignature.entries()) {
    if (names.length <= 1) continue;
    const keep = names.find((n) => preferred.has(n)) || names[0];
    for (const name of names) {
      if (name === keep) continue;
      console.log(`[migrate] ${tableName}: eliminando índice duplicado ${name} (se conserva ${keep})`);
      await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
      dropped += 1;
    }
  }

  if (dropped > 0) {
    console.log(`[migrate] ${tableName}: se eliminaron ${dropped} índice(s) duplicado(s).`);
  }
}

async function consolidateUniqueColumnIndex(sequelize, tableName, preferredName, columnName) {
  const dialect = sequelize.getDialect();
  if (dialect !== 'mariadb' && dialect !== 'mysql') return;
  if (!(await tableExists(sequelize, tableName))) return;

  const [rows] = await sequelize.query(`SHOW INDEX FROM \`${tableName}\``);
  const byKey = new Map();
  for (const row of rows || []) {
    const key = row.Key_name;
    if (!key || key === 'PRIMARY') continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const uniqueOnColumn = [];
  for (const [key, cols] of byKey.entries()) {
    const sorted = [...cols].sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index));
    const isUnique = sorted.length > 0 && Number(sorted[0].Non_unique) === 0;
    const onlyCol =
      sorted.length === 1 && String(sorted[0].Column_name) === columnName;
    if (isUnique && onlyCol) uniqueOnColumn.push(key);
  }

  if (uniqueOnColumn.includes(preferredName)) {
    for (const name of uniqueOnColumn) {
      if (name === preferredName) continue;
      console.log(
        `[migrate] ${tableName}: eliminando UNIQUE duplicado ${name} (se conserva ${preferredName})`
      );
      await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
    }
    return;
  }

  for (const name of uniqueOnColumn) {
    console.log(
      `[migrate] ${tableName}: eliminando UNIQUE legacy ${name} para consolidar en ${preferredName}`
    );
    await sequelize.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``);
  }

  console.log(`[migrate] ${tableName}: creando índice único ${preferredName}...`);
  await sequelize.query(
    `CREATE UNIQUE INDEX \`${preferredName}\` ON \`${tableName}\` (\`${columnName}\`)`
  );
}

async function runDedupeSequelizeAlterIndexes(sequelize) {
  console.log('[migrate] limpiando índices duplicados por sync(alter)...');
  // Primero colapsar UNIQUE de columnas críticas al nombre fijo del modelo.
  await consolidateUniqueColumnIndex(
    sequelize,
    'netsuite_sync_queue',
    'uk_netsuite_sync_queue_idempotency',
    'idempotency_key'
  );
  await consolidateUniqueColumnIndex(
    sequelize,
    'netsuite_sync_zim400',
    'uk_netsuite_sync_zim400_stop_event',
    'stop_event_id'
  );
  // Luego cualquier otro índice duplicado (status, FKs, etc.).
  await dedupeIndexesOnTable(sequelize, 'netsuite_sync_queue', [
    'uk_netsuite_sync_queue_idempotency',
    'idx_netsuite_sync_queue_status',
    'idx_netsuite_sync_queue_operation',
    'idx_netsuite_sync_queue_trigger_event',
    'idx_netsuite_sync_queue_next_retry',
    'idx_netsuite_sync_queue_locked_at'
  ]);
  await dedupeIndexesOnTable(sequelize, 'netsuite_sync_zim400', [
    'uk_netsuite_sync_zim400_stop_event',
    'idx_netsuite_sync_zim400_status',
    'idx_netsuite_sync_zim400_queue_item',
    'idx_netsuite_sync_zim400_operation',
    'idx_netsuite_sync_zim400_sent_at'
  ]);
}

async function runSchemaMigrations(sequelize) {
  await runDedupeSequelizeAlterIndexes(sequelize);
  await runV5MultioperarioTimerMigration(sequelize);
}

module.exports = {
  runSchemaMigrations
};
