const fs = require('fs');
const path = require('path');

const DEFAULT_CASES_PATH = path.join(__dirname, '../data/cases.json');

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function ensureFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]\n', 'utf8');
  }
}

function loadCases(filePath) {
  ensureFile(filePath);

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
}

function saveCases(filePath, cases) {
  ensureFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(cases, null, 2)}\n`, 'utf8');
}

function createMemoryStore(initialCases = []) {
  const cases = [...initialCases];

  return {
    listCases() {
      return cases;
    },
    addCase(caseRecord) {
      cases.push(caseRecord);
      return caseRecord;
    },
    getCase(id) {
      return cases.find((caseRecord) => caseRecord.id === id) || null;
    },
    findCaseByLookup(caseId, contactEmail) {
      const normalizedEmail = normalizeEmail(contactEmail);

      return (
        cases.find(
          (caseRecord) =>
            caseRecord.id === caseId &&
            normalizeEmail(caseRecord.intake.contactEmail) === normalizedEmail
        ) || null
      );
    },
    saveCase(caseRecord) {
      const index = cases.findIndex((entry) => entry.id === caseRecord.id);

      if (index === -1) {
        cases.push(caseRecord);
      } else {
        cases[index] = caseRecord;
      }

      return caseRecord;
    },
  };
}

function createFileStore(filePath = DEFAULT_CASES_PATH) {
  return {
    listCases() {
      return loadCases(filePath);
    },
    addCase(caseRecord) {
      const cases = loadCases(filePath);
      cases.push(caseRecord);
      saveCases(filePath, cases);
      return caseRecord;
    },
    getCase(id) {
      return loadCases(filePath).find((caseRecord) => caseRecord.id === id) || null;
    },
    findCaseByLookup(caseId, contactEmail) {
      const normalizedEmail = normalizeEmail(contactEmail);

      return (
        loadCases(filePath).find(
          (caseRecord) =>
            caseRecord.id === caseId &&
            normalizeEmail(caseRecord.intake.contactEmail) === normalizedEmail
        ) || null
      );
    },
    saveCase(caseRecord) {
      const cases = loadCases(filePath);
      const index = cases.findIndex((entry) => entry.id === caseRecord.id);

      if (index === -1) {
        cases.push(caseRecord);
      } else {
        cases[index] = caseRecord;
      }

      saveCases(filePath, cases);
      return caseRecord;
    },
  };
}

module.exports = {
  DEFAULT_CASES_PATH,
  createFileStore,
  createMemoryStore,
};
