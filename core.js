/* IELTS Studio — portable, dependency-free practice logic. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.IELTSCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SKILLS = Object.freeze(['listening', 'reading', 'writing', 'speaking']);
  const DAY = 86400000;
  const INTERVALS = Object.freeze([1, 3, 7, 14, 30, 60]);
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

  function normalizeAnswer(value) {
    return String(value == null ? '' : value)
      .normalize('NFKC')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/\s+/gu, ' ')
      .trim()
      .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '')
      .toLocaleLowerCase('en-GB');
  }

  // Null deliberately distinguishes a human-assessed task from a wrong answer.
  function grade(question, value) {
    if (!question || !Array.isArray(question.answer) || !question.answer.length) return null;
    const actual = normalizeAnswer(value);
    return actual !== '' && question.answer.some(expected => normalizeAnswer(expected) === actual);
  }

  function localDateKey(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('无效日期');
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function nextReview(previous = {}, correct, now = Date.now()) {
    if (!Number.isFinite(now) || now < 0) throw new TypeError('无效复习时间');
    const priorStreak = Math.max(0, Math.floor(Number(previous.streak) || 0));
    const priorLapses = Math.max(0, Math.floor(Number(previous.lapses) || 0));
    const streak = correct === true ? priorStreak + 1 : 0;
    const intervalDays = correct === true ? INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)] : 1;
    return { intervalDays, dueAt: now + intervalDays * DAY, streak, lapses: priorLapses + (correct === true ? 0 : 1) };
  }

  function distinctQuestions(questions) {
    const seen = new Set();
    return (Array.isArray(questions) ? questions : []).filter(q => {
      if (!q || typeof q.id !== 'string' || !SKILLS.includes(q.skill) || seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  }

  function safeRecord(progress, id) {
    const value = progress && Object.prototype.hasOwnProperty.call(progress, id) ? progress[id] : null;
    return value && typeof value === 'object' ? value : {};
  }

  function summarize(progress = {}, questions = []) {
    const make = () => ({ attempts: 0, correct: 0, accuracy: 0, answered: 0, total: 0 });
    const bySkill = Object.fromEntries(SKILLS.map(skill => [skill, make()]));
    const summary = { ...make(), bySkill };
    for (const q of distinctQuestions(questions)) {
      const p = safeRecord(progress, q.id);
      const attempts = Math.max(0, Math.floor(Number(p.attempts) || 0));
      const correct = Math.min(attempts, Math.max(0, Math.floor(Number(p.correct) || 0)));
      for (const target of [summary, bySkill[q.skill]]) {
        target.total++;
        target.attempts += attempts;
        target.correct += correct;
        if (attempts > 0) target.answered++;
      }
    }
    for (const target of [summary, ...Object.values(bySkill)]) {
      target.accuracy = target.attempts ? Math.round(target.correct / target.attempts * 100) : 0;
    }
    return summary;
  }

  function recommend(questions, progress = {}, now = Date.now()) {
    const bank = distinctQuestions(questions);
    const stats = summarize(progress, bank);
    // Unpractised skills are shown before deriving a weakness from scant data.
    const available = SKILLS.filter(skill => stats.bySkill[skill].total);
    available.sort((a, b) => {
      const x = stats.bySkill[a], y = stats.bySkill[b];
      if (!x.attempts || !y.attempts) return x.attempts - y.attempts;
      return x.accuracy - y.accuracy || x.answered / x.total - y.answered / y.total || SKILLS.indexOf(a) - SKILLS.indexOf(b);
    });
    const weakestSkill = available[0] || null;
    const dueIds = bank.filter(q => {
      const p = safeRecord(progress, q.id);
      return p.attempts > 0 && Number.isFinite(p.dueAt) && p.dueAt > 0 && p.dueAt <= now;
    }).sort((a, b) => safeRecord(progress, a.id).dueAt - safeRecord(progress, b.id).dueAt || a.id.localeCompare(b.id)).map(q => q.id);
    const names = { listening: '听力', reading: '阅读', writing: '写作', speaking: '口语' };
    const reason = dueIds.length
      ? `有 ${dueIds.length} 道题到期复习，建议先巩固，再练习${names[weakestSkill] || '其他题目'}。`
      : !weakestSkill ? '导入或添加题目后即可制定练习计划。'
        : !stats.bySkill[weakestSkill].attempts ? `${names[weakestSkill]}尚未练习，今天先完成一次基础训练。`
          : `根据已记录的练习，建议加强${names[weakestSkill]}；主观题记录来自你的自评。`;
    return { weakestSkill, dueIds, reason };
  }

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function dayEnd(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new TypeError('日期格式应为 YYYY-MM-DD');
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (localDateKey(date) !== dateKey) throw new TypeError('无效日期');
    return date.getTime();
  }

  function selectDaily(questions, progress = {}, dateKey = localDateKey(), limit = 8) {
    const bank = distinctQuestions(questions);
    const end = dayEnd(dateKey);
    const count = Math.min(bank.length, Math.max(0, Math.floor(Number(limit) || 0)));
    if (!count) return [];
    const stats = summarize(progress, bank);
    const skills = SKILLS.filter(skill => bank.some(q => q.skill === skill));
    skills.sort((a, b) => {
      const x = stats.bySkill[a], y = stats.bySkill[b];
      const xa = x.attempts ? x.accuracy : -1, ya = y.attempts ? y.accuracy : -1;
      return xa - ya || hash(dateKey + a) - hash(dateKey + b);
    });
    function priority(q) {
      const p = safeRecord(progress, q.id);
      if (p.attempts > 0 && p.dueAt > 0 && p.dueAt <= end) return 0;
      if (p.attempts > 0 && p.lastCorrect === false) return 1;
      if (!p.attempts) return 2;
      return 3;
    }
    const pools = Object.fromEntries(skills.map(skill => [skill, bank.filter(q => q.skill === skill).sort((a, b) => {
      const rank = priority(a) - priority(b);
      if (rank) return rank;
      const x = safeRecord(progress, a.id), y = safeRecord(progress, b.id);
      if (priority(a) === 0 && x.dueAt !== y.dueAt) return x.dueAt - y.dueAt;
      const xa = x.attempts ? x.correct / x.attempts : 0, ya = y.attempts ? y.correct / y.attempts : 0;
      return xa - ya || hash(dateKey + a.id) - hash(dateKey + b.id) || a.id.localeCompare(b.id);
    })]));
    const chosen = [];
    // Round robin gives every available skill one place before taking seconds.
    while (chosen.length < count) {
      let added = false;
      for (const skill of skills) {
        if (pools[skill].length && chosen.length < count) {
          chosen.push(pools[skill].shift());
          added = true;
        }
      }
      if (!added) break;
    }
    return chosen;
  }

  function assertObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      throw new TypeError(`${name}必须为普通对象`);
    }
  }

  function assertSafeTree(value, depth = 0) {
    if (depth > 8) throw new TypeError('备份嵌套层级过深');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('备份包含无效数字');
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return;
    if (typeof value !== 'object') throw new TypeError('备份包含不支持的数据类型');
    if (!Array.isArray(value)) assertObject(value, '备份字段');
    const keys = Object.keys(value);
    if (keys.length > 20000) throw new TypeError('备份数据量过大');
    for (const key of keys) {
      if (forbidden.has(key)) throw new TypeError('备份含不安全字段');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) throw new TypeError('备份含不支持的属性');
      assertSafeTree(value[key], depth + 1);
    }
  }

  function integer(value, name, max = 1000000) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new TypeError(`${name}必须为有效的非负整数`);
    return value;
  }

  function boundedString(value, name, max = 1000) {
    if (typeof value !== 'string' || value.length > max) throw new TypeError(`${name}文本格式或长度不正确`);
    return value;
  }

  function validateImport(data, questions = []) {
    assertObject(data, '备份');
    assertSafeTree(data);
    if (data.version !== 1) throw new TypeError('不支持的备份版本，请使用 version: 1');
    assertObject(data.progress, 'progress');
    assertObject(data.settings || {}, 'settings');
    if (data.history !== undefined && !Array.isArray(data.history)) throw new TypeError('history必须为数组');
    if ((data.history || []).length > 10000) throw new TypeError('训练记录最多 10000 条');
    const bankIds = new Set(distinctQuestions(questions).map(q => q.id));
    const progress = {};
    if (Object.keys(data.progress).length > 10000) throw new TypeError('题目记录最多 10000 条');
    for (const [id, value] of Object.entries(data.progress)) {
      if (!bankIds.has(id)) throw new TypeError(`备份包含当前题库不存在的题目：${id.slice(0, 80)}`);
      assertObject(value, '练习记录');
      const p = {
        attempts: integer(value.attempts ?? 0, 'attempts'),
        correct: integer(value.correct ?? 0, 'correct'),
        lastCorrect: value.lastCorrect ?? false,
        lastAnswer: boundedString(value.lastAnswer ?? '', 'lastAnswer', 100000),
        updatedAt: integer(value.updatedAt ?? 0, 'updatedAt', 8640000000000000),
        intervalDays: integer(value.intervalDays ?? 0, 'intervalDays', 3650),
        dueAt: integer(value.dueAt ?? 0, 'dueAt', 8640000000000000),
        streak: integer(value.streak ?? 0, 'streak'),
        lapses: integer(value.lapses ?? 0, 'lapses')
      };
      if (typeof p.lastCorrect !== 'boolean') throw new TypeError('lastCorrect必须为布尔值');
      if (p.correct > p.attempts) throw new TypeError('答对次数不能大于作答次数');
      progress[id] = p;
    }
    const vocabulary = {};
    const sourceVocabulary = data.vocabulary ?? {};
    assertObject(sourceVocabulary, 'vocabulary');
    if (Object.keys(sourceVocabulary).length > 20000) throw new TypeError('词汇记录最多 20000 条');
    for (const [word, value] of Object.entries(sourceVocabulary)) {
      if (!word.trim() || word.length > 1000 || /[\u0000-\u001f\u007f]/u.test(word) || forbidden.has(word)) throw new TypeError('词汇记录包含无效单词');
      assertObject(value, '词汇记录');
      const entry = {
        intervalDays: integer(value.intervalDays ?? 0, '词汇 intervalDays', 3650),
        dueAt: integer(value.dueAt ?? 0, '词汇 dueAt', 8640000000000000),
        streak: integer(value.streak ?? 0, '词汇 streak'),
        lapses: integer(value.lapses ?? 0, '词汇 lapses'),
        saved: value.saved ?? false
      };
      if (typeof entry.saved !== 'boolean') throw new TypeError('词汇 saved 必须为布尔值');
      vocabulary[word] = entry;
    }
    const settings = {};
    // Settings remain flat for forward-compatible UI preferences; nested data is rejected.
    const sourceSettings = data.settings || {};
    if (Object.keys(sourceSettings).length > 40) throw new TypeError('设置字段过多');
    for (const [key, value] of Object.entries(sourceSettings)) {
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key)) throw new TypeError('无效的设置字段');
      if (typeof value === 'string') settings[key] = boundedString(value, key, 500);
      else if (typeof value === 'boolean') settings[key] = value;
      else if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e12) settings[key] = value;
      else throw new TypeError('设置仅支持短文本、布尔值和数字');
    }
    if (settings.module !== undefined && !['academic', 'general'].includes(settings.module)) throw new TypeError('无效的考试类别');
    if (settings.targetBand !== undefined && (typeof settings.targetBand !== 'number' || settings.targetBand < 0 || settings.targetBand > 9 || settings.targetBand * 2 % 1)) throw new TypeError('目标分数应为 0–9 分，间隔 0.5 分');
    if (settings.dailyGoal !== undefined && (!Number.isInteger(settings.dailyGoal) || settings.dailyGoal < 1 || settings.dailyGoal > 200)) throw new TypeError('每日练习目标应为 1–200 道题');
    if (settings.reminderTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime)) throw new TypeError('提醒时间应为 HH:MM');
    if (settings.remindersEnabled !== undefined && typeof settings.remindersEnabled !== 'boolean') throw new TypeError('提醒开关必须为布尔值');
    if (settings.examDate !== undefined && settings.examDate !== '') dayEnd(settings.examDate);
    const history = (data.history || []).map(item => {
      assertObject(item, '训练记录');
      if (Object.keys(item).length > 30) throw new TypeError('训练记录字段过多');
      // These fields drive calendar charts and counters; missing values would
      // otherwise turn an accepted backup into NaN totals in the interface.
      if (typeof item.date !== 'string' || item.answered === undefined || item.correct === undefined) throw new TypeError('训练记录缺少 date、answered 或 correct');
      const result = {};
      for (const [key, value] of Object.entries(item)) {
        if (!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key)) throw new TypeError('无效的训练记录字段');
        if (key === 'questionIds') {
          if (!Array.isArray(value) || value.length > 1000 || value.some(id => typeof id !== 'string' || !bankIds.has(id))) throw new TypeError('训练记录包含无效题目列表');
          result[key] = [...new Set(value)];
        } else if (typeof value === 'string') result[key] = boundedString(value, key, 1000);
        else if (typeof value === 'boolean') result[key] = value;
        else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8640000000000000) result[key] = value;
        else throw new TypeError('训练记录包含无效字段');
      }
      if (result.date !== undefined) dayEnd(result.date);
      if (result.skill !== undefined && ![...SKILLS, 'mixed', 'all'].includes(result.skill)) throw new TypeError('训练记录包含无效科目');
      for (const key of ['at', 'answered', 'correct', 'durationSeconds']) {
        if (result[key] !== undefined) integer(result[key], key, key === 'at' ? 8640000000000000 : 100000000);
      }
      if (result.correct !== undefined && result.answered !== undefined && result.correct > result.answered) throw new TypeError('训练记录答对次数不能超过作答次数');
      return result;
    });
    return { version: 1, progress, vocabulary, settings, history };
  }

  return Object.freeze({ SKILLS, normalizeAnswer, grade, localDateKey, nextReview, selectDaily, recommend, summarize, validateImport });
});
