const state = {
  templates: [],
  assignment: null,
  teacherAssignment: null,
  student: null,
  instance: null,
  mastery: null,
  boardTimer: null
};

const $ = selector => document.querySelector(selector);

const els = {
  views: [...document.querySelectorAll('.view')],
  teacherStart: $('#teacherStart'),
  studentStart: $('#studentStart'),
  teacherTemplate: $('#teacherTemplate'),
  assignmentForm: $('#assignmentForm'),
  teacherName: $('#teacherName'),
  assignmentTitle: $('#assignmentTitle'),
  conceptName: $('#conceptName'),
  reasoningExplanation: $('#reasoningExplanation'),
  masteryThreshold: $('#masteryThreshold'),
  expectedClassSize: $('#expectedClassSize'),
  teacherAssignmentTitle: $('#teacherAssignmentTitle'),
  teacherConceptLine: $('#teacherConceptLine'),
  joinCode: $('#joinCode'),
  joinedCount: $('#joinedCount'),
  attemptCount: $('#attemptCount'),
  masteredCount: $('#masteredCount'),
  supportCount: $('#supportCount'),
  missingStep: $('#missingStep'),
  missingStepDetail: $('#missingStepDetail'),
  refreshBoard: $('#refreshBoard'),
  resultsBoard: $('#resultsBoard'),
  studentJoinForm: $('#studentJoinForm'),
  studentJoinCode: $('#studentJoinCode'),
  studentName: $('#studentName'),
  studentAssignmentTitle: $('#studentAssignmentTitle'),
  studentConceptLine: $('#studentConceptLine'),
  studentSeed: $('#studentSeed'),
  masteryText: $('#masteryText'),
  masteryFill: $('#masteryFill'),
  studentProblem: $('#studentProblem'),
  studentAnswer: $('#studentAnswer'),
  studentProofKey: $('#studentProofKey'),
  studentSeal: $('#studentSeal'),
  studentSubmit: $('#studentSubmit'),
  studentRetry: $('#studentRetry'),
  feedbackPanel: $('#feedbackPanel')
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

function showView(id) {
  els.views.forEach(view => view.classList.toggle('active', view.id === id));
  if (id === 'teacherConsoleView') startBoardPolling();
  else stopBoardPolling();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function startBoardPolling() {
  stopBoardPolling();
  state.boardTimer = setInterval(refreshBoard, 2500);
}

function stopBoardPolling() {
  if (state.boardTimer) clearInterval(state.boardTimer);
  state.boardTimer = null;
}

function setMastery(mastery) {
  state.mastery = mastery;
  els.masteryText.textContent = mastery.mastered
    ? 'You proved you can do this'
    : `${mastery.streak} of ${mastery.threshold} passes in a row`;
  els.masteryFill.style.width = `${mastery.percent}%`;
}

function renderProblem(instance) {
  els.studentSeed.textContent = instance.seedTag;
  els.studentProblem.innerHTML = `
    <p class="eyebrow">${escapeHTML(instance.templateTitle)}</p>
    <h3>${escapeHTML(instance.prompt)}</h3>
    <div class="problem-meta">
      <span>${escapeHTML(instance.answerFormat)}</span>
      <code>seed fp ${escapeHTML(instance.seedFingerprint)}</code>
    </div>
  `;
}

function renderFeedback(data) {
  const valid = data.verification.valid;
  const feedback = data.feedback;
  els.feedbackPanel.className = `feedback-panel ${valid ? 'pass' : 'retry'}`;
  els.feedbackPanel.innerHTML = `
    <div class="feedback-verdict">
      <span>${valid ? 'PASS' : 'KEEP GOING'}</span>
      <strong>${valid && data.mastery.mastered ? 'Mastery proved' : feedback.stepLabel}</strong>
    </div>
    <div class="feedback-grid">
      <article>
        <p class="eyebrow">Feed-Up</p>
        <h3>What goal am I practicing?</h3>
        <p>${escapeHTML(feedback.feedUp)}</p>
      </article>
      <article>
        <p class="eyebrow">Feed-Back</p>
        <h3>What happened on my numbers?</h3>
        <p>${escapeHTML(feedback.feedBack)}</p>
      </article>
      <article>
        <p class="eyebrow">Feed-Forward</p>
        <h3>What should I try next?</h3>
        <p>${escapeHTML(feedback.feedForward)}</p>
      </article>
    </div>
    ${data.mastery.mastered ? '<div class="proved-moment">You proved you can do this on fresh keyed attempts.</div>' : ''}
  `;
}

function setTeacherBoard(board) {
  state.teacherAssignment = board.assignment;
  els.teacherAssignmentTitle.textContent = board.assignment.title;
  els.teacherConceptLine.textContent = `${board.assignment.concept} · ${board.assignment.template.title}`;
  els.joinCode.textContent = board.assignment.code;
  els.joinedCount.textContent = board.summary.joined;
  els.attemptCount.textContent = board.summary.attempts;
  els.masteredCount.textContent = board.summary.mastered;
  els.supportCount.textContent = board.summary.needsSupport;
  if (board.missingStep) {
    els.missingStep.textContent = board.missingStep.step.replace(/-/g, ' ');
    els.missingStepDetail.textContent = `${board.missingStep.count} missed attempt(s) point here. Use this as tomorrow's mini-lesson.`;
  } else {
    els.missingStep.textContent = 'No missed step yet';
    els.missingStepDetail.textContent = 'As learners submit, Keymark will surface the reasoning step that needs the most support.';
  }

  if (!board.rows.length) {
    els.resultsBoard.innerHTML = `
      <div class="empty-board">
        <strong>Waiting for learners</strong>
        <p>Share join code ${escapeHTML(board.assignment.code)}. Mastery progress appears here automatically.</p>
      </div>
    `;
    return;
  }

  els.resultsBoard.innerHTML = board.rows.map(row => `
    <article class="board-row ${row.status.toLowerCase().replace(/\s+/g, '-')}">
      <div>
        <strong>${escapeHTML(row.name)}</strong>
        <code>${escapeHTML(row.seedTag)}</code>
      </div>
      <div class="mastery-mini">
        <span style="width:${row.masteryPercent}%"></span>
      </div>
      <div class="status-pill ${row.status.toLowerCase().replace(/\s+/g, '-')}">${escapeHTML(row.status)}</div>
      <div>
        <span>${row.attempts} attempt${row.attempts === 1 ? '' : 's'}</span>
        <small>${escapeHTML(row.lastStep || 'Not submitted yet')}</small>
      </div>
      <p>${escapeHTML(row.reason || 'Joined. Waiting for the first learning check.')}</p>
    </article>
  `).join('');
}

async function loadTemplates() {
  const data = await api('/api/templates');
  state.templates = data.templates;
  els.teacherTemplate.innerHTML = data.templates.map(template => (
    `<option value="${escapeHTML(template.id)}">${escapeHTML(template.title)} - ${escapeHTML(template.subject)}</option>`
  )).join('');
}

async function createAssignment(event) {
  event.preventDefault();
  const data = await api('/api/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherName: els.teacherName.value,
      title: els.assignmentTitle.value,
      concept: els.conceptName.value,
      reasoningExplanation: els.reasoningExplanation.value,
      templateId: els.teacherTemplate.value,
      masteryThreshold: els.masteryThreshold.value,
      expectedClassSize: els.expectedClassSize.value
    })
  });
  setTeacherBoard(data.board);
  els.studentJoinCode.value = data.assignment.code;
  showView('teacherConsoleView');
}

