# Keymark Demo Script

Total target length: under 3 minutes.

## 0:00-0:20 - Problem

Voiceover: "In 2026, a major public university ran its first fully-online admission exam. Recall-style multiple choice scores inflated across the board. Then AI proctoring wrongly voided thousands of honest students. The lesson is simple: you cannot proctor your way out of a format where the AI simply knows the answer."

Action: Open `http://localhost:3000`. Show the Keymark title and offline deterministic runtime badge.

## 0:20-0:45 - Principle

Voiceover: "Keymark uses Solver-Bound Validity. The answer is valid only relative to the solver-specific instance that generated it. Every answer carries its own proof of origin."

Action: Click `Run 90-second proof demo`.

## 0:45-1:15 - Teacher View

Voiceover: "Here the teacher assigns one concept to the whole class. But each student gets a keyed instance seeded from their identity and the assignment. Same concept, different numbers, different correct answer, different proof key."

Action: Use `Next proof step` if needed until the Teacher view appears. Show Ava, Mateo, and Zara side by side. Read two different seed tags and two different correct answers.

## 1:15-1:40 - Same-Answer Rejection

Voiceover: "Here is the credibility test: what if two students get the same answer value? Keymark still rejects a transplant because the required proof key belongs to the other seed."

Action: Show the same-answer panel. Read the shared answer value, the two different seed tags, and the red rejection receipt.

## 1:40-2:05 - Copy Ring

Voiceover: "Now simulate a copy ring. Every student pastes a classmate's answer. The verifier does not accuse anyone. It just runs the deterministic solver for that student's seed."

Action: Click `Simulate copy ring`. Show the rejection reasons: each pasted answer is correct for another seed, not the target student's seed.

## 2:05-2:30 - Attack Harness

Voiceover: "Now let an AI take it. This is an offline simulation: no model is called at runtime. The simulated AI receives the generic shared prompt and returns the correct generic answer. That answer would ace a shared exam. But submitted against Riley's keyed instance, it is rejected."

Action: Click `Run transplant attack`. Show the generic answer on the left, Riley's keyed instance on the right, and the AI attempt rejection receipt.

## 2:30-2:45 - Real Solver Passes

Voiceover: "A real solver who answers Riley's actual keyed instance passes. The proof key recomputes from Riley's seed and answer. The check is arithmetic, not a guess about intent."

Action: In Student view, click `Demo-fill real answer`. Show the PASS receipt and proof key.

## 2:45-2:55 - Build Week Use

Voiceover: "GPT-5.6 designed the Solver-Bound Validity framing, the keyed item templates, and the fingerprint scheme. Codex built the zero-dependency Node server, deterministic verifier, vanilla UI, copy-ring simulation, and attack harness."

Action: Briefly show the file tree or README runtime note.

## 2:55-3:00 - Close

Voiceover: "The Turing test asks if a machine can pass as human. Keymark asks if an answer belongs to you."
