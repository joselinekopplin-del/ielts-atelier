'use strict';
// Event-driven logic tests with a deliberately small DOM stub. These complement,
// and do not replace, real browser layout / microphone / Safari verification.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const KEY = 'ielts-atelier-v1', SESSION = 'ielts-atelier-session-v1';
const fixtures = [
  ...['listening', 'reading'].flatMap(skill => Array.from({length:40}, (_,i) => ({id:`${skill}-${i}`, skill, groupId:`${skill}-group-${Math.floor(i / 10)}`, module:'both', origin:'original', title:`${skill} question ${i + 1}`, type:'填空', topic:'Study', level:'基础', prompt:'Write the code.', transcript:'The code is alpha.', passage:'The code is alpha.', answer:['alpha'], explanation:'The stated code is alpha.', vocabulary:[{word:'evidence', meaning:'证据', example:'Evidence supports the claim.'}]}))),
  ...[1,2].map(i => ({id:`writing-${i}`, skill:'writing', module:i === 1 ? 'general' : 'both', origin:'original', title:`Writing Task ${i}`, type:`Task ${i}`, topic:'Study', level:'进阶', prompt:i === 1 ? 'Write a letter asking about an evening course.' : 'Discuss the role of education.', minWords:i === 1 ? 150 : 250, explanation:'Develop your ideas.'})),
  ...[1,2,3].map(i => ({id:`speaking-${i}`, skill:'speaking', module:'both', origin:'original', title:`Speaking Part ${i}`, type:`Part ${i}`, topic:'Study', level:'基础', prompt:'Describe your interests.', explanation:'Give specific examples.'}))
];

function boot({store = new Map(), now = new Date(2026,10,16,12).getTime(), hash = '#dashboard', recording = false} = {}) {
  let clock = now, serial = 0;
  const events = {}, windowEvents = {}, intervals = new Map(), timeouts = new Map(), nodes = new Map();
  const unescape = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  function element(id = '') {
    let html = '';
    return {id, value:'', textContent:'', dataset:{}, open:false, style:{}, classList:{add(){},remove(){},toggle(){}},
      get innerHTML() {return html;},
      set innerHTML(value) {
        html = value;
        if (id === 'main') {
          for (const key of ['answer','timer','word-count','record-result','record-status','audio-status','speech-rate']) nodes.delete(key);
          for (const match of value.matchAll(/id="([^"]+)"/g)) if (!nodes.has(match[1])) nodes.set(match[1], element(match[1]));
          const input = value.match(/<input\b[^>]*\bid="answer"[^>]*\bvalue="([^"]*)"/);
          const textarea = value.match(/<textarea\b[^>]*\bid="answer"[^>]*>([\s\S]*?)<\/textarea>/);
          if (nodes.has('answer')) nodes.get('answer').value = unescape(input?.[1] ?? textarea?.[1] ?? '');
          const recordingResult = value.match(/<div\b[^>]*\bid="record-result"[^>]*>([\s\S]*?)<\/div>/);
          if (recordingResult) nodes.get('record-result').innerHTML = recordingResult[1];
        }
      },
      showModal(){this.open = true;}, close(){this.open = false;}, focus(){}, setSelectionRange(){}, click(){}, remove(){}
    };
  }
  for (const id of ['main','toast','confirm-title','confirm-message','confirm-dialog','module-label','date-label','review-badge','page-label']) nodes.set(id, element(id));
  const document = {
    querySelector(selector) {return selector.startsWith('#') ? nodes.get(selector.slice(1)) || null : null;},
    querySelectorAll(){return [];},
    addEventListener(name, fn){(events[name] ||= []).push(fn);},
    createElement(){return element();},
    body:{append(){}}
  };
  class ClockDate extends Date {
    constructor(...args) {super(...(args.length ? args : [clock]));}
    static now(){return clock;}
  }
  const sandbox = {document, console, Date:ClockDate, navigator:{}, location:{hash, protocol:'https:'},
    localStorage:{getItem:key=>store.get(key) ?? null, setItem:(key,value)=>store.set(key,value), removeItem:key=>store.delete(key)},
    setInterval(fn, delay){const id=++serial;intervals.set(id,{fn,delay});return id;},
    clearInterval(id){intervals.delete(id);},
    setTimeout(fn, delay){const id=++serial;timeouts.set(id,{fn,delay});return id;},
    clearTimeout(id){timeouts.delete(id);},
    addEventListener(name, fn){(windowEvents[name] ||= []).push(fn);},
    scrollTo(){}, speechSynthesis:{speaking:false,cancel(){this.speaking=false;},speak(){this.speaking=true;},getVoices(){return [];}},
    SpeechSynthesisUtterance: class {constructor(text){this.text=text;}},
    URL:{createObjectURL(){return 'blob:test';}, revokeObjectURL(){}}, Blob,
    history:{replaceState(_a,_b,url){sandbox.location.hash=url;}},
  };
  sandbox.window = sandbox;
  if (recording) {
    const stream = {getTracks:()=>[{stop(){}}]};
    sandbox.navigator.mediaDevices = {getUserMedia:async()=>stream};
    sandbox.MediaRecorder = class {
      constructor(_stream, options={}){this.state='inactive';this.mimeType=options.mimeType || 'audio/webm';}
      static isTypeSupported(){return true;}
      start(){this.state='recording';}
      stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'],{type:this.mimeType})});queueMicrotask(()=>this.onstop?.());}
    };
  }
  const context = vm.createContext(sandbox);
  vm.runInContext(`window.IELTS_QUESTIONS=${JSON.stringify(fixtures)};window.IELTS_SOURCES=[];`, context);
  for (const file of ['core.js','app.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'), context, {filename:file});
  const dispatch = (name,event) => {for (const handler of events[name] || []) handler(event);};
  return {
    store, nodes, context,
    get html(){return nodes.get('main').innerHTML;},
    get state(){return JSON.parse(store.get(KEY) || '{}');},
    get session(){return JSON.parse(store.get(SESSION) || 'null');},
    get now(){return clock;},
    get speaking(){return sandbox.speechSynthesis.speaking;},
    click(action, extra={}){const target={dataset:{action,...extra},closest(){return this;}};dispatch('click',{target});},
    input(value){const target=nodes.get('answer');assert.ok(target, 'an answer input is rendered');target.value=value;dispatch('input',{target});},
    change(target){dispatch('change',{target});},
    route(hash){sandbox.location.hash=hash;for(const fn of windowEvents.hashchange || [])fn();},
    tick(milliseconds){clock+=milliseconds;for(const {fn,delay} of [...intervals.values()])if(delay===500)fn();},
    async importBackup(backup){dispatch('change',{target:{id:'import-backup',value:'backup.json',files:[{size:JSON.stringify(backup).length,text:async()=>JSON.stringify(backup)}]}});await new Promise(resolve=>setImmediate(resolve));},
  };
}

