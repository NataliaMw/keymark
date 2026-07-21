# Aquí Aprenderás ("here, you will learn")

One exam, a personal problem for every student, and instant feedback that teaches - so the test is where the learning happens.

Aquí Aprenderás is a zero-dependency feedback-and-mastery engine for OpenAI Build Week, Education track. It uses the **Solver-Bound Validity** principle from [CONCEPT.md](./CONCEPT.md): an answer is valid only relative to the solver-specific instance that generated it.

## Inspiration

Aquí Aprenderás was inspired by the school webtoon/live-action drama **True Education** (참교육), which sparked the question of what honest, real education should look like when students can game the system. The answer here is non-punitive: not policing or humiliating students, but redesigning the assignment so the test itself teaches.

## What It Is

Aquí Aprenderás lets a teacher turn one concept into a learning loop. The teacher names the concept, chooses a deterministic template, and authors the "why" explanation students should learn from. Each student receives a personal seeded instance, submits an answer, and gets elaborated feedback structured around:

- **Feed-Up**: what concept or skill this checks.
- **Feed-Back**: what happened on this student's specific numbers.
- **Feed-Forward**: what to try next on a fresh variant.

Students retry fresh variants until they meet the mastery threshold. The teacher dashboard shows mastery level, attempts, and the reasoning step the class is missing most - with zero manual grading.

Copying resistance is a side effect: a transplanted answer fails because the proof key does not bind to the student's seeded instance.

## Evidence Behind The Product

- Elaborated feedback that explains reasoning is far stronger than a bare right/wrong verdict: Van der Kleij et al. 2015 report about `d=0.99` for elaborated feedback vs `d=0.05` for simple verification, and Wisniewski/Hattie 2020 reinforce feedback as most useful when it answers where the learner is going, how they are going, and what comes next.
- Testing and generation effects are reliable learning mechanisms, with effects around `g=0.50` in synthesis-level findings.
- Personalized feedback can raise learner motivation; Wang 2026 reports `g=0.82`.
- Mastery retry with fresh variants has shown real assessment gains; Morphew 2020 reports final-exam scores about `+7` points higher.

## Solver-Bound Validity

The Turing test asks "Can a machine pass as human?"; Aquí Aprenderás asks "Does this answer belong to this solver's keyed instance?"

Each item template implements:

- `parameterize(seed)`: generate a concrete instance from a deterministic seed.
- `solve(instance)`: compute the reference answer for that instance.
- `fingerprint(answer, instance)`: derive a cheap proof key from the answer and instance.
- `verify(submittedAnswer, instance)`: accept only if the answer satisfies the deterministic solver for that exact seed and the submitted proof key equals the proof key derived from that same seed and correct answer.
- `feedback(instance, answer, valid, teacherWhy, concept)`: generate deterministic elaborated feedback for the student's instance.

The shipped templates cover:

- Math / quantitative: break-even lab kits, with step-level diagnosis.
- Science / data: calibrated cooling index, with principle-level diagnosis.
- Logic / quantitative reasoning: eight-digit recurrence lock, with principle-level diagnosis.

## Prior Art

These citations and contrasts are drawn from [CONCEPT.md](./CONCEPT.md):

- Turing, "Computing Machinery and Intelligence" (1950): frames intelligence as indistinguishable imitation; Aquí Aprenderás rejects imitation detection and verifies answer-instance origin by construction.
- Automatic Item Generation / isomorphic items: psychometrics already generates structurally equivalent item families; Aquí Aprenderás makes the variant identity-bound and self-verifying.
- PrairieLearn / randomized question generators: randomized parameters plus automated grading are proven instructional patterns; Aquí Aprenderás uses the same determinism for instant feedback and mastery loops.
- CodeRunner / executable grading: deterministic programmatic grading is valuable; Aquí Aprenderás extends determinism to provenance of the answer-instance match and feedback.
- Commitment schemes / zero-knowledge: Aquí Aprenderás is not cryptography, but borrows the binding and proof intuition for a simpler educational check.
- Canary tokens / honeytokens: unique embedded tripwires reveal misuse; Aquí Aprenderás embeds a per-instance fingerprint for deterministic validation.

