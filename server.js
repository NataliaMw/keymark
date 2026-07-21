#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  templateSummaries,
  getTemplate,
  buildInstance,
  buildGenericInstance,
  publicInstance,
  verifyAnswer,
  feedbackForSubmission,
  proofKey,
  cleanString
} = require('./items/keyedTemplates');
const { runSelfTest } = require('./selftest');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const DEFAULT_ASSIGNMENT = 'build-week-2026-education';
const DEFAULT_TEMPLATE = 'break-even-lab-kits';
const DEFAULT_CLASS = [
  ['ava-2041', 'Ava Chen'],
  ['mateo-1188', 'Mateo Rivera'],
  ['zara-9050', 'Zara Patel'],
  ['noah-3317', 'Noah Brooks'],
  ['mina-7720', 'Mina Okafor'],
  ['leo-6403', 'Leo Santos'],
  ['ivy-2914', 'Ivy Park'],
  ['sam-8506', 'Sam Lewis']
];
const assignments = {};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function requestValue(url, body, key, fallback) {
  if (body && body[key] != null) return body[key];
  return url.searchParams.get(key) || fallback;
}

function classRoster(count) {
  const n = Math.max(2, Math.min(12, Number(count) || 6));
  return DEFAULT_CLASS.slice(0, n).map(([studentId, studentName]) => ({ studentId, studentName }));
}

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return assignments[code] ? makeCode() : code;
}

