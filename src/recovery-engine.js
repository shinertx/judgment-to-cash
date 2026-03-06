const crypto = require('crypto');

const PLATFORM_CONFIG = {
  jurisdiction: 'Bexar County',
  wedge: 'Final unpaid default judgments',
  amountRange: {
    min: 5000,
    max: 250000,
  },
  feeModel: {
    contingencyRate: 0.3,
    headline: '30% contingency fee',
    details: 'We advance approved recovery costs and only get paid from money recovered.',
  },
  visibleStates: ['Received', 'Reviewing', 'Approved', 'In Recovery', 'Paid', 'Closed'],
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCurrency(value) {
  const raw = cleanText(value).replace(/[$,\s]/g, '');
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = cleanText(String(value)).toLowerCase();
  return ['true', 'yes', 'on', '1'].includes(normalized);
}

function parseDate(value) {
  const normalized = cleanText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function yearsBetween(later, earlier) {
  const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return (later.getTime() - earlier.getTime()) / millisecondsPerYear;
}

function buildId(now) {
  return `JTC-${now.getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function normalizeCounty(value) {
  return cleanText(value || PLATFORM_CONFIG.jurisdiction);
}

function normalizeIntake(input, uploadedFileName) {
  return {
    plaintiffName: cleanText(input.plaintiffName),
    contactEmail: cleanText(input.contactEmail).toLowerCase(),
    contactPhone: cleanText(input.contactPhone),
    defendantName: cleanText(input.defendantName),
    caseNumber: cleanText(input.caseNumber),
    county: normalizeCounty(input.county),
    judgmentAmount: parseCurrency(input.judgmentAmount),
    judgmentDate: parseDate(input.judgmentDate),
    finalJudgmentConfirmed: parseBoolean(input.finalJudgmentConfirmed),
    defaultJudgmentConfirmed: parseBoolean(input.defaultJudgmentConfirmed),
    debtorAddress: cleanText(input.debtorAddress),
    debtorBank: cleanText(input.debtorBank),
    debtorEmployer: cleanText(input.debtorEmployer),
    knownInformation: cleanText(input.knownInformation),
    uploadedFileName: uploadedFileName || null,
  };
}

function recommendedPath(intake) {
  if (intake.debtorBank) {
    return 'Bank garnishment review';
  }

  if (intake.knownInformation || intake.debtorEmployer) {
    return 'Asset discovery and partner review';
  }

  return 'Manual collectability review';
}

function buildTimeline(currentState) {
  const order = PLATFORM_CONFIG.visibleStates;
  const currentIndex = order.indexOf(currentState);

  return order.map((state, index) => ({
    state,
    completed: currentIndex >= index && currentIndex !== -1,
    current: state === currentState,
  }));
}

function buildNeedsInfoList(intake) {
  const prompts = [];

  if (!intake.debtorAddress) {
    prompts.push('Debtor address');
  }

  if (!intake.debtorBank) {
    prompts.push('Known bank');
  }

  if (!intake.judgmentAmount) {
    prompts.push('Judgment amount');
  }

  if (!intake.judgmentDate) {
    prompts.push('Judgment date');
  }

  return prompts;
}

function buildDecision(intake, now = new Date()) {
  const hardFailReasons = [];
  const softSignals = [];
  let manualReviewRequired = false;
  const judgmentDate =
    intake.judgmentDate instanceof Date ? intake.judgmentDate : parseDate(intake.judgmentDate);

  if (!intake.finalJudgmentConfirmed) {
    hardFailReasons.push('Only final judgments qualify right now.');
  }

  if (!intake.defaultJudgmentConfirmed) {
    manualReviewRequired = true;
    softSignals.push('Judgment type needs manual review');
  }

  if (!intake.caseNumber) {
    hardFailReasons.push('A case number is required.');
  }

  if (!intake.defendantName) {
    hardFailReasons.push('The debtor name is required.');
  }

  if (!intake.contactEmail) {
    hardFailReasons.push('A contact email is required.');
  }

  if (intake.county && !intake.county.toLowerCase().includes('bexar')) {
    hardFailReasons.push('Only Bexar County judgments qualify right now.');
  }

  if (
    intake.judgmentAmount &&
    (intake.judgmentAmount < PLATFORM_CONFIG.amountRange.min ||
      intake.judgmentAmount > PLATFORM_CONFIG.amountRange.max)
  ) {
    hardFailReasons.push(
      `The current workflow is focused on judgments between $${PLATFORM_CONFIG.amountRange.min.toLocaleString()} and $${PLATFORM_CONFIG.amountRange.max.toLocaleString()}.`
    );
  }

  if (judgmentDate) {
    const ageYears = yearsBetween(now, judgmentDate);
    if (ageYears > 10) {
      hardFailReasons.push('The judgment appears outside the current enforcement window.');
    }
  }

  let score = 0;

  if (intake.judgmentAmount) {
    if (intake.judgmentAmount >= 75000) {
      score += 25;
    } else if (intake.judgmentAmount >= 20000) {
      score += 18;
    } else {
      score += 10;
    }
  }

  if (judgmentDate) {
    const ageYears = yearsBetween(now, judgmentDate);
    if (ageYears <= 1) {
      score += 20;
    } else if (ageYears <= 3) {
      score += 15;
    } else if (ageYears <= 5) {
      score += 10;
    } else if (ageYears <= 10) {
      score += 5;
    }
  }

  if (intake.debtorAddress) {
    score += 12;
    softSignals.push('Known debtor address');
  }

  if (intake.debtorEmployer) {
    score += 10;
    softSignals.push('Known employer');
  }

  if (intake.debtorBank) {
    score += 15;
    softSignals.push('Known bank');
  }

  if (intake.knownInformation) {
    score += 12;
    softSignals.push('Additional debtor information provided');
  }

  if (intake.uploadedFileName) {
    score += 6;
  }

  if (!hardFailReasons.length && !intake.debtorAddress && !intake.debtorBank && !intake.knownInformation) {
    softSignals.push('More debtor detail would improve review quality');
  }

  const needsInfo = buildNeedsInfoList(intake);
  let decision = 'declined';
  let approvalTier = 'D';
  let currentState = 'Closed';
  let label = 'Does not qualify';
  let headline = 'Thank you. This judgment does not qualify right now.';
  let nextStep = 'We reviewed the file against the current recovery criteria and cannot move it forward as submitted.';

  if (!hardFailReasons.length) {
    if (manualReviewRequired) {
      decision = 'needs_more_info';
      approvalTier = 'C';
      currentState = 'Reviewing';
      label = 'Needs manual review';
      headline = 'Your judgment needs manual review before we can be sure.';
      nextStep =
        'Next step: we review the judgment type and decide whether it can move into recovery. There is still no upfront recovery fee during review.';
    } else if (score >= 55) {
      decision = 'approved';
      approvalTier = score >= 75 ? 'A' : 'B';
      currentState = 'Approved';
      label = 'Approved for recovery review';
      headline = 'Your judgment looks like a fit for recovery review.';
      nextStep =
        'Next step: agreement review and same-day partner handoff when the file is ready. Recovery timing still depends on court process and debtor assets.';
    } else {
      decision = 'needs_more_info';
      approvalTier = 'C';
      currentState = 'Reviewing';
      label = 'Needs more information';
      headline = 'We need a little more information before we can decide.';
      nextStep =
        'Next step: we review the additional debtor details and decide whether the judgment is strong enough to move forward.';
    }
  }

  const reasons = hardFailReasons.length
    ? hardFailReasons
    : manualReviewRequired
      ? ['This judgment may still be a fit, but it is outside the fastest default-judgment workflow and needs manual review.']
      : decision === 'needs_more_info'
      ? needsInfo.map((item) => `Helpful detail: ${item}.`)
      : softSignals;

  const summaryBullets = [];

  if (decision === 'approved') {
    summaryBullets.push('Current fee: 30% of recovered funds.');
    summaryBullets.push('Approved files move into partner review without upfront recovery costs.');
    summaryBullets.push('You can track the file from review to payment.');
  } else if (decision === 'needs_more_info') {
    if (manualReviewRequired) {
      summaryBullets.push('This file needs manual review before we decide whether to move it into recovery.');
      summaryBullets.push('There is still no upfront recovery fee during review.');
      summaryBullets.push('We will use the judgment type and the rest of the file to decide the next step.');
    } else {
      summaryBullets.push('We need a few more details before approving the file.');
      if (needsInfo.length) {
        summaryBullets.push(`Most helpful next details: ${needsInfo.join(', ')}.`);
      }
      summaryBullets.push('There is still no upfront recovery fee during review.');
    }
  } else {
    summaryBullets.push('This file is outside the current recovery criteria.');
    summaryBullets.push('We focus on final unpaid Bexar County default judgments.');
  }

  return {
    score,
    decision,
    approvalTier,
    currentState,
    label,
    headline,
    nextStep,
    reasons,
    recommendedPath: recommendedPath(intake),
    summaryBullets,
  };
}

function createCaseRecord(input, options = {}) {
  const now = options.now || new Date();
  const intake = normalizeIntake(input, options.uploadedFileName);
  const evaluation = buildDecision(intake, now);

  return {
    id: buildId(now),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    intake,
    evaluation,
    currentState: evaluation.currentState,
    timeline: buildTimeline(evaluation.currentState),
    feeModel: PLATFORM_CONFIG.feeModel,
  };
}

function buildCaseResponse(caseRecord) {
  return {
    id: caseRecord.id,
    currentState: caseRecord.currentState,
    createdAt: caseRecord.createdAt,
    plaintiffName: caseRecord.intake.plaintiffName,
    defendantName: caseRecord.intake.defendantName,
    caseNumber: caseRecord.intake.caseNumber,
    county: caseRecord.intake.county,
    judgmentAmount: caseRecord.intake.judgmentAmount,
    decision: caseRecord.evaluation.decision,
    approvalTier: caseRecord.evaluation.approvalTier,
    score: caseRecord.evaluation.score,
    label: caseRecord.evaluation.label,
    headline: caseRecord.evaluation.headline,
    nextStep: caseRecord.evaluation.nextStep,
    reasons: caseRecord.evaluation.reasons,
    recommendedPath: caseRecord.evaluation.recommendedPath,
    summaryBullets: caseRecord.evaluation.summaryBullets,
    feeModel: caseRecord.feeModel,
    timeline: caseRecord.timeline,
  };
}

module.exports = {
  PLATFORM_CONFIG,
  buildCaseResponse,
  buildDecision,
  buildTimeline,
  createCaseRecord,
  normalizeIntake,
};
