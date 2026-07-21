const state = {
  templates: [],
  classView: null,
  studentSolution: null,
  demoStep: -1,
  demoTimer: null
};

const els = {
  templateSelect: document.querySelector('#templateSelect'),
  assignmentInput: document.querySelector('#assignmentInput'),
  classSizeInput: document.querySelector('#classSizeInput'),
  refreshButton: document.querySelector('#refreshButton'),
  demoRail: document.querySelector('#demoRail'),
  demoRailButton: document.querySelector('#demoRailButton'),
  demoNextButton: document.querySelector('#demoNextButton'),
  demoCaption: document.querySelector('#demoCaption'),
  sameAnswerSection: document.querySelector('#sameAnswerSection'),
  sameAnswerButton: document.querySelector('#sameAnswerButton'),
  sameAnswerContent: document.querySelector('#sameAnswerContent'),
  classGrid: document.querySelector('#classGrid'),
  copyRingButton: document.querySelector('#copyRingButton'),
  copyRingResults: document.querySelector('#copyRingResults'),
  studentNameInput: document.querySelector('#studentNameInput'),
  studentIdInput: document.querySelector('#studentIdInput'),
  loadStudentButton: document.querySelector('#loadStudentButton'),
  studentInstance: document.querySelector('#studentInstance'),
  answerInput: document.querySelector('#answerInput'),
  proofInput: document.querySelector('#proofInput'),
  sealButton: document.querySelector('#sealButton'),
  submitButton: document.querySelector('#submitButton'),
  pasteClassmateButton: document.querySelector('#pasteClassmateButton'),
  fillCorrectButton: document.querySelector('#fillCorrectButton'),
  verifyResult: document.querySelector('#verifyResult'),
  attackButton: document.querySelector('#attackButton'),
  genericAttack: document.querySelector('#genericAttack'),
  targetAttack: document.querySelector('#targetAttack'),
  aiAttempt: document.querySelector('#aiAttempt'),
  realAttempt: document.querySelector('#realAttempt')
};
els.stepTabs = [...document.querySelectorAll('.step-tab')];
els.views = [...document.querySelectorAll('.view')];

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function selectedTemplate() {
  return els.templateSelect.value || 'break-even-lab-kits';
}

function assignmentId() {
  return els.assignmentInput.value.trim() || 'build-week-2026-education';
}

function classCount() {
  return Math.max(2, Math.min(12, Number(els.classSizeInput.value) || 6));
}

function statusClass(valid) {
  return valid ? 'pass' : 'fail';
}

