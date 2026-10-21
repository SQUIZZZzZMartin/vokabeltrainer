// Vokabeltrainer – GitHub Pages + Firebase (Firestore, Google-Anmeldung)
import { firebaseConfig, LEARNER_ID } from "./firebase-config.js";

/* ---------- lists: lists/index.json in this repo ---------- */
let LISTS = {};
let curSet="all", curMode="cards";
let curList = (()=>{try{return localStorage.getItem("vocab-list")||""}catch(e){return ""}})();
let ITEMS=[], BYID={}, CATS=[];
function applyList(id,remember){
  if(!LISTS[id]) id=Object.keys(LISTS).pop();   // default: the newest list
  curList=id; if(remember){try{localStorage.setItem("vocab-list",id)}catch(e){}}
  ITEMS=LISTS[id].items; BYID=Object.fromEntries(ITEMS.map(i=>[i.id,i])); CATS=[...new Set(ITEMS.map(i=>i.cat))];
  if(!SETS().some(s=>s.k===curSet)) curSet="all";
}
const TYPE_BY_CAT={"Linking Words":"linking","Konstruktionen":"construction","Stolperfallen":"pitfall"};
const typeOf = it => it.type || TYPE_BY_CAT[it.cat] || (it.basic && !it.de ? "upgrade" : "meaning");
const $ = s=>document.querySelector(s);
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle = a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

/* ---------- learner + storage: Firestore (anonymous, no login) with a local cache ---------- */
let progress = {};          // itemId -> {box,right,wrong,last}
let sessions = [];          // newest first
let learner = (()=>{try{return JSON.parse(localStorage.getItem("vocab-learner")||"null")}catch(e){return null}})();
const slugify = n => n.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30);
const lsKey = () => "vocab-trainer-v1-" + (learner ? learner.id : "_");
function lsLoad(){progress={};sessions=[];try{const d=JSON.parse(localStorage.getItem(lsKey())||"{}");progress=d.p||{};sessions=d.s||[]}catch(e){}}
function lsSave(){try{localStorage.setItem(lsKey(),JSON.stringify({p:progress,s:sessions.slice(0,30)}))}catch(e){}}
let fb = null;              // {db, fs} once Firebase is connected
let known = [];             // learners already in Firestore
const pending = {};         // one write at a time per document
function saveItem(id){
  lsSave();
  if(!fb || !learner) return;
  const p={...progress[id]}, f=fb, who=learner.id;
  pending[id]=(pending[id]||Promise.resolve()).then(()=>f.fs.setDoc(f.fs.doc(f.db,"learners",who,"progress",id),p)).catch(e=>{console.warn(e); showSave("error")});
}
function saveSession(s){
  sessions.unshift(s); lsSave(); renderStats();
  if(!fb || !learner) return;
  fb.fs.addDoc(fb.fs.collection(fb.db,"learners",learner.id,"sessions"),s).catch(e=>console.warn(e));
  fb.fs.setDoc(fb.fs.doc(fb.db,"learners",learner.id),{name:learner.name,lastSeen:s.at},{merge:true}).catch(()=>{});
}
function showSave(state){
  state = state || (fb ? "cloud" : "local");
  $("#saveinfo").textContent = {cloud:"Fortschritt wird gespeichert",local:"Fortschritt nur auf diesem Gerät",error:"Speichern klappt gerade nicht – Fortschritt bleibt auf diesem Gerät"}[state];
}
function renderLearner(){
  const has=!!learner;
  $("#picker").hidden=has;
  if(!has){ $("#setup").hidden=true; $("#session").hidden=true; S=null }
  else if($("#session").hidden) $("#setup").hidden=false;
  $("#switchbtn").hidden=!has;
  $("#authtext").textContent = has ? learner.name : "Wer übt?";
  if(has) $("#switchbtn").textContent = (learner.name.trim()[0]||"?").toUpperCase();
  $("#known").innerHTML = known.map(k=>`<button class="chip known" data-id="${esc(k.id)}">${esc(k.name)}</button>`).join("");
  $("#known").hidden = !known.length;
  $("#pickhint").textContent = known.length ? "Neu hier? Dann gib unten einmal deinen Namen ein." : "Das fragt die Seite nur einmal pro Gerät.";
}
function chooseLearner(l){
  learner=l; try{localStorage.setItem("vocab-learner",JSON.stringify(l))}catch(e){}
  lsLoad(); renderLearner(); renderSetInfo(); renderStats();
  if(fb){ fb.fs.setDoc(fb.fs.doc(fb.db,"learners",l.id),{name:l.name},{merge:true}).catch(e=>console.warn(e)); watchLearner() }
}
$("#known").addEventListener("click",e=>{const b=e.target.closest("[data-id]"); if(!b) return; const k=known.find(x=>x.id===b.dataset.id); if(k) chooseLearner({id:k.id,name:k.name})});
$("#newform").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("#newname").value.trim().replace(/\s+/g," ").slice(0,30); const id=slugify(name);
  if(!id){ $("#newname").focus(); return }
  const k=known.find(x=>x.id===id);
  chooseLearner({id, name:k?k.name:name}); $("#newname").value="";
});
$("#switchbtn").addEventListener("click",()=>{ learner=null; try{localStorage.removeItem("vocab-learner")}catch(e){} unwatch(); lsLoad(); renderLearner(); renderStats(); });

