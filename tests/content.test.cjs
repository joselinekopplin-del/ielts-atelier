'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'questions.js'), 'utf8'), context);
const bank = JSON.parse(JSON.stringify(context.window.IELTS_QUESTIONS));
const byId = id => {
  const item = bank.find(q => q.id === id);
  assert.ok(item, `Question ${id} must exist`);
  return item;
};
const normalize = value => value.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const wordCount = value => (value.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g) || []).length;

test('every selectable item has a unique identity, honest provenance and usable content', () => {
  assert.ok(bank.length >= 150, 'Both modules need substantial practice coverage');
  assert.equal(new Set(bank.map(q => q.id)).size, bank.length);
  for (const q of bank) {
    for (const field of ['id', 'skill', 'module', 'type', 'title', 'topic', 'level', 'groupId', 'prompt', 'explanation']) {
      assert.equal(typeof q[field], 'string', `${q.id}: ${field}`);
      assert.ok(q[field].trim(), `${q.id}: ${field} must not be blank`);
    }
    assert.ok(['listening', 'reading', 'speaking', 'writing'].includes(q.skill));
    assert.ok(['academic', 'general', 'both'].includes(q.module));
    assert.equal(q.year, null, `${q.id} must not masquerade as a dated past paper`);
    assert.equal(q.origin, 'original');
    assert.equal(q.createdYear, 2026);
    assert.ok(Array.isArray(q.vocabulary));
    assert.ok(!/<script\b|javascript:/i.test(JSON.stringify(q)), 'Content should not embed executable markup');
  }
});

test('mock selection has 40 listening answers and separate complete Academic / General reading sets', () => {
  const listening = bank.filter(q => q.skill === 'listening');
  assert.equal(listening.length, 40);
  const listeningGroups = [...new Set(listening.map(q => q.groupId))];
  assert.equal(listeningGroups.length, 4);
  for (const id of listeningGroups) assert.equal(listening.filter(q => q.groupId === id).length, 10);
  for (const module of ['academic', 'general']) {
    const reading = bank.filter(q => q.skill === 'reading' && q.module === module);
    assert.equal(reading.length, 40, `${module} reading mock needs 40 scored answers`);
    assert.equal(new Set(reading.map(q => q.groupId)).size, 3);
  }
  assert.equal(bank.filter(q => q.skill === 'reading' && q.module === 'both').length, 0, 'Different reading modules must not silently share the same mock');
});

test('a grouped source is consistent, long enough to practise and has coherent question numbering', () => {
  const groups = [...new Set(bank.filter(q => q.passage || q.transcript).map(q => q.groupId))];
  for (const id of groups) {
    const items = bank.filter(q => q.groupId === id);
    const field = items[0].skill === 'reading' ? 'passage' : 'transcript';
    const source = items[0][field];
    assert.ok(wordCount(source) >= 450, `${id} needs a substantive source`);
    for (const [index, q] of items.entries()) {
      assert.equal(q[field], source, `${id} must share one unchanged source`);
      assert.ok(q.id.endsWith(String(index + 1).padStart(2, '0')));
      if (index > 0) assert.equal(q.vocabulary.length, 0, 'Shared vocabulary should not be duplicated per answer');
    }
  }
});

test('objective answer keys are usable, and reading gap answers have textual evidence', () => {
  for (const q of bank.filter(q => ['reading', 'listening'].includes(q.skill))) {
    assert.ok(Array.isArray(q.answer) && q.answer.length > 0, `${q.id} needs accepted answers`);
    assert.equal(new Set(q.answer).size, q.answer.length, `${q.id} has duplicate answer variants`);
    for (const answer of q.answer) assert.ok(typeof answer === 'string' && answer.trim());
    if (q.options) {
      assert.ok(q.options.length >= 3);
      assert.equal(new Set(q.options).size, q.options.length, `${q.id} repeats an option`);
      assert.equal(q.answer.length, 1, `${q.id} should be single-select`);
      assert.ok(q.options.includes(q.answer[0]), `${q.id} cannot be graded against its options`);
    } else if (q.skill === 'reading') {
      const source = ` ${normalize(q.passage)} `;
      assert.ok(q.answer.some(answer => source.includes(` ${normalize(answer)} `)), `${q.id} gap answer must occur in the passage`);
      const maximum = /NO MORE THAN TWO WORDS/i.test(q.prompt) ? 2 : /ONE WORD/i.test(q.prompt) ? 1 : null;
      if (maximum) for (const answer of q.answer) assert.ok(answer.trim().split(/\s+/).length <= maximum, `${q.id} exceeds its stated word limit`);
    }
    if (q.type === '判断题') assert.deepEqual(q.options, ['True', 'False', 'Not Given']);
  }
});

