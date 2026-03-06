const assert = require('node:assert/strict');
const test = require('node:test');

const { createApp } = require('../src/index');

test('POST /api/intake returns a structured approved case response', async (t) => {
  const app = createApp({
    now: () => new Date('2026-03-06T00:00:00Z'),
  });
  const server = app.listen(0);

  t.after(() => {
    server.close();
  });

  const { port } = server.address();
  const formData = new FormData();
  formData.set('plaintiffName', 'Jane Smith');
  formData.set('contactEmail', 'jane@example.com');
  formData.set('defendantName', 'Doe LLC');
  formData.set('caseNumber', '2026-CV-10001');
  formData.set('county', 'Bexar County');
  formData.set('judgmentAmount', '48000');
  formData.set('judgmentDate', '2025-06-01');
  formData.set('finalJudgmentConfirmed', 'yes');
  formData.set('defaultJudgmentConfirmed', 'yes');
  formData.set('debtorAddress', '123 Main St');
  formData.set('debtorBank', 'Frost Bank');
  formData.set('knownInformation', 'Known bank relationship');

  const response = await fetch(`http://127.0.0.1:${port}/api/intake`, {
    method: 'POST',
    body: formData,
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.case.currentState, 'Approved');
  assert.equal(body.case.displayState, 'Looks like a fit');
  assert.equal(body.case.decision, 'approved');
  assert.equal(body.case.feeModel.contingencyRate, 0.3);
  assert.ok(Array.isArray(body.case.timeline));
});