## Honest Limitation

Deterministic checks fit verifiable-answer concepts: quantitative reasoning, data transformations, recurrence logic, and similar domains. Open-ended essays and subjective work are out of scope for this prototype. A determined student can still succeed by having another person or AI solve their exact keyed instance; answer-transplant resistance is a side effect, not the main product promise.

## Runtime Model

The product is pure deterministic JavaScript:

- `server.js`: plain Node `http` server and API routes.
- `items/keyedTemplates.js`: deterministic item templates, solvers, fingerprinting, verifier, and feedback helpers.
- `public/index.html`, `public/app.js`, `public/style.css`: product client at `/`.
- `public/demo.html`, `public/demo-app.js`, `public/demo-style.css`: mechanism explainer at `/demo`.

GPT-5.6 and Codex are used offline to design and build the submission. They are not required when the app runs.

## How GPT-5.6 Was Used

GPT-5.6 was used offline to design the Solver-Bound Validity framing, draft the keyed item templates, and draft reasoning explanations and feedback structure. Its role is intellectual and authoring support, not runtime execution.

## How Codex Was Used

Codex did the heavy lifting across the whole project, from first scaffold to final polish. Working in one continuous session, it:

- **Built the entire codebase** — the zero-dependency Node server, all API routes, the deterministic verifier integration, the keyed-instance generation, the seed-bound proof-key scheme, and the client for both the product (`/`) and the mechanism explainer (`/demo`).
- **Built the learning engine** — the elaborated-feedback logic (Feed-Up / Feed-Back / Feed-Forward), the step-level "where your reasoning broke" analysis derived from each template's solver, the mastery-streak tracking, the fresh-variant retry loop, and the teacher mastery dashboard.
- **Found and fixed a real correctness flaw** — when two students' seeded instances collided on the same numeric answer, an early version accepted a transplanted answer. Codex reworked the seeding and the proof-key binding so a copied answer is rejected even on a value collision, and wrote a `selftest.js` that proves it (answer-separation < 2% collision, transplant-always-rejected, legitimate-answer-passes) across all templates.
- **Iterated on product and UX** — it restructured a dense single-page dashboard into a stepped, screen-recordable demo, moved the explainer to `/demo`, and reframed the whole product around the learning-first pedagogy while keeping the runtime pure-algorithm and the self-test green.
- **Wrote the supporting material** — this README, the demo and video scripts, and the license.

Key engineering decisions Codex made and documented: polling over websockets for classroom-network robustness; an offline-first, no-runtime-API design so the deterministic checks never depend on the network; one shared JSON schema for hardcoded and generated instances; and confidence-gated verification so uncertain judgments never silently change a score.

## How To Run

```bash
node server.js
```

Product:

```text
http://localhost:3000
```

Mechanism explainer:

```text
http://localhost:3000/demo
```

Self-test:

```bash
node selftest.js
```

Health check:

```text
http://localhost:3000/api/health
```

## How To Use It

Teacher flow:

1. Open `/`.
2. Click `I'm a teacher`.
3. Enter teacher name, learning loop title, concept, template, reasoning explanation, mastery threshold, and optional class size.
4. Click `Publish learning loop`.
5. Share the join code.
6. Watch the mastery dashboard: learners, retrieval reps, mastered count, support count, missed-step pattern, and per-student progress.

Student flow:

1. Open `/`.
2. Click `I'm a student`.
3. Enter join code and name.
4. Solve the personal instance.
5. Enter an answer, click `Seal answer`, then click `Submit for feedback`.
6. Read Feed-Up, Feed-Back, and Feed-Forward.
7. If needed, click `Try a fresh one` for another retrieval rep.
8. Keep going until the mastery meter says `You proved you can do this`.

Mechanism demo:

1. Open `/demo`.
2. Click `Run 90-second proof demo`.
3. Watch the seeded-instance, same-answer, copy-ring, and generic-answer transplant demonstrations.

## Tech Stack

- Node.js built-in `http`, `fs`, `path`, and `crypto`.
- Vanilla HTML, CSS, and JavaScript.
- No build step.
- No package manager.
- No runtime AI API.

## License

MIT. See [LICENSE](./LICENSE).