function showView(index) {
  const next = Math.max(0, Math.min(els.views.length - 1, Number(index) || 0));
  els.views.forEach(view => view.classList.toggle('active', Number(view.dataset.view) === next));
  els.stepTabs.forEach(tab => tab.classList.toggle('active', Number(tab.dataset.step) === next));
  state.activeView = next;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderInstanceBox(instance, solution) {
  return `
    <div class="seed-row">
      <span>${escapeHTML(instance.studentName)}</span>
      <code>${escapeHTML(instance.seedTag)}</code>
    </div>
    <p>${escapeHTML(instance.prompt)}</p>
    <div class="meta-row">
      <span>${escapeHTML(instance.answerFormat)}</span>
      <span>seed fp ${escapeHTML(instance.seedFingerprint)}</span>
    </div>
    ${solution ? `
      <div class="solution-strip">
        <span>answer <strong>${escapeHTML(instance.correctAnswer)}</strong></span>
        <code>${escapeHTML(instance.proofKey)}</code>
      </div>
    ` : ''}
  `;
}

function renderReceipt(target, result) {
  if (!result) {
    target.className = 'receipt';
    target.innerHTML = '';
    return;
  }
  target.className = `receipt ${statusClass(result.valid)}`;
  target.innerHTML = `
    <div class="receipt-head">
      <strong>${result.valid ? 'PASS' : 'REJECT'}</strong>
      <span>${escapeHTML(result.expectedAnswer || '')}</span>
    </div>
    <p>${escapeHTML(result.reason)}</p>
    ${result.proofKey || result.expectedProofKey ? `<code>${escapeHTML(result.proofKey || result.expectedProofKey)}</code>` : ''}
    ${result.explanation ? `<p class="receipt-note">${escapeHTML(result.explanation)}</p>` : ''}
  `;
}

function receiptHTML(result) {
  return `
    <div class="receipt ${statusClass(result.valid)}">
      <div class="receipt-head">
        <strong>${result.valid ? 'PASS' : 'REJECT'}</strong>
        <span>${escapeHTML(result.expectedAnswer || '')}</span>
      </div>
      <p>${escapeHTML(result.reason)}</p>
      ${result.proofKey || result.expectedProofKey ? `<code>${escapeHTML(result.proofKey || result.expectedProofKey)}</code>` : ''}
      ${result.explanation ? `<p class="receipt-note">${escapeHTML(result.explanation)}</p>` : ''}
    </div>
  `;
}

async function loadTemplates() {
  const data = await api('/api/templates');
  state.templates = data.templates;
  els.templateSelect.innerHTML = state.templates.map(template => (
    `<option value="${escapeHTML(template.id)}">${escapeHTML(template.title)} - ${escapeHTML(template.subject)}</option>`
  )).join('');
}

async function loadClass() {
  const url = `/api/class?templateId=${encodeURIComponent(selectedTemplate())}&assignmentId=${encodeURIComponent(assignmentId())}&count=${classCount()}`;
  state.classView = await api(url);
  els.classGrid.innerHTML = state.classView.students.map((student, index) => `
    <article class="student-card">
      <div class="card-index">${String(index + 1).padStart(2, '0')}</div>
      ${renderInstanceBox(student, true)}
    </article>
  `).join('');
  els.copyRingResults.innerHTML = '';
}

async function loadSameAnswer() {
  const params = new URLSearchParams({ templateId: selectedTemplate() });
  const data = await api(`/api/same-answer?${params.toString()}`);
  const [first, second] = data.students;
  els.sameAnswerContent.classList.remove('muted');
  els.sameAnswerContent.innerHTML = `
    <div class="collision-banner">
      <span>Both seeded instances solve to</span>
      <strong>${escapeHTML(data.sharedAnswer)}</strong>
      <span>but the proof keys are not interchangeable.</span>
    </div>
    <div class="same-answer-grid">
      <article class="collision-card">
        <h3>${escapeHTML(first.label)}</h3>
        <div class="keyline"><span>Seed</span><code>${escapeHTML(first.instance.seedTag)}</code></div>
        <div class="keyline"><span>Answer</span><strong>${escapeHTML(first.instance.correctAnswer)}</strong></div>
        <div class="keyline"><span>Required proof</span><code>${escapeHTML(first.proofKey)}</code></div>
      </article>
      <article class="collision-card">
        <h3>${escapeHTML(second.label)}</h3>
        <div class="keyline"><span>Seed</span><code>${escapeHTML(second.instance.seedTag)}</code></div>
        <div class="keyline"><span>Answer</span><strong>${escapeHTML(second.instance.correctAnswer)}</strong></div>
        <div class="keyline"><span>Required proof</span><code>${escapeHTML(second.proofKey)}</code></div>
      </article>
    </div>
    <div class="transplant-strip">
      <div>
        <p class="eyebrow">Transplant attempt</p>
        <h3>${escapeHTML(data.transplant.submittedFrom)} -> ${escapeHTML(data.transplant.submittedTo)}</h3>
        <p>Submitted value: <strong>${escapeHTML(data.transplant.submittedAnswer)}</strong></p>
        <code>${escapeHTML(data.transplant.submittedProofKey)}</code>
      </div>
      ${receiptHTML(data.transplant.verification)}
    </div>
    <div class="transplant-strip legitimate">
      <div>
        <p class="eyebrow">Legitimate submission</p>
        <h3>${escapeHTML(data.legitimate.submittedBy)} uses their own proof key</h3>
        <p>Submitted value: <strong>${escapeHTML(data.legitimate.submittedAnswer)}</strong></p>
        <code>${escapeHTML(data.legitimate.submittedProofKey)}</code>
      </div>
      ${receiptHTML(data.legitimate.verification)}
    </div>
    <p class="small">${escapeHTML(data.note)}</p>
  `;
}

async function loadStudent(solution) {
  const params = new URLSearchParams({
    templateId: selectedTemplate(),
    assignmentId: assignmentId(),
    studentName: els.studentNameInput.value,
    studentId: els.studentIdInput.value,
    solution: solution ? 'true' : 'false'
  });
  const data = await api(`/api/instance?${params.toString()}`);
  els.studentInstance.classList.remove('muted');
  els.studentInstance.innerHTML = renderInstanceBox(data.instance, solution);
  if (solution) state.studentSolution = data.instance;
  return data.instance;
}

async function verifyCurrent() {
  const payload = {
    templateId: selectedTemplate(),
    assignmentId: assignmentId(),
    studentName: els.studentNameInput.value,
    studentId: els.studentIdInput.value,
    count: classCount(),
    answer: els.answerInput.value,
    proofKey: els.proofInput.value
  };
  const data = await api('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  renderReceipt(els.verifyResult, data.verification);
}

async function sealCurrentAnswer() {
  const payload = {
    templateId: selectedTemplate(),
    assignmentId: assignmentId(),
    studentName: els.studentNameInput.value,
    studentId: els.studentIdInput.value,
    answer: els.answerInput.value
  };
  const data = await api('/api/proof-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  els.proofInput.value = data.proofKey;
}

async function pasteClassmateAnswer() {
  if (!state.classView) await loadClass();
  const currentId = els.studentIdInput.value.trim();
  const classmate = state.classView.students.find(student => student.studentId !== currentId) || state.classView.students[0];
  els.answerInput.value = classmate.correctAnswer;
  els.proofInput.value = classmate.proofKey;
  await verifyCurrent();
}

async function fillCorrectAnswer() {
  const instance = await loadStudent(true);
  els.answerInput.value = instance.correctAnswer;
  els.proofInput.value = instance.proofKey;
  await verifyCurrent();
}

async function runCopyRing() {
  const params = new URLSearchParams({
    templateId: selectedTemplate(),
    assignmentId: assignmentId(),
    count: String(classCount())
  });
  const data = await api(`/api/copy-ring?${params.toString()}`);
  els.copyRingResults.innerHTML = `
    <h3>Copy ring result</h3>
    ${data.results.map(result => `
      <div class="copy-row ${result.valid ? 'pass' : 'fail'}">
        <span>${escapeHTML(result.target)} pasted ${escapeHTML(result.copiedFrom)}'s answer</span>
        <code>${escapeHTML(result.submittedAnswer)}</code>
        <p>${escapeHTML(result.reason)}</p>
      </div>
    `).join('')}
  `;
}

async function runAttack() {
  const params = new URLSearchParams({
    templateId: selectedTemplate(),
    assignmentId: assignmentId(),
    studentName: els.studentNameInput.value,
    studentId: els.studentIdInput.value
  });
  const data = await api(`/api/attack?${params.toString()}`);
  els.genericAttack.classList.remove('muted');
  els.targetAttack.classList.remove('muted');
  els.genericAttack.innerHTML = `
    ${renderInstanceBox(data.generic.instance, false)}
    <div class="solution-strip">
      <span>simulated AI answer <strong>${escapeHTML(data.generic.simulatedAIAnswer)}</strong></span>
      <code>${escapeHTML(data.generic.simulatedAIProofKey)}</code>
    </div>
    <p class="small">${escapeHTML(data.note)}</p>
  `;
  els.targetAttack.innerHTML = `
    ${renderInstanceBox(data.target.instance, false)}
    <div class="solution-strip">
      <span>real solver answer <strong>${escapeHTML(data.target.realStudentAnswer)}</strong></span>
      <code>${escapeHTML(data.target.realStudentProofKey)}</code>
    </div>
  `;
  renderReceipt(els.aiAttempt, data.aiAttempt);
  renderReceipt(els.realAttempt, data.realAttempt);
}

function setDemoFocus(element) {
  if (element) {
    element.classList.add('demo-pulse');
    setTimeout(() => element.classList.remove('demo-pulse'), 1200);
  }
}

async function runDemoStep(index) {
  const steps = [
    {
      caption: '1/4 Problem. Shared-answer exams make copying and generic AI answers look valid; Aquí Aprenderás changes the object being verified.',
      action: async () => {
        showView(0);
        setDemoFocus(document.querySelector('#problemView'));
      }
    },
    {
      caption: '2/4 Collision defense. Even when two students have the same answer value, the wrong seed proof key is rejected.',
      action: async () => {
        await loadSameAnswer();
        showView(1);
        setDemoFocus(els.sameAnswerSection);
      }
    },
    {
      caption: '3/4 Teacher view. Same concept, different keyed instances; then the copy ring shows every transplanted answer rejected.',
      action: async () => {
        await loadClass();
        await runCopyRing();
        showView(2);
        setDemoFocus(document.querySelector('#teacherView'));
      }
    },
    {
      caption: "4/4 Attack harness. The generic AI answer is rejected while the real keyed solver passes.",
      action: async () => {
        await runAttack();
        showView(3);
        setDemoFocus(document.querySelector('#attackView'));
      }
    }
  ];
  state.demoStep = index % steps.length;
  const step = steps[state.demoStep];
  els.demoCaption.textContent = step.caption;
  await step.action();
}

async function nextDemoStep() {
  await runDemoStep(state.demoStep + 1);
}

async function startDemoRail() {
  clearInterval(state.demoTimer);
  state.demoStep = -1;
  await nextDemoStep();
  state.demoTimer = setInterval(() => {
    if (state.demoStep >= 3) {
      clearInterval(state.demoTimer);
      els.demoCaption.textContent = 'Proof sequence complete: seeded instances, collision rejection, copy-ring rejection, and generic-AI rejection.';
      return;
    }
    nextDemoStep();
  }, 22000);
}

async function init() {
  try {
    await loadTemplates();
    await loadClass();
    await loadSameAnswer();
    await loadStudent(false);
    await runAttack();
  } catch (err) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="fatal">${escapeHTML(err.message)}</div>`);
  }
}

els.refreshButton.addEventListener('click', loadClass);
els.stepTabs.forEach(tab => {
  tab.addEventListener('click', () => showView(tab.dataset.step));
});
els.templateSelect.addEventListener('change', async () => {
  await loadClass();
  await loadSameAnswer();
  await loadStudent(false);
  await runAttack();
});
els.demoRailButton.addEventListener('click', startDemoRail);
els.demoNextButton.addEventListener('click', nextDemoStep);
els.sameAnswerButton.addEventListener('click', loadSameAnswer);
els.copyRingButton.addEventListener('click', runCopyRing);
els.loadStudentButton.addEventListener('click', () => loadStudent(false));
els.sealButton.addEventListener('click', sealCurrentAnswer);
els.submitButton.addEventListener('click', verifyCurrent);
els.pasteClassmateButton.addEventListener('click', pasteClassmateAnswer);
els.fillCorrectButton.addEventListener('click', fillCorrectAnswer);
els.attackButton.addEventListener('click', runAttack);

init();
