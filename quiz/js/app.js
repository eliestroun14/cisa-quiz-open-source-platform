"use strict";
let QUESTIONS = [], BY_UID = new Map(), LOAD_ERRORS = [];
const LETTERS = "ABCDEFGH";
const MAIN_SECTION_MIN = 5;
const STORE = { stats: "cisa.stats.v1", session: "cisa.session.v1", prefs: "cisa.prefs.v1", theme: "cisa.theme", imports: "cisa.imports.v1", lang: "cisa.lang" };

// ---------- Storage (failure tolerant) ----------
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, value) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
let stats = load(STORE.stats, {});      // uid -> {s: times seen, c: times correct, last: bool}
let session = load(STORE.session, null);

// ---------- Translations (strings live in js/i18n.js) ----------
const LANGS = window.I18N || { en: {} };
let lang = LANGS[load(STORE.lang, "en")] ? load(STORE.lang, "en") : "en";
function t(key, params = {}) {
  const s = (LANGS[lang] && LANGS[lang][key]) ?? LANGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (m, k) => k in params ? params[k] : m);
}
const fmtPct = p => t("pct", { p });

// ---------- Helpers ----------
const $app = document.getElementById("app");
const $timer = document.getElementById("timer");
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(c));
  return n;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const isPinned = text => /^(none|all) of the|^both$|^neither/i.test(text.trim());
function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}
let SOURCES = [], MAIN_SECTIONS = [];
const sectionOf = q => MAIN_SECTIONS.includes(q.section) ? q.section : "";
const sectionLabel = s => s || t("section.none");

// ---------- Loading question banks ----------
// 1. data/index.json: banks published with the app
// 2. data/index.local.json (optional, ignored by git): personal banks served locally
// 3. banks imported in the browser (localStorage)
function validQuestion(q, seenIds) {
  if (!q || typeof q.id !== "string" || !q.id) return "missingId";
  if (seenIds.has(q.id)) return "duplicateId";
  if (typeof q.question !== "string" || !q.question.trim()) return "missingText";
  const keys = q.options && typeof q.options === "object" ? Object.keys(q.options) : [];
  if (keys.length < 2 || keys.some((k, i) => k !== LETTERS[i] || typeof q.options[k] !== "string")) return "badOptions";
  if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some(a => !keys.includes(a))) return "badAnswer";
  return null;
}
// Errors are stored untranslated so they follow language changes
function addBank(data, file, seenIds) {
  const list = Array.isArray(data) ? data : data && Array.isArray(data.questions) ? data.questions : null;
  if (!list) { LOAD_ERRORS.push({ key: "err.noList", params: { file } }); return; }
  list.forEach((q, n) => {
    const problem = validQuestion(q, seenIds);
    if (problem) {
      LOAD_ERRORS.push({ key: "err.question", problem, params: { file, n: n + 1, id: q && q.id ? ` (${q.id})` : "" } });
      return;
    }
    seenIds.add(q.id);
    QUESTIONS.push({ ...q, uid: q.id, source: q.source || data.title || file, section: q.section || "", explanation: q.explanation || "" });
  });
}
const errorText = e => t(e.key, { ...e.params, problem: e.problem ? t("problem." + e.problem) : "" });
async function fetchJson(path, optional) {
  const r = await fetch(path, { cache: "no-store" });
  if (r.ok) return r.json();
  if (optional && r.status === 404) return null;
  throw new Error(`${path}: HTTP ${r.status}`);
}
async function loadBank() {
  QUESTIONS = []; LOAD_ERRORS = [];
  const seenIds = new Set();
  const index = await fetchJson("data/index.json");
  const local = await fetchJson("data/index.local.json", true).catch(() => null);
  for (const file of [...(index.files || []), ...((local && local.files) || [])]) {
    let data;
    try { data = await fetchJson("data/" + file); }
    catch (err) { LOAD_ERRORS.push({ key: "err.unreadable", params: { file, detail: err.message } }); continue; }
    addBank(data, file, seenIds);
  }
  for (const [name, data] of Object.entries(load(STORE.imports, {}))) addBank(data, name, seenIds);
  BY_UID = new Map(QUESTIONS.map(q => [q.uid, q]));
  SOURCES = [...new Set(QUESTIONS.map(q => q.source))];
  const counts = QUESTIONS.reduce((m, q) => (m[q.section] = (m[q.section] || 0) + 1, m), {});
  MAIN_SECTIONS = Object.keys(counts).filter(s => s && counts[s] >= MAIN_SECTION_MIN).sort();
  // A saved session whose questions are no longer in the bank cannot be resumed
  if (session && session.items.some(it => !BY_UID.has(it.uid))) { session = null; save(STORE.session, null); }
}

