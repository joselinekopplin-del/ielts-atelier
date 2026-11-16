'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const C = require('../core.js');
const questions = C.SKILLS.flatMap(skill => Array.from({length: 5}, (_, i) => ({id: `${skill}-${i}`, skill, answer: skill === 'writing' || skill === 'speaking' ? undefined : ['West Hall']})));

test('objective grading normalises typography without accepting partial or missing answers', () => {
  assert.equal(C.grade({answer: ['West Hall']}, '  WEST\u00a0HALL. '), true);
  assert.equal(C.grade({answer: ["don't"]}, 'Don’t'), true);
  assert.equal(C.grade({answer: ['community-led']}, 'community–led'), true);
  assert.equal(C.grade({answer: ['12', 'twelve']}, 'Twelve'), true);
  assert.equal(C.grade({answer: ['West Hall']}, 'Hall'), false);
  assert.equal(C.grade({answer: ['West Hall']}, ''), false);
  assert.equal(C.grade({answer: ['West Hall']}, undefined), false);
  assert.equal(C.grade({answer: []}, 'any'), null);
  assert.equal(C.grade({skill: 'writing'}, 'an essay'), null);
});

test('calendar keys use the learner local date instead of UTC', () => {
  const corePath = JSON.stringify(path.resolve(__dirname, '../core.js'));
  const result = spawnSync(process.execPath, ['-e', `console.log(require(${corePath}).localDateKey(new Date('2026-11-15T17:00:00Z')))`], {env: {...process.env, TZ: 'Asia/Shanghai'}, encoding: 'utf8'});
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '2026-11-16');
  assert.equal(C.localDateKey(new Date(2026, 0, 2)), '2026-01-02');
  assert.throws(() => C.localDateKey(new Date('bad')));
});

test('review intervals expand, cap at sixty days, and reset after an error', () => {
  let previous = {};
  for (const expected of [1, 3, 7, 14, 30, 60, 60]) {
    previous = C.nextReview(previous, true, 1000);
    assert.equal(previous.intervalDays, expected);
    assert.equal(previous.dueAt, 1000 + expected * 86400000);
  }
  previous = C.nextReview(previous, false, 2000);
  assert.deepEqual(previous, {intervalDays: 1, dueAt: 86402000, streak: 0, lapses: 1});
  assert.equal(C.nextReview(previous, true, 3000).intervalDays, 1);
});

test('daily practice is reproducible, balanced, unique, and prioritises due mistakes', () => {
  const end = new Date(2026, 10, 16).getTime();
  const progress = {'listening-3': {attempts: 2, correct: 0, lastCorrect: false, dueAt: end - 1000}};
  const first = C.selectDaily(questions, progress, '2026-11-16', 8);
  assert.deepEqual(first, C.selectDaily(questions, progress, '2026-11-16', 8));
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map(q => q.id)).size, 8);
  for (const skill of C.SKILLS) assert.equal(first.filter(q => q.skill === skill).length, 2);
  assert.equal(first.find(q => q.skill === 'listening').id, 'listening-3');
  assert.notDeepEqual(first.map(q => q.id), C.selectDaily(questions, progress, '2026-11-17', 8).map(q => q.id));
  assert.deepEqual(C.selectDaily(questions, progress, '2026-11-16', 0), []);
  assert.equal(C.selectDaily([...questions, ...questions], {}, '2026-11-16', 100).length, 20);
  assert.throws(() => C.selectDaily(questions, {}, '2026-02-30'));
});

test('recommendations separate unseen skills, due dates, and measured weakness', () => {
  const progress = Object.fromEntries(C.SKILLS.map(skill => [`${skill}-0`, {attempts: 4, correct: skill === 'reading' ? 1 : 3, dueAt: skill === 'listening' ? 100 : 1000}]));
  assert.equal(C.recommend(questions, progress, 500).weakestSkill, 'reading');
  assert.deepEqual(C.recommend(questions, progress, 500).dueIds, ['listening-0']);
  delete progress['speaking-0'];
  assert.equal(C.recommend(questions, progress, 500).weakestSkill, 'speaking');
  assert.equal(C.recommend([], {}, 500).weakestSkill, null);
});

test('summary counts attempts independently from unique answered questions', () => {
  const result = C.summarize({'reading-0': {attempts: 3, correct: 2}, 'speaking-0': {attempts: 1, correct: 1}, stale: {attempts: 100, correct: 100}}, questions);
  assert.equal(result.total, 20);
  assert.equal(result.answered, 2);
  assert.equal(result.attempts, 4);
  assert.equal(result.correct, 3);
  assert.equal(result.accuracy, 75);
  assert.equal(result.bySkill.reading.accuracy, 67);
  assert.equal(result.bySkill.speaking.correct, 1);
});

