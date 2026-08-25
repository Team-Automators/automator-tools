/* Backup export → import round-trip (in-memory stores).
 * Run: node scripts/backup-test.cjs
 */
process.env.VERCEL = ''; // in-memory
const backup    = require('../lib/backup-store');
const copyStore = require('../lib/copy-store');
const tasks     = require('../lib/tasks-store');
const pipeline  = require('../lib/pipeline-store');
const hooks     = require('../lib/hooks-store');

let passed = 0, failed = 0;
const check = (n, c, x = '') => { if (c) passed++; else failed++; console.log(`  [${c ? 'PASS' : 'FAIL'}] ${n}${x ? '  — ' + x : ''}`); };

(async () => {
  const SRC = 'LOC_SRC', DST = 'LOC_DST', U = 'U1';
  console.log('\n=== Backup export / restore ===\n');

  // Seed source location for user U1.
  const cust = await copyStore.createCustomer(SRC, { name: 'Acme', ownerUserId: U });
  await copyStore.saveCopy(SRC, { customerId: cust.id, customerName: 'Acme', type: 'email', messages: [{ role: 'assistant', content: 'hi' }], title: 'Welcome', ownerUserId: U });
  await tasks.create(SRC, { title: 'Build funnel', service: 'funnels', ownerUserId: U });
  await pipeline.create(SRC, { clientName: 'Acme', service: 'funnels', ownerUserId: U });
  await hooks.create(SRC, { name: 'Zap', destinationUrl: 'https://x.test', ownerUserId: U });

  // Export.
  const dump = await backup.exportAll(SRC, U);
  check('format tag present', dump.format === 'automator-backup', dump.format);
  check('exports 1 copy',     dump.data.copies.length === 1, `${dump.data.copies.length}`);
  check('copy keeps messages', Array.isArray(dump.data.copies[0].messages) && dump.data.copies[0].messages.length === 1);
  check('exports 1 task',     dump.data.tasks.length === 1);
  check('exports 1 pipeline', dump.data.pipeline.length === 1);
  check('exports 1 hook',     dump.data.hooks.length === 1);
  check('exports customer',   dump.data.customers.length === 1);

  // Restore into a DIFFERENT (empty) location as a different context.
  const out = await backup.importAll(DST, U, dump);
  check('import ok', out.ok === true);

  const dstCopies = await copyStore.getAllCopies(DST);
  const dstTasks  = await tasks.getAll(DST);
  const dstPipe   = await pipeline.getAll(DST);
  const dstHooks  = await hooks.getAll(DST);
  check('restored copy',     dstCopies.length === 1 && dstCopies[0].title === 'Welcome');
  check('restored copy owner stamped', dstCopies[0].ownerUserId === U);
  check('restored copy in index', (await copyStore.getCopyIndex(DST)).length === 1);
  check('restored task',     dstTasks.length === 1 && dstTasks[0].service === 'funnels');
  check('restored pipeline', dstPipe.length === 1);
  check('restored hook + token index', dstHooks.length === 1 && !!(await hooks.findByToken(dstHooks[0].incomingToken)));

  // Idempotent re-import (upsert by id — no duplicates).
  await backup.importAll(DST, U, dump);
  check('re-import does not duplicate copies', (await copyStore.getAllCopies(DST)).length === 1);
  check('re-import does not duplicate tasks',  (await tasks.getAll(DST)).length === 1);

  // Reject a non-backup file.
  let rejected = false;
  try { await backup.importAll(DST, U, { foo: 'bar' }); } catch { rejected = true; }
  check('rejects non-backup file', rejected);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
