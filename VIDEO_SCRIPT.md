# Keymark — 3-Minute Demo Video (record-ready)

**Target length: 2:40–2:55.** Read the voiceover in your own voice — natural, direct, a little passionate. The bracketed lines are what to do on screen. Requirement: the voiceover must clearly say how **Codex** and **GPT-5.6** were used.

Before recording:
- Run `node server.js`, open `http://localhost:3000` at ~1280–1440px width, browser zoom 100–110%.
- Have the 4-step nav visible (01 Problem / 02 Same Answer / 03 Teacher / 04 Attack).

---

### 0:00 – 0:25 · The problem  *(Step 01 Problem on screen)*
> "This year, a major public university ran its first big online admission exam. Scores jumped across almost every program, thousands of honest students had their exams voided by AI proctoring, and the whole thing landed in the news. The lesson is simple: you cannot proctor your way out of an exam where the answer is just… the answer. If a question has one shared correct answer, any AI already knows it. So I stopped trying to detect cheating — and changed what gets graded."

### 0:25 – 0:40 · The idea  *(still Step 01 — point to the tagline / stat tiles)*
> "This is Keymark. The principle is Solver-Bound Validity: every student gets the same concept, but an instance seeded to them — so a correct answer only counts if it carries the proof key for their seed. The Turing test asks if a machine can pass as human. Keymark asks if an answer belongs to you."

### 0:40 – 1:20 · The hard question, answered  *(click Step 02 Same Answer)*
> "The obvious objection: what if two students get the same answer by chance? Here are two real seeded instances that both solve to thirty-eight thousand eight hundred seventy."
[point to the two student cards]
> "Same value — but different seeds, and different required proof keys. Watch a transplant: student one's answer, submitted as student thirteen."
[point to the ✕ REJECT card]
> "Rejected. Correct number, wrong proof key. Now student thirteen submits with their own key —"
[point to the ✓ PASS card]
> "— accepted. Copying fails even when the answer is identical, because origin is checked, not just correctness. And it's deterministic, so there are zero false accusations."

### 1:20 – 1:55 · At classroom scale  *(click Step 03 Teacher, then click "Simulate copy ring")*
> "For a teacher it's one click. Same assignment, but every student gets a different seeded instance and a different answer — there's no shared key to leak or buy."
[click Simulate copy ring]
> "Run a copy ring across the whole class and every transplanted answer is rejected at once. No webcam, no surveillance, no accusing a kid because their glasses caught the light."

### 1:55 – 2:30 · The attack — AI takes the test  *(click Step 04 Attack, then "Run transplant attack")*
> "Finally, let an AI take the shared test. On the left, the generic prompt — the model answers it perfectly, like it would ace the old exam."
[click Run transplant attack; point to REJECT then PASS]
> "But submitted against a real student's keyed instance: rejected. The same seeded student, using their own proof: passes. The AI having the answer stops being enough."

### 2:30 – 2:55 · How it's built + close
> "Keymark runs on pure deterministic algorithms — no API calls, no keys at runtime. I used GPT-5.6 to design the Solver-Bound Validity technique and to author the keyed exercise templates and their fingerprint scheme, and I used Codex to build the whole thing — the server, the verifier, the attack harness, and a self-test that proves the transplant defense holds even on answer collisions. Keymark: every answer carries its own proof of origin."

---

## Recording tips
- Speed up any loading/typing in edit; cut dead air. Judges may stop at 3:00 — keep it under.
- Make sure the ✕ REJECT / ✓ PASS moments are on screen while you say them.
- Export 1080p, upload to YouTube (unlisted is fine), paste the link into Devpost.
- The voiceover already names Codex and GPT-5.6 — do not cut those two sentences.