async function refreshBoard() {
  if (!state.teacherAssignment) return;
  const board = await api(`/api/assignments/${state.teacherAssignment.code}/board`);
  setTeacherBoard(board);
}

async function joinAssignment(event) {
  event.preventDefault();
  const code = els.studentJoinCode.value.trim().toUpperCase();
  const data = await api(`/api/assignments/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: els.studentName.value })
  });
  state.assignment = data.assignment;
  state.student = data.student;
  state.instance = data.instance;
  els.studentAssignmentTitle.textContent = data.assignment.title;
  els.studentConceptLine.textContent = `${data.assignment.concept} · attempt starts from your seed`;
  renderProblem(data.instance);
  setMastery(data.mastery);
  els.feedbackPanel.className = 'feedback-panel empty';
  els.feedbackPanel.innerHTML = '<p>Submit your thinking to get Feed-Up, Feed-Back, and Feed-Forward. No bare score here.</p>';
  els.studentAnswer.value = '';
  els.studentProofKey.value = '';
  showView('studentExamView');
}

async function sealStudentAnswer() {
  const data = await api(`/api/assignments/${state.assignment.code}/proof-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: state.student.name, answer: els.studentAnswer.value })
  });
  els.studentProofKey.value = data.proofKey;
}

async function submitStudentAnswer() {
  const data = await api(`/api/assignments/${state.assignment.code}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: state.student.name,
      answer: els.studentAnswer.value,
      proofKey: els.studentProofKey.value
    })
  });
  setMastery(data.mastery);
  renderFeedback(data);
}

async function retryFreshInstance() {
  const data = await api(`/api/assignments/${state.assignment.code}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: state.student.name })
  });
  state.instance = data.instance;
  renderProblem(data.instance);
  setMastery(data.mastery);
  els.studentAnswer.value = '';
  els.studentProofKey.value = '';
  els.feedbackPanel.className = 'feedback-panel empty';
  els.feedbackPanel.innerHTML = '<p>Fresh variant loaded. Use the feedback from the last attempt, then seal and submit again.</p>';
}

function bindEvents() {
  els.teacherStart.addEventListener('click', () => showView('teacherSetupView'));
  els.studentStart.addEventListener('click', () => showView('studentJoinView'));
  document.querySelectorAll('.back-button').forEach(button => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });
  els.assignmentForm.addEventListener('submit', createAssignment);
  els.refreshBoard.addEventListener('click', refreshBoard);
  els.studentJoinForm.addEventListener('submit', joinAssignment);
  els.studentSeal.addEventListener('click', sealStudentAnswer);
  els.studentSubmit.addEventListener('click', submitStudentAnswer);
  els.studentRetry.addEventListener('click', retryFreshInstance);
}

async function init() {
  try {
    await loadTemplates();
    bindEvents();
  } catch (err) {
    document.body.insertAdjacentHTML('afterbegin', `<div class="fatal">${escapeHTML(err.message)}</div>`);
  }
}

init();