test('backup round trip preserves validated progress and preferences without retaining references', () => {
  const original = {version: 1, progress: {'reading-0': {attempts: 2, correct: 1, lastCorrect: false, lastAnswer: 'East Hall', updatedAt: 100, intervalDays: 1, dueAt: 86400100, streak: 0, lapses: 1}}, vocabulary: {}, settings: {module: 'academic', dailyGoal: 8, remindersEnabled: true}, history: [{date: '2026-11-16', questionIds: ['reading-0'], answered: 1, correct: 0, durationSeconds: 20}]};
  const clean = C.validateImport(original, questions);
  assert.deepEqual(clean, original);
  original.progress['reading-0'].lastAnswer = 'changed';
  original.history[0].questionIds.push('reading-1');
  assert.equal(clean.progress['reading-0'].lastAnswer, 'East Hall');
  assert.deepEqual(clean.history[0].questionIds, ['reading-0']);
});

test('backup validation rejects prototype pollution, malformed counters, and oversized input', () => {
  const base = () => ({version: 1, progress: {}, settings: {}, history: []});
  assert.throws(() => C.validateImport(JSON.parse('{"version":1,"progress":{},"settings":{"__proto__":{"polluted":true}},"history":[]}'), questions));
  const badCount = base(); badCount.progress['reading-0'] = {attempts: 1, correct: 2};
  assert.throws(() => C.validateImport(badCount, questions));
  const badNumber = base(); badNumber.progress['reading-0'] = {attempts: Infinity};
  assert.throws(() => C.validateImport(badNumber, questions));
  const badId = base(); badId.progress['missing-0'] = {attempts: 1};
  assert.throws(() => C.validateImport(badId, questions));
  const badSettings = base(); badSettings.settings.nested = {oops: true};
  assert.throws(() => C.validateImport(badSettings, questions));
  for (const [key, value] of [['module', 'injected'], ['module', 'both'], ['targetBand', 10], ['dailyGoal', -8], ['reminderTime', '25:90'], ['remindersEnabled', 'yes']]) {
    const backup = base(); backup.settings[key] = value;
    assert.throws(() => C.validateImport(backup, questions));
  }
  const badDate = base(); badDate.history.push({date: '2026-02-30', answered:1, correct:1});
  assert.throws(() => C.validateImport(badDate, questions));
  const missingCounters = base(); missingCounters.history.push({date:'2026-11-16'});
  assert.throws(() => C.validateImport(missingCounters, questions), /缺少/);
  const huge = base(); huge.history = Array(10001).fill({});
  assert.throws(() => C.validateImport(huge, questions));
  const getter = base(); Object.defineProperty(getter.settings, 'secret', {enumerable: true, get() { throw new Error('must not execute'); }});
  assert.throws(() => C.validateImport(getter, questions), /不支持的属性/);
  assert.equal(Object.prototype.polluted, undefined);
});

test('vocabulary backups preserve spaced review and saved words and migrate older backups', () => {
  const backup = {version: 1, progress: {}, vocabulary: {
    'renewable energy': {intervalDays: 7, dueAt: 1800000000000, streak: 3, lapses: 1, saved: true},
    'reservoir': {saved: true},
    'sustainable': {intervalDays: 1, dueAt: 1790000000000, streak: 0, lapses: 2}
  }, settings: {}, history: []};
  const restored = C.validateImport(backup, questions);
  assert.deepEqual(restored.vocabulary['renewable energy'], backup.vocabulary['renewable energy']);
  assert.deepEqual(restored.vocabulary.reservoir, {intervalDays: 0, dueAt: 0, streak: 0, lapses: 0, saved: true});
  assert.equal(restored.vocabulary.sustainable.saved, false);
  backup.vocabulary['renewable energy'].saved = false;
  assert.equal(restored.vocabulary['renewable energy'].saved, true);
  delete backup.vocabulary;
  assert.deepEqual(C.validateImport(backup, questions).vocabulary, {});
});

test('vocabulary imports reject unsafe keys, invalid fields and excessive entry counts', () => {
  const base = () => ({version: 1, progress: {}, settings: {}, history: [], vocabulary: {}});
  for (const value of [{saved: 'true'}, {intervalDays: -1}, {dueAt: Infinity}, {streak: 1.5}]) {
    const backup = base(); backup.vocabulary.example = value;
    assert.throws(() => C.validateImport(backup, questions));
  }
  for (const word of ['', ' ', 'bad\nword']) {
    const backup = base(); backup.vocabulary[word] = {saved: true};
    assert.throws(() => C.validateImport(backup, questions));
  }
  const proto = JSON.parse('{"version":1,"progress":{},"vocabulary":{"__proto__":{"saved":true}},"settings":{},"history":[]}');
  assert.throws(() => C.validateImport(proto, questions));
  const huge = base(); huge.vocabulary = Object.fromEntries(Array.from({length:20001}, (_,i)=>[`word-${i}`, {saved:true}]));
  assert.throws(() => C.validateImport(huge, questions));
});