// ---------- Header: theme, language ----------
let rerender = () => renderHome();   // redraws the current screen (used after a language change)
function applyTheme(th) { th ? document.documentElement.setAttribute("data-theme", th) : document.documentElement.removeAttribute("data-theme"); }
applyTheme(load(STORE.theme, null));
document.getElementById("theme-btn").onclick = () => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const cur = document.documentElement.getAttribute("data-theme") || (dark ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  applyTheme(next); save(STORE.theme, next);
};
document.getElementById("home-link").onclick = () => renderHome();
const $lang = document.getElementById("lang");
$lang.replaceChildren(...Object.keys(LANGS).map(code => el("option", { value: code, selected: code === lang }, LANGS[code]["lang.name"] || code)));
$lang.onchange = () => { lang = $lang.value; save(STORE.lang, lang); applyChrome(); rerender(); };
function applyChrome() {
  document.documentElement.lang = lang;
  document.getElementById("home-link").textContent = t("app.title");
  document.getElementById("home-link").title = t("app.home");
  document.getElementById("theme-btn").title = t("app.theme");
  document.getElementById("footer").textContent = t("footer");
}
applyChrome();

// ---------- Home ----------
function renderHome() {
  rerender = renderHome;
  stopTimer();
  const saved = load(STORE.prefs, {});
  // Sources / domains that appeared since the last visit are selected by default
  const keep = (all, chosen, known) => all.filter(x => !(known || []).includes(x) || (chosen || []).includes(x));
  const prefs = Object.assign({ count: 25, mode: "train", pick: "random", shuffleOpts: false, timed: false }, saved, {
    sources: keep(SOURCES, saved.sources, saved.knownSources),
    sections: keep([...MAIN_SECTIONS, ""], saved.sections, saved.knownSections),
  });
  const seen = Object.keys(stats).filter(k => BY_UID.has(k));
  const mastered = seen.filter(k => stats[k].last).length;
  const totalAns = seen.reduce((n, k) => n + stats[k].s, 0), totalOk = seen.reduce((n, k) => n + stats[k].c, 0);
  const errors = seen.filter(k => !stats[k].last).length;

  const countSel = el("select", { id: "count" },
    [10, 25, 50, 100, 150].map(n => el("option", { value: n, selected: n === prefs.count }, t("count.n", { n }))),
    el("option", { value: 0, selected: prefs.count === 0 }, t("count.all")));
  const modeSel = el("select", { id: "mode" },
    ["train", "exam"].map(m => el("option", { value: m, selected: prefs.mode === m }, t("mode." + m))));
  const pickSel = el("select", { id: "pick" },
    ["random", "unseen", "errors", "weak"].map(p => el("option", { value: p, selected: prefs.pick === p }, t("pick." + p))));
  const chk = (id, on, label) => el("label", { class: "chip" }, el("input", { type: "checkbox", id, checked: on }), label);
  const srcChips = SOURCES.map(s => el("label", { class: "chip" },
    el("input", { type: "checkbox", name: "src", value: s, checked: prefs.sources.includes(s) }), s));
  const secChips = [...MAIN_SECTIONS, ""].map(s => el("label", { class: "chip" },
    el("input", { type: "checkbox", name: "sec", value: s, checked: prefs.sections.includes(s) }),
    sectionLabel(s) + " (" + QUESTIONS.filter(q => sectionOf(q) === s).length + ")"));
  const poolInfo = el("p", { class: "muted" });
  const toggleAll = name => el("button", { class: "small", onclick: () => {
    const boxes = [...$app.querySelectorAll(`input[name=${name}]`)];
    const all = boxes.every(b => b.checked);
    boxes.forEach(b => b.checked = !all); updatePool();
  } }, t("filters.toggle"));

  const resumeCard = session && !session.finished ? el("div", { class: "card" },
    el("div", { class: "row spread" },
      el("div", {}, el("b", {}, t("resume.title")), " — ",
        el("span", { class: "muted" }, t("resume.info", { answered: Object.keys(session.answers).length, total: session.items.length, mode: t(`mode.${session.mode}.short`) }))),
      el("div", { class: "row" },
        el("button", { class: "danger small", onclick: () => { session = null; save(STORE.session, null); renderHome(); } }, t("resume.discard")),
        el("button", { class: "primary", onclick: () => { startTimer(); renderQuestion(); } }, t("resume.resume"))))) : null;

  const errorsCard = LOAD_ERRORS.length ? el("div", { class: "card feedback ko" },
    el("b", {}, t("load.errors", { n: LOAD_ERRORS.length })),
    el("ul", { style: "margin:8px 0 0;font-size:14px" }, LOAD_ERRORS.slice(0, 20).map(e => el("li", {}, errorText(e))))) : null;

  $app.replaceChildren(
    errorsCard || "",
    resumeCard || "",
    el("div", { class: "card" },
      el("h2", {}, t("new.title")),
      el("div", { class: "row" },
        el("div", {}, el("label", { class: "field", for: "count" }, t("count.label")), countSel),
        el("div", {}, el("label", { class: "field", for: "mode" }, t("mode.label")), modeSel),
        el("div", {}, el("label", { class: "field", for: "pick" }, t("pick.label")), pickSel)),
      el("div", { class: "chips", style: "margin-top:14px" },
        chk("shuffleOpts", prefs.shuffleOpts, t("opt.shuffle")),
        chk("timed", prefs.timed, t("opt.timed"))),
      el("h3", { class: "row spread" }, t("filters.sources"), toggleAll("src")),
      el("div", { class: "chips" }, srcChips),
      el("h3", { class: "row spread" }, t("filters.sections"), toggleAll("sec")),
      el("div", { class: "chips" }, secChips),
      poolInfo,
      el("button", { class: "primary", id: "start", onclick: startSession }, t("start"))),
    el("div", { class: "card" },
      el("div", { class: "row spread" }, el("h2", {}, t("progress.title")),
        el("button", { class: "small danger", onclick: () => {
          if (confirm(t("progress.resetConfirm"))) { stats = {}; save(STORE.stats, stats); renderHome(); }
        } }, t("progress.reset"))),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", {}, QUESTIONS.length), el("span", {}, t("stat.bank"))),
        el("div", { class: "stat" }, el("b", {}, seen.length), el("span", {}, t("stat.seen", { p: fmtPct(pct(seen.length, QUESTIONS.length)) }))),
        el("div", { class: "stat" }, el("b", {}, mastered), el("span", {}, t("stat.mastered"))),
        el("div", { class: "stat" }, el("b", {}, errors), el("span", {}, t("stat.review"))),
        el("div", { class: "stat" }, el("b", {}, fmtPct(pct(totalOk, totalAns))), el("span", {}, t("stat.rate", { n: totalAns })))),
      sectionTable()),
    importCard());

  $app.querySelectorAll("input, select").forEach(i => i.addEventListener("change", updatePool));
  updatePool();

  function readPrefs() {
    return {
      count: +countSel.value, mode: modeSel.value, pick: pickSel.value,
      shuffleOpts: $app.querySelector("#shuffleOpts").checked, timed: $app.querySelector("#timed").checked,
      sources: [...$app.querySelectorAll("input[name=src]:checked")].map(i => i.value),
      sections: [...$app.querySelectorAll("input[name=sec]:checked")].map(i => i.value),
    };
  }
  function updatePool() {
    const p = readPrefs(), pool = buildPool(p);
    const n = p.count ? Math.min(p.count, pool.length) : pool.length;
    poolInfo.textContent = t("pool.info", { pool: pool.length, n });
    $app.querySelector("#start").disabled = n === 0;
    save(STORE.prefs, { ...p, knownSources: SOURCES, knownSections: [...MAIN_SECTIONS, ""] });
  }
  function startSession() {
    const p = readPrefs();
    let pool = buildPool(p);
    if (p.pick === "unseen" || p.pick === "weak") {
      // Unseen first, then mistakes; order stays random within each group
      const rank = q => !stats[q.uid] ? 0 : stats[q.uid].last ? 2 : 1;
      pool = shuffle(pool).sort((a, b) => rank(a) - rank(b));
    } else pool = shuffle(pool);
    const picked = p.count ? pool.slice(0, p.count) : pool;
    newSession(shuffle(picked).map(q => q.uid), p);
  }
}