let unsub=[];
function unwatch(){ unsub.forEach(u=>u()); unsub=[] }
function watchLearner(){
  unwatch(); if(!fb||!learner) return;
  const {db,fs}=fb, who=learner.id; let first=true;
  unsub.push(fs.onSnapshot(fs.collection(db,"learners",who,"progress"),snap=>{
    if(!learner||learner.id!==who) return;
    const remote={}; snap.forEach(d=>{remote[d.id]=d.data()});
    const upload=[];
    for(const k in progress){ if(!remote[k] || (progress[k].last||0)>(remote[k].last||0)){ remote[k]=progress[k]; if(first) upload.push(k) } }
    progress=remote; lsSave(); renderSetInfo(); renderStats();
    if(first){ first=false; upload.forEach(saveItem) }   // carry over what was practised offline
  },e=>{console.warn(e); showSave("error")}));
  unsub.push(fs.onSnapshot(fs.query(fs.collection(db,"learners",who,"sessions"),fs.orderBy("at","desc"),fs.limit(30)),snap=>{
    if(!learner||learner.id!==who) return;
    sessions=snap.docs.map(d=>d.data()); lsSave(); renderStats();
  },e=>console.warn(e)));
}
lsLoad();

async function initFirebase(){
  renderLearner(); showSave();
  if(!firebaseConfig) return;
  const V="https://www.gstatic.com/firebasejs/10.12.2/";
  try{
    const [app,auth,fs]=await Promise.all([import(V+"firebase-app.js"),import(V+"firebase-auth.js"),import(V+"firebase-firestore.js")]);
    const fapp=app.initializeApp(firebaseConfig);
    await auth.signInAnonymously(auth.getAuth(fapp));     // invisible, no login for Moritz
    fb={db:fs.getFirestore(fapp),fs};
  }catch(e){ console.warn("Firebase",e); fb=null; showSave("local"); renderLearner(); return }
  showSave("cloud"); renderLearner();
  fb.fs.onSnapshot(fb.fs.collection(fb.db,"learners"),snap=>{
    known=snap.docs.map(d=>({id:d.id,name:String((d.data()||{}).name||d.id)})).sort((a,b)=>a.name.localeCompare(b.name,"de"));
    renderLearner();
  },e=>console.warn(e));
  if(learner) chooseLearner(learner);
}


