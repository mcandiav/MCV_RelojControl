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

async function runSchemaMigrations(sequelize) {
  await runV5MultioperarioTimerMigration(sequelize);
}

module.exports = {
  runSchemaMigrations
};
