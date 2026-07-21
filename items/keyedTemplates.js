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

module.exports = {
  templates,
  templateSummaries,
  getTemplate,
  buildInstance,
  buildGenericInstance,
  publicInstance,
  verifyAnswer,
  proofKey,
  clone,
  cleanString
};
