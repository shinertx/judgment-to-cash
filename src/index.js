const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const {
  PLATFORM_CONFIG,
  buildCaseResponse,
  buildTimeline,
  createCaseRecord,
} = require('./recovery-engine');
const {
  DEFAULT_CASES_PATH,
  createFileStore,
  createMemoryStore,
} = require('./case-store');

const DEFAULT_PORT = Number(process.env.PORT) || 4040;
const DEFAULT_UPLOADS_PATH = path.join(__dirname, '../uploads');

function updateCaseState(caseRecord, nextState) {
  caseRecord.currentState = nextState;
  caseRecord.timeline = buildTimeline(nextState);
  caseRecord.updatedAt = new Date().toISOString();
  return caseRecord;
}

function createApp(options = {}) {
  const app = express();
  fs.mkdirSync(DEFAULT_UPLOADS_PATH, { recursive: true });

  const upload = multer({ dest: DEFAULT_UPLOADS_PATH });
  const store = options.store || createMemoryStore(options.initialCases);
  const now = options.now || (() => new Date());

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../landing')));

  app.get('/api/config', (req, res) => {
    res.json({
      jurisdiction: PLATFORM_CONFIG.jurisdiction,
      wedge: PLATFORM_CONFIG.wedge,
      feeModel: PLATFORM_CONFIG.feeModel,
      amountRange: PLATFORM_CONFIG.amountRange,
      visibleStates: PLATFORM_CONFIG.visibleStates,
    });
  });

  app.post('/api/intake', upload.single('judgmentPdf'), (req, res) => {
    const caseRecord = createCaseRecord(req.body, {
      now: now(),
      uploadedFileName: req.file ? req.file.filename : null,
    });
    const caseResponse = buildCaseResponse(caseRecord);

    store.addCase(caseRecord);

    res.status(201).json({
      message: caseResponse.headline,
      case: caseResponse,
    });
  });

  app.post('/api/cases/lookup', (req, res) => {
    const caseId = typeof req.body.caseId === 'string' ? req.body.caseId.trim() : '';
    const contactEmail = typeof req.body.contactEmail === 'string' ? req.body.contactEmail.trim() : '';

    if (!caseId || !contactEmail) {
      return res.status(400).json({ error: 'Case ID and email are required.' });
    }

    const caseRecord = store.findCaseByLookup(caseId, contactEmail);

    if (!caseRecord) {
      return res.status(404).json({ error: 'No case matched that Case ID and email.' });
    }

    return res.json({
      case: buildCaseResponse(caseRecord),
    });
  });

  app.get('/api/cases/:id', (req, res) => {
    const caseRecord = store.findCaseByLookup(req.params.id, req.query.email);

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    return res.json({
      case: buildCaseResponse(caseRecord),
    });
  });

  app.post('/api/cases/:id/start-recovery', (req, res) => {
    const caseRecord = store.getCase(req.params.id);

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (caseRecord.currentState !== 'Approved') {
      return res.status(400).json({ error: 'Only approved cases can enter recovery.' });
    }

    updateCaseState(caseRecord, 'In Recovery');
    caseRecord.recoveryStartedAt = now().toISOString();
    store.saveCase(caseRecord);

    return res.json({
      message: 'Case moved into recovery.',
      case: buildCaseResponse(caseRecord),
    });
  });

  app.post('/api/cases/:id/mark-paid', (req, res) => {
    const caseRecord = store.getCase(req.params.id);

    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }

    updateCaseState(caseRecord, 'Paid');
    caseRecord.paidAt = now().toISOString();
    store.saveCase(caseRecord);

    return res.json({
      message: 'Case marked as paid.',
      case: buildCaseResponse(caseRecord),
    });
  });

  app.get('/api/dashboard/ops', (req, res) => {
    const cases = store.listCases();
    const counts = PLATFORM_CONFIG.visibleStates.reduce((accumulator, state) => {
      accumulator[state] = cases.filter((caseRecord) => caseRecord.currentState === state).length;
      return accumulator;
    }, {});

    const approvedOrBetter = cases.filter((caseRecord) =>
      ['Approved', 'In Recovery', 'Paid'].includes(caseRecord.currentState)
    ).length;

    res.json({
      metrics: {
        totalCases: cases.length,
        approvedRate: cases.length ? Math.round((approvedOrBetter / cases.length) * 100) : 0,
        receivedCount: counts.Received || 0,
        reviewingCount: counts.Reviewing || 0,
        approvedCount: counts.Approved || 0,
        inRecoveryCount: counts['In Recovery'] || 0,
        paidCount: counts.Paid || 0,
        closedCount: counts.Closed || 0,
      },
      cases: cases.map((caseRecord) => buildCaseResponse(caseRecord)),
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return app;
}

function startServer(port = DEFAULT_PORT) {
  const app = createApp({
    store: createFileStore(DEFAULT_CASES_PATH),
  });
  return app.listen(port, () => {
    console.log(`Judgment-to-Cash MVP server running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
};
