const crypto = require('crypto');

function hashHex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value, fallback, limit) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return (text || fallback).slice(0, limit);
}

function seedFor(studentId, assignmentId, templateId) {
  return hashHex(`${templateId}|${cleanString(assignmentId, 'assignment', 120)}|${cleanString(studentId, 'student', 120)}`);
}

function intFromSeed(seed, offset, min, max) {
  const span = max - min + 1;
  const chunk = seed.slice(offset, offset + 8);
  return min + (parseInt(chunk, 16) % span);
}

function choiceFromSeed(seed, offset, list) {
  return list[intFromSeed(seed, offset, 0, list.length - 1)];
}

function seedTag(seed) {
  return seed.slice(0, 10).toUpperCase();
}

function checksum(parts) {
  return hashHex(parts.join('|')).slice(0, 8).toUpperCase();
}

function asNumber(value) {
  if (typeof value === 'object' && value !== null && 'answer' in value) return asNumber(value.answer);
  const text = String(value == null ? '' : value).replace(/,/g, '').trim();
  if (!text) return NaN;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function digitCode(value, width) {
  if (typeof value === 'object' && value !== null && 'answer' in value) return digitCode(value.answer, width);
  const text = String(value == null ? '' : value).trim();
  const match = text.match(/\d+/);
  if (!match) return null;
  const digits = match[0].slice(-width);
  return digits.padStart(width, '0');
}

function numericCanonical(value, decimals) {
  const n = asNumber(value);
  if (!Number.isFinite(n)) return '';
  return decimals === 0 ? String(Math.round(n)) : n.toFixed(decimals);
}

function proofKey(template, answer, instance) {
  const canonical = template.canonicalAnswer(answer, instance);
  const check = checksum([template.id, instance.seed, canonical, instance.canary]);
  return `KM-${template.code}-${instance.seedTag}-${check}`;
}

function publicInstance(template, instance, includeSolution) {
  const solved = template.solve(instance);
  const out = {
    templateId: template.id,
    templateTitle: template.title,
    subject: template.subject,
    seedTag: instance.seedTag,
    seedFingerprint: instance.seedFingerprint,
    assignmentId: instance.assignmentId,
    studentId: instance.studentId,
    studentName: instance.studentName,
    prompt: template.prompt(instance),
    answerFormat: template.answerFormat,
    proofHint: 'Submit the answer plus the proof key for this seed. A bare answer is not sufficient to pass.'
  };
  if (includeSolution) {
    out.correctAnswer = template.displayAnswer(solved, instance);
    out.proofKey = proofKey(template, solved, instance);
  }
  return out;
}

const templates = [
  {
    id: 'break-even-lab-kits',
    code: 'MATH',
    subject: 'Math / quantitative',
    title: 'Break-even Lab Kits',
    answerFormat: 'Whole number of kits',
    parameterize(seed, meta) {
      const targetQuantity = intFromSeed(seed, 0, 100, 49999);
      const margin = intFromSeed(seed, 8, 5, 73);
      const material = intFromSeed(seed, 16, 8, 96);
      const price = material + margin;
      const remainder = intFromSeed(seed, 24, 1, margin);
      const fixedCost = (targetQuantity - 1) * margin + remainder;
      return {
        seed,
        seedTag: seedTag(seed),
        seedFingerprint: checksum(['seed', seed]).slice(0, 6),
        canary: checksum(['break-even', seed, price, material, fixedCost]),
        assignmentId: meta.assignmentId,
        studentId: meta.studentId,
        studentName: meta.studentName,
        price,
        material,
        fixedCost,
        margin,
        targetQuantity
      };
    },
    prompt(instance) {
      return `A class lab fund prints custom review kits. Setup costs $${instance.fixedCost}. Each kit sells for $${instance.price} and costs $${instance.material} to make. What is the minimum whole number of kits the class must sell to break even?`;
    },
    solve(instance) {
      return Math.ceil(instance.fixedCost / instance.margin);
    },
    canonicalAnswer(answer) {
      return numericCanonical(answer, 0);
    },
    answerEquals(submitted, expected) {
      const n = asNumber(submitted);
      return Number.isFinite(n) && Math.round(n) === Number(expected);
    },
    displayAnswer(answer) {
      return `${Math.round(Number(answer))} kits`;
    },
    explanation(instance, answer) {
      return `Break-even uses setup cost divided by per-kit margin: ${instance.fixedCost} / (${instance.price} - ${instance.material}) = ${answer}.`;
    },
    feedback(instance, answer, valid, teacherWhy, concept) {
      const submitted = asNumber(answer);
      const expectedMargin = instance.price - instance.material;
      const exactBreakEven = instance.fixedCost / expectedMargin;
      const rounded = Math.ceil(exactBreakEven);
      let brokenStep = 'final-check';
      let feedback = `Your submitted value does not complete the break-even reasoning for your numbers.`;
      let forward = `On the next fresh version, write the margin first, divide setup cost by that margin, then round up because partial kits cannot be sold.`;

      if (!Number.isFinite(submitted)) {
        brokenStep = 'answer-format';
        feedback = `I could not read a whole-number kit count from your answer.`;
        forward = `Submit one whole number of kits, then seal that answer before submitting.`;
      } else if (Math.round(submitted) === expectedMargin) {
        brokenStep = 'unit-margin';
        feedback = `You found the per-kit margin: ${instance.price} - ${instance.material} = ${expectedMargin}. That is an intermediate step, not the number of kits needed.`;
      } else if (Math.abs(submitted - exactBreakEven) < 0.01 && submitted !== rounded) {
        brokenStep = 'rounding';
        feedback = `You reached the exact break-even ratio, but the business needs a whole number of kits. Since ${exactBreakEven.toFixed(2)} is not a whole kit count, the final step is to round up.`;
      } else if (Math.round(submitted) === Math.floor(exactBreakEven)) {
        brokenStep = 'rounding-down';
        feedback = `Your answer rounds down from the break-even ratio. That leaves the class short of covering the setup cost.`;
      } else if (submitted < rounded) {
        brokenStep = 'division-or-margin';
        feedback = `Your count is too low for this setup cost and margin. The margin must be based on your instance: selling price ${instance.price} minus cost ${instance.material}.`;
      } else {
        brokenStep = 'division-or-overestimate';
        feedback = `Your count is higher than the minimum needed. The goal is the minimum whole kit count after dividing setup cost by margin.`;
      }

      return {
        feedUp: `${concept}: use contribution margin to decide the minimum whole number of kits needed to cover fixed setup cost.`,
        feedBack: valid
          ? `You proved the loop on your numbers. ${teacherWhy}`
          : `${feedback} Teacher why: ${teacherWhy}`,
        feedForward: valid
          ? `Try explaining the margin and rounding step in one sentence; that is the transferable skill.`
          : forward,
        brokenStep,
        stepLabel: brokenStep === 'unit-margin' ? 'Found margin but stopped early' : brokenStep === 'rounding' || brokenStep === 'rounding-down' ? 'Rounding to a feasible whole unit' : 'Set up and divide by margin'
      };
    }
  },
  {
    id: 'sensor-cooling-rate',
    code: 'SCI',
    subject: 'Science / data',
    title: 'Cooling Sensor Rate',
    answerFormat: 'Whole-number calibrated cooling index',
    parameterize(seed, meta) {
      const startMinute = intFromSeed(seed, 0, 1, 6);
      const elapsed = intFromSeed(seed, 8, 8, 15);
      const startTemp = intFromSeed(seed, 16, 68, 94);
      const dropTenths = intFromSeed(seed, 24, 42, 420);
      const drop = dropTenths / 10;
      const endTemp = Number((startTemp - drop).toFixed(1));
      const circulationRate = intFromSeed(seed, 32, 17, 97);
      const targetIndex = intFromSeed(seed, 40, 10000, 99999);
      const calibrationOffset = targetIndex - dropTenths * circulationRate;
      return {
        seed,
        seedTag: seedTag(seed),
        seedFingerprint: checksum(['seed', seed]).slice(0, 6),
        canary: checksum(['cooling', seed, startMinute, elapsed, startTemp, endTemp]),
        assignmentId: meta.assignmentId,
        studentId: meta.studentId,
        studentName: meta.studentName,
        startMinute,
        endMinute: startMinute + elapsed,
        elapsed,
        startTemp,
        endTemp,
        dropTenths,
        circulationRate,
        calibrationOffset,
        targetIndex
      };
    },
    prompt(instance) {
      const sign = instance.calibrationOffset >= 0 ? '+' : '-';
      const offset = Math.abs(instance.calibrationOffset);
      return `A cooling experiment records ${instance.startTemp.toFixed(1)} C at minute ${instance.startMinute} and ${instance.endTemp.toFixed(1)} C at minute ${instance.endMinute}. The instrument's calibrated cooling index is: temperature drop in tenths of a degree C, multiplied by circulation rate ${instance.circulationRate}, then ${sign} ${offset} for calibration. What whole-number index is recorded?`;
    },
    solve(instance) {
      return instance.dropTenths * instance.circulationRate + instance.calibrationOffset;
    },
    canonicalAnswer(answer) {
      return numericCanonical(answer, 0);
    },
    answerEquals(submitted, expected) {
      const n = asNumber(submitted);
      return Number.isFinite(n) && Math.round(n) === Number(expected);
    },
    displayAnswer(answer) {
      return `${Math.round(Number(answer))} index units`;
    },
    explanation(instance, answer) {
      return `Cooling index is ${instance.dropTenths} tenths C * ${instance.circulationRate} plus calibration ${instance.calibrationOffset}, which equals ${Math.round(Number(answer))}.`;
    },
    feedback(instance, answer, valid, teacherWhy, concept) {
      const submitted = asNumber(answer);
      const drop = Math.round((instance.startTemp - instance.endTemp) * 10);
      let brokenStep = 'calibrated-index';
      let feedback = `The calibrated index combines three pieces from your instance: temperature drop in tenths, circulation rate, and calibration offset.`;
      if (!Number.isFinite(submitted)) {
        brokenStep = 'answer-format';
        feedback = `I could not read a whole-number index from your answer.`;
      } else if (Math.round(submitted) === drop) {
        brokenStep = 'temperature-drop';
        feedback = `You appear to have found the temperature drop in tenths (${drop}), but the index also multiplies by circulation rate and applies the calibration.`;
      } else if (Math.round(submitted) === drop * instance.circulationRate) {
        brokenStep = 'calibration-offset';
        feedback = `You multiplied the drop by the circulation rate, but the calibrated instrument also applies this instance's offset.`;
      }
      return {
        feedUp: `${concept}: translate a data record into a calibrated index by following the defined operations in order.`,
        feedBack: valid ? `You followed the data transformation for your sensor record. ${teacherWhy}` : `${feedback} Teacher why: ${teacherWhy}`,
        feedForward: valid ? `Name the three operations in order: drop, scale, calibrate.` : `On the retry, annotate each number before calculating: drop in tenths, circulation multiplier, then calibration adjustment.`,
        brokenStep,
        stepLabel: brokenStep === 'temperature-drop' ? 'Stopped at raw drop' : brokenStep === 'calibration-offset' ? 'Missed calibration' : 'Follow the full transformation'
      };
    }
  },
  {
    id: 'modular-display-sequence',
    code: 'LOGIC',
    subject: 'Logic / quantitative reasoning',
    title: 'Eight-Digit Recurrence Lock',
    answerFormat: 'Eight-digit display value',
    parameterize(seed, meta) {
      const multipliers = [1103515245, 1664525, 22695477, 214013, 134775813];
      const start = intFromSeed(seed, 0, 10000000, 99999999);
      const multiplier = choiceFromSeed(seed, 8, multipliers);
      const add = intFromSeed(seed, 16, 10000, 99999999);
      const cycles = intFromSeed(seed, 24, 5, 11);
      return {
        seed,
        seedTag: seedTag(seed),
        seedFingerprint: checksum(['seed', seed]).slice(0, 6),
        canary: checksum(['sequence', seed, start, multiplier, add, cycles]),
        assignmentId: meta.assignmentId,
        studentId: meta.studentId,
        studentName: meta.studentName,
        start,
        multiplier,
        add,
        cycles
      };
    },
    prompt(instance) {
      return `An eight-digit lock starts at ${String(instance.start).padStart(8, '0')}. Each cycle multiplies the current display by ${instance.multiplier}, adds ${instance.add}, and keeps only the last eight digits. What eight-digit value appears after ${instance.cycles} cycles?`;
    },
    solve(instance) {
      let value = instance.start;
      for (let i = 0; i < instance.cycles; i++) {
        value = (BigInt(value) * BigInt(instance.multiplier) + BigInt(instance.add)) % 100000000n;
      }
      return String(value).padStart(8, '0');
    },
    canonicalAnswer(answer) {
      return digitCode(answer, 8) || '';
    },
    answerEquals(submitted, expected) {
      return digitCode(submitted, 8) === String(expected).padStart(8, '0');
    },
    displayAnswer(answer) {
      return String(answer).padStart(8, '0');
    },
    explanation(instance, answer) {
      return `Iterating ${instance.cycles} keyed cycles from ${String(instance.start).padStart(8, '0')} gives final display ${String(answer).padStart(8, '0')}.`;
    },
    feedback(instance, answer, valid, teacherWhy, concept) {
      return {
        feedUp: `${concept}: apply a recurrence repeatedly and keep only the last eight digits after each cycle.`,
        feedBack: valid
          ? `You maintained the recurrence state across all ${instance.cycles} cycles. ${teacherWhy}`
          : `This answer does not match the final display produced by your recurrence. The most common break is applying the last-eight-digits rule only at the end instead of after every cycle. Teacher why: ${teacherWhy}`,
        feedForward: valid
          ? `For transfer, write one cycle as: new display = last8(old * multiplier + add).`
          : `On the retry, make a small table with one row per cycle and trim to eight digits after each row.`,
        brokenStep: valid ? 'complete' : 'recurrence-iteration',
        stepLabel: valid ? 'Completed recurrence' : 'Iterate and trim each cycle'
      };
    }
  }
];

const templateMap = Object.fromEntries(templates.map(template => [template.id, template]));

function templateSummaries() {
  return templates.map(template => ({
    id: template.id,
    code: template.code,
    title: template.title,
    subject: template.subject,
    answerFormat: template.answerFormat
  }));
}

function getTemplate(id) {
  const template = templateMap[id] || templates[0];
  return template;
}

function buildInstance(templateId, assignmentId, studentId, studentName) {
  const template = getTemplate(templateId);
  const normalizedStudentId = cleanString(studentId, studentName || 'student', 120);
  const normalizedAssignmentId = cleanString(assignmentId, 'build-week-demo', 120);
  const seed = seedFor(normalizedStudentId, normalizedAssignmentId, template.id);
  return template.parameterize(seed, {
    assignmentId: normalizedAssignmentId,
    studentId: normalizedStudentId,
    studentName: cleanString(studentName, normalizedStudentId, 80)
  });
}

function buildGenericInstance(templateId) {
  const template = getTemplate(templateId);
  const seed = seedFor('GENERIC-SHARED-PROMPT', 'UNSEEDED', template.id);
  return template.parameterize(seed, {
    assignmentId: 'UNSEEDED',
    studentId: 'GENERIC-SHARED-PROMPT',
    studentName: 'Generic shared prompt'
  });
}

function verifyAnswer(templateId, submittedAnswer, targetInstance, opts) {
  const template = getTemplate(templateId);
  const expected = template.solve(targetInstance);
  const answerText = typeof submittedAnswer === 'object' && submittedAnswer !== null && 'answer' in submittedAnswer
    ? submittedAnswer.answer
    : submittedAnswer;
  const submittedProofKey = typeof submittedAnswer === 'object' && submittedAnswer !== null
    ? cleanString(submittedAnswer.proofKey, '', 120)
    : '';
  const correctForTarget = template.answerEquals(answerText, expected, targetInstance);
  const expectedProofKey = proofKey(template, expected, targetInstance);
  const submittedCanonical = template.canonicalAnswer(answerText, targetInstance);
  const known = ((opts && opts.knownInstances) || []).filter(item => item && item.instance);

  const sourceByAnswer = known.find(item => {
    if (item.instance.seed === targetInstance.seed) return false;
    return template.answerEquals(answerText, template.solve(item.instance), item.instance);
  });
  const sourceByProof = submittedProofKey && known.find(item => {
    if (item.instance.seed === targetInstance.seed) return false;
    return submittedProofKey === proofKey(template, template.solve(item.instance), item.instance);
  });
  const source = sourceByProof || sourceByAnswer;

  if (correctForTarget) {
    if (!submittedProofKey) {
      return {
        valid: false,
        reason: `Rejected. The answer value is correct for ${targetInstance.studentName}'s seeded instance (${targetInstance.seedTag}), but no proof key was submitted. Keymark requires the answer and the target-seed proof key.`,
        expectedAnswer: template.displayAnswer(expected, targetInstance),
        expectedProofKey,
        submittedCanonical
      };
    }
    if (submittedProofKey !== expectedProofKey) {
      return {
        valid: false,
        reason: source
          ? `The answer is numerically right here, but its proof key belongs to ${source.label} (${source.instance.seedTag}), not ${targetInstance.studentName} (${targetInstance.seedTag}).`
          : `The answer is numerically right, but the submitted proof key does not bind to this seeded instance (${targetInstance.seedTag}).`,
        expectedAnswer: template.displayAnswer(expected, targetInstance),
        expectedProofKey,
        submittedCanonical
      };
    }
    return {
      valid: true,
      reason: `Accepted. The answer matches ${targetInstance.studentName}'s seeded instance (${targetInstance.seedTag}) and recomputes proof key ${expectedProofKey}.`,
      expectedAnswer: template.displayAnswer(expected, targetInstance),
      proofKey: expectedProofKey,
      explanation: template.explanation(targetInstance, expected)
    };
  }

  if (source) {
    const sourceAnswer = template.solve(source.instance);
    return {
      valid: false,
      reason: `Rejected. This answer is correct for ${source.label} (${source.instance.seedTag}), not for ${targetInstance.studentName} (${targetInstance.seedTag}). Solver-bound validity fails because the answer came from a different seeded instance.`,
      expectedAnswer: template.displayAnswer(expected, targetInstance),
      submittedAnswer: template.displayAnswer(sourceAnswer, source.instance),
      expectedProofKey
    };
  }

  return {
    valid: false,
    reason: `Rejected. The submitted answer does not satisfy the deterministic solver for ${targetInstance.studentName}'s seeded instance (${targetInstance.seedTag}).`,
    expectedAnswer: template.displayAnswer(expected, targetInstance),
    expectedProofKey
  };
}

function feedbackForSubmission(templateId, submittedAnswer, instance, verification, teacherWhy, concept) {
  const template = getTemplate(templateId);
  const answerText = typeof submittedAnswer === 'object' && submittedAnswer !== null && 'answer' in submittedAnswer
    ? submittedAnswer.answer
    : submittedAnswer;
  const why = cleanString(teacherWhy, 'This concept matters because the reasoning transfers to new numbers, not just this one answer.', 900);
  const conceptName = cleanString(concept, template.title, 120);
  if (typeof template.feedback === 'function') {
    return template.feedback(instance, answerText, !!(verification && verification.valid), why, conceptName);
  }
  return {
    feedUp: `${conceptName}: apply the stated rule to your seeded instance.`,
    feedBack: verification && verification.valid ? `Your answer matched your keyed instance. ${why}` : `Your answer did not match the deterministic check for this seeded instance. ${why}`,
    feedForward: verification && verification.valid ? 'Explain the method in your own words.' : 'Try a fresh version and write each operation before calculating.',
    brokenStep: verification && verification.valid ? 'complete' : 'principle',
    stepLabel: verification && verification.valid ? 'Complete' : 'Review the principle'
  };
}

module.exports = {
  templates,
  templateSummaries,
  getTemplate,
  buildInstance,
  buildGenericInstance,
  publicInstance,
  verifyAnswer,
  feedbackForSubmission,
  proofKey,
  clone,
  cleanString
};
