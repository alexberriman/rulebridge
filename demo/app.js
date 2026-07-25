import { convert, evaluate, parse } from "https://esm.sh/rulebridge@0.1.1";

const FORMATS = [
  {
    id: "json-rules-engine",
    label: "json-rules-engine",
    kind: "json",
    example: `{
  "all": [
    { "fact": "name", "operator": "equal", "value": "Harry Potter" },
    { "fact": "age", "operator": "greaterThanInclusive", "value": 17 }
  ]
}`,
  },
  {
    id: "json-logic",
    label: "json-logic",
    kind: "json",
    example: `{
  "and": [
    { "===": [{ "var": "name" }, "Harry Potter"] },
    { ">=": [{ "var": "age" }, 17] }
  ]
}`,
  },
  {
    id: "json-logic-engine",
    label: "json-logic-engine",
    kind: "json",
    example: `{ ">=": [{ "var": "age" }, 17] }`,
  },
  {
    id: "filtrex",
    label: "filtrex",
    kind: "expr",
    example: `name == "Harry Potter" and age >= 17`,
  },
  {
    id: "jexl",
    label: "jexl",
    kind: "expr",
    example: `name == "Harry Potter" && age >= 17`,
  },
  {
    id: "expression-eval",
    label: "expression-eval",
    kind: "expr",
    example: `name === "Harry Potter" && age >= 17`,
  },
  {
    id: "expr-eval",
    label: "expr-eval",
    kind: "expr",
    example: `age >= 17 and name == "Harry Potter"`,
  },
  {
    id: "casbin",
    label: "casbin",
    kind: "expr",
    example: `r.sub == p.sub && r.obj == p.obj`,
  },
];

const JSON_OUT = new Set([
  "json-logic",
  "json-logic-engine",
  "json-rules-engine",
]);

// Ready-made rules that exercise a mix of formats and always evaluate cleanly.
const EXAMPLES = {
  age: {
    from: "json-rules-engine",
    input: `{
  "all": [
    { "fact": "name", "operator": "equal", "value": "Harry Potter" },
    { "fact": "age", "operator": "greaterThanInclusive", "value": 17 }
  ]
}`,
    facts: `{\n  "name": "Harry Potter",\n  "age": 17\n}`,
  },
  sub: {
    from: "json-logic",
    input: `{
  "and": [
    { "===": [{ "var": "plan" }, "pro"] },
    { ">=": [{ "var": "months" }, 12] }
  ]
}`,
    facts: `{\n  "plan": "pro",\n  "months": 12\n}`,
  },
  rbac: {
    from: "casbin",
    input: `r.sub == p.sub && r.obj == p.obj`,
    facts: `{\n  "r": { "sub": "alice", "obj": "data1" },\n  "p": { "sub": "alice", "obj": "data1" }\n}`,
  },
  member: {
    from: "filtrex",
    input: `status == "active" and age >= 18`,
    facts: `{\n  "status": "active",\n  "age": 20\n}`,
  },
};

const fromSel = document.getElementById("from");
const inputEl = document.getElementById("input");
const inputHl = document.getElementById("input-hl");
const factsEl = document.getElementById("facts");
const factsHl = document.getElementById("facts-hl");
const outputsEl = document.getElementById("outputs");
const evalBtn = document.getElementById("evaluate");
const evalOut = document.getElementById("eval-result");
const shareBtn = document.getElementById("share");

const find = (id) => FORMATS.find((f) => f.id === id);

function parseInput(format, text) {
  if (format.kind === "json") {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: `invalid JSON: ${e.message}` };
    }
  }
  return { ok: true, value: text };
}

function stringify(id, value) {
  return JSON_OUT.has(id) ? JSON.stringify(value, null, 2) : String(value);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Lightweight syntax highlighting for JSON values and expression strings.
function highlight(code) {
  const esc = escapeHtml(code);
  const re =
    /("(?:[^"\\]|\\.)*")(\s*:)?|('(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)|(\b(?:and|or|not|in)\b)|(===|!==|==|!=|>=|<=|&&|\|\||[-+*/%<>!])/g;
  return esc.replace(re, (m, str, colon, sstr, num, c, kw, op) => {
    if (str)
      return colon
        ? `<span class="k">${str}</span>${colon}`
        : `<span class="s">${str}</span>`;
    if (sstr) return `<span class="s">${sstr}</span>`;
    if (num) return `<span class="n">${num}</span>`;
    if (c) return `<span class="c">${c}</span>`;
    if (kw) return `<span class="op">${kw}</span>`;
    if (op) return `<span class="op">${op}</span>`;
    return m;
  });
}

// Mirror the textarea's content into the highlight layer and keep scroll in sync.
function syncHighlight() {
  inputHl.innerHTML = `${highlight(inputEl.value)}\n`;
  inputHl.scrollTop = inputEl.scrollTop;
  inputHl.scrollLeft = inputEl.scrollLeft;
}
function syncFactsHighlight() {
  factsHl.innerHTML = `${highlight(factsEl.value)}\n`;
  factsHl.scrollTop = factsEl.scrollTop;
  factsHl.scrollLeft = factsEl.scrollLeft;
}

