const assert = require('node:assert/strict');
const test = require('node:test');

const { createApp } = require('../src/index');

test('POST /api/cases/lookup returns the matching case when id and email match', async (t) => {
  const app = createApp({
    now: () => new Date('2026-03-06T00:00:00Z'),
  });
  const server = app.listen(0);

  t.after(() => {
    server.close();
  });

  const { port } = server.address();
  const intake = new FormData();
  intake.set('plaintiffName', 'Jane Smith');
  intake.set('contactEmail', 'jane@example.com');
  intake.set('defendantName', 'Doe LLC');
  intake.set('caseNumber', '2026-CV-10001');
  intake.set('county', 'Bexar County');
  intake.set('judgmentAmount', '48000');
  intake.set('judgmentDate', '2025-06-01');
  intake.set('finalJudgmentConfirmed', 'yes');
  intake.set('defaultJudgmentConfirmed', 'yes');
  intake.set('debtorAddress', '123 Main St');
  intake.set('debtorBank', 'Frost Bank');

  const intakeResponse = await fetch(`http://127.0.0.1:${port}/api/intake`, {
    method: 'POST',
    body: intake,
  });
  const intakeBody = await intakeResponse.json();

  const lookupResponse = await fetch(`http://127.0.0.1:${port}/api/cases/lookup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      caseId: intakeBody.case.id,
      contactEmail: 'jane@example.com',
    }),
  });
  const lookupBody = await lookupResponse.json();

  assert.equal(lookupResponse.status, 200);
  assert.equal(lookupBody.case.id, intakeBody.case.id);
  assert.equal(lookupBody.case.currentState, 'Approved');
});