/* ---------- Leitner logic ---------- */
const box = id=>(progress[id]&&progress[id].box)||0;
function record(id, result){ // 0 = nicht gewusst, 1 = unsicher, 2 = gewusst
  const p = {box:0,right:0,wrong:0,last:0,...(progress[id]||{})};
  if(result===2){p.box=Math.min(5,(p.box||0)+1);p.right++}
  else if(result===1){p.box=Math.max(1,p.box||0)}
  else {p.box=1;p.wrong++}
  p.last=Date.now(); p.lastOk=result===2;
  progress[id]=p; saveItem(id);
}
function pick(pool,n){
  // weak words first, then new ones, then the rest by box and age
  const rank = i=>{const p=progress[i.id]; if(!p) return 1; if(p.box<=1) return 0; return 1+p.box};
  return shuffle(pool).sort((a,b)=>rank(a)-rank(b) || ((progress[a.id]||{}).last||0)-((progress[b.id]||{}).last||0)).slice(0,n);
}

/* ---------- setup ---------- */
function SETS(){
  const s=[{k:"all",t:"Alles"},{k:"weak",t:"Hakt noch"}];
  if(ITEMS.some(i=>i.prio===1)) s.push({k:"p1",t:"Priorität 1"});
  if(ITEMS.some(i=>i.prio===2)) s.push({k:"p2",t:"Priorität 2"});
  if(ITEMS.some(i=>i.prio===3)) s.push({k:"p3",t:"Top 5 Klausur"});
  return s.concat(CATS.map(c=>({k:"c:"+c,t:c})));
}
function poolFor(k){
  if(k==="all") return ITEMS;
  if(k==="p1") return ITEMS.filter(i=>i.prio===1);
  if(k==="p2") return ITEMS.filter(i=>i.prio===2);
  if(k==="p3") return ITEMS.filter(i=>i.prio===3);
  if(k==="weak") return ITEMS.filter(i=>progress[i.id] && (progress[i.id].box<=1 || progress[i.id].wrong>progress[i.id].right));
  return ITEMS.filter(i=>i.cat===k.slice(2));
}
function renderSets(){
  $("#sets").innerHTML = SETS().map(s=>`<button class="chip" data-k="${esc(s.k)}" aria-pressed="${s.k===curSet}">${esc(s.t)}</button>`).join("");
}
function renderSetInfo(){
  const pool=poolFor(curSet); const learned=pool.filter(i=>box(i.id)>=4).length;
  $("#setinfo").innerHTML = `<span class="mono">${pool.length}</span> Einträge · <span class="mono">${learned}</span> sitzen`;
  $("#start").disabled = pool.length===0;
  $("#start").textContent = pool.length===0 ? "Noch nichts, was hakt" : `${Math.min(curMode==="pairs"?5:10,pool.length)} ${curMode==="pairs"?"Paare":"Wörter"} starten`;
}
$("#sets").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return;curSet=b.dataset.k;renderSets();renderSetInfo()});
$("#modes").addEventListener("click",e=>{const b=e.target.closest(".mode");if(!b)return;curMode=b.dataset.mode;document.querySelectorAll(".mode").forEach(m=>m.setAttribute("aria-pressed",m===b));renderSetInfo()});
/* ---------- list chooser ---------- */
function renderListSel(){
  const arr=Object.values(LISTS);
  $("#listsel").innerHTML=arr.map(l=>`<option value="${esc(l.id)}"${l.id===curList?" selected":""}>${esc(l.name)} (${l.items.length})${l===arr[arr.length-1]&&arr.length>1?" – neu":""}</option>`).join("");
  $("#listsel").disabled=arr.length<2;
}
function switchList(id){ applyList(id,true); renderListSel(); renderSets(); renderSetInfo(); renderStats(); }
$("#listsel").addEventListener("change",e=>switchList(e.target.value));
try{
  const idx=await (await fetch("lists/index.json",{cache:"no-cache"})).json();
  for(const l of idx){
    try{ const items=await (await fetch(l.file,{cache:"no-cache"})).json(); if(Array.isArray(items)&&items.length) LISTS[l.id]={id:l.id,name:l.name,items} }catch(e){console.warn("Liste",l.file,e)}
  }
}catch(e){ console.warn(e) }
if(!Object.keys(LISTS).length){ document.querySelector(".wrap").insertAdjacentHTML("beforeend",`<p class="banner">Die Vokabellisten konnten nicht geladen werden. Bitte Seite neu laden.</p>`); throw new Error("no lists") }
applyList(curList,false); renderListSel();