test('practice records one attempt, preserves answers across reload, and clears only finished session', () => {
  const first=boot(); first.click('question',{id:'reading-0'}); first.input('ALPHA'); first.click('submit-answer');
  assert.equal(first.state.progress['reading-0'].attempts,1);
  assert.equal(first.state.progress['reading-0'].lastCorrect,true);
  first.click('exit-session');
  const reloaded=boot({store:first.store,now:first.now+60000}); reloaded.click('resume');
  assert.equal(reloaded.nodes.get('answer').value,'ALPHA');
  assert.match(reloaded.html,/回答正确/);
  reloaded.click('next-question');
  assert.equal(reloaded.session,null);
  assert.equal(reloaded.state.progress['reading-0'].attempts,1);
  assert.equal(reloaded.state.history.length,1);
});

test('objective duplicate submission does not inflate practice statistics', () => {
  const app=boot();app.click('question',{id:'reading-0'});app.input('alpha');
  app.click('submit-answer');app.click('submit-answer');
  assert.equal(app.state.progress['reading-0'].attempts,1);
});

test('subjective work saves its draft but enters learning history only once after self assessment', () => {
  const app=boot();app.click('question',{id:'writing-1'});app.input('An original draft with a clear overview.');
  app.click('submit-answer');
  assert.equal(app.state.progress?.['writing-1'],undefined);
  app.click('self-rate',{correct:'false'});app.click('self-rate',{correct:'true'});
  assert.equal(app.state.progress['writing-1'].attempts,1);
  assert.equal(app.state.progress['writing-1'].lastCorrect,false);
  assert.match(app.store.get('ielts-atelier-drafts-v1'),/clear overview/);
});

