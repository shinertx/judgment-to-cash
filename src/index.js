const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const DEFAULT_PORT = Number(process.env.PORT) || 4040;

function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static landing page
  app.use(express.static(path.join(__dirname, '../landing')));

  // Multer for mock file uploads
  const upload = multer({ dest: 'uploads/' });

  // In-memory mock database
  const db = {
    judgments: [],
  };

  // ==========================================
  // 1) Intake + Assignment API
  // ==========================================
  app.post('/api/intake', upload.single('judgmentPdf'), (req, res) => {
    const { plaintiffName, defendantName, caseNumber } = req.body;

    // Mock ingestion logic
    const judgment = {
      id: `JTC-${Date.now()}`,
      plaintiffName: plaintiffName || 'Unknown Plaintiff',
      defendantName: defendantName || 'Unknown Defendant',
      caseNumber: caseNumber || `BEXAR-${Math.floor(Math.random() * 90000) + 10000}`,
      status: 'Ingested',
      standingConfirmed: true,
      fileAssigned: true,
      uploadedFile: req.file ? req.file.filename : null,
      createdAt: new Date().toISOString()
    };

    db.judgments.push(judgment);

    res.status(201).json({
      message: 'Intake successful. File authorized with standing and permissions.',
      judgment,
      nextStep: 'Underwriting'
    });
  });

  // ==========================================
  // 2) Judgment Underwriting Engine API
  // ==========================================
  app.post('/api/underwrite/:id', (req, res) => {
    const { id } = req.params;
    const judgment = db.judgments.find(j => j.id === id);

    if (!judgment) {
      return res.status(404).json({ error: 'Judgment not found' });
    }

    // Mock Underwriting Logic based on requirements
    const score = Math.floor(Math.random() * 100);
    let recommendedPath = 'Skip / low yield';
    let collectabilityEstimate = 'Low';

    if (score > 80) {
      recommendedPath = 'Garnishment path';
      collectabilityEstimate = 'High (Bank accounts likely)';
    } else if (score > 50) {
      recommendedPath = 'Discovery/subpoena path';
      collectabilityEstimate = 'Medium (Bank unknown, asset clues exist)';
    } else if (score > 30) {
      recommendedPath = 'Lien path';
      collectabilityEstimate = 'Low-Mid (Real property / UCC signals)';
    }

    judgment.underwriting = {
      recoveryScore: score,
      collectabilityEstimate,
      recommendedPath,
      underwrittenAt: new Date().toISOString()
    };
    judgment.status = 'Underwritten';

    res.json({
      message: 'Underwriting complete',
      actionPlan: judgment.underwriting
    });
  });

  // ==========================================
  // 3) Enforcement Automation Engine API
  // ==========================================
  app.post('/api/enforce/:id', (req, res) => {
    const { id } = req.params;
    const judgment = db.judgments.find(j => j.id === id);

    if (!judgment) {
      return res.status(404).json({ error: 'Judgment not found' });
    }

    if (!judgment.underwriting) {
      return res.status(400).json({ error: 'Judgment not yet underwritten' });
    }

    // Mock Enforcement / e-filing logic
    judgment.enforcement = {
      pathExecuted: judgment.underwriting.recommendedPath,
      documentsGenerated: ['application.pdf', 'affidavit.pdf', 'exhibit_a.pdf'],
      eFilingStatus: 'Submitted',
      serviceCoordinated: true,
      auditLog: [
        { event: 'Documents Generated', timestamp: new Date().toISOString() },
        { event: 'E-filed via EFSP API', timestamp: new Date().toISOString() }
      ]
    };
    judgment.status = 'Enforcement Filed';

    res.json({
      message: `Enforcement pipeline triggered for ${judgment.enforcement.pathExecuted}`,
      details: judgment.enforcement
    });
  });

  // ==========================================
  // 4 & 5) Ops & Plaintiff Dashboard APIs
  // ==========================================
  app.get('/api/dashboard/ops', (req, res) => {
    const exceptions = db.judgments.filter(j => j.status === 'Exception');
    const activeQueues = db.judgments.filter(j => j.status !== 'Exception' && j.status !== 'Disbursed');

    res.json({
      metrics: {
        totalCases: db.judgments.length,
        exceptionsQueueCount: exceptions.length,
        activePipelines: activeQueues.length
      },
      queues: {
        exceptions,
        active: activeQueues
      }
    });
  });

  app.get('/api/dashboard/plaintiff/:id', (req, res) => {
    const { id } = req.params;
    const judgment = db.judgments.find(j => j.id === id);

    if (!judgment) {
      return res.status(404).json({ error: 'Judgment not found' });
    }

    // Simple status + transparency
    const statuses = ['Ingested', 'Underwritten', 'Enforcement Filed', 'Served', 'Frozen', 'Funds Received', 'Disbursed'];
    const currentIndex = statuses.indexOf(judgment.status);

    res.json({
      id: judgment.id,
      caseNumber: judgment.caseNumber,
      currentStatus: judgment.status,
      progress: `${Math.round(((currentIndex + 1) / statuses.length) * 100)}%`,
      timeline: statuses.map((status, index) => ({
        status,
        completed: index <= currentIndex
      }))
    });
  });

  // ==========================================
  // Health & Base Endpoints
  // ==========================================
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  return app;
}

function startServer(port = DEFAULT_PORT) {
  const app = createApp();
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
