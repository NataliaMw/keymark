#!/usr/bin/env node
const {
  templates,
  buildInstance,
  verifyAnswer,
  proofKey
} = require('./items/keyedTemplates');

const SAMPLE_SIZE = 200;
const MAX_COLLISION_RATE = 0.02;
const ASSIGNMENT = 'selftest-answer-separation';

function known(template, instances) {
  return instances.map((instance, index) => ({
    label: `Student ${index + 1}`,
    instance
  }));
}

function answerKey(template, instance) {
  return template.canonicalAnswer(template.solve(instance), instance);
}

function collisionStats(template, instances) {
  const buckets = new Map();
  for (const instance of instances) {
    const key = answerKey(template, instance);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(instance);
  }
  const duplicateCount = instances.length - buckets.size;
  const collisionRate = duplicateCount / instances.length;
  const organicPair = [...buckets.values()].find(bucket => bucket.length > 1) || null;
  return { duplicateCount, collisionRate, organicPair };
}

function runSelfTest() {
  const results = templates.map(template => {
    const instances = Array.from({ length: SAMPLE_SIZE }, (_, index) => (
      buildInstance(template.id, ASSIGNMENT, `student-${String(index + 1).padStart(4, '0')}`, `Student ${index + 1}`)
    ));
    const allKnown = known(template, instances);
    const stats = collisionStats(template, instances);
    const target = instances[0];
    const source = instances[1];
    const targetAnswer = template.solve(target);
    const sourceAnswer = template.solve(source);
    const own = verifyAnswer(
      template.id,
      { answer: targetAnswer, proofKey: proofKey(template, targetAnswer, target) },
      target,
      { knownInstances: allKnown }
    );
    const forcedCollision = verifyAnswer(
      template.id,
      { answer: targetAnswer, proofKey: proofKey(template, sourceAnswer, source) },
      target,
      { knownInstances: allKnown }
    );
    let organicCollision = null;
    if (stats.organicPair) {
      const [first, second] = stats.organicPair;
      const firstAnswer = template.solve(first);
      organicCollision = verifyAnswer(
        template.id,
        { answer: firstAnswer, proofKey: proofKey(template, firstAnswer, first) },
        second,
        { knownInstances: allKnown }
      );
    }

    const checks = {
      answerSeparation: stats.collisionRate < MAX_COLLISION_RATE,
      ownSubmissionPasses: own.valid === true,
      forcedCollisionTransplantFails: forcedCollision.valid === false,
      organicCollisionTransplantFails: organicCollision ? organicCollision.valid === false : true
    };
    return {
      templateId: template.id,
      title: template.title,
      sampleSize: SAMPLE_SIZE,
      uniqueAnswers: SAMPLE_SIZE - stats.duplicateCount,
      duplicateAnswers: stats.duplicateCount,
      collisionRate: Number((stats.collisionRate * 100).toFixed(2)),
      checks,
      forcedCollisionReason: forcedCollision.reason,
      organicCollisionReason: organicCollision && organicCollision.reason,
      passed: Object.values(checks).every(Boolean)
    };
  });

  return {
    passed: results.every(result => result.passed),
    maxAllowedCollisionRatePercent: MAX_COLLISION_RATE * 100,
    results
  };
}

function printSelfTest(summary) {
  console.log(`Keymark self-test: ${summary.passed ? 'PASS' : 'FAIL'}`);
  console.log(`Allowed answer collision rate: < ${summary.maxAllowedCollisionRatePercent}% per template over ${SAMPLE_SIZE} seeded instances`);
  for (const result of summary.results) {
    console.log('');
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.templateId}`);
    console.log(`  unique answers: ${result.uniqueAnswers}/${result.sampleSize}`);
    console.log(`  duplicate answers: ${result.duplicateAnswers}`);
    console.log(`  collision rate: ${result.collisionRate}%`);
    for (const [name, passed] of Object.entries(result.checks)) {
      console.log(`  ${passed ? 'PASS' : 'FAIL'} ${name}`);
    }
    console.log(`  forced collision transplant: ${result.forcedCollisionReason}`);
    if (result.organicCollisionReason) {
      console.log(`  organic collision transplant: ${result.organicCollisionReason}`);
    }
  }
}

if (require.main === module) {
  const summary = runSelfTest();
  printSelfTest(summary);
  process.exit(summary.passed ? 0 : 1);
}

module.exports = { runSelfTest };