renderSets(); renderSetInfo();

/* ---------- speech (output only) ---------- */
function speak(t){try{const u=new SpeechSynthesisUtterance(t.replace(/…/g,"").replace(/\//g,", "));u.lang="en-GB";u.rate=.92;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}
const canSpeak = (()=>{try{return "speechSynthesis" in window}catch(e){return false}})();

/* ---------- prompts ---------- */
const isPit = it => typeOf(it)==="pitfall";
const gapLine = it => it.gap ? `<div class="gap">„${esc(it.gap)}“</div>` : "";
// short label for the matching side of a pair, and for lists
const partner = it => typeOf(it)==="linking" ? it.de : (it.basic || it.de || it.note || "");
const hintOf = it => it.de || it.note || "";
function front(it){
  const ty=typeOf(it);
  if(ty==="pitfall") return `<div class="basic">${esc(it.en)}</div><div class="nuance">Wo liegt die Falle?</div>`;
  if(ty==="linking") return `<div class="basic">${esc(it.de||it.basic||"")}</div><div class="nuance">Welche Linking Words passen?</div>${gapLine(it)}`;
  if(ty==="construction") return `<div class="basic">${esc(it.basic||it.de||"")}<span class="up">↗</span></div>${it.note?`<div class="nuance">${esc(it.note)}</div>`:""}`;
  if(ty==="meaning" && !it.basic) return `<div class="basic">${esc(it.de||"")}</div>${gapLine(it)}`;
  if(it.de) return `<div class="basic">${esc(it.basic)}<span class="up">↗</span></div><div class="nuance">${esc(it.de)}</div>`;
  return `<div class="basic">${esc(it.basic)}<span class="up">↗</span></div>${it.gap?gapLine(it):`<div class="nuance">Was ist präziser?</div>`}`;
}
function back(it){
  if(isPit(it)) return `<div class="nuance" style="color:var(--ink)">${esc(it.de||it.note||"")}</div>`;
  const note = typeOf(it)!=="construction" && it.note ? `<div class="nuance">${esc(it.note)}</div>` : "";
  return `<div class="en">${esc(it.en)}</div>${note}${it.ex?`<div class="ex">${esc(it.ex)}</div>`:""}${it.basic?`<div class="nuance">statt <b>${esc(it.basic)}</b></div>`:""}${canSpeak?`<button class="speak" data-say="${esc(it.en)}">🔊 anhören</button>`:""}`;
}

/* ---------- session ---------- */
let S=null;
$("#start").addEventListener("click",()=>{
  let pool=poolFor(curSet);
  if(curMode==="pairs"){ const p=pool.filter(i=>!isPit(i) && partner(i)); if(p.length>=2) pool=p }
  if(!pool.length) return;
  const n = curMode==="pairs"?5:10;
  S={mode:curMode,set:curSet,items:pick(pool,Math.min(n,pool.length)),i:0,ok:0,pool};
  $("#setup").hidden=true; $("#session").hidden=false;
  curMode==="pairs"?renderPairs():renderStep();
});
$("#quit").addEventListener("click",()=>finish(true));
$("#stage").addEventListener("click",e=>{const s=e.target.closest("[data-say]");if(s){speak(s.dataset.say)}});

function setPos(){
  const total=S.items.length, done=S.mode==="pairs"?S.matched:S.i;
  $("#pos").textContent=`${Math.min(done+ (S.mode==="pairs"?0:1),total)} / ${total}`;
  $("#bar").style.width=(done/total*100)+"%";
}
function renderStep(){
  if(S.i>=S.items.length) return finish();
  setPos();
  const it=S.items[S.i];
  if(S.mode==="cards"){
    $("#stage").innerHTML=`<div class="card"><div class="cat">${esc(it.cat)}</div><div class="prompt">${front(it)}</div>
      <div id="ans" hidden class="answer">${back(it)}</div>
      <button class="reveal" id="rev">Umdrehen</button>
      <div class="rate" id="rate" hidden><button class="r0" data-r="0">Nicht gewusst</button><button class="r1" data-r="1">Unsicher</button><button class="r2" data-r="2">Gewusst</button></div></div>`;
    $("#rev").onclick=()=>{$("#ans").hidden=false;$("#rev").hidden=true;$("#rate").hidden=false};
    $("#rate").onclick=e=>{const b=e.target.closest("[data-r]");if(!b)return;const r=+b.dataset.r;record(it.id,r);if(r===2)S.ok++;S.i++;renderStep()};
  } else {
    // quiz: alternate direction; distractors from the same category
    // Stolperfallen always ask for the explanation; topic words sometimes ask English → German
    const reverse = isPit(it) || (typeOf(it)==="meaning" && !!it.de && Math.random()<.4);
    const sameCat = ITEMS.filter(x=>x.cat===it.cat && x.id!==it.id && x.en!==it.en);
    const others = shuffle(sameCat.length>=3?sameCat:ITEMS.filter(x=>x.id!==it.id)).slice(0,3);
    const opts = shuffle([it,...others]);
    const label = x=>reverse?(x.de||x.note||x.en):x.en;
    const q = reverse ? `<div class="basic">${esc(it.en)}</div><div class="nuance">${isPit(it)?"Was stimmt?":"Was bedeutet das?"}</div>` : front(it);
    $("#stage").innerHTML=`<div class="card"><div class="cat">${esc(it.cat)}</div><div class="prompt">${q}</div>
      <div class="opts" id="opts">${opts.map(o=>`<button class="opt" data-id="${esc(o.id)}">${esc(label(o))}</button>`).join("")}</div>
      <div id="after" hidden class="wrap" style="gap:10px"></div></div>`;
    $("#opts").onclick=e=>{
      const b=e.target.closest(".opt"); if(!b||b.disabled) return;
      const right=b.dataset.id===it.id;
      document.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(o.dataset.id===it.id)o.classList.add("ok")});
      if(!right) b.classList.add("bad"); else S.ok++;
      record(it.id,right?2:0);
      const card=$("#stage .card");
      card.insertAdjacentHTML("beforeend",`<div class="mark ${right?"good":""}" aria-hidden="true">${right?"✓":"A"}</div>`);
      const af=$("#after"); af.hidden=false;
      af.innerHTML=`${it.note&&typeOf(it)!=="construction"?`<div class="nuance">${esc(it.note)}</div>`:""}${it.ex?`<div class="ex" style="font-style:italic;color:var(--ink-soft)">${esc(it.ex)}</div>`:""}${canSpeak?`<button class="speak" data-say="${esc(it.en)}">🔊 ${esc(it.en)}</button>`:""}<button class="next" id="nx">Weiter</button>`;
      $("#nx").onclick=()=>{S.i++;renderStep()}; $("#nx").focus();
    };
  }
}
function renderPairs(){
  S.matched=0; S.errs=new Set();
  const left=shuffle(S.items), right=shuffle(S.items);
  setPos();
  $("#stage").innerHTML=`<div class="card"><div class="cat">Verbinde einfach und präzise</div>
    <div class="pairs" id="pairs">${left.map((it,k)=>`<button class="pair en" data-id="${esc(it.id)}" data-side="en" style="grid-row:${k+1};grid-column:1">${esc(it.en)}</button>`).join("")}
    ${right.map((it,k)=>`<button class="pair" data-id="${esc(it.id)}" data-side="de" style="grid-row:${k+1};grid-column:2">${esc(partner(it))}</button>`).join("")}</div></div>`;
  let sel=null;
  $("#pairs").onclick=e=>{
    const b=e.target.closest(".pair"); if(!b||b.classList.contains("done")) return;
    if(!sel || sel.dataset.side===b.dataset.side){ if(sel) sel.classList.remove("sel"); sel=b; b.classList.add("sel"); if(b.dataset.side==="en"&&canSpeak) speak(BYID[b.dataset.id].en); return }
    const a=sel; sel=null; a.classList.remove("sel");
    if(a.dataset.id===b.dataset.id){
      a.classList.add("done");b.classList.add("done");a.disabled=b.disabled=true;
      const id=a.dataset.id; const first=!S.errs.has(id); record(id,first?2:1); if(first)S.ok++;
      S.matched++; setPos(); if(S.matched===S.items.length) setTimeout(()=>finish(),450);
    } else {
      [a,b].forEach(x=>{x.classList.add("err");setTimeout(()=>x.classList.remove("err"),600)});
      const enId = a.dataset.side==="en"?a.dataset.id:b.dataset.id;
      if(!S.errs.has(enId)){S.errs.add(enId);record(enId,0)}
    }
  };
}
function finish(aborted){
  if(!S) return;
  const answered = S.mode==="pairs"?S.matched:S.i;
  if(answered>0) saveSession({at:Date.now(),mode:S.mode,set:S.set,list:curList,n:answered,ok:S.ok});
  const weak = S.items.slice(0,S.mode==="pairs"?S.items.length:S.i).filter(i=>box(i.id)<=1);
  if(aborted && answered===0){ S=null; $("#session").hidden=true; $("#setup").hidden=false; return }
  $("#bar").style.width="100%"; $("#pos").textContent="Fertig";
  $("#stage").innerHTML=`<div class="card"><div class="cat">Runde geschafft</div>
    <div class="basic"><span class="mono">${S.ok}</span> von <span class="mono">${answered}</span> sofort gewusst</div>
    ${weak.length?`<div><p class="label">Das kommt bald wieder</p><div class="list">${weak.map(w=>`<div class="li"><div class="w"><b>${esc(w.en)}</b><span>${esc(w.basic?"statt "+w.basic:hintOf(w))}</span></div></div>`).join("")}</div></div>`:`<div class="nuance">Alles sauber. Die Wörter rutschen ein Fach weiter.</div>`}
    <button class="next" id="again">Noch eine Runde</button></div>`;
  $("#again").onclick=()=>{S=null;$("#session").hidden=true;$("#setup").hidden=false;renderSetInfo()};
  S.done=true;
}

/* ---------- progress view ---------- */
function fmtDate(t){const d=new Date(t);return d.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}
const MODE_DE={cards:"Karteikarte",quiz:"Auswahl",pairs:"Paare"};
function renderStats(){
  const v=$("#view-stats"); if(v.hidden && !v.dataset.dirty){v.dataset.dirty="1"}
  const mySessions=sessions.filter(s=>(s.list||"builtin")===curList);
  const all=ITEMS.length||1;
  const sit=ITEMS.filter(i=>box(i.id)>=4).length;
  const work=ITEMS.filter(i=>{const b=box(i.id);return b>=1&&b<4}).length;
  const neu=all-sit-work;
  const days=new Set(mySessions.map(s=>new Date(s.at).toDateString()));
  let streak=0; for(let d=new Date();;d.setDate(d.getDate()-1)){ if(days.has(d.toDateString())) streak++; else if(streak>0||d.toDateString()!==new Date().toDateString()) break }
  const weak=ITEMS.filter(i=>progress[i.id]&&progress[i.id].wrong>0).sort((a,b)=>{const pa=progress[a.id],pb=progress[b.id];return (pb.wrong-pb.right/2)-(pa.wrong-pa.right/2)||pa.box-pb.box}).slice(0,10);
  const catRows=CATS.map(c=>{const its=ITEMS.filter(i=>i.cat===c);const s=its.filter(i=>box(i.id)>=4).length;const w=its.filter(i=>{const b=box(i.id);return b>=1&&b<4}).length;return {c,n:its.length,s,w}});
  v.innerHTML=`
  <p class="sub" style="margin:0">${learner?`<b>${esc(learner.name)}</b> · `:""}Liste: <b>${esc(LISTS[curList].name)}</b> · <span class="mono">${ITEMS.length}</span> Einträge</p>
  <section>
    <div class="stats">
      <div class="stat"><b class="mono" style="font-family:var(--display)">${sit}</b><span>sitzen (Fach 4–5)</span></div>
      <div class="stat"><b style="color:var(--amber)">${work}</b><span>in Arbeit</span></div>
      <div class="stat"><b style="color:var(--ink-soft)">${neu}</b><span>noch neu</span></div>
    </div>
    <div class="stack" role="img" aria-label="${sit} sitzen, ${work} in Arbeit, ${neu} neu von ${all}">
      <i style="width:${sit/all*100}%;background:var(--green)"></i><i style="width:${work/all*100}%;background:var(--amber)"></i></div>
    <div class="legend"><span style="--c:var(--green)">sitzen</span><span style="--c:var(--amber)">in Arbeit</span><span style="--c:var(--rule)">neu</span><span class="nosw">${streak?`<b class="mono">${streak}</b> Tag${streak>1?"e":""} am Stück`:"Heute noch nicht geübt"}</span></div>
  </section>
  <section>
    <h2>Hier hakt es noch</h2>
    ${weak.length?`<div class="list">${weak.map(w=>{const p=progress[w.id];return `<div class="li"><div class="w"><b>${esc(w.en)}</b><span>${esc(w.basic?`statt ${w.basic}`:hintOf(w))}</span></div><span class="pill ${p.box>=3?"g":""}">${p.wrong}× falsch</span></div>`}).join("")}</div>`
      :`<p class="empty">Noch keine Fehler gespeichert. Sobald geübt wird, stehen hier die Wörter, die öfter danebengehen.</p>`}
  </section>
  <section>
    <h2>Nach Bereichen</h2>
    <div class="cats">${catRows.map(r=>`<div class="catrow"><span>${esc(r.c)}</span><div class="stack" style="height:8px"><i style="width:${r.s/r.n*100}%;background:var(--green)"></i><i style="width:${r.w/r.n*100}%;background:var(--amber)"></i></div><span class="mono">${r.s}/${r.n}</span></div>`).join("")}</div>
  </section>
  <section>
    <h2>Letzte Runden</h2>
    ${mySessions.length?`<div class="list">${mySessions.slice(0,10).map(s=>`<div class="li"><div class="w"><b>${esc(MODE_DE[s.mode]||s.mode)} · ${esc((SETS().find(x=>x.k===s.set)||{t:"–"}).t)}</b><span>${fmtDate(s.at)}</span></div><span class="pill ${s.ok/s.n>=.7?"g":""}">${s.ok}/${s.n}</span></div>`).join("")}</div>`
      :`<p class="empty">Noch keine Runde gespielt. Jede abgeschlossene Runde erscheint hier mit Datum und Ergebnis.</p>`}
  </section>`;
}
renderStats();

/* ---------- tabs ---------- */
function showTab(t){
  $("#tab-learn").setAttribute("aria-selected",t==="learn"); $("#tab-stats").setAttribute("aria-selected",t==="stats");
  $("#view-learn").hidden=t!=="learn"; $("#view-stats").hidden=t!=="stats";
  if(t==="stats") renderStats();
}
$("#tab-learn").onclick=()=>showTab("learn"); $("#tab-stats").onclick=()=>showTab("stats");
if(location.hash==="#fortschritt") showTab("stats");
initFirebase();
