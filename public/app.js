const state = {
  templates: [],
  classView: null,
  studentSolution: null
};

const els = {
  templateSelect: document.querySelector('#templateSelect'),
  assignmentInput: document.querySelector('#assignmentInput'),
  classSizeInput: document.querySelector('#classSizeInput'),
  refreshButton: document.querySelector('#refreshButton'),
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

async function init() {
  try {
    await loadTemplates();
    await loadClass();
    await loadStudent(false);
    await runAttack();
  } catch (err) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="fatal">${escapeHTML(err.message)}</div>`);
  }
}

els.refreshButton.addEventListener('click', loadClass);
els.templateSelect.addEventListener('change', async () => {
  await loadClass();
  await loadStudent(false);
  await runAttack();
});
els.copyRingButton.addEventListener('click', runCopyRing);
els.loadStudentButton.addEventListener('click', () => loadStudent(false));
els.sealButton.addEventListener('click', sealCurrentAnswer);
els.submitButton.addEventListener('click', verifyCurrent);
els.pasteClassmateButton.addEventListener('click', pasteClassmateAnswer);
els.fillCorrectButton.addEventListener('click', fillCorrectAnswer);
els.attackButton.addEventListener('click', runAttack);

init();