// Imported personal banks: they stay in this browser and are never sent anywhere
function importCard() {
  const imports = load(STORE.imports, {});
  const input = el("input", { type: "file", accept: ".json,application/json", class: "hidden", onchange: async e => {
    const file = e.target.files[0];
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (err) { alert(t("import.badJson", { name: file.name, detail: err.message })); return; }
    if (!Array.isArray(data) && !(data && Array.isArray(data.questions))) { alert(t("import.noList", { name: file.name })); return; }
    try { localStorage.setItem(STORE.imports, JSON.stringify({ ...imports, [file.name]: data })); }
    catch { alert(t("import.storage")); return; }
    await loadBank(); renderHome();
  } });
  const remove = name => {
    if (!confirm(t("import.removeConfirm", { name }))) return;
    const rest = { ...imports }; delete rest[name];
    save(STORE.imports, rest);
    loadBank().then(renderHome);
  };
  const names = Object.keys(imports);
  return el("div", { class: "card" },
    el("div", { class: "row spread" }, el("h2", { style: "margin:0" }, t("import.title")),
      el("button", { class: "small", onclick: () => input.click() }, t("import.button")), input),
    el("p", { class: "muted", style: "font-size:14px" }, t("import.help")),
    names.length ? el("ul", { style: "margin:0;padding-left:20px" }, names.map(n => {
      const d = imports[n], count = (Array.isArray(d) ? d : d.questions).length;
      return el("li", {}, t("import.count", { name: n, n: count }) + " ", el("button", { class: "small danger", onclick: () => remove(n) }, t("import.remove")));
    })) : null);
}