test('mock deadline survives reload and expired time is carried into next stage', () => {
  const first=boot();first.click('start-mock');first.input('alpha');
  const originalDeadline=first.session.deadline;
  first.click('exit-session');
  const restored=boot({store:first.store,now:originalDeadline+300000});restored.click('resume');restored.tick(1);
  assert.equal(restored.session.stageIndex,1);
  assert.equal(restored.session.answers['listening-0'],'alpha');
  assert.equal(restored.session.deadline,originalDeadline+3600000);
  assert.match(restored.html,/Reading/);
});

test('automatic expiry invalidates a pending stage-confirmation callback', () => {
  const app=boot();app.click('start-mock');app.click('advance-stage');
  assert.equal(app.nodes.get('confirm-dialog').open,true);
  app.tick(1800001);
  assert.equal(app.session.stageIndex,1);
  app.click('dialog-ok');
  assert.equal(app.session.stageIndex,1);
});

test('mock submission saves final typed answer and grades omitted objective answers as wrong', () => {
  const app=boot();app.click('single-mock',{skill:'listening'});app.click('jump-question',{index:'39'});app.input('alpha');
  app.click('advance-stage');app.click('dialog-ok');
  assert.equal(app.session,null);
  assert.equal(Object.keys(app.state.progress).length,40);
  assert.equal(app.state.progress['listening-39'].lastCorrect,true);
  assert.equal(app.state.progress['listening-0'].lastCorrect,false);
  assert.equal(app.state.history.filter(h=>h.correct).length,1);
  assert.match(app.html,/未作答的客观题计为错误/);
});

test('starting another exercise keeps pending work until explicit replacement confirmation', () => {
  const app=boot();app.click('question',{id:'reading-0'});app.input('unfinished');app.click('exit-session');
  app.click('question',{id:'reading-1'});
  assert.equal(app.nodes.get('confirm-dialog').open,true);
  assert.deepEqual(app.session.ids,['reading-0']);
  app.click('dialog-cancel');
  assert.equal(app.session.answers['reading-0'],'unfinished');
  app.click('question',{id:'reading-1'});app.click('dialog-ok');
  assert.deepEqual(app.session.ids,['reading-1']);
});

test('backup import restores vocabulary reviews and progress after confirmation', async () => {
  const original=boot();original.click('question',{id:'reading-0'});original.input('wrong');original.click('submit-answer');original.click('next-question');
  original.click('vocab-save',{word:'evidence'});original.click('vocab-rate',{word:'evidence',correct:'true'});
  const backup=original.state;
  const restored=boot();await restored.importBackup(backup);
  assert.equal(restored.nodes.get('confirm-dialog').open,true);
  assert.equal(restored.state.progress,undefined);
  restored.click('dialog-ok');
  assert.equal(restored.state.progress['reading-0'].attempts,1);
  assert.equal(restored.state.vocabulary.evidence.saved,true);
  assert.equal(restored.state.vocabulary.evidence.intervalDays,1);
  assert.equal(restored.state.vocabulary.evidence.dueAt,backup.vocabulary.evidence.dueAt);
});

test('unknown or inherited hash routes fall back to the dashboard', () => {
  const app=boot({hash:'#toString'});
  assert.match(app.html,/YOUR DAILY PRACTICE/);
  app.route('#practice/constructor');
  assert.match(app.html,/QUESTION LIBRARY/);
  assert.match(app.html,/85 道题/);
});

test('listening narration continues across questions in one group and stops on another group', () => {
  const app=boot();app.click('single-mock',{skill:'listening'});app.click('play-audio');
  assert.equal(app.speaking,true);
  app.click('next-question');
  assert.equal(app.session.index,1);
  assert.equal(app.speaking,true);
  app.click('jump-question',{index:'10'});
  assert.equal(app.speaking,false);
});

test('recording playback and download remain available after opening feedback for the same question', async () => {
  const app=boot({recording:true});app.click('question',{id:'speaking-1'});app.click('record-start');
  await new Promise(resolve=>setImmediate(resolve));app.click('record-stop');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(app.nodes.get('record-result').innerHTML,/<audio/);
  app.click('submit-answer');
  assert.match(app.nodes.get('record-result').innerHTML,/<audio/);
  assert.match(app.nodes.get('record-result').innerHTML,/download=/);
});
