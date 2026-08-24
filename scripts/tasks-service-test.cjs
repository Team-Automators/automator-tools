/* Verifies Tasks carry the pipeline sync fields (service/dueDate/waitingOn)
 * through create + update. Run: node scripts/tasks-service-test.cjs
 */
process.env.VERCEL = ''; // in-memory store
const store = require('../lib/tasks-store');

let passed = 0, failed = 0;
const check = (n, c, x = '') => { if (c) passed++; else failed++; console.log(`  [${c ? 'PASS' : 'FAIL'}] ${n}${x ? '  — ' + x : ''}`); };

(async () => {
  const LOC = 'LOC1';
  console.log('\n=== Tasks ↔ Pipeline sync fields ===\n');

  const t = await store.create(LOC, { title: 'Build funnel', customerName: 'Acme', service: 'funnels', dueDate: '2026-09-01', ownerUserId: 'U1' });
  check('create stores service', t.service === 'funnels', t.service);
  check('create stores dueDate', t.dueDate === '2026-09-01', t.dueDate);
  check('create defaults waitingOn to empty', t.waitingOn === '', JSON.stringify(t.waitingOn));
  check('create defaults stage to urgent', t.stage === 'urgent', t.stage);

  const u = await store.update(LOC, t.id, { waitingOn: 'client', service: 'automations', stage: 'done' });
  check('update sets waitingOn', u.waitingOn === 'client', u.waitingOn);
  check('update can re-tag service', u.service === 'automations', u.service);
  check('update moves stage to done (→ pipeline completed)', u.stage === 'done', u.stage);

  // A task with no service is a Tasks-only item (excluded from pipeline view).
  const plain = await store.create(LOC, { title: 'Internal note', ownerUserId: 'U1' });
  check('service optional (empty for Tasks-only)', plain.service === '', JSON.stringify(plain.service));

  const all = await store.getAll(LOC);
  const withSvc = all.filter(x => x.service);
  check('exactly one task has a service (pipeline shows 1)', withSvc.length === 1, `count ${withSvc.length}`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
})();
