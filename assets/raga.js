/* =====================================================================
   Raga Geometry — raga pitch wheel + Adi Talam wheel, with Web Audio playback.
   The ragas come from content/raga-geometry.yaml (window.SANATANA_DATA.ragas);
   "avaro: reverse" means the descent is the ascent reversed.
   All markup lives inside .rg; classes are prefixed rg- where they could clash
   with the shared stylesheet.
   ===================================================================== */
(function(){
"use strict";
var root = document.querySelector('.rg'); if(!root) return;
const SEMI={S:0,R1:1,R2:2,R3:3,G1:2,G2:3,G3:4,M1:5,M2:6,P:7,D1:8,D2:9,D3:10,N1:9,N2:10,N3:11,"S'":12};
const RATIO=[1,16/15,9/8,6/5,5/4,4/3,45/32,3/2,8/5,5/3,9/5,15/8,2];
const SLOT_SHORT=["S","R1","R2/G1","R3/G2","G3","M1","M2","P","D1","D2/N1","D3/N2","N3"];
const SLOT_NAME=["Shadjam","Shuddha Rishabham","Chatushruti Rishabham / Shuddha Gandharam","Shatshruti Rishabham / Sadharana Gandharam","Antara Gandharam","Shuddha Madhyamam","Prati Madhyamam","Panchamam","Shuddha Dhaivatam","Chatushruti Dhaivatam / Shuddha Nishadam","Shatshruti Dhaivatam / Kaisiki Nishadam","Kakali Nishadam"];
const NOTE_NAME={S:"Shadjam",R1:"Shuddha Rishabham",R2:"Chatushruti Rishabham",R3:"Shatshruti Rishabham",G1:"Shuddha Gandharam",G2:"Sadharana Gandharam",G3:"Antara Gandharam",M1:"Shuddha Madhyamam",M2:"Prati Madhyamam",P:"Panchamam",D1:"Shuddha Dhaivatam",D2:"Chatushruti Dhaivatam",D3:"Shatshruti Dhaivatam",N1:"Shuddha Nishadam",N2:"Kaisiki Nishadam",N3:"Kakali Nishadam","S'":"Tara Shadjam (upper Sa)"};

const RAGAS=((window.SANATANA_DATA||{}).ragas||[]).map(function(r){
  var o=Object.assign({},r);
  if(o.avaro==="reverse"||!o.avaro) o.avaro=o.aro.slice().reverse();
  return o;
});
if(!RAGAS.length) return;

const BEATS=[
 {k:"Clap",s:"Ta",t:"clap",sec:"laghu"},{k:"Pinky",s:"ka",t:"count",sec:"laghu"},{k:"Ring",s:"di",t:"count",sec:"laghu"},{k:"Middle",s:"mi",t:"count",sec:"laghu"},
 {k:"Clap",s:"Ta",t:"clap",sec:"dru1"},{k:"Wave",s:"ka",t:"wave",sec:"dru1"},
 {k:"Clap",s:"Jha",t:"clap",sec:"dru2"},{k:"Wave",s:"nu",t:"wave",sec:"dru2"}];
const SECNAME={laghu:"Laghu",dru1:"first Drutam",dru2:"second Drutam"};

const $=id=>document.getElementById("rg-"+id);
const fmt=n=>{ if(n==="S'") return "Ṡ"; const m=n.match(/^([A-Z])(\d)?$/); return m[2]?m[1]+"<sub>"+m[2]+"</sub>":m[1]; };
const P=(c,r,deg)=>{const a=deg*Math.PI/180;return [(c[0]+r*Math.cos(a)).toFixed(2),(c[1]+r*Math.sin(a)).toFixed(2)];};

let cur=RAGAS[0];

/* ---------- raga wheel ---------- */
function renderWheel(r){
  const C=[300,300], RA=205, RV=136, ang=s=>-90+(s%12)*30;
  const aroSet=new Set(r.aro.map(n=>SEMI[n]%12)), avSet=new Set(r.avaro.map(n=>SEMI[n]%12));
  const used={}; r.aro.concat(r.avaro).forEach(n=>{used[SEMI[n]%12]=n==="S'"?"S":n;});
  const cls=s=>aroSet.has(s)&&avSet.has(s)?"both":aroSet.has(s)?"aro":avSet.has(s)?"av":"dim";
  let s=`<defs>
   <marker id="rg-mA" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="17" markerHeight="17" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--aro)"/></marker>
   <marker id="rg-mV" viewBox="0 0 10 10" refX="5" refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--avaro)"/></marker>
  </defs>`;
  s+=`<circle class="disc" cx="300" cy="300" r="252"/>`;
  for(let k=0;k<12;k++){const a=P(C,96,ang(k)),b=P(C,236,ang(k));s+=`<line class="spoke" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;}
  s+=`<circle class="guide s-aro" cx="300" cy="300" r="${RA}"/><circle class="guide s-av" cx="300" cy="300" r="${RV}"/>`;
  for(let k=0;k<12;k++){
    const c=cls(k), a=P(C,238,ang(k)), b=P(C,254,ang(k)), L=P(C,276,ang(k));
    const txt=used[k]||SLOT_SHORT[k];
    s+=`<g class="lblg" id="rg-lb-${k}" data-semi="${k}" tabindex="0" role="button" aria-label="${txt}, ${SLOT_NAME[k]}">
      <line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="s-${c}" stroke-width="${c==="dim"?3:7}" stroke-linecap="round"/>
      <text class="lbl f-${c}" x="${L[0]}" y="${L[1]}" style="font-size:${c==="dim"?14:18}px">${txt}</text></g>`;
  }
  const chords=(notes,R,cl,mk)=>{let o="";for(let i=0;i<notes.length-1;i++){
      const a=P(C,R,ang(SEMI[notes[i]])), b=P(C,R,ang(SEMI[notes[i+1]]));
      const m=[((+a[0]+ +b[0])/2).toFixed(2),((+a[1]+ +b[1])/2).toFixed(2)];
      o+=`<path class="chord ${cl}" d="M${a[0]} ${a[1]}L${m[0]} ${m[1]}L${b[0]} ${b[1]}" marker-mid="url(#${mk})"/>`;}return o;};
  s+=`<g>${chords(r.aro,RA,"s-aro","rg-mA")}${chords(r.avaro,RV,"s-av","rg-mV")}</g>`;
  const dots=(notes,R,rad,pre,fill,tc,dir)=>{let o="";const seen=new Set();notes.forEach(n=>{const k=SEMI[n]%12;if(seen.has(k))return;seen.add(k);
      const p=P(C,R,ang(k));const lab=n==="S'"?"S":n;
      o+=`<g class="nd" id="rg-${pre}-${k}" data-note="${lab}" data-dir="${dir}" tabindex="0" role="button" aria-label="Play ${lab}"><circle cx="${p[0]}" cy="${p[1]}" r="${rad}" style="fill:var(${fill})"/><text x="${p[0]}" y="${p[1]}" style="fill:${tc}">${lab}</text></g>`;});return o;};
  s+=dots(r.aro,RA,17,"na","--aro","#1c1200","Arohana")+dots(r.avaro,RV,15,"nv","--avaro","#ffffff","Avarohana");
  const cnt=a=>new Set(a.filter(n=>n!=="S'").map(n=>SEMI[n])).size;
  const ca=cnt(r.aro), cv=cnt(r.avaro), TY={5:"AUDAVA",6:"SHADAVA",7:"SAMPOORNA"};
  const ty=ca===cv?TY[ca]:TY[ca]+"–"+TY[cv];
  s+=`<circle class="hub" cx="300" cy="300" r="90"/>
   <text class="ctr-k" x="300" y="266">${r.tag}</text>
   <text class="ctr-big" x="300" y="306"><tspan class="f-aro">↑${ca}</tspan><tspan dx="10" class="f-av">↓${cv}</tspan></text>
   <text class="ctr-k" x="300" y="340" style="font-size:${ty.length>12?11:13}px">${ty}</text>`;
  $("wheel").innerHTML=s;
}

/* ---------- tala wheel ---------- */
function arc(c,r,a0,a1){const p=P(c,r,a0),q=P(c,r,a1);return `M${p[0]} ${p[1]}A${r} ${r} 0 ${(a1-a0)>180?1:0} 1 ${q[0]} ${q[1]}`;}
function renderTala(){
  const C=[230,200],R=138,ang=i=>-90+45*i;
  let s=`<circle class="disc" cx="230" cy="200" r="${R+26}"/>`;
  s+=`<g fill="none" stroke-width="9" stroke-linecap="round">
    <path class="s-laghu" d="${arc(C,R,ang(0)-16,ang(3)+16)}"/>
    <path class="s-dru1" d="${arc(C,R,ang(4)-16,ang(5)+16)}"/>
    <path class="s-dru2" d="${arc(C,R,ang(6)-16,ang(7)+16)}"/></g>`;
  [ang(0)-22.5,ang(4)-22.5,ang(6)-22.5].forEach(a=>{const p=P(C,R-26,a),q=P(C,R+26,a);s+=`<line class="s-both" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke-width="4" stroke-linecap="round"/>`;});
  BEATS.forEach((b,i)=>{
    const p=P(C,R,ang(i)), so=P(C,R-40,ang(i)), ko=P(C,R+46,ang(i));
    const cx=Math.cos(ang(i)*Math.PI/180), anchor=cx>0.3?"start":cx<-0.3?"end":"middle";
    const kx=(+ko[0]+(anchor==="start"?-12:anchor==="end"?12:0)).toFixed(2);
    let mk;
    if(b.t==="clap") mk=`<circle class="mk s-${b.sec} clapmk" cx="${p[0]}" cy="${p[1]}" r="14" stroke-width="5"/>`;
    else if(b.t==="count") mk=`<circle class="mk f-${b.sec}" cx="${p[0]}" cy="${p[1]}" r="9"/>`;
    else mk=`<circle class="mk s-${b.sec} wavemk" cx="${p[0]}" cy="${p[1]}" r="11" stroke-width="4"/>`;
    s+=`<g class="bt" id="rg-bt-${i}">
      <circle class="halo s-both" cx="${p[0]}" cy="${p[1]}" r="27" fill="none" stroke-width="3"/>
      ${mk}
      <text class="sol f-${b.sec}" x="${so[0]}" y="${so[1]}">${b.s}</text>
      <text class="kri" x="${kx}" y="${ko[1]}" text-anchor="${anchor}">${i+1} ${b.k}${i===0?" · Sam":""}</text></g>`;
  });
  s+=`<text class="tala-ctr f-both" x="230" y="188" style="font-size:32px">ADI</text>
      <text class="tala-ctr" x="230" y="220" style="font-size:18px"><tspan class="f-laghu">4</tspan><tspan class="f-muted"> + </tspan><tspan class="f-dru1">2</tspan><tspan class="f-muted"> + </tspan><tspan class="f-dru2">2</tspan></text>
      <text class="ctr-k" x="230" y="244">8 AKSHARAS</text>`;
  $("tala").innerHTML=s;
}

/* ---------- facts ---------- */
function renderFacts(r){
  $("wheel-title").textContent=r.name; $("facts-title").textContent=r.name; $("parent").textContent=r.parent;
  const aroSet=new Set(r.aro.map(n=>SEMI[n]%12)), avSet=new Set(r.avaro.map(n=>SEMI[n]%12));
  $("aro").innerHTML=r.aro.map(n=>`<span class="rg-chip a${avSet.has(SEMI[n]%12)?"":" diff"}">${fmt(n)}</span>`).join("");
  $("avaro").innerHTML=r.avaro.map(n=>`<span class="rg-chip v${aroSet.has(SEMI[n]%12)?"":" diff"}">${fmt(n)}</span>`).join("");
  $("mood").innerHTML=`<span class="rg-muted">Mood · </span>${r.mood}`;
  $("note").textContent=r.note;
}

function select(id){
  const r=RAGAS.find(x=>x.id===id)||RAGAS[0];
  if(playing) stop();
  cur=r; $("raga").value=r.id;
  renderWheel(r); renderFacts(r);
  $("status").textContent="Tap any note on the wheel to hear it.";
}

/* ---------- audio ---------- */
const SA=261.63;
let actx=null, master=null, drone=[];
function ac(){
  if(!actx){const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
    actx=new AC(); master=actx.createGain(); master.gain.value=0.9;
    const comp=actx.createDynamicsCompressor(); master.connect(comp); comp.connect(actx.destination);}
  if(actx.state==="suspended") actx.resume().catch(()=>{});
  return actx;
}
function tone(freq,dur,gain){
  const a=ac(); if(!a) return; const t=a.currentTime+0.01; gain=gain||0.22;
  const o1=a.createOscillator(),o2=a.createOscillator(),g=a.createGain(),g2=a.createGain(),f=a.createBiquadFilter();
  o1.type="triangle";o2.type="sine";o1.frequency.value=freq;o2.frequency.value=freq*2;g2.gain.value=0.3;
  f.type="lowpass";f.frequency.value=3000;
  o1.connect(g);o2.connect(g2);g2.connect(g);g.connect(f);f.connect(master);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+0.025);
  g.gain.exponentialRampToValueAtTime(gain*0.6,t+dur*0.45);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o1.start(t);o2.start(t);o1.stop(t+dur+0.02);o2.stop(t+dur+0.02);
}
function click(type){
  const a=ac(); if(!a) return; const t=a.currentTime;
  const o=a.createOscillator(),g=a.createGain(); o.type="sine";
  o.frequency.value=type==="clap"?1700:type==="wave"?900:1250;
  const pk=type==="clap"?0.16:0.06;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(pk,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+0.07);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+0.09);
}
function droneOn(){
  const a=ac(); if(!a) return; const t=a.currentTime;
  const f=a.createBiquadFilter(); f.type="lowpass"; f.frequency.value=1100; f.connect(master);
  [[SA*3/4,0.035],[SA,0.03],[SA*1.002,0.025],[SA/2,0.045]].forEach(([hz,v])=>{
    const o=a.createOscillator(),g=a.createGain(); o.type="sawtooth"; o.frequency.value=hz;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(v,t+0.6);
    o.connect(g); g.connect(f); o.start(t); drone.push({o,g});});
}
function droneOff(){
  if(!actx) return; const t=actx.currentTime;
  drone.forEach(({o,g})=>{try{g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value||0.02,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.4);o.stop(t+0.45);}catch(e){}});
  drone=[];
}

/* ---------- highlighting ---------- */
function lightNote(n,dir){
  root.querySelectorAll("#rg-wheel .on").forEach(e=>e.classList.remove("on"));
  if(!n) return; const k=SEMI[n]%12;
  const d=$((dir==="Avarohana"?"nv-":"na-")+k); if(d) d.classList.add("on");
  const l=$("lb-"+k); if(l) l.classList.add("on");
}
function setBeat(i){
  root.querySelectorAll("#rg-tala .bt.on").forEach(e=>e.classList.remove("on"));
  if(i>=0){const b=$("bt-"+i); if(b) b.classList.add("on");}
}
function sayNote(n,dir){
  $("status").textContent=(dir?dir+" · ":"")+n.replace("S'","Ṡ")+" · "+(NOTE_NAME[n]||"");
}

/* ---------- playback ---------- */
let playing=false,timer=null,step=0,seq=[],total=0;
function bpm(){return +$("bpm").value;}
function play(){
  const a=ac(); if(!a){$("status").textContent="This browser cannot play audio.";return;}
  playing=true; $("play").classList.add("on"); $("play").textContent="■ Stop";
  seq=cur.aro.map(n=>({n,dir:"Arohana"})).concat(cur.avaro.map(n=>({n,dir:"Avarohana"})));
  total=Math.ceil(seq.length/8)*8; step=0; droneOn(); timer=setTimeout(tick,500);
}
function tick(){
  if(!playing) return; const dur=60/bpm(), b=step%8, beat=BEATS[b];
  click(beat.t); setBeat(b);
  if(step<seq.length){const {n,dir}=seq[step]; tone(SA*RATIO[SEMI[n]],dur*0.95); lightNote(n,dir); sayNote(n,dir);}
  else {lightNote(null); $("status").textContent="Tala completes the cycle · beat "+(b+1)+" of 8 ("+SECNAME[beat.sec]+")";}
  step++;
  timer=setTimeout(step>=total?()=>stop():tick,dur*1000);
}
function stop(){
  playing=false; clearTimeout(timer); droneOff(); lightNote(null); setBeat(-1);
  $("play").classList.remove("on"); $("play").textContent="▶ Play ascent + descent";
  $("status").textContent="Tap any note on the wheel to hear it.";
}

/* ---------- wiring ---------- */
$("raga").innerHTML=RAGAS.map(r=>`<option value="${r.id}">${r.name}</option>`).join("");
$("raga").addEventListener("change",e=>{ try{history.replaceState(null,"","#"+e.target.value);}catch(_){} select(e.target.value); });
window.addEventListener("hashchange",()=>{const h=location.hash.slice(1); if(h&&h!==cur.id&&RAGAS.some(r=>r.id===h)) select(h);});
$("play").addEventListener("click",()=>playing?stop():play());
$("bpm").addEventListener("input",e=>{$("bpmv").textContent=e.target.value;});
function noteFromTarget(t){
  const nd=t.closest&&t.closest(".nd"); if(nd) return {n:nd.dataset.note,dir:nd.dataset.dir};
  const lb=t.closest&&t.closest(".lblg"); if(lb){const k=+lb.dataset.semi;const n=Object.keys(SEMI).find(x=>SEMI[x]===k&&lb.textContent.trim()===x);return {n:n||null,k};}
  return null;
}
function hit(t){
  const r=noteFromTarget(t); if(!r) return;
  if(r.n){tone(SA*RATIO[SEMI[r.n]],0.9); if(!playing){lightNote(r.n,r.dir||"Arohana"); sayNote(r.n,r.dir);} }
  else {tone(SA*RATIO[r.k],0.9); if(!playing) $("status").textContent=SLOT_SHORT[r.k]+" · "+SLOT_NAME[r.k]+" · not used in "+cur.name;}
}
$("wheel").addEventListener("click",e=>hit(e.target));
$("wheel").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();hit(e.target);}});

renderTala();
let start=RAGAS[0].id; try{const h=location.hash.slice(1); if(RAGAS.some(r=>r.id===h)) start=h;}catch(_){}
select(start);
})();
