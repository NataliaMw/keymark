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
        app: 'Keymark',
        tagline: 'Every answer carries its own proof of origin.',
        runtime: 'pure deterministic algorithms',
        openaiApiAtRuntime: false,
        templates: templateSummaries().length
      });
    }

    if (pathname === '/api/templates' && req.method === 'GET') {
      return sendJSON(res, 200, { templates: templateSummaries() });
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

    return serveStatic(req, res, pathname);
  } catch (err) {
    return sendJSON(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Keymark running at http://localhost:${PORT}`);
});
