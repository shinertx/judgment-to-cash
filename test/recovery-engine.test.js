const assert = require('node:assert/strict');
const test = require('node:test');

const { buildDecision, createCaseRecord } = require('../src/recovery-engine');

const fixedNow = new Date('2026-03-06T00:00:00Z');

test('approved judgment gets an approved decision and fee summary', () => {
  const caseRecord = createCaseRecord(
    {
      plaintiffName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      defendantName: 'Doe LLC',
      caseNumber: '2026-CV-10001',
      county: 'Bexar County',
      judgmentAmount: '48000',
      judgmentDate: '2025-06-01',
      finalJudgmentConfirmed: 'yes',
      defaultJudgmentConfirmed: 'yes',
      debtorAddress: '123 Main St, San Antonio, TX',
      debtorBank: 'Frost Bank',
      knownInformation: 'Plaintiff knows where the debtor banks.',
    },
    { now: fixedNow }
  );

  assert.equal(caseRecord.currentState, 'Approved');
  assert.equal(caseRecord.evaluation.decision, 'approved');
  assert.equal(caseRecord.feeModel.contingencyRate, 0.3);
  assert.ok(caseRecord.evaluation.score >= 55);
});

test('missing debtor details can stay in reviewing instead of declining', () => {
  const decision = buildDecision(
    {
      plaintiffName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      defendantName: 'Doe LLC',
      caseNumber: '2026-CV-10002',
      county: 'Bexar County',
      judgmentAmount: 12000,
      judgmentDate: new Date('2024-03-01T00:00:00Z'),
      finalJudgmentConfirmed: true,
      defaultJudgmentConfirmed: true,
      debtorAddress: '',
      debtorBank: '',
      debtorEmployer: '',
      knownInformation: '',
      uploadedFileName: null,
    },
    fixedNow
  );

  assert.equal(decision.decision, 'needs_more_info');
  assert.equal(decision.currentState, 'Reviewing');
  assert.ok(decision.reasons.some((reason) => reason.includes('Debtor address')));
});

test('non-final judgments are declined', () => {
  const decision = buildDecision(
    {
      plaintiffName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      defendantName: 'Doe LLC',
      caseNumber: '2026-CV-10003',
      county: 'Bexar County',
      judgmentAmount: 20000,
      judgmentDate: new Date('2025-03-01T00:00:00Z'),
      finalJudgmentConfirmed: false,
      defaultJudgmentConfirmed: true,
      debtorAddress: '123 Main St',
      debtorBank: '',
      debtorEmployer: '',
      knownInformation: '',
      uploadedFileName: null,
    },
    fixedNow
  );

  assert.equal(decision.decision, 'declined');
  assert.equal(decision.currentState, 'Closed');
  assert.ok(decision.reasons.some((reason) => reason.includes('final judgments')));
});

test('non-default judgments can move to manual review instead of hard decline', () => {
  const decision = buildDecision(
    {
      plaintiffName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      defendantName: 'Doe LLC',
      caseNumber: '2026-CV-10004',
      county: 'Bexar County',
      judgmentAmount: 250000,
      judgmentDate: new Date('2025-03-01T00:00:00Z'),
      finalJudgmentConfirmed: true,
      defaultJudgmentConfirmed: false,
      debtorAddress: '123 Main St',
      debtorBank: 'Frost Bank',
      debtorEmployer: 'Builder Co',
      knownInformation: '',
      uploadedFileName: 'judgment.pdf',
    },
    fixedNow
  );

  assert.equal(decision.decision, 'needs_more_info');
  assert.equal(decision.currentState, 'Reviewing');
  assert.equal(decision.label, 'Needs manual review');
  assert.ok(decision.reasons.some((reason) => reason.includes('manual review')));
});

test('string judgment dates still score correctly for persisted cases', () => {
  const decision = buildDecision(
    {
      plaintiffName: 'Jane Smith',
      contactEmail: 'jane@example.com',
      defendantName: 'Doe LLC',
      caseNumber: '2026-CV-10005',
      county: 'Bexar County',
      judgmentAmount: 48000,
      judgmentDate: '2025-03-01T00:00:00.000Z',
      finalJudgmentConfirmed: true,
      defaultJudgmentConfirmed: true,
      debtorAddress: '123 Main St',
      debtorBank: 'Frost Bank',
      debtorEmployer: '',
      knownInformation: '',
      uploadedFileName: null,
    },
    fixedNow
  );

  assert.equal(decision.decision, 'approved');
  assert.equal(decision.currentState, 'Approved');
});