function buildPool(p) {
  return QUESTIONS.filter(q => p.sources.includes(q.source) && p.sections.includes(sectionOf(q)) && (
    p.pick === "errors" ? stats[q.uid] && !stats[q.uid].last :
    p.pick === "weak" ? !stats[q.uid] || !stats[q.uid].last : true));
}

function sectionTable() {
  const rows = [...MAIN_SECTIONS, ""].map(s => {
    const qs = QUESTIONS.filter(q => sectionOf(q) === s);
    const seenQs = qs.filter(q => stats[q.uid]);
    return el("tr", {}, el("td", {}, sectionLabel(s)), el("td", { class: "num" }, `${seenQs.length}/${qs.length}`),
      el("td", { class: "num" }, seenQs.length ? fmtPct(pct(seenQs.filter(q => stats[q.uid].last).length, seenQs.length)) : "—"));
  });
  return el("table", { style: "margin-top:16px" },
    el("thead", {}, el("tr", {}, el("th", {}, t("table.domain")), el("th", { class: "num" }, t("table.seen")), el("th", { class: "num" }, t("table.success")))),
    el("tbody", {}, rows));
}

// ---------- Session ----------
function newSession(uids, p) {
  session = {
    mode: p.mode, shuffleOpts: p.shuffleOpts, current: 0, answers: {}, validated: {}, flagged: {}, finished: false,
    timeLimit: p.timed ? Math.round(uids.length * 96) : 0, elapsed: 0,
    items: uids.map(uid => {
      const keys = Object.keys(BY_UID.get(uid).options);
      if (!p.shuffleOpts) return { uid, order: keys };
      // "None of the choices", "All of the above"… stay last
      const q = BY_UID.get(uid);
      const pinned = keys.filter(k => isPinned(q.options[k]));
      return { uid, order: [...shuffle(keys.filter(k => !pinned.includes(k))), ...pinned] };
    }),
  };
  persist(); startTimer(); renderQuestion();
}
const persist = () => save(STORE.session, session);
const itemQ = i => BY_UID.get(session.items[i].uid);
const isCorrect = i => sameSet(session.answers[i] || [], itemQ(i).answer);
const isLocked = i => session.finished || (session.mode === "train" && session.validated[i]);

