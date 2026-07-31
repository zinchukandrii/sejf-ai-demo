import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { scoreLead, validate, server } = await import('../server.mjs');

test('qualified confidential daily workflow routes to paid pilot', () => {
  const result = scoreLead({ sensitivity:'confidential', frequency:'daily', users:30, systems:'SharePoint + ERP', outcome:'Reduce manual contract review and produce an approved evidence pack', email:'cto@example.com' });
  assert.equal(result.route, 'PAID_PILOT');
  assert.ok(result.score >= 70);
});

test('weak occasional public use case is not auto-qualified', () => {
  const result = scoreLead({ sensitivity:'public', frequency:'occasional', users:1, systems:'', outcome:'', email:'x@example.com' });
  assert.equal(result.route, 'NOT_NOW');
});

test('validation blocks missing consent and malformed email', () => {
  const { errors } = validate({ company:'A', name:'B', email:'bad', workflow:'This workflow description is long enough.', sensitivity:'internal', frequency:'weekly', consent:false });
  assert.deepEqual(errors.sort(), ['consent','email']);
});

test('health endpoint returns approval gate state', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.approvalGate, true);
  await new Promise(resolve => server.close(resolve));
});

test('synthetic control room endpoint is explicit and complete', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/demo-dashboard`);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.synthetic, true);
  assert.equal(data.queue.length, 4);
  assert.ok(data.metrics.citationCoverage > 0);
  await new Promise(resolve => server.close(resolve));
});
