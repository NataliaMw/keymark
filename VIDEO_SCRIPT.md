# Aquí Aprenderás — 3-Minute Demo Video (record-ready, learning-first)

**Target: 2:30–2:55.** English required. You do NOT need to speak live or show your face:
screen-record the product, then lay an **AI voiceover** (ElevenLabs / Narakeet / free Edge TTS)
over it using the narration below. Add captions if easy (YouTube auto-captions are fine).
The voiceover MUST name Codex and GPT-5.6 (it does — don't cut those lines).

Setup: `node server.js` → open `http://localhost:3000` at ~1280–1440px. Have a second
browser/incognito window ready to play a student.

---

### 0:00 – 0:22 · The problem  *(landing page on screen)*
> "When an exam moves online, the questions have one shared answer — so any AI just knows it, and a whole class can score the same. Schools respond with surveillance, which punishes honest students and still doesn't teach anyone anything. Aquí Aprenderás takes the opposite bet: instead of policing the test, it makes the test itself the moment students actually learn."

### 0:22 – 0:38 · The idea  *(read the headline + click "I'm a teacher")*
> "One exam becomes a personal problem for every student, with instant feedback that explains their own reasoning. Here's how a teacher sets it up."

### 0:38 – 1:05 · Teacher designs a learning loop  *(teacher flow: name a concept, pick template, WRITE THE REASONING)*
> "You don't write thirty questions — you design one concept. Pick the skill, then author the one thing that matters most: the reasoning, the WHY, that every student will get as feedback. Set a mastery goal — pass it twice — and publish. You get a join code to share."
[show the join code]

### 1:05 – 1:55 · The student — the test teaches  *(second window: join with code, get YOUR problem, submit a WRONG answer)*
> "Every student who joins gets their own version — different numbers, same concept. Watch what happens on a wrong answer."
[submit a wrong answer — the feedback panel appears]
> "Not a red X. Aquí Aprenderás shows the goal, then exactly where the reasoning broke on THEIR numbers, then the next step: 'find the margin, divide the setup cost, round up.' That explaining feedback is, in the research, about ten times more effective for learning than a bare right-or-wrong. Then — try a fresh one."
[click "try a fresh one", solve it correctly, mastery meter fills]
> "A new personalized version, they apply what they just learned, and the mastery meter fills. Struggle became learning, safely."

### 1:55 – 2:20 · Teacher dashboard  *(flip to teacher board)*
> "For the teacher, it's a live mastery dashboard — who's mastered it, who's stuck, which step the class keeps missing — with zero grading. Personalized practice at a scale no teacher could hand-make."

### 2:20 – 2:45 · How it's built + close
> "Aquí Aprenderás runs on pure deterministic algorithms — no API calls, no keys at runtime, works fully offline. I used GPT-5.6 to design the keyed-exercise technique and author the templates and reasoning feedback, and Codex to build all of it — the server, the feedback engine, and a self-test that proves it holds. And because every problem is genuinely the student's own, copying simply doesn't work — but that's a side effect of good teaching, not the point. Aquí Aprenderás: the test is where the learning happens."

---

## Notes
- The mechanism explainer lives at `/demo` if you want a 5-second cutaway ("here's the keying under the hood"), but the PRODUCT flow above is the video.
- Keep it under 3:00 — speed up any typing/loading in edit.
- Judges include OpenAI's VP of Education — lead with the learning story, which this does.
- Upload YouTube (unlisted OK) → paste link in Devpost → category **Education** → Session ID `019f82d6-1575-7770-8df1-ccda58628dce`.