// These evidence checks independently guard distinctions most easily broken by an edit.
// They do not claim to prove all semantic correctness automatically.
const evidenceCases = [
  ['r-seed-01', 'False', 'A variety that attracts little commercial interest today'],
  ['r-seed-02', 'False', 'some species produce seeds that cannot tolerate this treatment'],
  ['r-seed-03', 'True', 'look perfectly normal while losing its ability to germinate'],
  ['r-seed-05', 'False', 'its place of origin is not proof'],
  ['r-repair-04', 'True', 'modularity may add weight'],
  ['r-repair-05', 'False', "a part's appearance does not establish"],
  ['r-repair-07', 'True', 'An unsuccessful repair can still be educational'],
  ['r-memory-01', 'False', 'an imperfect guide to future performance'],
  ['r-memory-02', 'True', 'describe a process aloud'],
  ['r-memory-05', 'False', 'There is no single spacing schedule'],
  ['r-memory-06', 'False', 'beginners may first need some focused instruction'],
  ['r-gt-community-05', 'False', 'It does not include entry to the swimming pool'],
  ['r-gt-community-06', 'False', 'No booking is required'],
  ['r-gt-community-08', 'True', 'centre membership is not required'],
  ['r-gt-work-03', 'False', 'even if they have used similar equipment elsewhere'],
  ['r-gt-work-04', 'False', 'must not operate the equipment themselves'],
  ['r-gt-work-05', 'True', 'stop and ask for guidance'],
  ['r-gt-work-10', 'False', 'without giving their names'],
  ['r-gt-tools-04', 'False', 'accepting every offered object can create an unmanageable collection'],
  ['r-gt-tools-05', 'True', 'without paying for its upkeep several years later'],
  ['r-gt-tools-07', 'False', 'a loan does not always prevent a purchase'],
  ['r-gt-tools-08', 'True', 'learn from borrowing patterns']
];
test('True / False evidence remains aligned with answer keys', () => {
  for (const [id, expected, evidence] of evidenceCases) {
    const q = byId(id);
    assert.equal(q.answer[0], expected, id);
    assert.ok(normalize(q.passage).includes(normalize(evidence)), `${id} lost its supporting evidence`);
  }
});

test('Not Given questions concern absent information, not mere paraphrases', () => {
  const cases = [
    ['r-seed-04', /nineteenth|first community seed exchange/i],
    ['r-repair-06', /all online repair videos are produced|qualified technicians/i],
    ['r-memory-03', /first invented|invented for language/i],
    ['r-gt-community-07', /taught at the centre for|ten years/i],
    ['r-gt-work-11', /appointed last year|appointment date/i],
    ['r-gt-tools-06', /under thirty|age distribution/i]
  ];
  for (const [id, absentClaim] of cases) {
    const q = byId(id);
    assert.equal(q.answer[0], 'Not Given');
    assert.ok(!absentClaim.test(q.passage), `${id} now contains the previously absent fact; re-review its key`);
  }
});

test('both writing modules and all three speaking parts are selectable with realistic instructions', () => {
  for (const module of ['academic', 'general']) {
    const task1 = bank.filter(q => q.skill === 'writing' && q.module === module && /Task 1/.test(q.type));
    assert.ok(task1.length >= 4);
    for (const q of task1) {
      assert.equal(q.minWords, 150);
      assert.equal(q.seconds, 1200);
      assert.ok(q.checklist.length >= 4);
      assert.ok(q.model.length > 60);
      if (module === 'general') assert.ok(wordCount(q.model) >= 150, `${q.title} needs a complete letter model`);
    }
  }
  const essays = bank.filter(q => q.skill === 'writing' && /Task 2/.test(q.type));
  assert.ok(essays.length >= 6);
  for (const q of essays) {
    assert.equal(q.module, 'both');
    assert.equal(q.minWords, 250);
    assert.equal(q.seconds, 2400);
  }
  for (const part of [1, 2, 3]) assert.ok(bank.filter(q => q.skill === 'speaking' && q.type.includes(`Part ${part}`)).length >= 6);
});

test('vocabulary has distinct words, Chinese meanings and usable example sentences', () => {
  const vocabulary = bank.flatMap(q => q.vocabulary);
  assert.ok(vocabulary.length >= 80);
  assert.equal(new Set(vocabulary.map(entry => entry.word)).size, vocabulary.length);
  for (const entry of vocabulary) {
    assert.ok(entry.word.trim());
    assert.ok(/[\u4e00-\u9fff]/.test(entry.meaning), `${entry.word} needs a Chinese meaning`);
    assert.ok(wordCount(entry.example) >= 4, `${entry.word} needs a usable example`);
  }
});