function recordStat(i) {
  const q = itemQ(i), ok = isCorrect(i), s = stats[q.uid] || { s: 0, c: 0 };
  stats[q.uid] = { s: s.s + 1, c: s.c + (ok ? 1 : 0), last: ok };
  save(STORE.stats, stats);
}

// ---------- Timer ----------
let timerId = null;
function startTimer() {
  stopTimer();
  if (!session || session.finished) return;
  const tick = () => {
    if (session.timeLimit) {
      const left = session.timeLimit - session.elapsed;
      $timer.textContent = "⏱ " + fmtTime(Math.max(0, left));
      $timer.classList.toggle("low", left < 300);
      if (left <= 0) { finishSession(); return; }
    } else $timer.textContent = "⏱ " + fmtTime(session.elapsed);
  };
  $timer.classList.remove("hidden");
  tick();
  timerId = setInterval(() => { session.elapsed++; if (session.elapsed % 5 === 0) persist(); tick(); }, 1000);
}
function stopTimer() { clearInterval(timerId); timerId = null; $timer.classList.add("hidden"); }

// ---------- Question screen ----------
function renderQuestion() {
  rerender = renderQuestion;
  const i = session.current, item = session.items[i], q = itemQ(i);
  const chosen = session.answers[i] || [], locked = isLocked(i);
  const showResult = locked;
  const multi = q.answer.length > 1;
  const answeredCount = Object.keys(session.answers).length;

  const opts = item.order.map((key, idx) => {
    const isSel = chosen.includes(key), isAns = q.answer.includes(key);
    let cls = "opt";
    if (showResult) cls += isAns ? " correct" : isSel ? " wrong" : "";
    else if (isSel) cls += " selected";
    return el("button", { class: cls, disabled: locked, "data-key": key, onclick: () => toggle(key) },
      el("span", { class: "letter" }, LETTERS[idx]), el("span", {}, q.options[key]),
      session.shuffleOpts && showResult ? el("span", { class: "orig" }, t("q.orig", { k: key })) : null);
  });

  let feedback = null;
  if (showResult) {
    const ok = isCorrect(i), answered = chosen.length > 0;
    const goodLetters = item.order.map((k, idx) => q.answer.includes(k) ? LETTERS[idx] : null).filter(Boolean).join(", ");
    feedback = el("div", { class: "feedback " + (!answered ? "neutral" : ok ? "ok" : "ko") },
      el("b", {}, !answered ? t("fb.none") : ok ? t("fb.ok") : t("fb.ko")),
      t("fb.expected", { letters: goodLetters }),
      q.explanation ? el("p", { style: "margin:8px 0 0" }, q.explanation) : null,
      session.shuffleOpts && /\b(choice|option)s?\s+[A-H]\b/i.test(q.explanation)
        ? el("p", { class: "muted", style: "margin:6px 0 0;font-size:13px" }, t("fb.origNote")) : null);
  }

  const isLast = i === session.items.length - 1;
  const canValidate = session.mode === "train" && !locked && chosen.length > 0;
  const actions = el("div", { class: "row spread", style: "margin-top:18px" },
    el("div", { class: "row" },
      el("button", { disabled: i === 0, onclick: () => go(i - 1) }, t("btn.prev")),
      session.finished ? null : el("button", { onclick: toggleFlag }, session.flagged[i] ? t("btn.flagged") : t("btn.flag"))),
    el("div", { class: "row" },
      session.finished ? el("button", { onclick: renderResults }, t("btn.results")) :
        el("button", { onclick: confirmFinish }, t("btn.finish")),
      canValidate ? el("button", { class: "primary", onclick: validate }, t("btn.check")) :
        !isLast ? el("button", { class: locked || session.mode === "exam" ? "primary" : "", onclick: () => go(i + 1) }, t("btn.next")) :
        !session.finished ? el("button", { class: "primary", onclick: confirmFinish }, t("btn.seeResults")) : null));

  const nav = el("div", { class: "nav" }, session.items.map((_, j) => {
    let cls = j === i ? "cur" : "";
    if (session.answers[j]) cls += " answered";
    if (isLocked(j) && session.answers[j]) cls += isCorrect(j) ? " r-ok" : " r-ko";
    if (session.flagged[j]) cls += " flag";
    return el("button", { class: cls, onclick: () => go(j), title: t("nav.question", { n: j + 1 }) }, j + 1);
  }));

  $app.replaceChildren(el("div", { class: "card" },
    el("div", { class: "qmeta" },
      el("b", {}, t("q.counter", { i: i + 1, n: session.items.length })),
      el("span", {}, q.source + (q.number ? t("q.number", { n: q.number }) : "")),
      q.section ? el("span", {}, q.section) : null,
      el("span", {}, stats[q.uid] ? t("q.seen", { n: stats[q.uid].s, last: t(stats[q.uid].last ? "q.lastOk" : "q.lastKo") }) : t("q.unseen"))),
    el("div", { class: "progress" }, el("div", { style: `width:${pct(answeredCount, session.items.length)}%` })),
    multi ? el("div", { class: "hint" }, t("q.multi", { n: q.answer.length })) : null,
    el("div", { class: "qtext" }, q.question),
    el("div", { class: "opts" }, opts),
    feedback, actions),
    el("div", { class: "card" },
      el("div", { class: "row spread" }, el("b", {}, t("nav.title")),
        el("span", { class: "muted", style: "font-size:13px" }, t("nav.info", { answered: answeredCount, flagged: Object.values(session.flagged).filter(Boolean).length }))),
      nav,
      el("div", { class: "kbd" }, t("kbd"))));

  function toggle(key) {
    if (isLocked(i)) return;
    let cur = session.answers[i] || [];
    cur = multi ? (cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]) : [key];
    if (cur.length) session.answers[i] = cur; else delete session.answers[i];
    persist(); renderQuestion();
  }
  function toggleFlag() { session.flagged[i] = !session.flagged[i]; persist(); renderQuestion(); }
}

