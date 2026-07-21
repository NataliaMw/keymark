# Keymark

Every answer carries its own proof of origin.

Keymark is a zero-dependency assessment prototype for OpenAI Build Week, Education track. It implements the **Solver-Bound Validity** principle from [CONCEPT.md](./CONCEPT.md): an assessment answer is valid only relative to the solver-specific instance that generated it; a transplanted answer is deterministically invalid.

## What It Is

Keymark makes copying structurally fail. A teacher picks an item template and assignment id. Each student receives the same conceptual task, but the concrete numbers are seeded from `studentId + assignmentId + templateId`. The correct answer carries a proof key derived from that student's instance. A classmate's answer, or a generic AI answer to the shared problem, fails the verifier because the submitted proof key does not bind to the target seed.

There is no proctoring, no surveillance, no AI detector, no oral exam, and no probabilistic accusation. The check is arithmetic.

The motivation is a 2026 online admissions-exam failure pattern: recall-heavy multiple choice inflated across the board, while AI proctoring wrongly voided thousands of honest students. Keymark does not try to proctor its way out of an answer format an AI can already know. It changes the format so the answer must belong to the solver's keyed instance.

## Solver-Bound Validity

The Turing test asks "Can a machine pass as human?"; Keymark asks "Does this answer belong to this solver's keyed instance?"

Each item template implements:

- `parameterize(seed)`: generate a concrete instance from a deterministic seed.
- `solve(instance)`: compute the reference answer for that instance.
- `fingerprint(answer, instance)`: derive a cheap proof key from the answer and instance.
- `verify(submittedAnswer, instance)`: accept only if the answer satisfies the deterministic solver for that exact seed and the submitted proof key equals the proof key derived from that same seed and correct answer.

The shipped templates cover:

- Math / quantitative: break-even lab kits.
- Science / data: calibrated cooling index from seeded sensor readings.
- Logic / quantitative reasoning: eight-digit recurrence lock.

The answer spaces are deliberately wide. `node selftest.js` generates 200 seeded instances per template and requires the duplicate-answer collision rate to stay below 2%. It also proves that a value-collision transplant still fails when the proof key belongs to another seed.

## Prior Art

These citations and contrasts are drawn from [CONCEPT.md](./CONCEPT.md):

- Turing, "Computing Machinery and Intelligence" (1950): frames intelligence as indistinguishable imitation; Keymark rejects imitation detection and verifies answer-instance origin by construction.
- Automatic Item Generation / isomorphic items: psychometrics already generates structurally equivalent item families; Keymark makes the variant identity-bound and self-verifying.
- PrairieLearn / randomized question generators: randomized parameters plus automated grading are proven instructional patterns; Keymark sharpens them into an anti-transplant property tied to the solver.
- CodeRunner / executable grading: deterministic programmatic grading is valuable; Keymark extends determinism to provenance of the answer-instance match.
- Commitment schemes / zero-knowledge: Keymark is not cryptography, but borrows the binding and proof intuition for a simpler educational check.
- Canary tokens / honeytokens: unique embedded tripwires reveal misuse; Keymark embeds a per-instance fingerprint for deterministic validation.

## Honest Limitation

A determined student can still succeed by having another person or AI solve their exact keyed instance; the method prevents answer transplantation, not unauthorized assistance on the correct instance.

## Runtime Model

The runtime uses **no OpenAI API, no API key, no network call, and no npm dependency**. The product is pure deterministic JavaScript:

- `server.js`: plain Node `http` server and API routes.
- `items/keyedTemplates.js`: deterministic item templates, solvers, fingerprinting, and verifier.
- `public/index.html`, `public/app.js`, `public/style.css`: vanilla browser client.

GPT-5.6 and Codex are used offline to design and build the submission. They are not required when the app runs.

## How GPT-5.6 Was Used

GPT-5.6 was used offline to design the Solver-Bound Validity framing, author the keyed item-template concept, and shape the answer fingerprint scheme. Its role is intellectual and authoring support, not runtime execution.

## How Codex Was Used

Codex built the zero-dependency server, deterministic verifier, vanilla UI, copy-ring simulation, attack harness, README, demo script, and license. Key implementation decisions were to keep instance generation stateless, recompute all seeds on demand, and make transplant rejection reasons explain which seeded instance the copied answer belongs to.

## How To Run

```bash
node server.js
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

Self-test:

```bash
node selftest.js
```

Browser-readable self-test:

```text
http://localhost:3000/api/selftest
```

## Demo Flow

1. Open the app and keep the default assignment id.
2. In Teacher view, compare the class cards: the same template produces different prompts, seed tags, correct answers, and proof keys.
3. Click `Simulate copy ring`.
4. Observe that every transplanted classmate answer is rejected with a deterministic reason.
5. In Student view, click `Paste classmate answer`.
6. The verifier rejects the answer because its proof key belongs to a different seeded instance.
7. Type an answer manually, click `Seal answer`, then submit to see answer-plus-proof verification.
8. Click `Demo-fill real answer`.
9. The verifier accepts the answer and proof key for that student's seed.
10. Click `Run transplant attack`.
11. The simulated generic AI answer is rejected, while the real keyed solver answer passes.

## Tech Stack

- Node.js built-in `http`, `fs`, `path`, and `crypto`.
- Vanilla HTML, CSS, and JavaScript.
- No build step.
- No package manager.
- No runtime AI API.

## License

MIT. See [LICENSE](./LICENSE).