function studentKey(name) {
  return cleanString(name, 'Student', 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'student';
}

function assignmentView(assignment) {
  return {
    code: assignment.code,
    title: assignment.title,
    concept: assignment.concept,
    reasoningExplanation: assignment.reasoningExplanation,
    teacherName: assignment.teacherName,
    template: templateSummaries().find(item => item.id === assignment.templateId),
    expectedClassSize: assignment.expectedClassSize,
    masteryThreshold: assignment.masteryThreshold,
    retryPolicy: assignment.retryPolicy,
    createdAt: assignment.createdAt,
    joinUrl: `/`
  };
}

function requireAssignment(res, code) {
  const assignment = assignments[String(code || '').trim().toUpperCase()];
  if (!assignment) {
    sendJSON(res, 404, { error: 'No assignment found for that join code' });
    return null;
  }
  return assignment;
}

function knownAssignmentInstances(assignment) {
  return Object.values(assignment.students).map(student => ({
    label: student.name,
    instance: studentInstanceForAssignment(assignment, student)
  }));
}

function studentInstanceForAssignment(assignment, student) {
  return buildInstance(assignment.templateId, attemptSeed(assignment, student), student.studentId, student.name);
}

function attemptSeed(assignment, student) {
  return `${assignment.code}:attempt:${student.currentAttempt || 1}`;
}

function productVerification(verification) {
  const safe = { ...verification };
  if (!safe.valid) {
    delete safe.expectedAnswer;
    delete safe.expectedProofKey;
    delete safe.submittedAnswer;
    delete safe.submittedCanonical;
  }
  return safe;
}

function defaultReasoning(template) {
  if (template.id === 'break-even-lab-kits') {
    return 'Students should learn to identify the per-unit margin, divide fixed cost by that margin, and round up because the context asks for a feasible whole quantity.';
  }
  if (template.id === 'sensor-cooling-rate') {
    return 'Students should learn to transform data in the order specified by the model, keeping units attached to each operation.';
  }
  return 'Students should learn to track state carefully through repeated operations instead of treating a recurrence as one static calculation.';
}

function boardView(assignment) {
  const missCounts = {};
  const rows = Object.values(assignment.students).map(student => {
    const instance = studentInstanceForAssignment(assignment, student);
    const latest = student.attempts[student.attempts.length - 1] || null;
    for (const attempt of student.attempts) {
      if (!attempt.valid) missCounts[attempt.brokenStep] = (missCounts[attempt.brokenStep] || 0) + 1;
    }
    return {
      name: student.name,
      studentId: student.studentId,
      seedTag: instance.seedTag,
      joinedAt: student.joinedAt,
      status: student.mastered ? 'MASTERED' : latest ? (latest.valid ? 'BUILDING' : 'NEEDS PRACTICE') : 'JOINED',
      masteryLevel: Math.min(student.streak, assignment.masteryThreshold),
      masteryTarget: assignment.masteryThreshold,
      masteryPercent: Math.round((Math.min(student.streak, assignment.masteryThreshold) / assignment.masteryThreshold) * 100),
      attempts: student.attempts.length,
      currentAttempt: student.currentAttempt,
      lastAnswer: latest && latest.answer,
      lastStep: latest && latest.stepLabel,
      reason: latest && latest.feedback && latest.feedback.feedBack,
      copiedAttempt: !!(latest && latest.copySignal),
      updatedAt: latest && latest.submittedAt
    };
  });
  const missingStep = Object.entries(missCounts).sort((a, b) => b[1] - a[1])[0];
  return {
    assignment: assignmentView(assignment),
    summary: {
      joined: rows.length,
      attempts: rows.reduce((sum, row) => sum + row.attempts, 0),
      mastered: rows.filter(row => row.status === 'MASTERED').length,
      needsSupport: rows.filter(row => row.status === 'NEEDS PRACTICE').length,
      expectedClassSize: assignment.expectedClassSize
    },
    rows,
    missingStep: missingStep ? { step: missingStep[0], count: missingStep[1] } : null,
    template: templateSummaries().find(item => item.id === assignment.templateId)
  };
}

function knownInstances(templateId, assignmentId, roster, includeGeneric) {
  const known = roster.map(student => ({
    label: student.studentName,
    instance: buildInstance(templateId, assignmentId, student.studentId, student.studentName)
  }));
  if (includeGeneric) {
    known.push({ label: 'the generic unseeded prompt', instance: buildGenericInstance(templateId) });
  }
  return known;
}

function buildClassView(templateId, assignmentId, count, includeSolutions) {
  const template = getTemplate(templateId);
  const roster = classRoster(count);
  const students = roster.map(student => {
    const instance = buildInstance(template.id, assignmentId, student.studentId, student.studentName);
    return publicInstance(template, instance, includeSolutions);
  });
  return {
    assignmentId,
    template: templateSummaries().find(item => item.id === template.id),
    students
  };
}

function verifyForRequest(body) {
  const template = getTemplate(body.templateId || DEFAULT_TEMPLATE);
  const assignmentId = cleanString(body.assignmentId, DEFAULT_ASSIGNMENT, 120);
  const studentName = cleanString(body.studentName, 'Student', 80);
  const studentId = cleanString(body.studentId, studentName, 120);
  const target = buildInstance(template.id, assignmentId, studentId, studentName);
  const roster = classRoster(body.count || 6);
  const mergedRoster = roster.some(student => student.studentId === studentId)
    ? roster
    : [{ studentId, studentName }, ...roster].slice(0, 12);
  const known = knownInstances(template.id, assignmentId, mergedRoster, true);
  const verification = verifyAnswer(template.id, { answer: body.answer, proofKey: body.proofKey }, target, { knownInstances: known });
  return {
    instance: publicInstance(template, target, false),
    verification
  };
}

function copyRing(templateId, assignmentId, count) {
  const template = getTemplate(templateId);
  const roster = classRoster(count);
  const known = knownInstances(template.id, assignmentId, roster, true);
  return roster.map((student, index) => {
    const target = buildInstance(template.id, assignmentId, student.studentId, student.studentName);
    const sourceStudent = roster[(index + roster.length - 1) % roster.length];
    const source = buildInstance(template.id, assignmentId, sourceStudent.studentId, sourceStudent.studentName);
    const sourceAnswer = template.solve(source);
    const verification = verifyAnswer(
      template.id,
      { answer: sourceAnswer, proofKey: proofKey(template, sourceAnswer, source) },
      target,
      { knownInstances: known }
    );
    return {
      target: student.studentName,
      targetSeed: target.seedTag,
      copiedFrom: sourceStudent.studentName,
      copiedSeed: source.seedTag,
      submittedAnswer: template.displayAnswer(sourceAnswer, source),
      valid: verification.valid,
      reason: verification.reason
    };
  });
}

function findSameAnswerPair(templateId, assignmentId, limit) {
  const template = getTemplate(templateId);
  const seen = new Map();
  const max = Math.max(50, Math.min(6000, Number(limit) || 5000));
  for (let i = 1; i <= max; i++) {
    const studentId = `student-${String(i).padStart(4, '0')}`;
    const studentName = `Student ${i}`;
    const instance = buildInstance(template.id, assignmentId, studentId, studentName);
    const answer = template.solve(instance);
    const canonical = template.canonicalAnswer(answer, instance);
    if (seen.has(canonical)) {
      return {
        template,
        first: seen.get(canonical),
        second: { studentId, studentName, instance, answer, canonical }
      };
    }
    seen.set(canonical, { studentId, studentName, instance, answer, canonical });
  }
  return null;
}

function sameAnswerDemo(templateId) {
  const requestedTemplate = getTemplate(templateId);
  const collisionAssignment = 'selftest-answer-separation';
  const found = findSameAnswerPair(requestedTemplate.id, collisionAssignment, 5000)
    || findSameAnswerPair(DEFAULT_TEMPLATE, collisionAssignment, 5000);
  if (!found) throw new Error('No deterministic same-answer pair found');

  const template = found.template;
  const firstProofKey = proofKey(template, found.first.answer, found.first.instance);
  const secondProofKey = proofKey(template, found.second.answer, found.second.instance);
  const known = [
    { label: found.first.studentName, instance: found.first.instance },
    { label: found.second.studentName, instance: found.second.instance }
  ];
  const transplant = verifyAnswer(
    template.id,
    { answer: found.first.answer, proofKey: firstProofKey },
    found.second.instance,
    { knownInstances: known }
  );
  const legitimate = verifyAnswer(
    template.id,
    { answer: found.second.answer, proofKey: secondProofKey },
    found.second.instance,
    { knownInstances: known }
  );

  return {
    label: 'Same answer, different required proof keys',
    note: requestedTemplate.id === template.id
      ? 'Deterministic search found two real seeded instances for the selected template with the same answer value.'
      : 'The selected template did not collide within the deterministic search window, so this panel uses the stable math collision fixture.',
    assignmentId: collisionAssignment,
    template: templateSummaries().find(item => item.id === template.id),
    sharedAnswer: template.displayAnswer(found.first.answer, found.first.instance),
    students: [
      {
        label: found.first.studentName,
        instance: publicInstance(template, found.first.instance, true),
        proofKey: firstProofKey
      },
      {
        label: found.second.studentName,
        instance: publicInstance(template, found.second.instance, true),
        proofKey: secondProofKey
      }
    ],
    transplant: {
      submittedFrom: found.first.studentName,
      submittedTo: found.second.studentName,
      submittedAnswer: template.displayAnswer(found.first.answer, found.first.instance),
      submittedProofKey: firstProofKey,
      verification: transplant
    },
    legitimate: {
      submittedBy: found.second.studentName,
      submittedAnswer: template.displayAnswer(found.second.answer, found.second.instance),
      submittedProofKey: secondProofKey,
      verification: legitimate
    }
  };
}

function attackHarness(templateId, assignmentId, studentId, studentName) {
  const template = getTemplate(templateId);
  const target = buildInstance(template.id, assignmentId, studentId, studentName);
  const generic = buildGenericInstance(template.id);
  const genericAnswer = template.solve(generic);
  const targetAnswer = template.solve(target);
  const known = [
    { label: studentName, instance: target },
    { label: 'the generic unseeded prompt', instance: generic }
  ];
  const aiAttempt = verifyAnswer(
    template.id,
    { answer: genericAnswer, proofKey: proofKey(template, genericAnswer, generic) },
    target,
    { knownInstances: known }
  );
  const realAttempt = verifyAnswer(
    template.id,
    { answer: targetAnswer, proofKey: proofKey(template, targetAnswer, target) },
    target,
    { knownInstances: known }
  );
  return {
    label: 'Offline simulation of a generic-answer transplant attack',
    note: 'No model is called at runtime. The simulated AI answer is the deterministic solution to the unseeded/shared version of the problem.',
    template: templateSummaries().find(item => item.id === template.id),
    generic: {
      instance: publicInstance(template, generic, true),
      simulatedAIAnswer: template.displayAnswer(genericAnswer, generic),
      simulatedAIProofKey: proofKey(template, genericAnswer, generic)
    },
    target: {
      instance: publicInstance(template, target, true),
      realStudentAnswer: template.displayAnswer(targetAnswer, target),
      realStudentProofKey: proofKey(template, targetAnswer, target)
    },
    aiAttempt,
    realAttempt
  };
}

function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, 'Not found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://keymark.local');
  const pathname = url.pathname;

  try {
    if (pathname === '/api/health') {
      return sendJSON(res, 200, {
        ok: true,
        app: 'Aquí Aprenderás',
        tagline: 'One exam, a personal problem for every student, and instant feedback that teaches.',
        runtime: 'pure deterministic algorithms',
        openaiApiAtRuntime: false,
        templates: templateSummaries().length
      });
    }

    if (pathname === '/api/templates' && req.method === 'GET') {
      return sendJSON(res, 200, { templates: templateSummaries() });
    }

    if (pathname === '/api/assignments' && req.method === 'POST') {
      const body = await readBody(req);
      const template = getTemplate(body.templateId || DEFAULT_TEMPLATE);
      const code = makeCode();
      const reasoningExplanation = cleanString(body.reasoningExplanation, defaultReasoning(template), 900);
      if (!reasoningExplanation) return sendJSON(res, 400, { error: 'Reasoning explanation is required' });
      const assignment = {
        code,
        templateId: template.id,
        title: cleanString(body.title, `${template.title} Learning Loop`, 100),
        concept: cleanString(body.concept, template.title, 120),
        reasoningExplanation,
        teacherName: cleanString(body.teacherName, 'Teacher', 80),
        expectedClassSize: Math.max(0, Math.min(200, Number(body.expectedClassSize) || 0)),
        masteryThreshold: Math.max(1, Math.min(5, Number(body.masteryThreshold) || 2)),
        retryPolicy: 'unlimited fresh variants',
        students: {},
        createdAt: Date.now()
      };
      assignments[code] = assignment;
      return sendJSON(res, 201, { assignment: assignmentView(assignment), board: boardView(assignment) });
    }

    const assignmentJoinMatch = pathname.match(/^\/api\/assignments\/([A-Z0-9]{5})\/join$/);
    if (assignmentJoinMatch && req.method === 'POST') {
      const assignment = requireAssignment(res, assignmentJoinMatch[1]);
      if (!assignment) return;
      const body = await readBody(req);
      const name = cleanString(body.name, 'Student', 80);
      const key = studentKey(name);
      if (!assignment.students[key]) {
        assignment.students[key] = {
          name,
          studentId: key,
          joinedAt: Date.now(),
          currentAttempt: 1,
          streak: 0,
          mastered: false,
          attempts: []
        };
      }
      const student = assignment.students[key];
      const template = getTemplate(assignment.templateId);
      const instance = studentInstanceForAssignment(assignment, student);
      return sendJSON(res, 200, {
        assignment: assignmentView(assignment),
        student: { name: student.name, studentId: student.studentId },
        instance: publicInstance(template, instance, false),
        mastery: {
          streak: student.streak,
          threshold: assignment.masteryThreshold,
          mastered: student.mastered,
          percent: Math.round((Math.min(student.streak, assignment.masteryThreshold) / assignment.masteryThreshold) * 100)
        },
        board: boardView(assignment)
      });
    }

    const assignmentProofMatch = pathname.match(/^\/api\/assignments\/([A-Z0-9]{5})\/proof-key$/);
    if (assignmentProofMatch && req.method === 'POST') {
      const assignment = requireAssignment(res, assignmentProofMatch[1]);
      if (!assignment) return;
      const body = await readBody(req);
      const name = cleanString(body.name, 'Student', 80);
      const key = studentKey(name);
      const student = assignment.students[key];
      if (!student) return sendJSON(res, 404, { error: 'Join the assignment before sealing an answer' });
      const template = getTemplate(assignment.templateId);
      const instance = studentInstanceForAssignment(assignment, student);
      const answer = cleanString(body.answer, '', 120);
      if (!answer) return sendJSON(res, 400, { error: 'Answer is required to derive a proof key' });
      return sendJSON(res, 200, {
        proofKey: proofKey(template, answer, instance),
        seedTag: instance.seedTag,
        note: 'This seals the submitted answer to this student seed. It does not reveal whether the answer is correct.'
      });
    }

    const assignmentSubmitMatch = pathname.match(/^\/api\/assignments\/([A-Z0-9]{5})\/submit$/);
    if (assignmentSubmitMatch && req.method === 'POST') {
      const assignment = requireAssignment(res, assignmentSubmitMatch[1]);
      if (!assignment) return;
      const body = await readBody(req);
      const name = cleanString(body.name, 'Student', 80);
      const key = studentKey(name);
      const student = assignment.students[key];
      if (!student) return sendJSON(res, 404, { error: 'Join the assignment before submitting' });
      const template = getTemplate(assignment.templateId);
      const instance = studentInstanceForAssignment(assignment, student);
      const known = knownAssignmentInstances(assignment);
      const verification = verifyAnswer(
        template.id,
        { answer: body.answer, proofKey: body.proofKey },
        instance,
        { knownInstances: known }
      );
      const feedback = feedbackForSubmission(
        template.id,
        { answer: body.answer, proofKey: body.proofKey },
        instance,
        verification,
        assignment.reasoningExplanation,
        assignment.concept
      );
      if (verification.valid) student.streak += 1;
      else student.streak = 0;
      student.mastered = student.streak >= assignment.masteryThreshold;
      const attempt = {
        attempt: student.currentAttempt,
        answer: cleanString(body.answer, '', 120),
        proofKey: cleanString(body.proofKey, '', 120),
        valid: verification.valid,
        verification: productVerification(verification),
        feedback,
        brokenStep: feedback.brokenStep,
        stepLabel: feedback.stepLabel,
        copySignal: !verification.valid && /proof key belongs|correct for/.test(verification.reason),
        submittedAt: Date.now()
      };
      student.attempts.push(attempt);
      return sendJSON(res, 200, {
        assignment: assignmentView(assignment),
        student: { name: student.name, studentId: student.studentId },
        verification: productVerification(verification),
        feedback,
        mastery: {
          streak: student.streak,
          threshold: assignment.masteryThreshold,
          mastered: student.mastered,
          percent: Math.round((Math.min(student.streak, assignment.masteryThreshold) / assignment.masteryThreshold) * 100)
        },
        board: boardView(assignment)
      });
    }

    const assignmentRetryMatch = pathname.match(/^\/api\/assignments\/([A-Z0-9]{5})\/retry$/);
    if (assignmentRetryMatch && req.method === 'POST') {
      const assignment = requireAssignment(res, assignmentRetryMatch[1]);
      if (!assignment) return;
      const body = await readBody(req);
      const name = cleanString(body.name, 'Student', 80);
      const key = studentKey(name);
      const student = assignment.students[key];
      if (!student) return sendJSON(res, 404, { error: 'Join the assignment before requesting a fresh variant' });
      student.currentAttempt += 1;
      const template = getTemplate(assignment.templateId);
      const instance = studentInstanceForAssignment(assignment, student);
      return sendJSON(res, 200, {
        assignment: assignmentView(assignment),
        student: { name: student.name, studentId: student.studentId },
        instance: publicInstance(template, instance, false),
        mastery: {
          streak: student.streak,
          threshold: assignment.masteryThreshold,
          mastered: student.mastered,
          percent: Math.round((Math.min(student.streak, assignment.masteryThreshold) / assignment.masteryThreshold) * 100)
        }
      });
    }

    const assignmentBoardMatch = pathname.match(/^\/api\/assignments\/([A-Z0-9]{5})\/board$/);
    if (assignmentBoardMatch && req.method === 'GET') {
      const assignment = requireAssignment(res, assignmentBoardMatch[1]);
      if (!assignment) return;
      return sendJSON(res, 200, boardView(assignment));
    }

    if (pathname === '/api/selftest' && req.method === 'GET') {
      return sendJSON(res, 200, runSelfTest());
    }

    if (pathname === '/api/class' && req.method === 'GET') {
      const templateId = url.searchParams.get('templateId') || DEFAULT_TEMPLATE;
      const assignmentId = cleanString(url.searchParams.get('assignmentId'), DEFAULT_ASSIGNMENT, 120);
      const includeSolutions = url.searchParams.get('solutions') !== 'false';
      return sendJSON(res, 200, buildClassView(templateId, assignmentId, url.searchParams.get('count'), includeSolutions));
    }

    if (pathname === '/api/instance' && req.method === 'GET') {
      const template = getTemplate(url.searchParams.get('templateId') || DEFAULT_TEMPLATE);
      const assignmentId = cleanString(url.searchParams.get('assignmentId'), DEFAULT_ASSIGNMENT, 120);
      const studentName = cleanString(url.searchParams.get('studentName'), 'Student', 80);
      const studentId = cleanString(url.searchParams.get('studentId'), studentName, 120);
      const instance = buildInstance(template.id, assignmentId, studentId, studentName);
      return sendJSON(res, 200, { instance: publicInstance(template, instance, url.searchParams.get('solution') === 'true') });
    }

    if (pathname === '/api/verify' && req.method === 'POST') {
      const body = await readBody(req);
      return sendJSON(res, 200, verifyForRequest(body));
    }

    if (pathname === '/api/proof-key' && req.method === 'POST') {
      const body = await readBody(req);
      const template = getTemplate(body.templateId || DEFAULT_TEMPLATE);
      const assignmentId = cleanString(body.assignmentId, DEFAULT_ASSIGNMENT, 120);
      const studentName = cleanString(body.studentName, 'Student', 80);
      const studentId = cleanString(body.studentId, studentName, 120);
      const target = buildInstance(template.id, assignmentId, studentId, studentName);
      const answer = cleanString(body.answer, '', 120);
      if (!answer) return sendJSON(res, 400, { error: 'Answer is required to derive a proof key' });
      return sendJSON(res, 200, {
        proofKey: proofKey(template, answer, target),
        seedTag: target.seedTag,
        note: 'This seals the submitted answer to this student seed. It does not reveal whether the answer is correct.'
      });
    }

    if (pathname === '/api/copy-ring' && req.method === 'GET') {
      const templateId = url.searchParams.get('templateId') || DEFAULT_TEMPLATE;
      const assignmentId = cleanString(url.searchParams.get('assignmentId'), DEFAULT_ASSIGNMENT, 120);
      return sendJSON(res, 200, {
        assignmentId,
        template: templateSummaries().find(item => item.id === getTemplate(templateId).id),
        results: copyRing(templateId, assignmentId, url.searchParams.get('count'))
      });
    }

    if (pathname === '/api/same-answer' && req.method === 'GET') {
      const templateId = url.searchParams.get('templateId') || DEFAULT_TEMPLATE;
      return sendJSON(res, 200, sameAnswerDemo(templateId));
    }

    if (pathname === '/api/attack' && req.method === 'GET') {
      const templateId = url.searchParams.get('templateId') || DEFAULT_TEMPLATE;
      const assignmentId = cleanString(url.searchParams.get('assignmentId'), DEFAULT_ASSIGNMENT, 120);
      const studentName = cleanString(url.searchParams.get('studentName'), 'Riley Stone', 80);
      const studentId = cleanString(url.searchParams.get('studentId'), 'riley-4402', 120);
      return sendJSON(res, 200, attackHarness(templateId, assignmentId, studentId, studentName));
    }

    if (pathname.startsWith('/api/')) {
      return sendJSON(res, 404, { error: 'No such API route' });
    }

    if (pathname === '/favicon.ico') {
      res.writeHead(204);
      return res.end();
    }

    return serveStatic(req, res, pathname === '/demo' || pathname === '/demo/' ? '/demo.html' : pathname);
  } catch (err) {
    return sendJSON(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Aquí Aprenderás running at http://localhost:${PORT}`);
});