function go(j) {
  if (j < 0 || j >= session.items.length) return;
  session.current = j; persist(); renderQuestion(); window.scrollTo(0, 0);
}
function validate() {
  const i = session.current;
  if (session.mode !== "train" || isLocked(i) || !session.answers[i]) return;
  session.validated[i] = true; recordStat(i); persist(); renderQuestion();
}
function confirmFinish() {
  const unanswered = session.items.length - Object.keys(session.answers).length;
  if (confirm(unanswered ? t("finish.unanswered", { n: unanswered }) : t("finish.confirm"))) finishSession();
}
function finishSession() {
  session.items.forEach((_, i) => {
    // In practice mode, checked questions were already counted; count the other answers given
    if (session.answers[i] && !(session.mode === "train" && session.validated[i])) recordStat(i);
  });
  session.finished = true; persist(); stopTimer(); renderResults();
}

// ---------- Results ----------
function renderResults() {
  rerender = renderResults;
  const n = session.items.length;
  const okIdx = session.items.map((_, i) => i).filter(isCorrect);
  const koIdx = session.items.map((_, i) => i).filter(i => !isCorrect(i));
  const score = pct(okIdx.length, n);
  const bySec = {};
  session.items.forEach((_, i) => {
    const s = sectionLabel(sectionOf(itemQ(i)));
    bySec[s] = bySec[s] || { n: 0, ok: 0 }; bySec[s].n++; if (isCorrect(i)) bySec[s].ok++;
  });
  let onlyErrors = false;
  const list = el("div");
  const drawList = () => list.replaceChildren(...session.items.map((item, i) => {
    if (onlyErrors && isCorrect(i)) return null;
    const q = itemQ(i), chosen = session.answers[i] || [];
    const tag = !chosen.length ? el("span", { class: "tag skip" }, t("tag.skip")) :
      isCorrect(i) ? el("span", { class: "tag ok" }, t("tag.ok")) : el("span", { class: "tag ko" }, t("tag.ko"));
    return el("div", { class: "review-item" },
      el("div", { class: "row spread" }, el("b", {}, t("nav.question", { n: i + 1 })), tag),
      el("div", { class: "qtext" }, q.question),
      el("div", { class: "opts" }, item.order.map((key, idx) => {
        const cls = "opt" + (q.answer.includes(key) ? " correct" : chosen.includes(key) ? " wrong" : "");
        return el("div", { class: cls }, el("span", { class: "letter" }, LETTERS[idx]), el("span", {}, q.options[key]));
      })),
      q.explanation ? el("p", { class: "muted", style: "margin:10px 0 0" }, q.explanation) : null);
  }).filter(Boolean));
  drawList();

  $app.replaceChildren(
    el("div", { class: "card" },
      el("h2", {}, t("res.title")),
      el("div", { class: "row", style: "gap:24px" },
        el("div", { class: "score", style: `color:var(${score >= 65 ? "--ok" : "--ko"})` }, fmtPct(score)),
        el("div", {},
          el("div", {}, t("res.correct", { ok: okIdx.length, n })),
          el("div", { class: "muted" }, t("res.time", { time: fmtTime(session.elapsed), position: t(score >= 65 ? "res.above" : "res.below") })))),
      el("table", { style: "margin-top:16px" },
        el("thead", {}, el("tr", {}, el("th", {}, t("table.domain")), el("th", { class: "num" }, t("table.score")))),
        el("tbody", {}, Object.entries(bySec).map(([s, v]) =>
          el("tr", {}, el("td", {}, s), el("td", { class: "num" }, `${v.ok}/${v.n} (${fmtPct(pct(v.ok, v.n))})`))))),
      el("div", { class: "row", style: "margin-top:18px" },
        el("button", { class: "primary", disabled: !koIdx.length, onclick: () =>
          newSession(shuffle(koIdx.map(i => session.items[i].uid)), { mode: session.mode, shuffleOpts: session.shuffleOpts, timed: false }) },
          t("res.retry", { n: koIdx.length })),
        el("button", { onclick: () => go(0) }, t("res.browse")),
        el("button", { onclick: renderHome }, t("res.home")))),
    el("div", { class: "card" },
      el("div", { class: "row spread" }, el("h2", { style: "margin:0" }, t("res.review")),
        el("label", { class: "chip" }, el("input", { type: "checkbox", onchange: e => { onlyErrors = e.target.checked; drawList(); } }), t("res.onlyErrors"))),
      list));
  window.scrollTo(0, 0);
}

// ---------- Keyboard ----------
document.addEventListener("keydown", e => {
  if (!session || e.ctrlKey || e.metaKey || e.altKey || !$app.querySelector(".opts .opt[data-key]")) return;
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  const i = session.current, k = e.key.toUpperCase();
  let idx = LETTERS.indexOf(k);
  if (/^[1-8]$/.test(e.key)) idx = +e.key - 1;
  if (idx >= 0 && k.length === 1) {
    const btn = $app.querySelectorAll(".opts .opt")[idx];
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (session.mode === "train" && !isLocked(i) && session.answers[i]) validate();
    else if (i < session.items.length - 1) go(i + 1);
  } else if (e.key === "ArrowRight") go(i + 1);
  else if (e.key === "ArrowLeft") go(i - 1);
  else if (k === "M" && !session.finished) { session.flagged[i] = !session.flagged[i]; persist(); renderQuestion(); }
});

loadBank().then(renderHome).catch(err => {
  rerender = () => {};
  $app.replaceChildren(el("div", { class: "card" }, el("h2", {}, t("load.failTitle")),
    el("p", {}, err.message),
    location.protocol === "file:" ? el("p", {}, t("load.fileHint")) : null));
});