function render() {
  outputsEl.innerHTML = "";
  const fromId = fromSel.value;
  const from = find(fromId);
  const parsed = parseInput(from, inputEl.value);

  if (!parsed.ok) {
    outputsEl.innerHTML = `<div class="out err"><div class="out-body">${escapeHtml(
      parsed.error,
    )}</div></div>`;
    return;
  }

  for (const target of FORMATS) {
    if (target.id === fromId) continue; // source is shown in the editor above
    const result = convert(fromId, target.id, parsed.value);
    const card = document.createElement("div");
    card.className = "out";
    if (!result.ok) card.classList.add("err");

    const bodyHtml = result.ok
      ? highlight(stringify(target.id, result.value))
      : escapeHtml(`${result.error.code}: ${result.error.message}`);

    card.innerHTML = `
      <div class="out-head">
        <span class="out-name">${target.label}</span>
        <span class="kind ${target.kind}">${target.kind}</span>
        ${
          result.ok
            ? '<button class="copy" type="button"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="8.5" height="8.5" rx="1.8" stroke="currentColor" stroke-width="1.3"/><path d="M3.2 10.3V4c0-1 .8-1.8 1.8-1.8h5.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg><span class="copy-t">copy</span></button>'
            : ""
        }
      </div>
      <div class="out-body">${bodyHtml}</div>`;

    const copyBtn = card.querySelector(".copy");
    if (copyBtn) {
      const label = copyBtn.querySelector(".copy-t");
      copyBtn.addEventListener("click", () => {
        navigator.clipboard?.writeText(stringify(target.id, result.value));
        copyBtn.classList.add("done");
        if (label) label.textContent = "copied";
        setTimeout(() => {
          copyBtn.classList.remove("done");
          if (label) label.textContent = "copy";
        }, 800);
      });
    }

    outputsEl.appendChild(card);
  }
}

function runEvaluate() {
  evalOut.textContent = "";
  evalOut.className = "eval-out";
  const from = find(fromSel.value);
  const parsed = parseInput(from, inputEl.value);
  if (!parsed.ok) return setBad(parsed.error);
  let facts;
  try {
    facts = JSON.parse(factsEl.value);
  } catch (e) {
    return setBad(`invalid facts: ${e.message}`);
  }
  const rule = parse(from.id, parsed.value);
  if (!rule.ok) return setBad(`${rule.error.code}: ${rule.error.message}`);
  evalOut.textContent = `=> ${JSON.stringify(evaluate(rule.value, facts))}`;
  evalOut.classList.add("ok");
}
function setBad(msg) {
  evalOut.textContent = msg;
  evalOut.classList.add("bad");
}

// --- shareable state in the URL hash ---------------------------------------
let syncing = false;
function syncHash() {
  if (syncing) return;
  try {
    const state = {
      from: fromSel.value,
      input: inputEl.value,
      facts: factsEl.value,
    };
    history.replaceState(
      null,
      "",
      `#${encodeURIComponent(JSON.stringify(state))}`,
    );
  } catch {
    /* ignore */
  }
}
function loadHash() {
  if (!location.hash || location.hash === "#") return false;
  try {
    const state = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    if (!state || typeof state !== "object") return false;
    syncing = true;
    if (state.from && find(state.from)) fromSel.value = state.from;
    if (typeof state.input === "string") inputEl.value = state.input;
    if (typeof state.facts === "string") factsEl.value = state.facts;
    syncing = false;
    return true;
  } catch {
    return false;
  }
}

// --- wiring -----------------------------------------------------------------
for (const f of FORMATS) {
  const opt = document.createElement("option");
  opt.value = f.id;
  opt.textContent = f.label;
  fromSel.appendChild(opt);
}

const hasState = loadHash();
if (!hasState) {
  fromSel.value = "json-rules-engine";
  inputEl.value = find("json-rules-engine").example;
  factsEl.value = `{\n  "name": "Harry Potter",\n  "age": 17\n}`;
  document.querySelector('.preset[data-ex="age"]')?.classList.add("active");
}

fromSel.addEventListener("change", () => {
  inputEl.value = find(fromSel.value).example;
  syncHighlight();
  render();
  syncHash();
});

inputEl.addEventListener("input", () => {
  syncHighlight();
  render();
  syncHash();
});
inputEl.addEventListener("scroll", syncHighlight, { passive: true });
factsEl.addEventListener("input", () => {
  syncFactsHighlight();
  syncHash();
});
factsEl.addEventListener("scroll", syncFactsHighlight, { passive: true });
// Tab inserts two spaces instead of leaving the field.
inputEl.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  e.preventDefault();
  const s = inputEl.selectionStart;
  const en = inputEl.selectionEnd;
  inputEl.value = `${inputEl.value.slice(0, s)}  ${inputEl.value.slice(en)}`;
  inputEl.selectionStart = inputEl.selectionEnd = s + 2;
  syncHighlight();
  render();
  syncHash();
});

evalBtn.addEventListener("click", runEvaluate);
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    runEvaluate();
  }
});

shareBtn?.addEventListener("click", async () => {
  syncHash();
  try {
    await navigator.clipboard?.writeText(location.href);
    shareBtn.textContent = "copied";
    setTimeout(() => (shareBtn.textContent = "copy link"), 1200);
  } catch {
    /* clipboard unavailable */
  }
});

for (const btn of document.querySelectorAll(".preset")) {
  btn.addEventListener("click", () => {
    const ex = EXAMPLES[btn.dataset.ex];
    if (!ex) return;
    document.querySelectorAll(".preset").forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    syncing = true;
    fromSel.value = ex.from;
    inputEl.value = ex.input;
    factsEl.value = ex.facts;
    syncing = false;
    syncHighlight();
    syncFactsHighlight();
    render();
    runEvaluate();
    syncHash();
  });
}

syncHighlight();
syncFactsHighlight();
render();
syncHash();
