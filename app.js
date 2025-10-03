const CATEGORIES = ["Schüsse","Tore","Assist","Plus/Minus","FaceOffs","FaceOffs Won","Penaltys"];

const MASTER_PLAYERS = [
  { num: "2", name: "David Lienert" },
  { num: "4", name: "Ondrej Kastner" },
  { num: "5", name: "Raphael Oehninger" },
  { num: "6", name: "Nuno Meier" },
  { num: "7", name: "Silas Teuber" },
  { num: "8", name: "Diego Warth" },
  { num: "9", name: "Mattia Crameri" },
  { num: "10", name: "Mael Bernath" },
  { num: "11", name: "Sean Nef" },
  { num: "12", name: "Rafael Burri" },
  { num: "13", name: "Lenny Schwarz" },
  { num: "14", name: "Levi Baumann" },
  { num: "15", name: "Neven Severini" },
  { num: "16", name: "Nils Koubek" },
  { num: "17", name: "Lionel Kundert" },
  { num: "18", name: "Livio Berner" },
  { num: "19", name: "Robin Strasser" },
  { num: "21", name: "Marlon Kreyenbühl" },
  { num: "22", name: "Martin Lana" },
  { num: "23", name: "Manuel Isler" },
  { num: "24", name: "Moris Hürlimann" },
  { num: "", name: "Marco Senn" },
  { num: "", name: "Lenny Zimmermann" },
  { num: "", name: "Luke Böhmichen" },
  { num: "", name: "Corsin Blapp" },
  { num: "", name: "Livio Weissen" },
  { num: "", name: "Raul Wütrich" }
];

// LocalStorage keys
const KEY_STORE = "ts_players_v4";    // playersStore object
const KEY_SELECTED = "ts_selected_v4"; // selected keys array
const KEY_OPP = "ts_opp_v4";          // opponent shots

/* Helper: player key */
function playerKey(num, name){ return `${num}|${name}`; }

/* Load / Save all persisted data */
function loadAll(){
  const rawStore = localStorage.getItem(KEY_STORE);
  const rawSel = localStorage.getItem(KEY_SELECTED);
  const rawOpp = localStorage.getItem(KEY_OPP);
  return {
    playersStore: rawStore ? JSON.parse(rawStore) : {},
    selectedKeys: rawSel ? JSON.parse(rawSel) : null,
    oppShots: rawOpp ? Number(rawOpp) : 0
  };
}
function saveAll(playersStore, selectedKeys, oppShots){
  localStorage.setItem(KEY_STORE, JSON.stringify(playersStore));
  localStorage.setItem(KEY_SELECTED, JSON.stringify(selectedKeys));
  localStorage.setItem(KEY_OPP, String(oppShots));
}

/* DOM refs (set in init) */
let selectionScreen, selectList, confirmBtn;
let mainScreen, theadRow, tbody, totalsRow;
let reselectBtn, timerBtn, resetBtn, importBtn, exportBtn, fileInput;

let playersStore = {}; // key -> { num, name, stats: {cat: val} }
let selectedKeys = null;
let opponentShots = 0;

/* timer state */
let timerInterval = null;
let timerSeconds = 0;
let timerPressTimeout = null;
let timerLongPressed = false;

/* general */
let clickWindowMs = 300; // double-tap window

