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

const STATE_LABELS = {
  Received: 'Submitted',
  Reviewing: 'In review',
  Approved: 'Looks like a fit',
  'In Recovery': 'Recovery in progress',
  Paid: 'Paid',
  Closed: 'Not a fit',
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
    label: STATE_LABELS[state] || state,
    completed: currentIndex >= index && currentIndex !== -1,
    current: state === currentState,
  }));
}

function simplifyReason(reason) {
  if (!reason) {
    return reason;
  }

  const replacements = new Map([
    ['Only final judgments qualify right now.', 'We only handle final judgments right now.'],
    ['Only Bexar County judgments qualify right now.', 'We only handle Bexar County judgments right now.'],
    ['A case number is required.', 'We need the case number.'],
    ['The debtor name is required.', 'We need the name of the person or business that owes you money.'],
    ['A contact email is required.', 'We need your email address.'],
    ['The judgment appears outside the current enforcement window.', 'This judgment appears to be too old for our current program.'],
  ]);

  return replacements.get(reason) || reason;
}

function formatFeeLine(feeModel) {
  const rate = Math.round((feeModel?.contingencyRate || 0) * 100);
  return `Current fee: ${rate}% of money recovered.`;
}

function buildCustomerCopy(caseRecord) {
  const feeLine = formatFeeLine(caseRecord.feeModel);
  const currentState = caseRecord.currentState;
  const needsManualReview = currentState === 'Reviewing' && !caseRecord.intake.defaultJudgmentConfirmed;
  const needsMoreInfo = currentState === 'Reviewing' && caseRecord.intake.defaultJudgmentConfirmed;

  if (currentState === 'Approved') {
    return {
      displayState: STATE_LABELS[currentState],
      label: 'Looks like a fit',
      headline: 'Your judgment looks like a fit.',
      nextStep: 'Next step: we send the agreement for your review. If you want to move forward, you sign it first.',
      reasons: [],
      summaryBullets: [
        'No fee to submit and no upfront recovery fee.',
        `${feeLine.replace('Current fee: ', 'Standard fee if you move forward: ')}`,
        'Nothing moves forward until you review the agreement.',
      ],
    };
  }

  if (needsManualReview) {
    return {
      displayState: STATE_LABELS[currentState],
      label: 'In review',
      headline: 'We received your judgment and we are reviewing it now.',
      nextStep: 'We are taking a closer look before deciding the next step. If we need anything else, we will reach out.',
      reasons: ['We are reviewing the file now.'],
      summaryBullets: [
        'There is no upfront recovery fee during review.',
        'We will tell you the next step after review.',
        'If we need anything else, we will contact you.',
      ],
    };
  }

  if (needsMoreInfo) {
    const evaluationReasons = Array.isArray(caseRecord.evaluation.reasons)
      ? caseRecord.evaluation.reasons.map((reason) => reason.replace('Helpful detail: ', '').replace(/\.$/, ''))
      : [];

    return {
      displayState: STATE_LABELS[currentState],
      label: 'In review',
      headline: 'We received your judgment and we are reviewing it now.',
      nextStep: 'We are reviewing the file now. If we need anything else, we will reach out.',
      reasons: [],
      summaryBullets: [
        'There is no upfront recovery fee during review.',
        evaluationReasons.length
          ? `Most helpful details next: ${evaluationReasons.join(', ')}.`
          : 'We may need a few more details before moving forward.',
        'We will tell you the next step after review.',
      ],
    };
  }

  if (currentState === 'In Recovery') {
    return {
      displayState: STATE_LABELS[currentState],
      label: 'Recovery in progress',
      headline: 'Your recovery is in progress.',
      nextStep: 'We are moving the file forward and will keep you updated as it progresses.',
      reasons: [],
      summaryBullets: [
        feeLine,
        'No upfront recovery fee.',
        'You can follow the case as it moves toward payment.',
      ],
    };
  }

  if (currentState === 'Paid') {
    return {
      displayState: STATE_LABELS[currentState],
      label: 'Paid',
      headline: 'Money has been recovered on this case.',
      nextStep: 'We will show payment details here as the file closes out.',
      reasons: [],
      summaryBullets: [
        feeLine,
        'Payment has been recorded on this file.',
      ],
    };
  }

  if (currentState === 'Closed') {
    const reasons = Array.isArray(caseRecord.evaluation.reasons)
      ? caseRecord.evaluation.reasons.map(simplifyReason)
      : [];

    return {
      displayState: STATE_LABELS[currentState],
      label: 'Not a fit right now',
      headline: 'This judgment is not a fit for our current program.',
      nextStep: 'We cannot move this file forward as submitted.',
      reasons,
      summaryBullets: reasons.length ? reasons : ['This file is outside our current program.'],
    };
  }

  return {
    displayState: STATE_LABELS[currentState] || currentState,
    label: STATE_LABELS[currentState] || currentState,
    headline: 'We received your judgment.',
    nextStep: 'We are reviewing the file now.',
    reasons: [],
    summaryBullets: ['We will update you as the file moves forward.'],
  };
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
      label = 'In review';
      headline = 'We received your judgment and we are reviewing it now.';
      nextStep =
        'We are taking a closer look before deciding the next step. If we need anything else, we will reach out.';
    } else if (score >= 55) {
      decision = 'approved';
      approvalTier = score >= 75 ? 'A' : 'B';
      currentState = 'Approved';
      label = 'Looks like a fit';
      headline = 'Your judgment looks like a fit.';
      nextStep =
        'Next step: we send the agreement and start moving the file forward.';
    } else {
      decision = 'needs_more_info';
      approvalTier = 'C';
      currentState = 'Reviewing';
      label = 'In review';
      headline = 'We received your judgment and need a little more information.';
      nextStep =
        'We may reach out for a few more details before deciding the next step.';
    }
  }

  const reasons = hardFailReasons.length
    ? hardFailReasons
    : manualReviewRequired
      ? ['We are taking a closer look before deciding the next step.']
      : decision === 'needs_more_info'
      ? needsInfo.map((item) => `Helpful detail: ${item}.`)
      : softSignals;

  const summaryBullets = [];

  if (decision === 'approved') {
    summaryBullets.push('Current fee: 30% of money recovered.');
    summaryBullets.push('No upfront recovery fee.');
    summaryBullets.push('You can follow the case from review to payment.');
  } else if (decision === 'needs_more_info') {
    if (manualReviewRequired) {
      summaryBullets.push('There is no upfront recovery fee during review.');
      summaryBullets.push('We will tell you the next step after review.');
      summaryBullets.push('If we need anything else, we will contact you.');
    } else {
      summaryBullets.push('There is no upfront recovery fee during review.');
      if (needsInfo.length) {
        summaryBullets.push(`Most helpful details next: ${needsInfo.join(', ')}.`);
      }
      summaryBullets.push('We will tell you the next step after review.');
    }
  } else {
    summaryBullets.push('This file is outside our current program.');
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
  const customerCopy = buildCustomerCopy(caseRecord);

  return {
    id: caseRecord.id,
    currentState: caseRecord.currentState,
    displayState: customerCopy.displayState,
    createdAt: caseRecord.createdAt,
    plaintiffName: caseRecord.intake.plaintiffName,
    defendantName: caseRecord.intake.defendantName,
    caseNumber: caseRecord.intake.caseNumber,
    county: caseRecord.intake.county,
    judgmentAmount: caseRecord.intake.judgmentAmount,
    decision: caseRecord.evaluation.decision,
    approvalTier: caseRecord.evaluation.approvalTier,
    score: caseRecord.evaluation.score,
    label: customerCopy.label,
    headline: customerCopy.headline,
    nextStep: customerCopy.nextStep,
    reasons: customerCopy.reasons,
    recommendedPath: caseRecord.evaluation.recommendedPath,
    summaryBullets: customerCopy.summaryBullets,
    feeModel: caseRecord.feeModel,
    timeline: buildTimeline(caseRecord.currentState),
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