/* Utility: sort MASTER_PLAYERS numeric asc, empty numbers last */
function sortedMaster(){
  return MASTER_PLAYERS.slice().sort((a,b)=>{
    const na = a.num === "" ? Infinity : Number(a.num);
    const nb = b.num === "" ? Infinity : Number(b.num);
    if(na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  });
}

/* Render selection checkbox list */
function renderSelection(){
  // ensure element exists
  if(!selectList) return;
  selectList.innerHTML = "";
  const list = sortedMaster();
  list.forEach(p=>{
    const key = playerKey(p.num, p.name);
    const row = document.createElement("div");
    row.className = "selectRow";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.key = key;
    cb.id = "cb_" + btoa(key).replace(/=/g,"");
    if(Array.isArray(selectedKeys) && selectedKeys.includes(key)) cb.checked = true;
    const label = document.createElement("label");
    label.htmlFor = cb.id;
    label.textContent = (p.num ? p.num + " " : "") + p.name;
    row.appendChild(cb); row.appendChild(label);
    selectList.appendChild(row);
  });
}

/* Confirm selection: preserve existing stats, add missing players */
function confirmSelection(){
  const checkedElems = Array.from(selectList.querySelectorAll("input[type=checkbox]:checked"));
  const keys = checkedElems.map(el => el.dataset.key);
  if(keys.length === 0){
    alert("Bitte mindestens einen Spieler auswählen.");
    return;
  }

  // sort keys numeric asc, empty last
  keys.sort((ka,kb)=>{
    const [na,naName] = ka.split("|");
    const [nb,nbName] = kb.split("|");
    const nna = na === "" ? Infinity : Number(na);
    const nnb = nb === "" ? Infinity : Number(nb);
    if(nna !== nnb) return nna - nnb;
    return naName.localeCompare(nbName);
  });

  // ensure playersStore entries exist, preserve stats if present
  keys.forEach(k=>{
    if(!playersStore[k]){
      const [num,name] = k.split("|");
      const obj = { num, name, stats:{} };
      CATEGORIES.forEach(c => obj.stats[c] = 0);
      playersStore[k] = obj;
    }
  });

  selectedKeys = keys;
  saveAll(playersStore, selectedKeys, opponentShots);

  showMain();
  renderTable();
}

/* Render table header + body */
function renderTable(){
  // header
  theadRow.innerHTML = "<th>Nr</th><th>Name</th>";
  CATEGORIES.forEach(c=>{
    const th = document.createElement("th");
    th.textContent = c;
    theadRow.appendChild(th);
  });

  // body
  tbody.innerHTML = "";

  if(!Array.isArray(selectedKeys) || selectedKeys.length === 0){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 2 + CATEGORIES.length;
    td.textContent = "Keine Spieler ausgewählt.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    updateTotals();
    return;
  }

  selectedKeys.forEach((k, idx) => {
    const p = playersStore[k];
    if(!p) return;
    const tr = document.createElement("tr");
    const tdNum = document.createElement("td"); tdNum.textContent = p.num || "";
    const tdName = document.createElement("td"); tdName.textContent = p.name; tdName.className = "nameCell";
    tr.appendChild(tdNum); tr.appendChild(tdName);

    CATEGORIES.forEach(cat => {
      const td = document.createElement("td");
      td.className = "statCell";
      td.dataset.key = k;
      td.dataset.cat = cat;

      const span = document.createElement("span");
      span.className = "cellInner";
      const val = Number(p.stats[cat] || 0);
      span.textContent = val;
      if(val > 0) span.classList.add("positive");
      if(val < 0) span.classList.add("negative");
      td.appendChild(span);

      // hover visual
      td.addEventListener("pointerenter", ()=> span.classList.add("hovered"));
      td.addEventListener("pointerleave", ()=> span.classList.remove("hovered"));

      // click/double (pointerup) logic — closure to capture k,cat,span
      (function(localKey, localCat, localSpan){
        let clickTimer = null;
        td.addEventListener("pointerup", (ev) => {
          ev.preventDefault();
          // if there is no timer, set it — single click will occur after window
          if(clickTimer === null){
            clickTimer = setTimeout(()=>{
              // single tap -> +1
              changeStat(localKey, localCat, 1);
              clickTimer = null;
            }, clickWindowMs);
          } else {
            // second tap within window -> -1
            clearTimeout(clickTimer);
            clickTimer = null;
            changeStat(localKey, localCat, -1);
          }
        });
      })(k, cat, span);

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  updateTotals();
}

/* change stat value, update DOM & storage */
function changeStat(key, cat, delta){
  const entry = playersStore[key];
  if(!entry) return;
  const cur = Number(entry.stats[cat] || 0);
  const next = cur + delta;
  entry.stats[cat] = next;
  playersStore[key] = entry;
  saveAll(playersStore, selectedKeys, opponentShots);

  // update UI node
  const selector = `td[data-key="${CSS.escape(key)}"][data-cat="${CSS.escape(cat)}"] .cellInner`;
  const node = document.querySelector(selector);
  if(node){
    node.textContent = next;
    node.classList.remove("positive","negative","selected");
    if(next > 0) node.classList.add("positive");
    if(next < 0) node.classList.add("negative");
    node.classList.add("selected");
    setTimeout(()=>{ node.classList.remove("selected"); }, 650);
  }

  updateTotals();
}

/* Update totals row:
   - Schüsse: "my vs opp" (click increments opp)
   - FaceOffs Won: show percent
   - Plus/Minus: gerundeter Mittelwert (Math.round)
*/
function updateTotals(){
  const sums = CATEGORIES.map(()=>0);
  let count = 0;
  if(Array.isArray(selectedKeys)){
    selectedKeys.forEach(k=>{
      const p = playersStore[k];
      if(!p) return;
      count++;
      CATEGORIES.forEach((c,i)=> sums[i] += Number(p.stats[c] || 0));
    });
  }

  // build footer
  const footer = document.getElementById("totalsRow");
  footer.innerHTML = "";
  const tdLabel = document.createElement("td");
  tdLabel.colSpan = 2;
  tdLabel.id = "totalsLabel";
  tdLabel.textContent = `Summe / Spieler: (${count})`;
  footer.appendChild(tdLabel);

  sums.forEach((val, idx) => {
    const td = document.createElement("td");

    const cat = CATEGORIES[idx];
    if(cat === "Schüsse"){
      td.textContent = `${val} vs ${opponentShots}`;
      td.style.cursor = "pointer";
      td.addEventListener("click", () => {
        opponentShots++;
        saveAll(playersStore, selectedKeys, opponentShots);
        updateTotals();
      });
    } else if(cat === "FaceOffs Won"){
      const totalFO = sums[CATEGORIES.indexOf("FaceOffs")] || 0;
      const pct = totalFO > 0 ? Math.round((val / totalFO) * 100) : null;
      td.textContent = pct !== null ? `${val} (${pct}%)` : `${val}`;
    } else if(cat === "Plus/Minus"){
      const avg = count > 0 ? Math.round(val / count) : 0;
      td.textContent = avg;
    } else {
      td.textContent = val;
    }

    footer.appendChild(td);
  });
}

/* CSV import merges into playersStore (preserve existing stats if keys match) */
function importCSV(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const txt = e.target.result;
    const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length);
    if(lines.length < 1){ alert("Leere Datei."); return; }
    const header = lines.shift().split(";");
    lines.forEach(line=>{
      const parts = line.split(";");
      const num = (parts[0]||"").replace(/"/g,'').trim();
      const name = (parts[1]||"").replace(/"/g,'').trim();
      if(!name) return;
      const key = playerKey(num, name);
      const entry = playersStore[key] || { num, name, stats:{} };
      CATEGORIES.forEach((cat,i)=> entry.stats[cat] = Number(parts[2+i] || 0));
      playersStore[key] = entry;
    });
    saveAll(playersStore, selectedKeys, opponentShots);
    renderSelection();
    if(!selectionScreen.classList.contains("hidden")) return;
    renderTable();
    alert("Import abgeschlossen.");
  };
  reader.readAsText(file, "utf-8");
}

/* Export CSV for selected players */
function exportCSV(){
  if(!Array.isArray(selectedKeys) || selectedKeys.length === 0){ alert("Keine Spieler ausgewählt."); return; }
  const header = ["Nummer","Name", ...CATEGORIES];
  const rows = [ header.join(";") ];
  selectedKeys.forEach(k=>{
    const p = playersStore[k];
    if(!p) return;
    const vals = [p.num || "", `"${p.name.replace(/"/g,'""')}"`, ...CATEGORIES.map(c => p.stats[c] || 0)];
    rows.push(vals.join(";"));
  });
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "team_stats_export.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* Reset all stats (keeps playersStore and selection), zero opponentShots, timer remains stopped */
function resetAll(){
  if(!confirm("Alle Statistikwerte auf 0 setzen?")) return;
  Object.keys(playersStore).forEach(k => { CATEGORIES.forEach(c => playersStore[k].stats[c] = 0); });
  opponentShots = 0;
  // stop timer and keep it stopped (no auto-start)
  if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  timerSeconds = 0;
  updateTimerDisplay();
  saveAll(playersStore, selectedKeys, opponentShots);
  renderTable();
}

/* Timer logic: pointerdown -> start longpress timer to reset; pointerup -> toggle if not longpress */
function updateTimerDisplay(){
  const mm = String(Math.floor(timerSeconds/60)).padStart(2,"0");
  const ss = String(timerSeconds % 60).padStart(2,"0");
  timerBtn.textContent = `⏱ ${mm}:${ss}`;
}
function toggleTimer(){
  if(timerInterval){
    clearInterval(timerInterval); timerInterval = null;
  } else {
    timerInterval = setInterval(()=>{ timerSeconds++; updateTimerDisplay(); }, 1000);
  }
}
function resetTimer(){
  if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  timerSeconds = 0; updateTimerDisplay();
}
function attachTimerHandlers(){
  timerBtn.addEventListener("pointerdown", (ev)=>{
    ev.preventDefault();
    timerLongPressed = false;
    timerPressTimeout = setTimeout(()=>{
      timerLongPressed = true;
      resetTimer(); // reset and remain stopped
    }, 800);
  });
  timerBtn.addEventListener("pointerup", (ev)=>{
    ev.preventDefault();
    if(timerPressTimeout){ clearTimeout(timerPressTimeout); timerPressTimeout = null; }
    if(timerLongPressed){
      // longpress already handled -> do nothing (remain stopped)
      timerLongPressed = false;
      return;
    }
    // short press -> toggle
    toggleTimer();
  });
  timerBtn.addEventListener("pointercancel", ()=>{
    if(timerPressTimeout){ clearTimeout(timerPressTimeout); timerPressTimeout = null; }
    timerLongPressed = false;
  });
}

/* UI helpers */
function showSelection(){
  renderSelection();
  selectionScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
}
function showMain(){
  selectionScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  renderTable();
}

/* Init — wire DOM and events */
function init(){
  // DOM refs
  selectionScreen = document.getElementById("selectionScreen");
  selectList = document.getElementById("selectList");
  confirmBtn = document.getElementById("confirmSelection");

  mainScreen = document.getElementById("mainScreen");
  theadRow = document.getElementById("theadRow");
  tbody = document.getElementById("tbody");
  totalsRow = document.getElementById("totalsRow");

  reselectBtn = document.getElementById("reselectBtn");
  timerBtn = document.getElementById("timerBtn");
  resetBtn = document.getElementById("resetBtn");
  importBtn = document.getElementById("importBtn");
  exportBtn = document.getElementById("exportBtn");
  fileInput = document.getElementById("fileInput");

  // guard: if selectList missing -> log and create fallback
  if(!selectList){
    console.error("selectList DOM element not found. Make sure index.html has <div id=\"selectList\">");
    // create fallback so UI won't be broken
    selectList = document.createElement("div");
    selectList.id = "selectList";
    if(selectionScreen) selectionScreen.appendChild(selectList);
  }

  // load persisted
  const loaded = loadAll();
  playersStore = loaded.playersStore || {};
  selectedKeys = loaded.selectedKeys;
  opponentShots = loaded.oppShots || 0;

  // bind events
  confirmBtn.addEventListener("click", confirmSelection);
  reselectBtn.addEventListener("click", ()=> { renderSelection(); selectionScreen.classList.remove("hidden"); mainScreen.classList.add("hidden"); });
  exportBtn.addEventListener("click", exportCSV);
  importBtn.addEventListener("click", ()=> fileInput.click());
  fileInput.addEventListener("change", (e)=>{ const f = e.target.files[0]; if(f) importCSV(f); fileInput.value = ""; });
  resetBtn.addEventListener("click", resetAll);

  attachTimerHandlers();

  // initial view: if selection empty -> show selection; otherwise main
  if(!Array.isArray(selectedKeys) || selectedKeys.length === 0){
    showSelection();
  } else {
    // ensure playersStore has entries for selected keys (create if missing)
    selectedKeys.forEach(k=>{
      if(!playersStore[k]){
        const [num,name] = k.split("|");
        const obj = { num, name, stats:{} };
        CATEGORIES.forEach(c => obj.stats[c] = 0);
        playersStore[k] = obj;
      }
    });
    showMain();
  }

  // timer initial display
  updateTimerDisplay();
}

window.addEventListener("DOMContentLoaded", init);
