// Wintercup banenkaart – app (UI). Rekenwerk staat in ./core, de toestand in ./state.js.
import { perf as corePerf } from './core/polar.js';
import * as TM from './core/timing.js';
import { fmtT, fmtMS, hms, manTxt } from './core/timing.js';
import { llXY, xyLL, brgT, pad3, wname, WIND_NAMES, twaOf as navTwaOf, pos, cmean, fitsWind, KX as KXl, offsetNm, distCrs, norm360 } from './core/nav.js';
import { margins } from './core/rating.js';
import { dueSignals, clockState } from './core/race.js';
import { rankVoices, digits } from './core/voice.js';
import { countdownKeys, nextLegKeys, spiKeys } from './core/clips.js';
import { initClips } from './ui/clips.js';
import { createStore } from './state.js';
import { BOATS, FLEETS, CLASSES, FLEET_SRC } from './data/boats.js';
import { initPanels } from './ui/panels.js';
import { initRegels } from './ui/regels.js';

const D=window.__D;
// Tijdelijke baanwijzigingen uit de wedstrijdinformatie: na 'until' geldt weer de baan uit het boekje.
for(const c of Object.values(D.courses)){if(!c.orig)continue;if(Date.now()>Date.parse(c.until)){Object.assign(c,c.orig);delete c.mod}delete c.orig}
const IMG=window.__IMG;
let LS=null;try{LS=window.localStorage}catch(e){}
export const store=createStore(LS);
const ST=store.S;
if(!D.courses[ST.baan])ST.baan=51;
window.__store=store;   // voor tests en foutzoeken

// Dunne wrappers: het rekenwerk is puur (core), hier komt de actuele toestand erbij.
const calcCtx=()=>({polar:BOATS[ST.boat].polar,twd:ST.twd,tws:ST.tws,eff:ST.eff,tackS:ST.tackS,gybeS:ST.gybeS});
function perf(twa,tws){return corePerf(BOATS[ST.boat].polar,twa,tws,ST.eff)}
function segTime(sg){return TM.segTime(sg,calcCtx())}
function sailTime(l){return TM.sailTime(l,calcCtx())}
function legTime(l){return TM.legTime(l,calcCtx())}
function countManoeuvres(legs){TM.countManoeuvres(legs,calcCtx())}
function twaOf(tw){return navTwaOf(ST.twd,tw)}
const WN=WIND_NAMES;
function setSpi(v){v=Math.round(+v);if(isNaN(v))return;v=Math.max(90,Math.min(180,v));ST.spiMin=v;document.getElementById('spiIn').value=v;document.getElementById('spiRange').value=v;const L=document.getElementById('spiLeg');if(L)L.textContent=`Spinnaker bij TWA ${v}°–180°`;show(false)}
const svg=document.getElementById('map');
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}
$('water').setAttribute('d',D.water);
$('dShal').setAttribute('d',D.shal);$('dMid').setAttribute('d',D.mid);$('dNod').setAttribute('d',D.nod);$('d2').setAttribute('d',D.line24);
const si=$('sat');si.setAttribute('href',IMG.href);['x','y','width','height'].forEach(k=>si.setAttribute(k,IMG[k]));
function setStyle(st){ST.mapStyle=st;svg.classList.remove('st-chart','st-dim','st-photo','st-night');svg.classList.add('st-'+st);svg.classList.toggle('sat',st==='photo');si.style.display=(st==='chart'||st==='night')?'none':'';
  document.querySelectorAll('#styleSel button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.st===st?'true':'false'));try{if(CUR)applyVB()}catch(e){}try{scheduleTiles()}catch(e){}}
document.querySelectorAll('#styleSel button').forEach(b=>b.onclick=()=>setStyle(b.dataset.st));setStyle(ST.mapStyle);
const [bx0,by0,bx1,by1]=D.bounds;
const ALL={x:bx0-0.2,y:-by1-0.2,w:(bx1-bx0)+0.4,h:(by1-by0)+0.4};
let vb={...ALL};
const KIND={g:'groene spitse ton',r:'rode stompe ton',y:'gele ton',gr:'splitsingston groen-rood',rg:'splitsingston rood-groen',sg:'sparboei groen-wit (2 m-dieptemarkering)',sr:'sparboei rood-wit (2 m-dieptemarkering)',srg:'sparboei rood-groen (splitsing dieptemarkering)',sy:'gele sparboei'};
const gB=$('buoys');const BUOY={};
for(const [n,x,y,c] of D.buoys){
  const g=el('g',{transform:`translate(${x},${y})`,'data-n':n,'data-c':c},gB);
  el('circle',{class:'hit',r:2.2},g);
  if(c[0]==='s'){const col=c==='sg'?'g':c==='sr'?'r':c==='sy'?'y':'r';el('rect',{class:'bz sp '+col,x:-0.22,y:-1.1,width:0.44,height:2.2},g);
    if(c!=='sy')el('rect',{class:'bz sw',x:-0.22,y:-0.45,width:0.44,height:0.4},g);}
  else if(c==='g'||c==='gr') el('path',{class:'bz g',d:'M0,-1L0.9,0.75L-0.9,0.75Z'},g);
  else if(c==='y') el('circle',{class:'bz y',r:0.8},g);
  else el('rect',{class:'bz r',x:-0.75,y:-0.75,width:1.5,height:1.5},g);
  if(c==='gr'||c==='rg') el('rect',{class:'bz '+(c==='gr'?'r':'g'),x:-0.9,y:-0.15,width:1.8,height:0.5},g);
  BUOY[n]=[x,y,c];
}
for(const [n,x,y] of D.places){const t=el('text',{class:'place',x,y,'text-anchor':'middle'},$('places'));t.textContent=n}
for(const k in D.areas){const [x,y]=D.areas[k];const g=el('g',{'data-a':k},$('areas'));el('circle',{class:'area',cx:x,cy:y,r:D.area_r},g);const t=el('text',{class:'alab',x,y:y+D.area_r*1.25},g);t.textContent='Startgebied '+k}

let K=0.01;
function LZ(k){return Math.min(1.7,Math.max(1,Math.sqrt(0.0095/k)))}
function applyVB(kOver){
  svg.setAttribute('viewBox',`${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const r=svg.getBoundingClientRect();
  const k=kOver||Math.max(vb.w/r.width,vb.h/r.height);K=k;
  const st=$('dyn')||el('style',{id:'dyn'},svg);
  const showB=k<0.006;
  const fz=window.innerWidth<760?1.25:1;const zf=Math.min(3.2,Math.max(1,0.0095/k));
  st.textContent=`.bz{stroke-width:${k*0.6*(zf>1.4?1.6:1)}px} #buoys g>*:not(text){transform:scale(${k*3.4*zf})} #buoys g.inc>*:not(text){transform:scale(${k*5.5*Math.max(1,zf*0.75)})} #buoys g:not(.inc){opacity:${zf>1.5?1:zf>1.15?0.75:0.5}}
  .place{font-size:${k*12}px} #map.sat .place{stroke-width:${k*3}px} .alab{font-size:${k*13}px} .area{stroke-width:${k*1.2}px}
  .wat{stroke-width:${k*0.8}px} .d-shal{stroke-width:${k*1.1}px} .d-2{stroke-width:${k*1.4}px;stroke-dasharray:${k*4} ${k*3}}
  .corr{stroke-width:${k*1}px;stroke-dasharray:${k*5} ${k*3}} .corrlab{font-size:${k*14}px;stroke-width:${k*3.5}px}
  .leg{stroke-width:${k*3.2}px} .leg.curleg{stroke-width:${k*6.5}px} .halo{stroke-width:${k*6.5}px} .leg.var{stroke-dasharray:${k*7} ${k*5}}
  .mk .ring{stroke-width:${k*2.6}px} .mk .lab{font-size:${k*13*fz}px;stroke-width:${k*3.5}px}
  .crs{font-size:${k*11*fz}px;stroke-width:${k*3.5}px} .gateb,.fbuoy{stroke-width:${k*1}px} .pingmk{stroke-width:${k*2.5}px} .sline,.fline{stroke-width:${k*2}px} .fship{stroke-width:${k*1.2}px}
  .wtag{font-size:${k*12}px;stroke-width:${k*3}px} .legno text{font-size:${k*12*LZ(k)}px} .legno circle{stroke-width:${k*2}px}`;
  document.querySelectorAll('.legno circle').forEach(e=>e.setAttribute('r',k*10.5*LZ(k)));
  document.querySelectorAll('[data-r]').forEach(e=>e.setAttribute('r',e.dataset.r*k));
  document.querySelectorAll('[data-s]').forEach(e=>e.setAttribute('transform',`translate(${e.dataset.x},${e.dataset.y}) rotate(${e.dataset.a||0}) scale(${k*(+e.dataset.s)})`));
  document.querySelectorAll('.mk .lab').forEach(e=>{e.setAttribute('x',+e.dataset.x+k*12);e.setAttribute('y',+e.dataset.y-k*8)});
  document.querySelectorAll('[data-nx]').forEach(e=>placeLab(e,1,k));
  svg.classList.toggle('far',k>0.03);
  declutter(k);
  try{if(G.on)gpsDraw()}catch(e){}
  try{scheduleTiles()}catch(e){}
  if(kOver)return;
  const nmPx=1/k; let s=[0.1,0.25,0.5,1,2,5].find(v=>v*nmPx>70)||5;
  $('scale').innerHTML=`<span style="display:inline-block;width:${s*nmPx}px;border-bottom:2px solid currentColor;margin-right:6px"></span>${s} nm`;
  placeTip();
}
function placeLab(e,side,k){const o=(+e.dataset.o||13)*side;const x=+e.dataset.x+(+e.dataset.nx)*k*o,y=+e.dataset.y+(+e.dataset.ny)*k*o;e.setAttribute('x',x);e.setAttribute('y',y);if(e.dataset.rot!==undefined)e.setAttribute('transform',`rotate(${e.dataset.rot} ${x} ${y})`)}
function declutter(k){
  const placed=[];const R=e=>e.getBoundingClientRect();
  const hit=r=>placed.some(p=>!(r.right<p.left||r.left>p.right||r.bottom<p.top||r.top>p.bottom));
  document.querySelectorAll('#toplayer .legno,#course .gateb,#course .fship,#course .fbuoy,#course .sline').forEach(e=>placed.push(R(e)));
  document.querySelectorAll('#course .mk .lab').forEach(e=>{const x=+e.dataset.x,y=+e.dataset.y;
    for(const [dx,dy,an] of [[12,-8,'start'],[-12,-8,'end'],[12,15,'start'],[-12,15,'end'],[0,-16,'middle'],[0,22,'middle']]){e.setAttribute('x',x+dx*k);e.setAttribute('y',y+dy*k);e.setAttribute('text-anchor',an);const r=R(e);if(!hit(r)){placed.push(r);return}}
    e.setAttribute('x',x+12*k);e.setAttribute('y',y-8*k);e.setAttribute('text-anchor','start');placed.push(R(e))});
  document.querySelectorAll('#course .corrlab,#course .crs').forEach(e=>{if(e.style.display==='none')return;e.style.visibility='';
    for(const sd of [1,-1,1.8,-1.8]){placeLab(e,sd,k);const r=R(e);if(!hit(r)){placed.push(r);return}}e.style.visibility='hidden'});
}
function fitTo(b,pad=0.12){const r=svg.getBoundingClientRect();const ar=r.width/r.height;let w=b.w*(1+pad*2),h=b.h*(1+pad*2);if(w/h<ar)w=h*ar;else h=w/ar;vb={x:b.x+b.w/2-w/2,y:b.y+b.h/2-h/2,w,h};applyVB()}
function zoom(f,cx,cy){if(cx===undefined){cx=vb.x+vb.w/2;cy=vb.y+vb.h/2}const nw=Math.min(Math.max(vb.w*f,0.25),260);const s=nw/vb.w;vb={x:cx-(cx-vb.x)*s,y:cy-(cy-vb.y)*s,w:vb.w*s,h:vb.h*s};applyVB()}
function pt(e){const r=svg.getBoundingClientRect();const k=Math.max(vb.w/r.width,vb.h/r.height);const ox=(r.width*k-vb.w)/2,oy=(r.height*k-vb.h)/2;return [vb.x-ox+(e.clientX-r.left)*k,vb.y-oy+(e.clientY-r.top)*k,k]}
function toScreen(x,y){const r=svg.getBoundingClientRect(),c=$('chart').getBoundingClientRect();const k=Math.max(vb.w/r.width,vb.h/r.height);const ox=(r.width*k-vb.w)/2,oy=(r.height*k-vb.h)/2;return [(x-vb.x+ox)/k+r.left-c.left,(y-vb.y+oy)/k+r.top-c.top]}
svg.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=pt(e);zoom(e.deltaY>0?1.18:1/1.18,x,y)},{passive:false});
let drag=null,down=null;const ptrs=new Map();
// start en gate verslepen (vóór het pannen van de kaart)
function setSG(k,xy){const adj=JSON.parse(JSON.stringify(ST.sgAdj||{}));const a=adj[ST.area]||(adj[ST.area]={});
  if(CUR){const o=k==='start'?'g':'s';if(!a[o])a[o]=xyLL(...CUR.S[o==='s'?'start':'gate'])}
  a[k==='start'?'s':'g']=xyLL(xy[0],xy[1]);ST.sgAdj=adj;show(false)}
svg.addEventListener('pointerdown',e=>{const t=e.target;if(!t.classList||!t.classList.contains('sgh')||document.body.classList.contains('race'))return;
  e.stopPropagation();e.preventDefault();const k=t.dataset.k;try{svg.setPointerCapture(e.pointerId)}catch(_){}let raf=0,last=null;svg.classList.add('sgdrag');
  const mv=ev=>{ev.stopPropagation();last=pt(ev);if(!raf)raf=requestAnimationFrame(()=>{raf=0;if(last)setSG(k,last)})};
  const up=ev=>{ev.stopPropagation();svg.removeEventListener('pointermove',mv,true);svg.removeEventListener('pointerup',up,true);svg.removeEventListener('pointercancel',up,true);svg.classList.remove('sgdrag');if(raf)cancelAnimationFrame(raf);if(last)setSG(k,last)};
  svg.addEventListener('pointermove',mv,true);svg.addEventListener('pointerup',up,true);svg.addEventListener('pointercancel',up,true)},true);
function sgFromFields(){if(!CUR)return;const nm=+String($('sgDist').value).replace(',','.'),mc=+String($('sgCrs').value).replace(',','.');if(!(nm>=0.05&&nm<=5)||isNaN(mc))return;
  const st=CUR.S.start,g=offsetNm(st,nm,norm360(mc+D.decl));const adj=JSON.parse(JSON.stringify(ST.sgAdj||{}));adj[ST.area]={s:xyLL(...st),g:xyLL(...g)};ST.sgAdj=adj;show(false)}
['sgDist','sgCrs'].forEach(id=>{$(id).addEventListener('change',sgFromFields);$(id).addEventListener('keydown',e=>{if(e.key==='Enter')sgFromFields()})});
$('sgReset').onclick=()=>{const adj=JSON.parse(JSON.stringify(ST.sgAdj||{}));delete adj[ST.area];ST.sgAdj=adj;show(false)};
svg.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:e.target};svg.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);drag={x:e.clientX,y:e.clientY,vb:{...vb}};svg.classList.add('drag')});
svg.addEventListener('pointermove',e=>{if(!drag)return;const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===2&&prev){const [a,b]=[...ptrs.values()];const d1=Math.hypot(a[0]-b[0],a[1]-b[1]);const o=[...ptrs.entries()].find(([id])=>id!==e.pointerId)[1];const d0=Math.hypot(prev[0]-o[0],prev[1]-o[1]);if(d0>0){const [x,y]=pt({clientX:(a[0]+b[0])/2,clientY:(a[1]+b[1])/2});zoom(d0/d1,x,y)}drag={x:e.clientX,y:e.clientY,vb:{...vb}};return}
  const [, , k]=pt(e);vb.x=drag.vb.x-(e.clientX-drag.x)*k;vb.y=drag.vb.y-(e.clientY-drag.y)*k;applyVB()});
const end=e=>{ptrs.delete(e.pointerId);if(!ptrs.size){drag=null;svg.classList.remove('drag')}
  if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5){const ln=down.t&&down.t.closest&&down.t.closest('.legno');if(ln){setLeg(+ln.dataset.li)}else clickAt(e)}
  else if(down&&G.on&&G.follow){G.follow=false;$('gFollow').setAttribute('aria-pressed','false')}down=null};
svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',e=>{down=null;end(e)});
// buoy tooltip
let tipAt=null;
function clickAt(e){
  // nearest buoy within 14 px
  const [x,y,k]=pt(e);let best=null,bd=14*k;
  for(const n in BUOY){const [bx,by]=BUOY[n];const d=Math.hypot(bx-x,by-y);if(d<bd){bd=d;best=n}}
  if(!best){$('tip').hidden=true;tipAt=null;return}
  const [bx,by,c]=BUOY[best];tipAt=[bx,by];
  const lat=(-by/60+51.74),lon=(bx/(Math.cos(51.74*Math.PI/180)*60)+3.95);
  $('tip').innerHTML=`<b>${best}</b><span>${KIND[c]||''}</span><span>${lat.toFixed(4)}° N  ${lon.toFixed(4)}° O</span>`;
  $('tip').hidden=false;placeTip();
}
function placeTip(){if(!tipAt||$('tip').hidden)return;const [sx,sy]=toScreen(...tipAt);$('tip').style.left=sx+'px';$('tip').style.top=sy+'px'}
$('zin').onclick=()=>zoom(1/1.4);$('zout').onclick=()=>zoom(1.4);$('all').onclick=()=>fitTo(ALL,0);
$('nlBtn').onclick=()=>{const a=llXY(53.6,3.3),b=llXY(50.72,7.25);fitTo({x:a[0],y:a[1],w:b[0]-a[0],h:b[1]-a[1]},0.02)};
let curBox=ALL,startBox=ALL;$('fit').onclick=()=>fitTo(curBox);$('fitS').onclick=()=>fitTo(startBox,0.25);
const FB={x:Math.min(D.finish.ship[0],D.finish.buoy[0])-0.25,y:Math.min(D.finish.ship[1],D.finish.buoy[1])-0.2,w:0.5,h:0.4};$('fitF').onclick=()=>fitTo(FB,0.1);
$('tDepth').onchange=e=>{$('depth').style.display=e.target.checked?'':'none'};
$('tBuoy').onchange=e=>{$('buoys').style.display=e.target.checked?'':'none'};

$('tCorr').onchange=e=>{$('corr').style.display=e.target.checked?'':'none'};
$('tCrs').onchange=e=>{document.querySelectorAll('.crs').forEach(t=>t.style.display=e.target.checked?'':'none')};

WN.forEach((n,i)=>{const b=document.createElement('button');b.textContent=n;b.dataset.w=i*22.5;b.title=`Wind uit ${n} (${(i*22.5).toFixed(1).replace('.0','')}°)`;b.onclick=()=>setTwd(Math.round(i*22.5));$('wind').appendChild(b)});
function setTwd(v){v=Math.round(((+v)%360+360)%360);if(isNaN(v))return;ST.twd=v;$('twdIn').value=v;$('twdRange').value=v;show(false)}
$('twdIn').addEventListener('change',e=>setTwd(e.target.value));
$('twdIn').addEventListener('keydown',e=>{if(e.key==='Enter')setTwd(e.target.value)});
$('twdRange').addEventListener('input',e=>setTwd(e.target.value));
$('spiIn').addEventListener('change',e=>setSpi(e.target.value));$('spiIn').addEventListener('keydown',e=>{if(e.key==='Enter')setSpi(e.target.value)});
$('spiRange').addEventListener('input',e=>setSpi(e.target.value));
$('twsIn').value=ST.tws;$('effIn').value=ST.eff;
function setTws(){{const a=+$('tackIn').value,b=+$('gybeIn').value;if(!isNaN(a)&&a>=0){ST.tackS=Math.min(60,a)}if(!isNaN(b)&&b>=0){ST.gybeS=Math.min(60,b)}}let v=+$('twsIn').value;if(isNaN(v))return;v=Math.max(4,Math.min(24,v));ST.tws=v;$('twsIn').value=v;let e=+$('effIn').value;if(!isNaN(e)){e=Math.max(50,Math.min(110,e));ST.eff=e;$('effIn').value=e}show(false)}
$('tackIn').value=ST.tackS;$('gybeIn').value=ST.gybeS;
['twsIn','effIn','tackIn','gybeIn'].forEach(id=>{$(id).addEventListener('change',setTws);$(id).addEventListener('keydown',e=>{if(e.key==='Enter')setTws()})});
$('spiIn').value=ST.spiMin;$('spiRange').value=ST.spiMin;{const L=document.getElementById('spiLeg');if(L)L.textContent=`Spinnaker bij TWA ${ST.spiMin}°–180°`}
const keys=Object.keys(D.courses).map(Number).sort((a,b)=>a-b);
function fits(n){return fitsWind(D.courses[n].title,ST.twd)}
['A','B','C','D'].forEach(a=>{const b=document.createElement('button');b.textContent=a;b.id='ar'+a;b.onclick=()=>{ST.area=a;show(false)};$('areaSel').appendChild(b)});
$('allCourses').onchange=e=>{ST.allC=e.target.checked;show(false)};
for(const n of keys){const b=document.createElement('button');b.textContent=n;b.id='c'+n;b.onclick=()=>{if(b.classList.contains('off')&&!ST.allC)return;ST.baan=n;show(true)};$('chips').appendChild(b)}

function sideCls(s){return s==='SB'?'sb':s==='BB'?'bb':''}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function dispSegs(l){const out=[];let carry=0;l.s.forEach((sg,j)=>{if(sg.nm<0.1&&j<l.s.length-1){carry+=sg.nm;return}out.push(Object.assign({},sg,{nm:sg.nm+carry,j}));carry=0});return out}
function legStats(l){const mw=cmean(l.s.map(s=>[s.mw,s.nm||0.01])),tw=cmean(l.s.map(s=>[s.tw,s.nm||0.01]));
  let lo=0,hi=0;l.s.forEach(s=>{const d=((s.mw-mw+540)%360)-180;lo=Math.min(lo,d);hi=Math.max(hi,d)});
  return {mw,tw,lo:mw+lo,hi:mw+hi,span:hi-lo}}

function spiPlan(legs){
  // flatten into segments with location names
  const segs=[];
  legs.forEach((l,i)=>{const ds=l.s.length>1?dispSegs(l):l.s.map((s,j)=>Object.assign({},s,{j}));let cum=0;
    ds.forEach((sg,q)=>{const t=twaOf(sg.tw);const c0=cum;cum+=sg.nm;
      const from=q===0?(i===0?'start':i===1?'gate':legs[i].f):(l.wp&&l.wp[sg.j]?l.wp[sg.j]:legs[i].f);
      const to=q===ds.length-1?(i===0?'gate':l.t):(l.wp&&l.wp[sg.j+1]?l.wp[sg.j+1]:l.t);
      segs.push({leg:i+1,lab:(i+1)+(ds.length>1?String.fromCharCode(97+q):''),spi:t.a>=ST.spiMin,lee:t.side==='SB'?'BB':'SB',from,to,a:t.a,nm:sg.nm,first:q===0,last:q===ds.length-1,c0,c1:cum})})});
  // short, broad-reach gaps between spinnaker legs: keep the spi up
  for(let k=1;k<segs.length-1;k++){const g=segs[k];if(!g.spi&&g.a>=ST.spiMin-30&&g.nm<0.3&&segs[k-1].spi&&segs.slice(k+1).find(x=>x.nm>=0.05)?.spi){g.spi=true;g.keep=true}}
  const runs=[];let cur=null;
  segs.forEach(s=>{if(s.spi){if(!cur){cur={segs:[]};runs.push(cur)}cur.segs.push(s)}else cur=null});
  const sideTxt=x=>`<span class="side ${x.toLowerCase()}">${x==='BB'?'bakboord':'stuurboord'} (${x})</span>`;
  const items=[],ev=[];
  if(!runs.length){return {items:[],ev:[],html:'<div class="none">Geen spinnakerrakken (TWA ≥ '+ST.spiMin+'°) bij deze wind.</div>'}}
  const first=runs[0].segs[0];
  items.push({at:'voor start',html:`<span class="act">KLAARLEGGEN</span>spi klaarleggen aan ${sideTxt(first.lee)}: de lijzijde van het eerste spi-rak (${first.lab}).`});
  runs.forEach((r,ri)=>{
    const a=r.segs[0],z=r.segs[r.segs.length-1];
    items.push({at:'rak '+a.lab,html:`<span class="act">HIJSEN</span>bij ${esc(a.from)}, aan ${sideTxt(a.lee)} (lij).`});
    ev.push({li:a.first?a.leg-2:a.leg-1,along:a.first?Infinity:a.c0,lab:a.lab,kind:'HIJSEN',side:a.lee});
    r.segs.filter(x=>x.keep).forEach(x=>items.push({at:'rak '+x.lab,html:`<span class="act">SPI OP HOUDEN</span>kort ruim stuk (${Math.round(x.a)}°, ${x.nm.toFixed(2)} nm): spi niet strijken.`}));
    for(let k=1;k<r.segs.length;k++){if(r.segs[k].lee!==r.segs[k-1].lee){items.push({at:'rak '+r.segs[k].lab,html:`<span class="act">GIJPEN</span>bij ${esc(r.segs[k].from)}; spi gaat naar ${sideTxt(r.segs[k].lee)}.`});}}
    const nxt=runs[ri+1];
    if(!nxt){items.push({at:'rak '+z.lab,html:`<span class="act">STRIJKEN</span>vóór ${esc(z.to)}, aan ${sideTxt(z.lee)} (lij). Geen spi-rak meer daarna.`});ev.push({li:z.leg-1,along:z.last?Infinity:z.c1,lab:z.lab,kind:'STRIJKEN',side:z.lee});return}
    const want=nxt.segs[0].lee;
    ev.push({li:z.leg-1,along:z.last?Infinity:z.c1,lab:z.lab,kind:'STRIJKEN',side:want});
    if(want===z.lee)items.push({at:'rak '+z.lab,html:`<span class="act">STRIJKEN</span>vóór ${esc(z.to)} aan ${sideTxt(z.lee)} (lijzijde). Ligt dan goed voor het volgende spi-rak ${nxt.segs[0].lab}, ook aan ${sideTxt(want)}.`});
    else items.push({at:'rak '+z.lab,html:`<span class="act">STRIJKEN</span>vóór ${esc(z.to)} aan ${sideTxt(want)}: dat is hier de <b>loefzijde</b> (windward drop). Zo ligt hij klaar voor spi-rak ${nxt.segs[0].lab}, waar ${want} lij is. Lukt loef strijken niet: strijk aan lij en zet tack/schoten om naar ${want} vóór rak ${nxt.segs[0].lab}.`});
  });
  return {items,ev,html:'<ol>'+items.map(it=>`<li><span class="at">${it.at}</span><span>${it.html}</span></li>`).join('')+'</ol>'};
}
const OFFS_NM=10/1852;
function offsetLegs(legs,c){
  // global vertex list; vertices on a buoy are moved 10 m to the side the boat passes
  legs.forEach(l=>{l.p=l.p.map(q=>q.slice())});
  const V=[];   // {li,j,kind,side}
  legs.forEach((l,i)=>{for(let j=(i===0?0:1);j<l.p.length;j++){const last=j===l.p.length-1;let kind='fix',side=null;
    if(i>0&&last){const m=c.marks[i-1];if(m&&m.b&&m.s){kind='mark';side=m.s}}
    else if(i>0&&!last&&l.wp&&l.wp[j])kind='turn';
    V.push({li:i,j,kind,side})}});
  const P=V.map(v=>legs[v.li].p[v.j]);const EN=p=>[p[0],-p[1]];
  const NP=P.map((p,k)=>{const v=V[k];if(v.kind==='fix'||k===0||k===P.length-1)return p;
    const a=EN(P[k-1]),o=EN(p),b=EN(P[k+1]);
    let ux=o[0]-a[0],uy=o[1]-a[1],wx=b[0]-o[0],wy=b[1]-o[1];const lu=Math.hypot(ux,uy)||1,lw=Math.hypot(wx,wy)||1;ux/=lu;uy/=lu;wx/=lw;wy/=lw;
    let dx,dy;const ix=wx-ux,iy=wy-uy,li=Math.hypot(ix,iy);
    if(v.kind==='mark'){let tx=ux+wx,ty=uy+wy;const lt=Math.hypot(tx,ty);if(lt<1e-6){tx=ux;ty=uy}else{tx/=lt;ty/=lt}
      const sg=v.side==='SB'?1:-1;dx=-ty*sg;dy=tx*sg;if(li>0.5&&(-ix/li*dx-iy/li*dy)<0){dx=-ix/li;dy=-iy/li}}
    else{if(li<1e-6)return p;dx=-ix/li;dy=-iy/li}
    const n=Math.hypot(dx,dy)||1;return [o[0]+dx/n*OFFS_NM,-(o[1]+dy/n*OFFS_NM)]});
  V.forEach((v,k)=>{legs[v.li].p[v.j]=NP[k];if(v.j===legs[v.li].p.length-1&&legs[v.li+1])legs[v.li+1].p[0]=NP[k]});
  // recompute courses and distances for the shifted geometry
  legs.forEach((l,i)=>{if(i===0)return;const ns=[];for(let j=1;j<l.p.length;j++){const a=l.p[j-1],b=l.p[j];const dx=b[0]-a[0],dy=-(b[1]-a[1]);const nm=Math.hypot(dx,dy);
      const tw=((Math.atan2(dx,dy)*180/Math.PI)+360)%360;ns.push({nm:+nm.toFixed(2),tw:Math.round(tw),mw:Math.round(((tw-D.decl)%360+360)%360)})}
    l.s=ns;l.nm=+ns.reduce((a,x)=>a+x.nm,0).toFixed(2)});
}
function crsRange(st){return st.span<=4?pad3(st.mw):`${pad3(st.lo)}–${pad3(st.hi)}`}
function subName(l,j){const w=l.wp&&l.wp[j+1];if(j===l.s.length-1)return '→ '+l.t;const sd=l.wps&&l.wps[j+1];return w?'→ langs '+w+(sd?' '+sd+' ⚠':''):(j===0?'→ vaarwater in':'deel '+String.fromCharCode(97+j))}
function boatIcon(tw){const t=twaOf(tw);
  // sail on leeward side: wind from SB -> sail to port (left)
  const dir=t.side==='SB'?-1:1;const col=t.side==='SB'?'var(--green)':'var(--red)';
  const ang=Math.max(6,Math.min(85,t.a*0.5))*Math.PI/180;
  const mx=12,my=13,L=12;const bx=mx+dir*Math.sin(ang)*L,by=my+Math.cos(ang)*L;
  const fx=mx+dir*0.3,fy=3.2; // forestay/head
  const cx=(fx+bx)/2+dir*5*Math.cos(ang*0.6),cy=(fy+by)/2-1;
  const spi=t.a>=ST.spiMin;const ox=-dir*1.5;
  const spiSvg=spi?`<g transform="translate(${ox} 0)"><path d="M4.5 6 C2 -1 7 -5.5 12 -5.5 C17 -5.5 22 -1 19.5 6 Q12 2.5 4.5 6Z" fill="#ff8a00" fill-opacity=".45" stroke="#e06a00" stroke-width="1.3" stroke-linejoin="round"/>
   <line x1="4.5" y1="6" x2="${(6.5-ox).toFixed(1)}" y2="11" stroke="#e06a00" stroke-width=".7"/><line x1="19.5" y1="6" x2="${(17.5-ox).toFixed(1)}" y2="11" stroke="#e06a00" stroke-width=".7"/></g>`:'';
  return `<svg class="boat${spi?' spi':''}" viewBox="${spi?'0 -7 24 39':'0 0 24 32'}" width="26" height="${spi?41:34}" aria-label="${t.side==='SB'?'wind van stuurboord':'wind van bakboord'}${spi?', spinnaker':''}" role="img">${spiSvg}
   <path d="M12 1.5 C17 7 19 14 18.2 25 L5.8 25 C5 14 7 7 12 1.5Z" fill="none" stroke="var(--fair)" stroke-width="1.1"/>
   <path d="M12 5.5 C15 10 16 15 15.5 21 L8.5 21 C8 15 9 10 12 5.5Z" fill="none" stroke="var(--fair)" stroke-width=".6" opacity=".55"/>
   <line x1="12" y1="25" x2="12" y2="30" stroke="var(--ink)" stroke-width="1.2"/>
   <line x1="${mx}" y1="${my}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="var(--ink)" stroke-width="1.4"/>
   <path d="M${fx} ${fy} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>
   <circle cx="${mx}" cy="${my}" r="1.4" fill="var(--ink)"/></svg>`}
const PASS_T='Vaarwaterboei, geen merkteken van de baan. Je passeert hem aan deze zijde volgens art. 9 (genoemd vaarwater). Of je de hoek mag afsnijden is niet zeker: vraag de wedstrijdleiding.';
function sideHtml(m){if(!m||!m.s)return '';return m.auto?`<span class="pill ${sideCls(m.s)} pass" title="${PASS_T}">passeren ${m.s}</span><span class="passnote">vaarwaterboei, geen merkteken</span>`:`<span class="pill ${sideCls(m.s)}">${m.s}</span>`}
function twaHtml(tw){const t=twaOf(tw);return `<span class="twa ${t.side.toLowerCase()}">${Math.round(t.a)}° ${t.side}</span> <span class="pos">${pos(t.a)}</span>`}
let SG_SRC={start:'berekend',gate:'berekend'};
function windInd(){const a=$('wiArrow');if(!a)return;a.setAttribute('transform',`rotate(${ST.twd%360})`);$('wiTxt').textContent=`${pad3(ST.twd)} · ${ST.tws} kn`}
function show(fit){
  const c=D.courses[ST.baan];const wk=String((Math.round(ST.twd/5)*5)%360);
  if(!c.pair.includes(ST.area))ST.area=c.pair[0];
  let S=D.starts[ST.area+'|'+wk];let FIRST=D.first[ST.area+'|'+wk+'|'+c.fk];
  let BEAT={p:[S.start,S.gate],s:[{nm:0.5,tw:+wk,mw:((+wk-D.decl)%360+360)%360}],nm:0.5,flag:S.frac<0.999?`kruisrak niet overal ≥ ${D.mind} m (${Math.round(S.frac*100)}% van de strook)`:''};
  {const sh=pingXY('ship'),pn=pingXY('pin'),gp0=pingXY('gate');const adj=ST.sgAdj[ST.area]||{};
   const as=adj.s?llXY(adj.s[0],adj.s[1]):null,ag=adj.g?llXY(adj.g[0],adj.g[1]):null;
   const ns=(sh&&pn)?[(sh[0]+pn[0])/2,(sh[1]+pn[1])/2]:as,gp=gp0||ag;
   SG_SRC={start:(sh&&pn)?'gepingd':as?'handmatig':'berekend',gate:gp0?'gepingd':ag?'handmatig':'berekend'};
   if(ns||gp){S=Object.assign({},S);if(ns)S.start=ns;if(gp)S.gate=gp;
     const seg=(a,b)=>{const tb=brgT(a,b);return {nm:+Math.hypot(b[0]-a[0],b[1]-a[1]).toFixed(2),tw:Math.round(tb),mw:Math.round(((tb-D.decl)%360+360)%360)}};
     const s0=seg(S.start,S.gate);BEAT={p:[S.start,S.gate],s:[s0],nm:s0.nm,flag:''};
     if(gp){FIRST=JSON.parse(JSON.stringify(FIRST));FIRST.p[0]=gp.slice();FIRST.s[0]=seg(FIRST.p[0],FIRST.p[1]);FIRST.nm=+FIRST.s.reduce((a,b)=>a+b.nm,0).toFixed(2)}}}
  ['A','B','C','D'].forEach(a=>{const b=$('ar'+a);b.disabled=!c.pair.includes(a);b.setAttribute('aria-pressed',a===ST.area?'true':'false')});
  document.querySelectorAll('#areas g').forEach(g=>g.style.display=g.dataset.a===ST.area?'':'none');
  {const inc=new Set(c.marks.map(m=>m.b).filter(Boolean));document.querySelectorAll('#buoys g').forEach(g=>g.classList.toggle('inc',inc.has(g.dataset.n)))}
  let nf=0;document.querySelectorAll('#chips button').forEach(b=>{const n=+b.id.slice(1);const ok=fits(n);if(ok)nf++;b.classList.toggle('off',!ok);b.disabled=!ok&&!ST.allC&&n!==ST.baan;b.title=ok?'':'Volgens het boekje niet bedoeld voor deze windrichting'});
  $('filtHint').textContent=`${nf} banen passen bij wind uit ${wname(ST.twd)} (${ST.twd}°) volgens het boekje.`;
  document.querySelectorAll('#chips button').forEach(b=>b.setAttribute('aria-pressed',b.id==='c'+ST.baan?'true':'false'));
  document.querySelectorAll('#wind button').forEach(b=>b.setAttribute('aria-pressed',Math.round(+b.dataset.w)===ST.twd?'true':'false'));
  $('twdIn').value=ST.twd;$('twdRange').value=ST.twd;
  $('twdHint').textContent=`Wind uit ${wname(ST.twd)} · start en gate berekend voor ${wk}°`;
  const legs=[Object.assign({f:'Start',t:'Gate',via:[],kind:'var'},BEAT),Object.assign({kind:''},FIRST),...c.legs.map(l=>Object.assign({kind:''},l))];
  offsetLegs(legs,c);
  countManoeuvres(legs);
  // fairway corridors used
  const used=[...new Set(legs.flatMap(l=>l.via))];
  const gc=$('corr');gc.innerHTML='';
  used.forEach(f=>{el('path',{class:'corr',d:D.corr[f],'fill-rule':'evenodd'},gc)});
  const g=$('course');g.innerHTML='';
  const gh=el('g',{},g),gl=el('g',{},g),ga=el('g',{},g),gm=el('g',{},g),gt=el('g',{},g);$('toplayer').innerHTML='';const gn=el('g',{},$('toplayer'));const LNPOS=[];
  let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
  const labelled=new Set();
  legs.forEach((l,i)=>{
    const d='M'+l.p.map(p=>p.join(',')).join('L');
    el('path',{class:'halo',d,'data-li':i},gh);
    const cls=l.kind==='var'?'var':l.via.length?'fw':'';
    el('path',{class:'leg '+cls,d,'data-i':i,'data-li':i},gl);
    l.p.forEach(([x,y])=>{minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)});
    let longest=-1,LL=0;
    for(let j=1;j<l.p.length;j++){
      const a=l.p[j-1],b=l.p[j];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L>LL){LL=L;longest=j}
      const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;const ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
      const nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L;
      if(L>0.12){const ar=el('path',{class:'arrow '+cls,d:'M7,0L-5,-5.5L-2,0L-5,5.5Z','data-s':1,'data-li':i},ga);ar.dataset.x=a[0]+(b[0]-a[0])*0.68;ar.dataset.y=a[1]+(b[1]-a[1])*0.68;ar.dataset.a=ang}
      const sg=l.s[j-1];
      let rot=ang;if(rot>90)rot-=180;if(rot<=-90)rot+=180;
      if(sg&&L>0.22){const t=el('text',{class:'crs','data-li':i},gt);t.dataset.x=mx;t.dataset.y=my;t.dataset.nx=nx;t.dataset.ny=ny;t.dataset.rot=rot;t.textContent=pad3(sg.mw)}
    }
    if(longest>0){const a=l.p[longest-1],b=l.p[longest];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);
      let qx=a[0]+(b[0]-a[0])*0.32,qy=a[1]+(b[1]-a[1])*0.32;
      for(const f of [0.62,0.18,0.82,0.45]){if(!LNPOS.some(([x,y])=>Math.hypot(x-qx,y-qy)<0.09))break;qx=a[0]+(b[0]-a[0])*f;qy=a[1]+(b[1]-a[1])*f}
      LNPOS.push([qx,qy]);
      const n=el('g',{class:'legno','data-li':i},gn);el('circle',{cx:qx,cy:qy,r:0.01},n);const t=el('text',{x:qx,y:qy,dy:'0.36em'},n);t.textContent=i+1;
      // fairway name along the leg
      l.via.forEach((f,vi)=>{const key=f+'|'+i;const nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L;
        let rot2=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;if(rot2>90)rot2-=180;if(rot2<=-90)rot2+=180;
        const t2=el('text',{class:'corrlab','data-li':i},gt);t2.dataset.x=a[0]+(b[0]-a[0])*0.5;t2.dataset.y=a[1]+(b[1]-a[1])*0.5;t2.dataset.nx=-nx;t2.dataset.ny=-ny;t2.dataset.o=16+vi*16;t2.dataset.rot=rot2;t2.textContent='via '+f})}
  });
  // start line + gate
  const [sx,sy]=S.start,[gx,gy]=S.gate;const gLen=Math.hypot(gx-sx,gy-sy)||0.5;const ux=(gx-sx)/gLen,uy=(gy-sy)/gLen;const px=-uy,py=ux;
  {const sh=pingXY('ship'),pn=pingXY('pin');
   if(sh&&pn){el('line',{class:'sline',x1:sh[0],y1:sh[1],x2:pn[0],y2:pn[1]},gm);
     for(const [q,lab] of [[sh,'Startschip'],[pn,'Pin']]){el('circle',{class:'pingmk','data-r':5,cx:q[0],cy:q[1]},gm);const t=el('text',{class:'lab'},el('g',{class:'mk'},gm));t.dataset.x=q[0];t.dataset.y=q[1];t.textContent=lab}}
   else el('line',{class:'sline',x1:sx-px*0.07,y1:sy-py*0.07,x2:sx+px*0.07,y2:sy+py*0.07},gm)}
  for(const s of [-1,1]){el('circle',{class:'gateb','data-r':4.5,cx:gx+px*0.025*s,cy:gy+py*0.025*s},gm)}
  {const t=el('text',{class:'lab'},el('g',{class:'mk'},gm));t.dataset.x=gx;t.dataset.y=gy;t.textContent=ST.pings.gate?'Gate (gepingd)':'Gate'}
  {const t=el('text',{class:'lab'},el('g',{class:'mk'},gm));t.dataset.x=sx;t.dataset.y=sy;t.textContent='Start'}
  {const tr=ST.twd*Math.PI/180;const wx0=Math.sin(tr),wy0=-Math.cos(tr);const wx=gx+wx0*0.2,wy=gy+wy0*0.2;
   const a=el('path',{class:'arrow fw',d:'M7,0L-5,-5.5L-2,0L-5,5.5Z','data-s':1.6},gm);a.dataset.x=wx-wx0*0.05;a.dataset.y=wy-wy0*0.05;a.dataset.a=Math.atan2(-wy0,-wx0)*180/Math.PI;
   const t=el('text',{class:'wtag',x:wx+wx0*0.05,y:wy+wy0*0.05},gm);t.textContent=`wind ${ST.twd}°`}
  {const hg=el('g',{class:'sgh-g'},gm);for(const [k,q] of [['gate',S.gate],['start',S.start]])el('circle',{class:'sgh','data-r':15,'data-k':k,cx:q[0],cy:q[1]},hg)}
  {const dc=distCrs(S.start,S.gate,D.decl);if(document.activeElement!==$('sgDist'))$('sgDist').value=dc.nm.toFixed(2);if(document.activeElement!==$('sgCrs'))$('sgCrs').value=Math.round(dc.mw)%360;
   $('sgHint').textContent=`Start ${SG_SRC.start}, gate ${SG_SRC.gate}. Sleep de lichtblauwe cirkels op de kaart om ze te verplaatsen.`;$('sgReset').hidden=!ST.sgAdj[ST.area]}
  windInd();
  startBox={x:Math.min(sx,gx)-0.15,y:Math.min(sy,gy)-0.15,w:Math.abs(gx-sx)+0.3,h:Math.abs(gy-sy)+0.3};
  // finish (schematic per booklet)
  {const [fx,fy]=D.finish.ship,[bx,by]=D.finish.buoy;
   el('line',{class:'fline',x1:fx,y1:fy,x2:bx,y2:by,'stroke-dasharray':'0.01 0.006'},gm);
   const sh=el('path',{class:'fship',d:'M-6,-2L6,-2L4,3L-4,3Z M0,-2L0,-11L6,-8L0,-6','data-s':1},gm);sh.dataset.x=fx;sh.dataset.y=fy;
   el('circle',{class:'fbuoy','data-r':4.5,cx:bx,cy:by},gm);
   const g2=el('g',{class:'mk'},gm);const t=el('text',{class:'lab'},g2);t.dataset.x=bx;t.dataset.y=by;t.textContent='Finish'}
  const seen={};
  c.marks.forEach((m)=>{
    if(m.l==='Finish')return;
    const g2=el('g',{class:'mk'},gm);
    el('circle',{class:'ring '+sideCls(m.s)+(m.auto?' passring':''),'data-r':9,cx:m.x,cy:m.y},g2);if(m.auto)el('title',{},g2).textContent=PASS_T;
    const key=m.b||m.l;seen[key]=(seen[key]||0)+1;
    if(seen[key]===1){const t=el('text',{class:'lab'},g2);t.dataset.x=m.x;t.dataset.y=m.y;t.dataset.key=key;t.textContent=m.l.replace(/\s*\(gele ton\)/i,'').replace(/[‘’']/g,'')}
    else{const t=gm.querySelector(`text[data-key="${CSS.escape(key)}"]`);if(t)t.textContent=t.textContent.replace(/ ×\d+$/,'')+' ×'+seen[key]}
  });
  curBox={x:minx,y:miny,w:maxx-minx,h:maxy-miny};
  const total=legs.reduce((s,l)=>s+l.nm,0);
  const flags=legs.filter(l=>l.flag).length;
  $('info').innerHTML=`<div class="big">Baan ${ST.baan}</div><div>${esc(c.title)}</div>${c.mod?`<div class="modnote">⚠ ${esc(c.mod)}</div>`:''}
   <div class="kv"><span>Boekje</span><span>${esc(c.dist)}</span></div>
   <div class="kv"><span>Langs de lijn</span><span>${total.toFixed(1)} nm</span></div>
   <div class="kv"><span>Zeiltijd (polar)</span><span><b>${fmtT(legs.reduce((a,l)=>a+legTime(l),0))}</b></span></div>
   <div class="kv"><span>Manoeuvres</span><span>${(()=>{const T=legs.reduce((a,l)=>a+l._man.t,0),G=legs.reduce((a,l)=>a+l._man.g,0),L=legs.reduce((a,l)=>a+l._man.loss,0);return `${T}× ↺ ${G}× ⤺ +${fmtT(L)}`})()}</span></div>
   <div class="kv"><span>Gem. snelheid</span><span>${(total/legs.reduce((a,l)=>a+legTime(l),0)).toFixed(1)} kn</span></div>
   <div class="kv"><span>Wind / start</span><span>${ST.twd}° ${wname(ST.twd)} / veld ${ST.area}</span></div>
   ${fits(ST.baan)?'':'<div class="warn">Deze baan is volgens het boekje niet bedoeld voor deze windrichting.</div>'}<div style="display:none"></div>
   ${flags?`<div class="warn">${flags} rak${flags>1?'ken':''} met een opmerking, zie tabel</div>`:''}
   <div>${used.map(v=>`<span class="pill via">${v}</span>`).join('')||'<span class="sub">Geen vaarwater genoemd</span>'}</div>`;
  $('logh').textContent=`Rakken baan ${ST.baan} · ware wind ${ST.twd}° (${wname(ST.twd)})`;
  $('lpTitle').textContent=`Rakken baan ${ST.baan} · TWD ${ST.twd}° · ${ST.tws} kn`;
  const toName=(l,i)=>i===0?'Gate (kruisrak)':l.t;
  $('legs').innerHTML=legs.map((l,i)=>{const m=i===0?{s:''}:c.marks[i-1];
    const segs=(l.s.length>1?(()=>{const st=legStats(l),t=twaOf(st.tw);return `<span class="sn"><b>gemiddeld</b>${st.span>4?' ('+crsRange(st)+')':''}</span><span class="r"><b>${pad3(st.mw)}</b></span><span class="r">${l.nm.toFixed(2)} nm</span><span class="r">${Math.round(t.a)}°</span><span class="pos ptype">${boatIcon(st.tw)}${pos(t.a)}</span>`})():'')+(l.s.length>1?dispSegs(l):l.s).map((sg,j)=>{const t=twaOf(sg.tw);return `<span class="sn">${l.s.length>1?esc(subName(l,sg.j)):''}</span><span class="r">${pad3(sg.mw)}</span><span class="r">${sg.nm.toFixed(2)} nm</span><span class="r">${Math.round(t.a)}°</span><span class="pos ptype">${boatIcon(sg.tw)}${pos(t.a)}</span>`}).join('');
    return `<tr data-i="${i}"><td class="num">${i+1}</td><td>${esc(i===0?'Start':i===1?'Gate':l.f)}</td><td>${esc(toName(l,i))}</td><td>${sideHtml(m)}</td><td>${l.via.map(v=>`<span class="pill via">${v}</span>`).join('')}</td><td><div class="sg">${segs}</div>${l.flag?`<div class="warn">${esc(l.flag)}</div>`:''}</td><td class="num">${l.nm.toFixed(2)}</td><td class="num">${fmtT(legTime(l))}${manTxt(l._man)?`<div class="pos">${manTxt(l._man)}</div>`:''}</td></tr>`}).join('');
  const twaCell=tw=>{const t=twaOf(tw);return `<td class="r m">${Math.round(t.a)}°</td><td class="pos"><span class="ptype">${boatIcon(tw)}<span class="ptxt">${pos(t.a)}</span></span></td>`};
  $('lpBody').innerHTML=legs.map((l,i)=>{
    const mk=i===0?null:(c.marks[i-1]||{});const sd=mk?mk.s||'':'';
    const rd=`<td>${sd?sideHtml(mk):(i===0?'<span class="pos">door gate</span>':'<span class="pos">finishlijn</span>')}</td>`;
    const to=`<td class="to" title="${esc(toName(l,i))}">${esc(toName(l,i))}${l.via.length?`<small>via ${esc(l.via.join(', '))}</small>`:''}</td>`;
    if(l.s.length===1){const sg=l.s[0];return `<tr data-i="${i}"><td class="no">${i+1}</td>${to}${rd}${twaCell(sg.tw)}<td class="r m k">${pad3(sg.mw)}</td><td class="r m nm">${l.nm.toFixed(2)}</td><td class="r m tm" title="${esc(manTxt(l._man))}">${fmtT(legTime(l))}${l._man&&(l._man.t||l._man.g)?`<small class="rng">${l._man.t?l._man.t+'×↺':''}${l._man.g?' '+l._man.g+'×⤺':''}</small>`:''}</td></tr>`}
    const st=legStats(l);const ds=dispSegs(l);
    return `<tr data-i="${i}" class="parent multi" title="Klik voor de deelrakken"><td class="no">${i+1}<span class="tg">▸</span></td>${to}${rd}${twaCell(st.tw)}<td class="r m k">${pad3(st.mw)}<small class="rng">${st.span>4?crsRange(st):''}</small></td><td class="r m nm">${l.nm.toFixed(2)}</td><td class="r m tm" title="${esc(manTxt(l._man))}">${fmtT(legTime(l))}${l._man&&(l._man.t||l._man.g)?`<small class="rng">${l._man.t?l._man.t+'×↺':''}${l._man.g?' '+l._man.g+'×⤺':''}</small>`:''}</td></tr>`+
      ds.map((sg,q)=>`<tr data-i="${i}" class="subrow" data-p="${i}" hidden><td class="no">${i+1}${String.fromCharCode(97+q)}</td><td>${esc(subName(l,sg.j))}</td><td></td>${twaCell(sg.tw)}<td class="r m k">${pad3(sg.mw)}</td><td class="r m nm">${sg.nm.toFixed(2)}</td><td class="r m tm">${fmtT(segTime(sg))}</td></tr>`).join('')}).join('');
  document.querySelectorAll('#lpBody tr.multi').forEach(tr=>tr.onclick=()=>{const open=!tr.classList.contains('open');tr.classList.toggle('open',open);document.querySelectorAll(`#lpBody tr.subrow[data-p="${tr.dataset.i}"]`).forEach(r=>r.hidden=!open)});
  $('lpTot').textContent=total.toFixed(1);const TT=legs.reduce((a,l)=>a+legTime(l),0);$('lpTotT').textContent=fmtT(TT);
  {const sp=spiPlan(legs);$('spiPlan').innerHTML='<h3>Spinnaker-plan</h3>'+sp.html;CUR_SPI=sp}
  document.querySelectorAll('#legs tr,#lpBody tr').forEach(tr=>{tr.onmouseenter=()=>hl(+tr.dataset.i);tr.onmouseleave=()=>hl(-1)});
  if(!$('tCrs').checked)document.querySelectorAll('.crs').forEach(t=>t.style.display='none');
  CUR={legs,c,S,total,used};
  try{renderFleet()}catch(e){}
  if(LV.baan!==ST.baan){LV.i=-1;LV.baan=ST.baan;NAV.leg=0}
  if(LV.i>=legs.length)LV.i=-1;if(NAV.leg>=legs.length)NAV.leg=0;
  markFocus();
  if(LV.i>=0){if(fit)fitLeg();else applyVB()}else{if(fit)fitTo(curBox);else applyVB()}
  try{gpsUpdate()}catch(e){}
  try{markCurLeg(false)}catch(e){}
}

// ---------- per-rak weergave ----------
const LV={i:-1,baan:null};
function legBox(l,extra){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const pts=extra?[...l.p,extra]:l.p;for(const [x,y] of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}const m=0.08,MIN=0.6;let w=x1-x0+2*m,h=y1-y0+2*m;const cx=(x0+x1)/2,cy=(y0+y1)/2;w=Math.max(w,MIN);h=Math.max(h,MIN);return {x:cx-w/2,y:cy-h/2,w,h}}
function fitLeg(){if(!CUR||LV.i<0)return;const l=CUR.legs[LV.i];fitTo(legBox(l,G.on&&G.xy&&G.follow?G.xy:null),0.18)}
function markFocus(){
  $('map').classList.toggle('legfocus',LV.i>=0);
  document.querySelectorAll('#map [data-li]').forEach(e=>e.classList.toggle('lf',+e.dataset.li===LV.i));
  $('legNav').classList.toggle('on',LV.i>=0);
  if(!CUR||LV.i<0){$('lnLab').textContent='Per rak';$('legInfo').hidden=true;return}
  const n=CUR.legs.length,l=CUR.legs[LV.i],c=CUR.c;
  $('lnLab').textContent=`Rak ${LV.i+1} / ${n}`;
  const st=l.s.length>1?legStats(l):{mw:l.s[0].mw,tw:l.s[0].tw,span:0};const t=twaOf(st.tw);
  const mk=LV.i===0?null:(c.marks[LV.i-1]||{});const to=LV.i===0?'Gate (kruisrak)':l.t;
  const side=mk&&mk.s?(mk.auto?`passeren ${mk.s}`:`ronden ${mk.s}`):(LV.i===0?'door de gate':'finishlijn');
  $('legInfo').innerHTML=`<div class="t">Rak ${LV.i+1}: ${esc(LV.i===0?'Start':LV.i===1?'Gate':l.f)} → ${esc(to)}</div>
   ${l.via.length?`<div class="sub">via ${esc(l.via.join(', '))}</div>`:''}
   <div>Koers <span class="m"><b>${pad3(st.mw)}</b>${st.span>4?' ('+crsRange(st)+')':''}</span> · TWA <span class="m">${Math.round(t.a)}°</span> ${pos(t.a)}</div>
   <div><span class="m">${l.nm.toFixed(2)} nm</span> · <span class="m">${fmtT(legTime(l))}</span> · ${esc(side)}</div>`;
  $('legInfo').hidden=false;
}
function setLeg(i,refit=true){if(!CUR)return;const n=CUR.legs.length;const was=LV.i;LV.i=i<0?-1:Math.min(n-1,i);
  if(window.innerWidth>=760){const lp=$('legsPanel');if(was<0&&LV.i>=0){LV.panel=lp.open;lp.open=false}else if(was>=0&&LV.i<0&&LV.panel!=null){lp.open=LV.panel;LV.panel=null}}if(LV.i>=0&&G.on){NAV.leg=LV.i;gpsUpdate()}markFocus();if(refit){if(LV.i>=0)fitLeg();else fitTo(curBox)}}
$('lnPrev').onclick=()=>setLeg(LV.i<0?0:Math.max(0,LV.i-1));
$('lnNext').onclick=()=>setLeg(LV.i<0?0:LV.i+1);
$('lnLab').onclick=()=>setLeg(LV.i<0?(G.on?NAV.leg:0):-1);
document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test((e.target.tagName||''))||$('tabKaart').hidden)return;
  if(e.key==='ArrowRight'&&LV.i>=0){setLeg(LV.i+1);e.preventDefault()}else if(e.key==='ArrowLeft'&&LV.i>=0){setLeg(Math.max(0,LV.i-1));e.preventDefault()}else if(e.key==='Escape'&&LV.i>=0){setLeg(-1)}});
document.getElementById('lpBody').addEventListener('click',e=>{const td=e.target.closest('td.no');if(!td)return;const tr=td.closest('tr');e.stopPropagation();setLeg(+tr.dataset.i)},true);

// ---------- GPS ----------
const G={on:false,watch:null,xy:null,acc:null,sog:null,cog:null,prev:null,trail:[],follow:true,wake:null,last:0};
const NAV={leg:0};
const ARRIVE_NM=0.03;   // ~55 m: dichterbij dan dit -> volgend rak
function gpsEls(){const g=$('gpsL');if(g.firstChild)return;
  el('polyline',{class:'gpstrail',id:'gTrail',points:''},g);
  el('line',{class:'gpsnext',id:'gNext',style:'stroke-width:0'},g);
  el('circle',{class:'gpsacc',id:'gAcc',r:0},g);
  el('line',{class:'gpscog',id:'gCogL',style:'display:none'},g);
  el('circle',{class:'gpspulse',id:'gPulse',r:0},g);el('path',{class:'gpsboat',id:'gBoat',d:'M10,0L-7,6.5L-3.5,0L-7,-6.5Z'},g)}
function gpsDraw(){if(!G.xy)return;const k=K;const [x,y]=G.xy;
  $('gAcc').setAttribute('cx',x);$('gAcc').setAttribute('cy',y);$('gAcc').setAttribute('r',Math.max(G.acc||0,1)/1852);$('gAcc').style.strokeWidth=k*1+'px';
  const a=(G.cog==null?0:G.cog)-90;$('gBoat').setAttribute('transform',`translate(${x},${y}) rotate(${a}) scale(${k*2.4})`);$('gPulse').setAttribute('cx',x);$('gPulse').setAttribute('cy',y);$('gPulse').setAttribute('r',k*26);$('gPulse').style.strokeWidth=k*5+'px';$('gBoat').style.strokeWidth=1.4/2.4+'px';$('gBoat').style.opacity=G.cog==null?0.6:1;
  const L=0.25;if(G.cog!=null){const r=G.cog*Math.PI/180;$('gCogL').setAttribute('x1',x);$('gCogL').setAttribute('y1',y);$('gCogL').setAttribute('x2',x+Math.sin(r)*L);$('gCogL').setAttribute('y2',y-Math.cos(r)*L);$('gCogL').style.strokeWidth=k*2+'px';$('gCogL').style.strokeDasharray=`${k*6} ${k*4}`;$('gCogL').style.display=''}else $('gCogL').style.display='none';
  $('gTrail').setAttribute('points',G.trail.map(p=>p.join(',')).join(' '));$('gTrail').style.strokeWidth=k*2+'px';
  $('gNext').style.strokeWidth=k*1.6+'px';$('gNext').style.strokeDasharray=`${k*3} ${k*3}`}
function legProgress(l,xy){let best=null,acc=0;
  for(let j=1;j<l.p.length;j++){const a=l.p[j-1],b=l.p[j];const dx=b[0]-a[0],dy=b[1]-a[1];const L2=dx*dx+dy*dy||1e-12;let t=((xy[0]-a[0])*dx+(xy[1]-a[1])*dy)/L2;t=Math.max(0,Math.min(1,t));
    const q=[a[0]+dx*t,a[1]+dy*t];const d=Math.hypot(xy[0]-q[0],xy[1]-q[1]);const L=Math.sqrt(L2);
    if(!best||d<best.d)best={d,j,along:acc+L*t,q};acc+=L}
  let rem=0;for(let j=best.j;j<l.p.length;j++){const a=j===best.j?best.q:l.p[j-1],b=l.p[j];rem+=Math.hypot(b[0]-a[0],b[1]-a[1])}
  return {...best,rem,next:l.p[best.j],xte:best.d}}
function gpsUpdate(){if(!G.on||!G.xy||!CUR)return;
  let l=CUR.legs[NAV.leg];let pr=legProgress(l,G.xy);
  // aankomst: dicht bij het einde van het rak -> automatisch volgend rak
  let moved=false;
  for(let guard=0;guard<5&&NAV.leg<CUR.legs.length-1&&!(G.started===false&&NAV.leg===0);guard++){
    const len=pr.along+pr.rem;const nl=CUR.legs[NAV.leg+1];const pr2=legProgress(nl,G.xy);
    const arrived=pr.rem<ARRIVE_NM||(pr.along>0.8*len&&pr2.d+0.005<pr.d);
    if(!arrived)break;NAV.leg++;l=nl;pr=pr2;moved=true}
  if(moved&&LV.i>=0){LV.i=NAV.leg;markFocus();fitLeg()}
  if(moved||G.lastCur!==NAV.leg){G.lastCur=NAV.leg;markCurLeg(true)}
  // volgend routepunt: sla punten over die vlakbij liggen
  let nx=pr.next;if(Math.hypot(G.xy[0]-nx[0],G.xy[1]-nx[1])<ARRIVE_NM&&pr.j<l.p.length-1)nx=l.p[pr.j+1];
  const btw=brgT(G.xy,nx),dtw=Math.hypot(nx[0]-G.xy[0],nx[1]-G.xy[1]);
  const c=CUR.c,mk=NAV.leg===0?null:(c.marks[NAV.leg-1]||{});const to=NAV.leg===0?'Gate':l.t;
  const isEnd=nx===l.p[l.p.length-1];
  $('gTo').textContent=`Rak ${NAV.leg+1}/${CUR.legs.length} → ${isEnd?to:'routepunt '+(pr.j)+' van '+(l.p.length-1)}${isEnd&&mk&&mk.s?` (${mk.auto?'pass.':'rond'} ${mk.s})`:''}`;
  $('gBtw').textContent=pad3(btw-D.decl).replace('°','');$('gDtw').textContent=dtw.toFixed(2);
  // countdown tot de volgende boeironding (einde van dit rak)
  {const a=l.p[Math.max(0,pr.j-1)],b=l.p[pr.j];const segB=brgT(a,b);
   let v=null;if(G.sog!=null&&G.cog!=null)v=G.sog*Math.cos((G.cog-segB)*Math.PI/180);else if(G.sog!=null)v=G.sog;
   if(v!=null){G.vmc=G.vmc==null?v:G.vmc*0.85+v*0.15}
   const legLen=pr.along+pr.rem||l.nm;let etaH,src;
   if(G.vmc!=null&&G.vmc>0.5){etaH=pr.rem/G.vmc;src='op je snelheid richting boei'}else{etaH=legTime(l)*(pr.rem/(legLen||1));src='schatting polar'}
   const k=G.demo?demoSpd():1;G.cdTarget=Date.now()+etaH*3600000/k;G.cdSrc=src+(G.demo?` · proefvaart ×${k}`:'');
   const markName=NAV.leg===0?'de gate':(NAV.leg===CUR.legs.length-1?'de finish':l.t);
   const side=mk&&mk.s?(mk.auto?` (pass. ${mk.s})`:` (rond ${mk.s})`):'';
   if(!(RACE.start&&Date.now()<RACE.start&&!G.demo))$('gCdTo').textContent=`einde rak ${NAV.leg+1}: ${markName}${side}`;G.cdLeg=NAV.leg;G.pr=pr;cdTick()}
  const eta=G.sog>0.5?pr.rem/G.sog:null;
  $('gRem').textContent=`Rest rak ${pr.rem.toFixed(2)} nm${eta?` · ±${fmtT(eta)}`:''} · ${Math.round(pr.xte*1852)} m naast lijn${isEnd?'':` · daarna ${to}`}`;
  $('gNext').setAttribute('x1',G.xy[0]);$('gNext').setAttribute('y1',G.xy[1]);$('gNext').setAttribute('x2',nx[0]);$('gNext').setAttribute('y2',nx[1]);
  gpsDraw()}
function spiAlert(){if(!G.on||G.cdTarget==null||!CUR_SPI||!CUR_SPI.ev||!G.pr||G.started===false)return;
  const li=G.cdLeg,l=CUR.legs[li];if(!l)return;const pr=G.pr;const tEnd=(G.cdTarget-Date.now())/1000*(G.demo?demoSpd():1);
  const polyLen=pr.along+pr.rem,nmSum=l.s.reduce((a,b)=>a+b.nm,0)||polyLen;
  for(const e of CUR_SPI.ev){if(e.li!==li)continue;const key=ST.baan+'|'+ST.twd+'|'+li+'|'+e.kind+'|'+e.lab;if(G.spiDone&&G.spiDone.has(key))continue;
    const at=e.along===Infinity?polyLen:e.along*polyLen/nmSum;const dist=at-pr.along;if(dist<-0.02)continue;
    const t=pr.rem>0.001?tEnd*Math.max(0,dist)/pr.rem:0;if(t>ST.spiLead*60)continue;
    (G.spiDone||(G.spiDone=new Set())).add(key);
    $('spK').textContent=e.kind==='HIJSEN'?'Hijsen':'Strijken';
    $('spSide').textContent=e.side==='BB'?'Bakboord':'Stuurboord';$('spSide').className='sp-side '+e.side.toLowerCase();
    $('spiPop').hidden=false;speak(spiKeys(e.kind,e.side),`Spinnaker ${e.kind==='HIJSEN'?'hijsen':'strijken'}, ${e.side==='BB'?'bakboord':'stuurboord'}`);
    try{navigator.vibrate&&navigator.vibrate([300,150,300])}catch(_){}
    try{const ac=G.ac||(G.ac=new (window.AudioContext||window.webkitAudioContext)());[0,0.35].forEach(d=>{const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=880;g.gain.value=0.25;o.connect(g);g.connect(ac.destination);o.start(ac.currentTime+d);o.stop(ac.currentTime+d+0.25)})}catch(_){}
    clearTimeout(G.spiTimer);G.spiTimer=setTimeout(()=>{$('spiPop').hidden=true},G.demo?6000:60000);break}}
$('spOk').onclick=()=>{$('spiPop').hidden=true};
// ---------- startprocedure, stopwatch, racemodus ----------
$('spiLeadIn').value=ST.spiLead;$('spiLeadIn').addEventListener('change',e=>{const v=Math.round(+e.target.value);if(v>=1&&v<=15){ST.spiLead=v;}else e.target.value=ST.spiLead});
const tStr=ms=>new Date(ms).toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
// Racetoestand: start/finish staan in de centrale store (persistent); 'fired' is alleen runtime.
const RACE={fired:new Set(),
  get start(){return ST.race.start},set start(v){store.set({race:{...ST.race,start:v}})},
  get fin(){return ST.race.fin},set fin(v){store.set({race:{...ST.race,fin:v}})}};
function saveRace(){}
function setSig5(ms){RACE.start=ms+300000;RACE.fin=null;RACE.fired=new Set();saveRace();sig5Show();if(Date.now()<RACE.start){G.started=false;NAV.leg=0;G.spiDone=null;G.nxDone=null}$('dlOver').value='';try{showResult()}catch(e){}}
function sig5Show(){if(RACE.start){const d=new Date(RACE.start-300000);$('sig5In').value=d.toTimeString().slice(0,8);$('sig5Hint').textContent=`Start om ${tStr(RACE.start)} · signalen op 4 min, 1 min en 10 s`}else{$('sig5Hint').textContent=''}}
$('sig5In').addEventListener('change',e=>{const v=e.target.value;if(!v){RACE.start=null;saveRace();sig5Show();return}const [h,m,x]=v.split(':').map(Number);const d=new Date();d.setHours(h,m,x||0,0);setSig5(d.getTime())});
$('sig5Now').onclick=()=>{unlockAudio();setSig5(Date.now())};
sig5Show();
// ---------- stem: beste Nederlandse (vrouwen)stem, door de gebruiker te kiezen ----------
let NLV=null,NLVS=[];
function pickVoice(){try{NLVS=rankVoices(speechSynthesis.getVoices());NLV=NLVS.find(v=>v.name===ST.voiceName)||NLVS[0]||null;fillVoices()}catch(e){}}
function fillVoices(){const sel=$('voiceSel');if(!sel)return;
  sel.innerHTML=NLVS.length?NLVS.map(v=>`<option value="${esc(v.name)}"${NLV&&v.name===NLV.name?' selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join(''):'<option value="">geen Nederlandse stem gevonden</option>';
  $('voiceHint').textContent=NLVS.length?`${NLVS.length} Nederlandse stem${NLVS.length>1?'men':''} op dit apparaat.`:'Dit apparaat heeft geen Nederlandse stem. Zie Uitleg.'}
try{pickVoice();speechSynthesis.onvoiceschanged=pickVoice;setTimeout(pickVoice,800);setTimeout(pickVoice,2500)}catch(e){}
function say(txt,cut,force){if(!ST.voice&&!force)return;try{const ss=window.speechSynthesis;if(!ss)return;if(cut)ss.cancel();const u=new SpeechSynthesisUtterance(txt);u.lang=NLV?NLV.lang:'nl-NL';if(NLV)try{u.voice=NLV}catch(_){};u.rate=cut?1.1:0.95;u.pitch=1;u.volume=1;ss.speak(u)}catch(e){}}
// ingesproken fragmenten gaan voor; ontbreekt er iets, dan spreekt de telefoonstem
const CLIPSX=initClips({getCtx:()=>{unlockAudio();return G.ac},onChange:()=>{try{clipShow()}catch(e){}}});
window.__clips=CLIPSX;
function speak(keys,txt,cut,force){if(!ST.voice&&!force)return;if(keys&&CLIPSX.play(keys,cut))return;say(txt,cut,force)}
function clipShow(){const n=CLIPSX.count(),t=CLIPSX.total;$('recInfo').textContent=n?`Eigen opnames: ${n} van ${t} ingesproken${n<t?' (meldingen waarvan een stukje ontbreekt, gebruiken de telefoonstem)':' — alle meldingen gebruiken je eigen stem'}.`:'Nog geen eigen opnames: de telefoonstem spreekt.'}
function voiceShow(){const b=$('rbVoice');b.setAttribute('aria-pressed',ST.voice?'true':'false');b.textContent=ST.voice?'stem aan':'stem uit'}
$('rbVoice').onclick=()=>{ST.voice=!ST.voice;voiceShow();unlockAudio();if(ST.voice)speak(['stemaan'],'stem aan',true)};
voiceShow();
let WL=null;async function wakeLock(on){try{if(on){if(!WL&&navigator.wakeLock){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}}else if(WL){await WL.release();WL=null}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ST.tab==='Race')wakeLock(true)});
function unlockAudio(){try{if(window.speechSynthesis&&!G.spk){G.spk=1;const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}}catch(_){}try{if(!G.ac)G.ac=new (window.AudioContext||window.webkitAudioContext)();G.ac.resume()}catch(_){}}
function beep(n,freq=880,dur=0.22,gap=0.32){try{const ac=G.ac||(G.ac=new (window.AudioContext||window.webkitAudioContext)());for(let i=0;i<n;i++){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;g.gain.value=0.3;o.connect(g);g.connect(ac.destination);o.start(ac.currentTime+i*gap);o.stop(ac.currentTime+i*gap+dur)}}catch(_){}try{navigator.vibrate&&navigator.vibrate(n>1?[250,120,250]:400)}catch(_){}}
function raceTick(){const now=Date.now();const pre=RACE.start&&now<RACE.start;
  if(RACE.start&&!RACE.fin){const left=(RACE.start-now)/1000;
    const due=dueSignals(left,RACE.fired,ST.voice);due.beeps.forEach(b=>beep(b.n,b.f,b.d,.35));due.calls.forEach(c=>speak(countdownKeys(c.t),c.txt,c.quick));
    if(left<=0&&G.started===false){G.started=true}}
  $('raceRow').hidden=!(G.on&&RACE.start&&now>=RACE.start);
  if(!$('raceRow').hidden){$('raceClock').textContent=hms((RACE.fin||now)-RACE.start);$('finBtn').hidden=!!RACE.fin;$('raceLab').textContent=RACE.fin?'Gezeild':'Race'}
  rbClock(now);
  return pre}
function showResult(){if(!RACE.fin){$('raceRes').hidden=true;return}const el=(RACE.fin-RACE.start)/60000;const myf=+$('dlMy').value||DM0;
  $('raceRes').innerHTML=`<b>Finish ${tStr(RACE.fin)}</b><br>Gezeild ${hms(RACE.fin-RACE.start)} · gecorrigeerd ${hms(el*myf*60000)} (× ${myf.toFixed(4)})<br><button id="resGo" type="button">Marges t.o.v. deelnemers →</button> <button id="resUndo" type="button">herstel</button>`;
  $('raceRes').hidden=false;$('resGo').onclick=()=>setTab('Deeln');$('resUndo').onclick=()=>{RACE.fin=null;saveRace();$('dlOver').value='';showResult();renderFleet()}}
$('finBtn').onclick=()=>{if(!RACE.start)return;RACE.fin=Date.now();saveRace();$('dlOver').value=((RACE.fin-RACE.start)/60000).toFixed(2);beep(1,660,.8);showResult();try{renderFleet()}catch(e){}};
setInterval(raceTick,250);
function raceMode(on){document.body.classList.toggle('race',on);try{PANELS&&PANELS.apply()}catch(e){}try{applyVB()}catch(e){}}
$('raceBtn').onclick=()=>{setTab('Race');setTimeout(()=>{$('chart').scrollIntoView({block:'start'})},50)};
function rbSync(){$('rbTwdR').value=Math.round(ST.twd/5)*5%360;$('rbTwd').textContent=pad3(ST.twd);$('rbTwsR').value=ST.tws;$('rbTws').textContent=ST.tws+' kn';$('rbEffR').value=ST.eff;$('rbEff').textContent=ST.eff+'%';$('rbSig5').value=RACE.start?new Date(RACE.start-300000).toTimeString().slice(0,8):''}
$('rbEffR').addEventListener('input',e=>{$('rbEff').textContent=e.target.value+'%'});
$('rbEffR').addEventListener('change',e=>{$('effIn').value=e.target.value;setTws();rbSync()});
$('rbSigNow').onclick=()=>{unlockAudio();setSig5(Date.now());rbSync();raceTick()};
$('rbSig5').addEventListener('change',e=>{unlockAudio();const v=e.target.value;if(!v)return;const [h,m,x]=v.split(':').map(Number);const d=new Date();d.setHours(h,m,x||0,0);if(d.getTime()<Date.now()-3600e3)d.setDate(d.getDate()+1);setSig5(d.getTime());rbSync();raceTick()});
$('rbSigClr').onclick=()=>{RACE.start=null;RACE.fin=null;saveRace();sig5Show();showResult();rbSync();raceTick()};
$('rbFin').onclick=()=>$('finBtn').onclick();
let LEGFILL=false;$('legBtn').onclick=()=>{const lp=$('legPop');if(!LEGFILL){$('legPopBody').innerHTML=document.querySelector('#legendBox .legend').innerHTML.replace(/ id="[^"]*"/g,'');LEGFILL=true}lp.hidden=!lp.hidden;$('legBtn').setAttribute('aria-pressed',lp.hidden?'false':'true')};
$('legPopX').onclick=()=>{$('legPop').hidden=true;$('legBtn').setAttribute('aria-pressed','false')};
function rbClock(now){const el=$('rbClock');const c=document.body.classList.contains('race')?clockState(now,RACE.start,RACE.fin):null;if(!c){el.hidden=true;return}
  el.hidden=false;el.classList.toggle('run',c.phase==='run');['soon','now','go'].forEach(k=>el.classList.toggle(k,c.cls===k));
  $('rbClkLab').textContent=c.label;$('rbClkT').textContent=c.phase==='pre'?c.text:hms(c.elapsed);
  $('rbClkAt').textContent=c.phase==='fin'?'finish '+tStr(RACE.fin):'start '+tStr(RACE.start);$('rbFin').hidden=c.phase!=='run'}
$('rbTwdR').addEventListener('input',e=>{$('rbTwd').textContent=pad3(+e.target.value)});
$('rbTwdR').addEventListener('change',e=>{setTwd(+e.target.value);rbSync()});
$('rbTwsR').addEventListener('input',e=>{$('rbTws').textContent=e.target.value+' kn'});
$('rbTwsR').addEventListener('change',e=>{$('twsIn').value=e.target.value;setTws();rbSync()});
function markCurLeg(scroll){const i=G.on?NAV.leg:-1;document.querySelectorAll('#lpBody tr').forEach(tr=>tr.classList.toggle('cur',+tr.dataset.i===i&&!tr.classList.contains('subrow')));
  document.querySelectorAll('#course .leg').forEach(p=>p.classList.toggle('curleg',+p.dataset.i===i));
  if(scroll&&i>=0){const tr=document.querySelector('#lpBody tr.cur');if(tr){const box=tr.closest('.inner');if(box)box.scrollTop=Math.max(0,tr.offsetTop-box.clientHeight/3)}}}
function cdTick(){if(!G.on)return;if(RACE.start&&Date.now()<RACE.start&&!G.demo){const sec=Math.ceil((RACE.start-Date.now())/1000);$('gCd').textContent=`−${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;$('gCdTo').textContent=`tot de start (${tStr(RACE.start)})`;$('gCdSrc').textContent='startprocedure';$('gCdBox').classList.toggle('soon',sec<=60&&sec>10);$('gCdBox').classList.toggle('now',sec<=10);return}
  if($('gCdTo').textContent.startsWith('tot de start')){$('gCdTo').textContent='';try{gpsUpdate()}catch(e){}return}
  if(G.cdTarget==null)return;const sec=Math.max(0,Math.round((G.cdTarget-Date.now())/1000));spiAlert();nextAlert(sec);
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s2=sec%60;
  $('gCd').textContent=h?`${h}:${String(m).padStart(2,'0')}:${String(s2).padStart(2,'0')}`:`${m}:${String(s2).padStart(2,'0')}`;
  $('gCdSrc').textContent=G.cdSrc||'';$('gCdBox').classList.toggle('soon',sec<=60&&sec>15);$('gCdBox').classList.toggle('now',sec<=15)}
setInterval(cdTick,500);
// ---------- 2 minuten voor het einde van het rak: koers en TWA van het volgende rak (pop-up + stem) ----------
const NEXT_LEAD=120;
function nextAlert(sec){if(!G.on||G.started===false||!CUR||G.cdTarget==null)return;const i=NAV.leg;if(sec>NEXT_LEAD||G.nxDone===i)return;
  G.nxDone=i;const n=CUR.legs[i+1];
  if(!n){showNext('Nog 2 minuten','Finish','');speak(['fin2'],'Nog 2 minuten tot de finish');return}
  const st=legStats(n),t=twaOf(st.tw),k=Math.round(st.mw)%360,a=Math.round(t.a);const side=t.side==='SB'?'stuurboord':'bakboord';
  showNext(`Volgend rak ${i+2} → ${esc(n.t)}`,pad3(k)+'<small style="font-size:.45em">M</small>',`TWA ${a}° <span class="${t.side.toLowerCase()}">${t.side}</span><small>${pos(a)}</small>`);
  speak(nextLegKeys(i+2,k,a,t.side),`Over twee minuten: rak ${i+2}. Koers ${digits(k)}. T.W.A. ${a}, ${side}.`)}
function showNext(h,k,t){$('nxH').innerHTML=h;$('nxK').innerHTML=k;$('nxT').innerHTML=t;$('nxtPop').hidden=false;
  try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(_){}clearTimeout(G.nxTimer);G.nxTimer=setTimeout(()=>{$('nxtPop').hidden=true},G.demo?8000:30000)}
$('nxOk').onclick=()=>{$('nxtPop').hidden=true};
$('voiceSel').onchange=e=>{ST.voiceName=e.target.value;pickVoice()};
$('voiceTest').onclick=()=>{unlockAudio();speak(nextLegKeys(3,88,180,'BB'),`Over twee minuten: rak 3. Koers ${digits(88)}. T.W.A. 180, bakboord.`,true,true)};
$('recOpen').onclick=()=>{unlockAudio();CLIPSX.open()};
// ---------- alleen kaart (racemodus) ----------
function mapOnly(on){document.body.classList.toggle('maponly',on);$('mapOnly').setAttribute('aria-pressed',on?'true':'false');$('mapOnly').textContent=on?'vensters':'alleen kaart';setTimeout(()=>{try{applyVB()}catch(e){}},30)}
$('mapOnly').onclick=()=>mapOnly(!document.body.classList.contains('maponly'));
function gpsFix(p){const c=p.coords;const xy=llXY(c.latitude,c.longitude);const now=p.timestamp||Date.now();
  if(G.prev){const d=Math.hypot(xy[0]-G.prev.xy[0],xy[1]-G.prev.xy[1]);const dt=(now-G.prev.t)/3600000;
    if(d*1852>4){G.cogCalc=brgT(G.prev.xy,xy);if(dt>0)G.sogCalc=d/dt;G.prev={xy,t:now}}}
  else G.prev={xy,t:now};
  if(G.started===false&&G.xy){const sh=pingXY('ship'),pn=pingXY('pin');if(sh&&pn){const dx=pn[0]-sh[0],dy=pn[1]-sh[1];const sd=q=>Math.sign(dx*(q[1]-sh[1])-dy*(q[0]-sh[0]));
    const a=G.xy,b=xy;if(sd(a)!==sd(b)&&sd(a)!==0){const den=(b[0]-a[0])*dy-(b[1]-a[1])*dx;const t=den?((sh[0]-a[0])*dy-(sh[1]-a[1])*dx)/den:0;const u=((a[0]+(b[0]-a[0])*t-sh[0])*dx+(a[1]+(b[1]-a[1])*t-sh[1])*dy)/(dx*dx+dy*dy);
      if(u>-0.2&&u<1.2){G.started=true;$('gMsg').style.color='var(--ink)';$('gMsg').textContent='Start! ✓ Startlijn gepasseerd.';G.msgHold=Date.now()+15000}}}}
  G.xy=xy;G.acc=c.accuracy;
  G.sog=c.speed!=null&&!isNaN(c.speed)?c.speed*1.943844:(G.sogCalc??null);
  G.cog=c.heading!=null&&!isNaN(c.heading)&&G.sog>0.5?c.heading:(G.sog==null||G.sog>0.5?(G.cogCalc??null):null);
  const last=G.trail[G.trail.length-1];if(!last||Math.hypot(xy[0]-last[0],xy[1]-last[1])*1852>8){G.trail.push(xy);if(G.trail.length>3000)G.trail.shift()}
  $('gSog').textContent=G.sog==null?'–':G.sog.toFixed(1);$('gCog').textContent=G.cog==null?'–':pad3(G.cog-D.decl).replace('°','');
  const dm=v=>{const a=Math.abs(v),d=Math.floor(a);return `${d}°${((a-d)*60).toFixed(3)}′`};
  $('gPos').textContent=`${G.demo?'PROEFVAART · ':''}${dm(c.latitude)}${c.latitude>=0?'N':'Z'} ${dm(c.longitude)}${c.longitude>=0?'O':'W'} · ±${Math.round(c.accuracy)} m · ${new Date(now).toLocaleTimeString('nl-NL')}`;
  if(!(G.msgHold>Date.now()))$('gMsg').textContent=c.accuracy>50?`Lage nauwkeurigheid (±${Math.round(c.accuracy)} m)`:'';
  G.outside=xy[0]<ALL.x-1||xy[0]>ALL.x+ALL.w+1||xy[1]<ALL.y-1||xy[1]>ALL.y+ALL.h+1;
  if(G.outside){const st=CUR?CUR.S.start:[0,0];const km=Math.hypot(xy[0]-st[0],xy[1]-st[1])*1.852;$('gMsg').style.color='var(--ink)';$('gMsg').textContent=`GPS werkt ✓ — je bent buiten de Grevelingen (${km<100?km.toFixed(1):Math.round(km)} km van de start).`}else $('gMsg').style.color='';
  gpsUpdate();
  if(G.follow){if(G.outside&&!G.outFit){G.outFit=true;const r=svg.getBoundingClientRect();vb.w=3;vb.h=3*(r.height/r.width||0.7)}if(LV.i>=0&&!G.fitted&&!G.outside){fitLeg();G.fitted=true}else{vb.x=xy[0]-vb.w/2;vb.y=xy[1]-vb.h/2;applyVB()}}
}
function gpsErr(e){const m=e.code===1?'Geen toestemming voor locatie. Sta locatie toe voor deze site (in de Claude-app werkt GPS mogelijk niet; gebruik dan de GitHub-versie).':e.code===2?'Geen GPS-positie beschikbaar.':e.code===3?'GPS reageert niet (time-out), probeert opnieuw…':'GPS-fout.';if(e.code===1||!(G.msgHold>Date.now()))$('gMsg').textContent=m;if(e.code===1)gpsStop(true)}
async function wake(){try{if('wakeLock' in navigator&&document.visibilityState==='visible')G.wake=await navigator.wakeLock.request('screen')}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(G.on&&document.visibilityState==='visible')wake()});
function gpsStart(){setTimeout(showResult,0);if(RACE.start&&Date.now()<RACE.start){G.started=false;NAV.leg=0}if(G.demo)demoStop();G.trail=[];G.prev=null;G.vmc=null;G.cdTarget=null;$('gCd').textContent='--:--';hudPanel(true);
  $('gpsHud').hidden=false;$('gpsBtn').setAttribute('aria-pressed','true');
  if(!('geolocation' in navigator)){$('gMsg').textContent='Deze browser geeft geen locatie door.';return}
  if(window.isSecureContext===false){$('gMsg').textContent='Locatie werkt alleen via https (bijv. de GitHub-link).'}
  G.on=true;G.follow=true;G.fitted=false;$('gFollow').setAttribute('aria-pressed','true');NAV.leg=LV.i>=0?LV.i:NAV.leg;
  gpsEls();$('gpsL').style.display='';$('gTo').textContent='Zoekt GPS…';
  G.watch=navigator.geolocation.watchPosition(gpsFix,gpsErr,{enableHighAccuracy:true,maximumAge:1000,timeout:20000});wake()}
function gpsStop(keepMsg){if(ST.tab==='Race'&&!keepMsg){G.on=false;setTimeout(()=>setTab('Kaart'),0)}if(G.demo)demoStop();$('spiPop').hidden=true;G.spiDone=null;G.nxDone=null;hudPanel(false);if(G.watch!=null)navigator.geolocation.clearWatch(G.watch);G.watch=null;G.on=false;
  $('gpsBtn').setAttribute('aria-pressed','false');if(!keepMsg){$('gpsHud').hidden=true}$('gpsL').style.display='none';try{G.wake&&G.wake.release()}catch(e){}G.wake=null}
function hudPanel(on){if(window.innerWidth<760||ST.tab==='Race')return;const lp=$('legsPanel');if(on){if(G.panel==null){G.panel=lp.open;lp.open=false}}else if(G.panel!=null){lp.open=G.panel;G.panel=null}}
// proefvaart: virtuele boot vaart de huidige baan af (6 kn, 20x versneld)
function demoSpd(){return ST.demoSpd}
function demoStart(){if(!CUR)return;G.vmc=null;G.cdTarget=null;G.spiDone=null;G.nxDone=null;G.started=null;if(G.watch!=null){navigator.geolocation.clearWatch(G.watch);G.watch=null}
  G.on=true;G.demo=true;G.trail=[];G.prev=null;G.follow=true;G.fitted=false;$('gFollow').setAttribute('aria-pressed','true');$('gDemo').setAttribute('aria-pressed','true');
  $('gpsHud').hidden=false;$('gpsBtn').setAttribute('aria-pressed','true');gpsEls();$('gpsL').style.display='';NAV.leg=0;G.adv=0;hudPanel(true);fitTo(startBox,0.6);
  const pts=[];CUR.legs.forEach(l=>l.p.forEach((q,j)=>{if(!pts.length||j>0)pts.push(q)}));
  const KN=6,DT=1;let seg=0,t=0,simT=Date.now();
  const toLLd=(x,y)=>[-y/60+51.74,x/(Math.cos(51.74*Math.PI/180)*60)+3.95];
  clearInterval(G.demoTimer);
  G.demoTimer=setInterval(()=>{const SPEED=demoSpd();let step=KN*SPEED*DT/3600;
    while(step>0&&seg<pts.length-1){const a=pts[seg],b=pts[seg+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const left=L*(1-t);if(step<left){t+=step/L;step=0}else{step-=left;seg++;t=0}}
    if(seg>=pts.length-1){demoStop();$('gMsg').textContent='Proefvaart klaar: finish bereikt.';return}
    const a=pts[seg],b=pts[seg+1];const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;const [la,lo]=toLLd(x,y);simT+=DT*1000*SPEED;
    gpsFix({timestamp:simT,coords:{latitude:la,longitude:lo,accuracy:5,speed:KN/1.943844,heading:brgT(a,b)}})},DT*1000)}
function demoStop(){clearInterval(G.demoTimer);G.demoTimer=null;G.demo=false;$('gDemo').setAttribute('aria-pressed','false')}
$('gDemoSpd').value=String(ST.demoSpd);$('gDemoSpd').onchange=e=>{ST.demoSpd=+e.target.value;};
$('gDemo').onclick=()=>{try{G.ac&&G.ac.resume()}catch(_){}if(G.demo){demoStop();gpsStop()}else demoStart()};
$('gpsBtn').onclick=()=>{setTab(ST.tab==='Race'?'Kaart':'Race')};
$('gStop').onclick=()=>gpsStop();
$('gFollow').onclick=()=>{G.follow=!G.follow;$('gFollow').setAttribute('aria-pressed',G.follow?'true':'false');if(G.follow&&G.xy){G.fitted=false;if(LV.i>=0){fitLeg();G.fitted=true}else{vb.x=G.xy[0]-vb.w/2;vb.y=G.xy[1]-vb.h/2;applyVB()}}};


// ---------- achtergrondkaart Nederland (PDOK-tegels, alleen online; offline uit cache) ----------
const TILE={map:{url:(z,x,y,st)=>`https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/${st==='night'?'grijs':'pastel'}/EPSG:3857/${z}/${x}/${y}.png`,max:17},
  foto:{url:(z,x,y)=>`https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/${z}/${x}/${y}.jpeg`,max:18}};
const tileEls=new Map();let tileOK=false,tileFail=0;
function tLon(x,z){return x/2**z*360-180}
function tLat(y,z){const n=Math.PI-2*Math.PI*y/2**z;return 180/Math.PI*Math.atan(Math.sinh(n))}
function lon2t(lon,z){return Math.floor((lon+180)/360*2**z)}
function lat2t(lat,z){const r=lat*Math.PI/180;return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**z)}
function updateTiles(){
  const g=$('tiles');if(!g)return;
  if(location.protocol==='file:'&&!window.__STANDALONE__){g.innerHTML='';return}
  const r=svg.getBoundingClientRect();if(!r.width)return;
  const k=Math.max(vb.w/r.width,vb.h/r.height);const ox=(r.width*k-vb.w)/2,oy=(r.height*k-vb.h)/2;
  const x0=vb.x-ox,y0=vb.y-oy,x1=x0+r.width*k,y1=y0+r.height*k;
  const src=(ST.mapStyle==='photo'||ST.mapStyle==='dim')?TILE.foto:TILE.map;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  let z=Math.round(Math.log2(360*KXl/(256*k/dpr)));z=Math.max(6,Math.min(src.max,z));
  const [la0,lo0]=xyLL(x0,y1),[la1,lo1]=xyLL(x1,y0);
  let tx0=lon2t(lo0,z),tx1=lon2t(lo1,z),ty0=lat2t(la1,z),ty1=lat2t(la0,z);
  while((tx1-tx0+1)*(ty1-ty0+1)>120&&z>6){z--;tx0=lon2t(lo0,z);tx1=lon2t(lo1,z);ty0=lat2t(la1,z);ty1=lat2t(la0,z)}
  const want=new Set();const pre=(ST.mapStyle==='photo'||ST.mapStyle==='dim'?'f':'m')+(ST.mapStyle==='night'?'n':'')+'/';
  for(let tx=tx0;tx<=tx1;tx++)for(let ty=ty0;ty<=ty1;ty++){
    const key=pre+z+'/'+tx+'/'+ty;want.add(key);if(tileEls.has(key))continue;
    const a=llXY(tLat(ty,z),tLon(tx,z)),b=llXY(tLat(ty+1,z),tLon(tx+1,z));
    const im=el('image',{x:a[0],y:a[1],width:b[0]-a[0]+1e-4,height:b[1]-a[1]+1e-4,preserveAspectRatio:'none'},null);
    im.dataset.z=z;im.addEventListener('load',()=>{tileOK=true;$('chart').classList.add('tiles-on')});im.addEventListener('error',()=>{tileFail++;im.remove();tileEls.delete(key)});
    im.setAttribute('href',src.url(z,tx,ty,ST.mapStyle));g.appendChild(im);tileEls.set(key,im)}
  // keep tiles of other zoom levels briefly underneath until the new ones are loaded; drop far-away ones
  for(const [key,im] of tileEls){if(want.has(key))continue;
    const zz=+im.dataset.z;if(key.slice(0,pre.length)!==pre||Math.abs(zz-z)>1){im.remove();tileEls.delete(key);continue}
    const bx=+im.getAttribute('x'),by=+im.getAttribute('y'),bw=+im.getAttribute('width'),bh=+im.getAttribute('height');
    if(bx>x1||bx+bw<x0||by>y1||by+bh<y0){im.remove();tileEls.delete(key)}}
  // newest zoom level on top
  [...g.children].sort((p,q)=>(+p.dataset.z)-(+q.dataset.z)).forEach(n=>g.appendChild(n));
  if(tileEls.size>400){for(const [key,im] of tileEls){if(!want.has(key)){im.remove();tileEls.delete(key)}}}
}
let tileTimer=null;function scheduleTiles(){clearTimeout(tileTimer);tileTimer=setTimeout(()=>{try{updateTiles()}catch(e){}},60)}

// ---------- start pingen (startschip, pin, gate) ----------
function savePings(){store.touch('pings')}
function pingXY(k){const q=ST.pings[k];return q?llXY(q.lat,q.lon):null}
function pingInfo(){document.querySelectorAll('.pbtns button').forEach(b=>b.classList.toggle('ok',!!ST.pings[b.dataset.p]));
  const sh=pingXY('ship'),pn=pingXY('pin'),gt=pingXY('gate');const parts=[];
  if(sh&&pn){const L=Math.hypot(pn[0]-sh[0],pn[1]-sh[1])*1852;const r=ST.twd*Math.PI/180;const up=q=>q[0]*Math.sin(r)-q[1]*Math.cos(r);
    const d=(up(pn)-up(sh))*1852;parts.push(`Lijn ${Math.round(L)} m · ${Math.abs(d)<3?'geen kant bevoordeeld':(d>0?'pin':'startschip')+` bevoordeeld (~${Math.round(Math.abs(d))} m)`}`)}
  if(gt&&sh&&pn){const m=[(sh[0]+pn[0])/2,(sh[1]+pn[1])/2];parts.push(`gate ${(Math.hypot(gt[0]-m[0],gt[1]-m[1])).toFixed(2)} nm, ${pad3(brgT(m,gt)-D.decl)}`)}
  const n=['ship','pin','gate'].filter(k=>ST.pings[k]).length;
  $('pingInfo').textContent=n?`${n}/3 gepingd. `+parts.join(' · '):'Vaar langs het startschip, de pin en de gate en tik op de knop als je ernaast ligt.'}
document.querySelectorAll('.pbtns button').forEach(b=>b.onclick=()=>{
  if(!G.on||!G.xy){$('pingInfo').textContent='Nog geen GPS-positie; wacht even.';return}
  if(G.acc>30&&!G.demo){$('pingInfo').textContent=`GPS nog te onnauwkeurig (±${Math.round(G.acc)} m); wacht even.`;return}
  const [la,lo]=xyLL(G.xy[0],G.xy[1]);ST.pings[b.dataset.p]={lat:la,lon:lo,acc:G.acc,t:Date.now()};savePings();NAV.leg=0;G.spiDone=null;G.nxDone=null;$('spiPop').hidden=true;G.started=!(ST.pings.ship&&ST.pings.pin)?null:false;show(false);pingInfo()});
$('pingClear').onclick=()=>{ST.pings={};savePings();G.started=null;show(false);pingInfo()};
setTimeout(()=>{try{pingInfo()}catch(e){}},0);
function hl(i){document.querySelectorAll('#course .leg').forEach(p=>p.style.opacity=i<0?'':(+p.dataset.i===i?1:.25));document.querySelectorAll('#legs tr,#lpBody tr').forEach(r=>r.classList.toggle('hl',+r.dataset.i===i))}
// ---------- PDF A3 ----------
let CUR=null,CUR_SPI=null;
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`)){res();return}const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('script'));document.head.appendChild(s)})}
let DL=null,DLtried=false;
const STANDALONE=!!window.__STANDALONE__;
const LOCAL_DL={save:async({filename,data})=>{const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return{status:'saved'}}};
async function getDL(){if(DL)return DL;if(STANDALONE){DL=LOCAL_DL;DLtried=true;return DL}for(let i=0;i<30&&!window.claude?.use;i++)await new Promise(r=>setTimeout(r,100));
  try{DL=window.claude?.use?await window.claude.use('downloads'):null}catch(e){DL=null}DLtried=true;
  if(!DL)DL=LOCAL_DL;$('pdfMsg').textContent='';return DL}
getDL();
function cssText(){let out='';for(const sh of document.styleSheets){try{for(const r of sh.cssRules)out+=r.cssText+'\n'}catch(e){}}return out}
function rootVars(){const cs=getComputedStyle(document.documentElement);let o='';for(const sh of document.styleSheets){try{for(const r of sh.cssRules){if(r.style)for(const p of r.style)if(p.startsWith('--'))o+=`${p}:${cs.getPropertyValue(p)};`}}catch(e){}}return o}
let SATDATA=null;async function satData(){if(SATDATA)return SATDATA;const bl=await (await fetch(IMG.href)).blob();SATDATA=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(bl)});return SATDATA}
async function mapImage(box,W,H){
  const saveVB={...vb},saveTip=$('tip').hidden;$('tip').hidden=true;
  // fit box to W:H
  const ar=W/H;let w=box.w*1.16,h=box.h*1.16;if(w/h<ar)w=h*ar;else h=w/ar;
  vb={x:box.x+box.w/2-w/2,y:box.y+box.h/2-h/2,w,h};
  const kp=vb.w/(W/2.4);applyVB(kp);
  const clone=svg.cloneNode(true);clone.setAttribute('width',W);clone.setAttribute('height',H);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.removeAttribute('style');clone.setAttribute('class',svg.getAttribute('class')||'');
  const st=document.createElementNS(NS,'style');st.textContent=`svg{${rootVars()};background:#26302a} `+cssText();clone.insertBefore(st,clone.firstChild);
  {const cs=clone.querySelector('#sat');if(cs&&!/^data:/.test(IMG.href)&&cs.style.display!=='none'){try{cs.setAttribute('href',await satData())}catch(e){cs.remove()}}}
  const txt=new XMLSerializer().serializeToString(clone);
  vb=saveVB;applyVB();$('tip').hidden=saveTip;
  const url=URL.createObjectURL(new Blob([txt],{type:'image/svg+xml'}));
  const img=new Image();img.decoding='sync';img.src=url;await img.decode();
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);URL.revokeObjectURL(url);
  return {data:cv.toDataURL('image/jpeg',0.86),vb:{...vb,w,h,x:box.x+box.w/2-w/2,y:box.y+box.h/2-h/2}};
}
function pdfBoat(doc,x,y,tw){ // x,y = centre, mm
  const t=twaOf(tw);const dir=t.side==='SB'?-1:1;const s=0.13;
  doc.setDrawColor(31,95,168);doc.setLineWidth(0.18);
  const hull=[[12,1.5],[16.5,7],[18.2,15],[18.2,25],[5.8,25],[5.8,15],[7.5,7],[12,1.5]];
  for(let i=1;i<hull.length;i++)doc.line(x+(hull[i-1][0]-12)*s,y+(hull[i-1][1]-15)*s,x+(hull[i][0]-12)*s,y+(hull[i][1]-15)*s);
  const ang=Math.max(6,Math.min(85,t.a*0.5))*Math.PI/180;const mx=12,my=13,L=12;const bx=mx+dir*Math.sin(ang)*L,by=my+Math.cos(ang)*L;
  doc.setDrawColor(29,42,51);doc.setLineWidth(0.22);doc.line(x,y+(my-15)*s,x+(bx-12)*s,y+(by-15)*s);
  const fx=12+dir*0.3,fy=3.2,cx=(fx+bx)/2+dir*5*Math.cos(ang*0.6),cy=(fy+by)/2-1;
  if(t.side==='SB')doc.setDrawColor(31,138,59);else doc.setDrawColor(200,35,44);doc.setLineWidth(0.4);
  let px=fx,py=fy;for(let k=1;k<=8;k++){const u=k/8;const qx=(1-u)*(1-u)*fx+2*(1-u)*u*cx+u*u*bx,qy=(1-u)*(1-u)*fy+2*(1-u)*u*cy+u*u*by;doc.line(x+(px-12)*s,y+(py-15)*s,x+(qx-12)*s,y+(qy-15)*s);px=qx;py=qy}
  if(t.a>=ST.spiMin){const ox=-dir*1.5;doc.setDrawColor(224,106,0);doc.setFillColor(255,190,120);doc.setLineWidth(0.25);
    doc.ellipse(x+ox*s,y+(-1-15)*s,7.5*s,4.5*s,'FD');doc.setLineWidth(0.12);doc.line(x+(4.5+ox-12)*s,y+(0-15)*s,x+(6.5-12)*s,y+(11-15)*s);doc.line(x+(19.5+ox-12)*s,y+(0-15)*s,x+(17.5-12)*s,y+(11-15)*s)}
}
async function makePdf(){
  if(!CUR)return;if(!DL)await getDL();if(!DL)return;const btn=$('pdfBtn');btn.disabled=true;$('pdfMsg').textContent='PDF wordt gemaakt…';
  try{
    if(!window.jspdf){$('pdfMsg').textContent='PDF-module laden…';await loadScript(STANDALONE&&window.__JSPDF__?window.__JSPDF__:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');$('pdfMsg').textContent='PDF wordt gemaakt…'}
    const {jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3'});
    const {legs,c,S,total}=CUR;
    const M=10,PW=420,PH=297,TW=128,MX=M,MY=26,MW=PW-2*M-TW-6,MH=PH-MY-M;
    // header
    doc.setFont('helvetica','bold');doc.setFontSize(20);doc.setTextColor(29,42,51);
    doc.text(`Grevelingen Wintercup 2026–2027 · Baan ${ST.baan}`,M,M+7);
    doc.setFont('helvetica','normal');doc.setFontSize(11);doc.setTextColor(93,107,115);
    doc.text(`${c.title} · boekje ${c.dist} · langs de lijn ${total.toFixed(1)} nm · ware wind ${ST.twd}° (${wname(ST.twd)}) ${ST.tws} kn · startgebied ${ST.area} · zeiltijd ${fmtT(legs.reduce((a,l)=>a+legTime(l),0))} (polar ${ST.eff}%)`,M,M+13.5);
    // map
    const W=Math.round(MW*10),H=Math.round(MH*10);
    const box={x:curBox.x,y:curBox.y,w:Math.max(curBox.w,0.5),h:Math.max(curBox.h,0.5)};
    const im=await mapImage(box,W,H);
    doc.addImage(im.data,'JPEG',MX,MY,MW,MH);doc.setDrawColor(150,150,150);doc.setLineWidth(0.3);doc.rect(MX,MY,MW,MH);
    // north arrow + scale bar on map
    doc.setFillColor(255,255,255);doc.rect(MX+4,MY+MH-14,58,10,'F');
    const nmPerMm=im.vb.w/MW;const sb=[0.25,0.5,1,2].find(v=>v/nmPerMm>25)||1;const sbmm=sb/nmPerMm;
    doc.setDrawColor(29,42,51);doc.setLineWidth(0.6);doc.line(MX+7,MY+MH-7,MX+7+sbmm,MY+MH-7);doc.line(MX+7,MY+MH-8.5,MX+7,MY+MH-5.5);doc.line(MX+7+sbmm,MY+MH-8.5,MX+7+sbmm,MY+MH-5.5);
    doc.setFontSize(9);doc.setTextColor(29,42,51);doc.text(`${sb} nm`,MX+9+sbmm,MY+MH-6);
    doc.setFillColor(255,255,255);doc.circle(MX+MW-10,MY+12,7,'F');doc.setFillColor(29,42,51);doc.triangle(MX+MW-10,MY+6,MX+MW-13,MY+15,MX+MW-7,MY+15,'F');doc.setFontSize(10);doc.setFont('helvetica','bold');doc.text('N',MX+MW-11.3,MY+18.6);
    // table
    const TX=PW-M-TW;let y=MY+2;
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(29,42,51);doc.text('Rakken',TX,y);y+=5;
    const cols=[{t:'#',x:0,w:7,r:1},{t:'Naar',x:9,w:30},{t:'Rond.',x:40,w:10},{t:'TWA',x:50,w:10,r:1},{t:'Koerstype',x:63,w:25},{t:'Koers',x:88,w:11,r:1},{t:'nm',x:100,w:10,r:1},{t:'Tijd',x:112,w:16,r:1}];
    doc.setFontSize(8);doc.setTextColor(93,107,115);
    cols.forEach(cl=>doc.text(cl.t.toUpperCase(),TX+cl.x+(cl.r?cl.w:0),y,{align:cl.r?'right':'left'}));
    y+=2;doc.setDrawColor(200,200,200);doc.setLineWidth(0.2);doc.line(TX,y,TX+TW,y);y+=4.6;
    const rowH=6.4;
    const cell=(cl,v,opt={})=>{doc.text(String(v),TX+cl.x+(cl.r?cl.w:0),y,{align:cl.r?'right':'left',...opt})};
    const nRows=legs.reduce((a,l)=>a+1+(l.via.length?0.6:0)+(l.s.length>1?dispSegs(l).length*0.8:0),0);const showSub=nRows*6.6<(PH-M-y-40);
    legs.forEach((l,i)=>{
      const mk=i===0?null:(c.marks[i-1]||{});const sd=mk?mk.s||'':'';const pass=!!(mk&&mk.auto);
      const name=i===0?'Gate (kruisrak)':l.t+(pass?' (vaarwaterboei)':'');
      const one=l.s.length===1;
      doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(29,42,51);cell(cols[0],i+1);
      doc.setFont('helvetica','normal');cell(cols[1],doc.splitTextToSize(name,36)[0]);
      if(sd){if(sd==='SB')doc.setTextColor(31,138,59);else doc.setTextColor(200,35,44);doc.setFont('helvetica','bold');cell(cols[2],pass?'pass. '+sd:sd);doc.setFont('helvetica','normal');doc.setTextColor(29,42,51)}
      else{doc.setFontSize(7.5);doc.setTextColor(93,107,115);cell(cols[2],i===0?'gate':'finish');doc.setFontSize(9.5);doc.setTextColor(29,42,51)}
      {const st=one?{mw:l.s[0].mw,tw:l.s[0].tw,span:0}:legStats(l);const t=twaOf(st.tw);doc.setFont('courier','normal');cell(cols[3],Math.round(t.a)+'°');doc.setFont('helvetica','normal');pdfBoat(doc,TX+cols[4].x+2,y-1.2,st.tw);doc.setFontSize(8.5);doc.text(pos(t.a),TX+cols[4].x+5,y);doc.setFontSize(9.5);doc.setFont('courier','normal');cell(cols[5],pad3(st.mw));if(!one&&st.span>4){doc.setFontSize(6.5);doc.setTextColor(93,107,115);doc.text(crsRange(st),TX+cols[5].x+cols[5].w,y+2.6,{align:'right'});doc.setTextColor(29,42,51);doc.setFontSize(9.5)}}
      doc.setFont('courier','normal');cell(cols[6],l.nm.toFixed(2));cell(cols[7],fmtT(legTime(l)));doc.setFont('helvetica','normal');
      if(l.via.length){y+=3.6;doc.setFontSize(7.5);doc.setTextColor(31,95,168);doc.text('via '+l.via.join(', '),TX+cols[1].x,y);doc.setTextColor(29,42,51)}
      if(!one&&showSub){dispSegs(l).forEach((sg,q)=>{const j=sg.j;y+=5.2;const t=twaOf(sg.tw);doc.setFontSize(8.5);doc.setTextColor(93,107,115);cell(cols[0],(i+1)+String.fromCharCode(97+q));cell(cols[1],subName(l,j).replace('→','>'));doc.setTextColor(29,42,51);doc.setFont('courier','normal');cell(cols[3],Math.round(t.a)+'°');doc.setFont('helvetica','normal');pdfBoat(doc,TX+cols[4].x+2,y-1.2,sg.tw);doc.text(pos(t.a),TX+cols[4].x+5,y);doc.setFont('courier','normal');cell(cols[5],pad3(sg.mw));cell(cols[6],sg.nm.toFixed(2));cell(cols[7],fmtT(segTime(sg)));doc.setFont('helvetica','normal')})}
      y+=2.2;doc.setDrawColor(225,225,225);doc.line(TX,y,TX+TW,y);y+=4.2;
    });
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text('Totaal',TX+cols[1].x,y);doc.setFont('courier','bold');cell(cols[6],total.toFixed(1));cell(cols[7],fmtT(legs.reduce((a,l)=>a+legTime(l),0)));y+=8;
    // spinnaker plan
    if(CUR_SPI&&CUR_SPI.items.length){doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(194,90,0);doc.text('Spinnaker-plan',TX,y);y+=4.2;
      doc.setFont('helvetica','normal');doc.setFontSize(7.6);doc.setTextColor(29,42,51);
      CUR_SPI.items.forEach(it=>{const txt=it.html.replace(/<[^>]+>/g,'').replace(/^(KLAARLEGGEN|HIJSEN|GIJPEN|STRIJKEN)/,'$1: ').replace(/→/g,'>').replace(/≥/g,'>=');
        const lines=doc.splitTextToSize(txt,TW-18);if(y+lines.length*3.1>PH-M-22)return;doc.setTextColor(93,107,115);doc.text(it.at,TX,y);doc.setTextColor(29,42,51);doc.text(lines,TX+17,y);y+=lines.length*3.1+0.9});y+=3}
    // notes
    doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(93,107,115);
    const notes=[`Koers = magnetische kompaskoers (rechtwijzend min 2,5° variatie), zonder deviatie. TWA t.o.v. ware wind ${ST.twd}°. Rakken met deelrakken: gemiddelde koers met bereik; deelrakken lopen van boei naar boei. Zeiltijd: polar ${BOATS[ST.boat].polarSrc}, TWS ${ST.tws} kn, rendement ${ST.eff}%, met ${ST.tackS} s per overstag en ${ST.gybeS} s per gijp, zonder stroom. Spinnaker-icoon en -plan vanaf TWA ${ST.spiMin}°. Bootje: zeil aan lij; groen = wind van stuurboord, rood = wind van bakboord.`,
      'Gate 0,5 nm recht in de wind vanaf de start; start zo gekozen dat het kruisrak in water van minimaal 2,4 m ligt. Routes: kortste weg in water van minimaal 2,4 m, binnen de betonning waar het boekje een vaarwater noemt.',
      'Diepte: RWS bodemhoogte 20 m (t/m 2024), meerpeil NAP -0,30 m. Betonning: RWS vaarwegmarkeringen drijvend. Luchtfoto: Beeldmateriaal Nederland / PDOK. Finish schematisch volgens het boekje.',
      'Hulpmiddel bij de voorbereiding; geen vervanging van de officiële kaart, de wedstrijdbepalingen of de dieptemeter aan boord.'];
    notes.forEach(n=>{const lines=doc.splitTextToSize(n,TW);if(y+lines.length*3.2<PH-M){doc.text(lines,TX,y);y+=lines.length*3.2+1.2}});
    doc.text(`Gemaakt ${new Date().toLocaleDateString('nl-NL')}`,PW-M,PH-4,{align:'right'});
    const blob=doc.output('blob');
    await DL.save({filename:`Wintercup_baan_${ST.baan}_TWD${String(ST.twd).padStart(3,'0')}_A3.pdf`,data:blob});
    $('pdfMsg').textContent='PDF klaar.';
  }catch(e){const code=e&&e.code;$('pdfMsg').textContent=code==='declined'?'Opslaan geannuleerd.':code==='rate_limited'?'Er staat al een opslagvraag open.':('PDF maken lukte niet'+(code?` (${code})`:'')+'.')}
  finally{btn.disabled=false}
}
$('pdfBtn').onclick=makePdf;
// ---------- GPX export (packed in a .zip: the viewer only saves allow-listed file types) ----------
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRCT[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipFiles(files){const enc=new TextEncoder();const parts=[],cent=[];let off=0;
  for(const f of files){const name=enc.encode(f.name),data=enc.encode(f.text),crc=crc32(data);
    const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(8,0,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
    parts.push(new Uint8Array(h.buffer),name,data);
    const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
    cent.push(new Uint8Array(c.buffer),name);off+=30+name.length+data.length}
  const csize=cent.reduce((a,b)=>a+b.length,0);const e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,csize,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cent,new Uint8Array(e.buffer)],{type:'application/zip'})}
const toLL=(x,y)=>[-y/60+51.74, x/(Math.cos(51.74*Math.PI/180)*60)+3.95];
const xmlEsc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function shortName(t){return String(t).replace(/\s*\(gele ton\)/i,'').replace(/[‘’']/g,'').replace(/\s+/g,'').replace('/','-').toUpperCase()}
const OFF_NM=10/1852;   // 10 m
function buildGpx(){
  const {legs,c,S}=CUR;const wk=Math.round(ST.twd);const P=[];
  const add=(xy,o)=>{const last=P[P.length-1];if(last&&Math.abs(last.xy[0]-xy[0])<1e-7&&Math.abs(last.xy[1]-xy[1])<1e-7){if(o.desc)last.desc+=' '+o.desc;return}P.push(Object.assign({xy,desc:'',sym:'Waypoint',kind:'fix'},o))};
  add(S.start,{name:`${ST.baan}-START`,desc:`Start (startgebied ${ST.area})`,sym:'Flag, Green'});
  legs.forEach((l,i)=>{
    for(let j=1;j<l.p.length;j++){const last=j===l.p.length-1;const sg=l.s[j-1];let o;
      if(last){const m=i===0?null:c.marks[i-1];
        if(i===0)o={name:`${ST.baan}-GATE`,desc:'Gate (0,5 nm in de wind)',sym:'Flag, Blue'};
        else if(m&&m.l==='Finish')o={name:`${ST.baan}-FINISH`,desc:'Finish (schematisch)',sym:'Flag, Red'};
        else o={name:`${String(i+1).padStart(2,'0')}-${shortName(l.t)}`.slice(0,15),desc:`Rak ${i+1}: ${l.t}${m&&m.s?' – '+(m.s==='SB'?'aan stuurboord houden':'aan bakboord houden'):''}`,sym:m&&m.s==='SB'?'Navaid, Green':'Navaid, Red',kind:m&&m.s?'mark':'fix',side:m&&m.s,buoy:m&&m.b};}
      else{const w=l.wp&&l.wp[j];o={name:`${String(i+1).padStart(2,'0')}${String.fromCharCode(97+j-1)}-${w?shortName(w):'VW'}`.slice(0,15),desc:w?`langs ${w}${l.wps&&l.wps[j]?' aan '+(l.wps[j]==='SB'?'stuurboord':'bakboord')+' (checken bij palaver)':''} (vaarwater ${l.via.join(', ')})`:`vaarwater in (${l.via.join(', ')})`,kind:w?'turn':'fix',buoy:w}}
      if(sg)o.desc+=` | koers ${pad3(sg.mw)}m, ${sg.nm.toFixed(2)} nm, TWA ${Math.round(twaOf(sg.tw).a)}°`;
      add(l.p[j],o)}
  });
  // the route geometry is already shifted 10 m off the buoys (offsetLegs); only annotate
  const out=P.map((p,k)=>{if(p.kind!=='fix'&&k>0&&k<P.length-1)p.desc=`10 m naast ${p.buoy||'boei'}: `+p.desc;return p.xy});
  const pts=P.map((p,k)=>{const [la,lo]=toLL(out[k][0],out[k][1]);return {la,lo,name:p.name,desc:p.desc,sym:p.sym}});
  const t=new Date().toISOString();
  const rn=`WC baan ${ST.baan} TWD${String(wk).padStart(3,'0')}`;
  const wpt=pts.map(p=>`  <wpt lat="${p.la.toFixed(6)}" lon="${p.lo.toFixed(6)}"><name>${xmlEsc(p.name)}</name><desc>${xmlEsc(p.desc)}</desc><sym>${xmlEsc(p.sym)}</sym></wpt>`).join('\n');
  const rte=pts.map(p=>`    <rtept lat="${p.la.toFixed(6)}" lon="${p.lo.toFixed(6)}"><name>${xmlEsc(p.name)}</name><desc>${xmlEsc(p.desc)}</desc><sym>${xmlEsc(p.sym)}</sym></rtept>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wintercup banenkaart" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xmlEsc(rn)}</name><desc>${xmlEsc(c.title+' – ware wind '+wk+'°, startgebied '+ST.area+'. Routepunten bij boeien 10 m naast de boei aan de vaarkant. Kompaskoersen magnetisch (var. 2,5° O). Hulpmiddel; controleer met de officiële kaart.')}</desc><time>${t}</time></metadata>
${wpt}
  <rte><name>${xmlEsc(rn)}</name>
${rte}
  </rte>
</gpx>
`}
async function makeGpx(){
  if(!CUR)return;if(!DL)await getDL();if(!DL)return;const btn=$('gpxBtn');btn.disabled=true;
  try{const gpx=buildGpx();const base=`Wintercup_baan_${ST.baan}_TWD${String(ST.twd).padStart(3,'0')}`;
    if(DL===LOCAL_DL){await DL.save({filename:base+'.gpx',data:new Blob([gpx],{type:'application/gpx+xml'})});$('pdfMsg').textContent='GPX opgeslagen.'}
    else{const zip=zipFiles([{name:base+'.gpx',text:gpx}]);
    await DL.save({filename:base+'_gpx.zip',data:zip});$('pdfMsg').textContent='GPX opgeslagen (in een .zip; uitpakken en de .gpx op de plotter zetten).'}}
  catch(e){const code=e&&e.code;$('pdfMsg').textContent=code==='declined'?'Opslaan geannuleerd.':('GPX maken lukte niet'+(code?` (${code})`:'')+'.')}
  finally{btn.disabled=false}}
$('gpxBtn').onclick=makeGpx;
// ---------- tabs ----------
let PREVSTYLE=null;
function setTab(t){const sec=t==='Race'?'Kaart':t;['Kaart','Deeln','Regels','Uitleg'].forEach(k=>{$('tab'+k).hidden=k!==sec});['Kaart','Race','Deeln','Regels','Uitleg'].forEach(k=>$('tb'+k).setAttribute('aria-selected',k===t?'true':'false'));
  const prev=ST.tab;ST.tab=t;
  raceMode(t==='Race');if(t!=='Race')mapOnly(false);
  if(t!=='Race'){$('legPop').hidden=true;$('legBtn').setAttribute('aria-pressed','false');if(prev==='Race'&&PREVSTYLE&&PREVSTYLE!=='chart')setStyle(PREVSTYLE)}
  if(t==='Race'){if(prev!=='Race'){PREVSTYLE=ST.mapStyle;if(ST.mapStyle!=='chart')setStyle('chart')}unlockAudio();const lp=$('legsPanel');lp.open=true;if(!G.on)gpsStart();rbSync();setTimeout(()=>{applyVB();markCurLeg(true)},30)}
  else if(t==='Kaart'){if(G.on)gpsStop();applyVB()}
  else if(t==='Deeln')renderFleet()
  else{if(G.on)gpsStop()}
  wakeLock(t==='Race')}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
// ---------- deelnemers & marges ----------
const CLS=()=>ST.dlCls&&FLEETS[ST.dlCls]?ST.dlCls:BOATS[ST.boat].cls;
const myKey=()=>ST.boat+'|'+CLS();
const myDefault=()=>{const B=BOATS[ST.boat];return B.myfBy[CLS()]??B.myfBy[B.cls]};
const mySrc=()=>{const B=BOATS[ST.boat];return (B.srcBy&&B.srcBy[CLS()])||B.src};
const F0x=x=>FLEET0.find(y=>y.boat===x.boat&&y.gc===x.gc);
const F0=x=>{const o=F0x(x);return o?o.f:null};let DM0=myDefault();
let FLEET0=FLEETS[CLS()];
let FLEET=[];
function loadFleet(){const B=BOATS[ST.boat];FLEET0=FLEETS[CLS()];DM0=myDefault();FLEET=FLEET0.map(x=>Object.assign({on:true},x));
  {const v=(ST.fleets2||{})[CLS()];if(Array.isArray(v)&&v.length)FLEET=JSON.parse(JSON.stringify(v))}
  $('dlMy').value=DM0;{const m=(ST.myf2||{})[myKey()];if(m>0.6&&m<1.4)$('dlMy').value=m}
  $('dlCls').innerHTML=Object.entries(CLASSES).map(([k,l])=>`<option value="${k}"${k===CLS()?' selected':''}>${l} · ${FLEETS[k].length} boten${k===B.cls?' (jouw klasse)':''}</option>`).join('');
  $('dlEstLab').textContent='Geschatte zeiltijd '+B.name;$('dlMyLab').textContent=B.rlab+' '+B.name;$('dlNote').textContent=B.note;try{$('dlNoteU').textContent=B.note+' '+FLEET_SRC}catch(e){}
  document.querySelectorAll('.bname').forEach(e=>e.textContent=B.name);$('polSrc').textContent=B.polarSrc;
  $('boatSel').value=ST.boat;$('boatHint').textContent=B.klasse}
function saveFleet(){store.set({fleets2:Object.assign({},ST.fleets2,{[CLS()]:FLEET}),myf2:Object.assign({},ST.myf2,{[myKey()]:+$('dlMy').value})})}
loadFleet();
$('boatSel').onchange=e=>{ST.boat=e.target.value;ST.dlCls='';loadFleet();show(false);renderFleet()};
$('dlCls').onchange=e=>{ST.dlCls=e.target.value===BOATS[ST.boat].cls?'':e.target.value;loadFleet();renderFleet()};
const zeil=x=>`${esc(x.gc||'')}${x.zn?`<small class="zn">${esc(x.zn)}</small>`:''}`;
const bron=x=>x.est?`<span class="est" title="Schatting [Inference]">${esc(x.src||'')}</span>`:esc(x.src||'');
function estHours(){if(!CUR)return null;return CUR.legs.reduce((a,l)=>a+legTime(l),0)}
function fEd(cls,i,val,orig,name){const chg=orig!=null&&Math.abs(val-orig)>1e-9;
  return `<span class="fed"><button type="button" class="fst" data-c="${cls}" data-i="${i}" data-d="-0.001" aria-label="rating ${esc(name)} omlaag">−</button><input type="number" step="0.0001" min="0.7" max="1.3" data-i="${i}" class="${cls}${chg?' chg':''}" value="${(+val).toFixed(4)}" aria-label="GC-factor ${esc(name)}"><button type="button" class="fst" data-c="${cls}" data-i="${i}" data-d="0.001" aria-label="rating ${esc(name)} omhoog">+</button>${chg?`<button type="button" class="frs" data-c="${cls}" data-i="${i}" title="Terug naar ${orig.toFixed(4)}">↺</button>`:''}</span>${chg?`<span class="was">was ${orig.toFixed(4)}</span>`:''}`}
const o0Null=x=>F0(x)==null;
function setF(cls,i,v){v=Math.round(v*10000)/10000;if(!(v>0.7&&v<1.3))return;if(cls==='dlMyT'){$('dlMy').value=v.toFixed(4)}else{const x=FLEET[i];x.f=v;if(x.on===false&&o0Null(x))x.on=true;const o0=F0x(x),o=o0?o0.f:null;x.src=o==null?(x.src&&x.src!=='geen rating gevonden'?x.src:'handmatig'):(Math.abs(v-o)<1e-9?o0.src:'aangepast');x.est=o!=null&&Math.abs(v-o)<1e-9?!!o0.est:false}saveFleet();renderFleet()}
function renderFleet(){
  if($('tabDeeln').hidden)return;
  const est=estHours();const over=+$('dlOver').value;const Tmin=over>0?over:(est?est*60:120);
  const myf=+$('dlMy').value||DM0;const ME=BOATS[ST.boat];const nm=CUR?CUR.total:0;const kn=est?nm/est:6;
  $('dlCourse').textContent=CUR?`baan ${ST.baan} · ${ST.twd}° · ${ST.tws} kn`:'–';
  $('dlEst').textContent=est?`${fmtT(est)} (${nm.toFixed(1)} nm, ${kn.toFixed(1)} kn)`:'–';
  const rows=[...FLEET,{gc:ME.gc,zn:ME.sail,boat:ME.name,type:ME.type,f:myf,src:mySrc(),on:true,me:true}].filter(x=>!(x.gc===ME.gc&&!x.me));
  rows.sort((a,b)=>(b.f||0)-(a.f||0));
  const MG=margins(rows.filter(x=>!x.me),Tmin,myf,kn);const MGx=new Map(MG.rows.map(r=>[r.x,r]));const worstAhead=MG.ahead,worstBehind=MG.behind;
  $('dlBody').innerHTML=rows.map(x=>{
    if(x.me)return `<tr class="me"><td></td><td>${zeil(x)}</td><td>${esc(x.boat)}</td><td>${esc(x.type)}</td><td class="r fcell">${fEd('dlMyT',-1,myf,DM0,ME.name)}</td><td>${Math.abs(myf-DM0)>1e-9?'aangepast':bron(x)}</td><td class="r">${fmtMS(Tmin)}</td><td>jouw zeiltijd</td><td></td></tr>`;
    if(!x.f){const i=FLEET.indexOf(x);return `<tr class="off"><td><input type="checkbox" disabled aria-label="geen rating"></td><td>${zeil(x)}</td><td>${esc(x.boat)}</td><td>${esc(x.type)}</td><td class="r fcell"><span class="fed"><input type="number" step="0.0001" min="0.7" max="1.3" data-i="${i}" class="dlF" placeholder="factor" aria-label="factor ${esc(x.boat)}"></span></td><td>${esc(x.src||'')}</td><td class="r">–</td><td><small>vul een factor in</small></td><td></td></tr>`}
    const {tie,lag,m}=MGx.get(x);
    const i=FLEET.indexOf(x);
    return `<tr class="${x.on?'':'off'}"><td><input type="checkbox" data-i="${i}" class="dlOn" ${x.on?'checked':''} aria-label="${esc(x.boat)} meetellen"></td><td>${zeil(x)}</td><td>${esc(x.boat)}</td><td>${esc(x.type)}</td>
      <td class="r fcell">${fEd('dlF',i,x.f,F0(x),x.boat)}</td><td>${bron(x)}</td>
      <td class="r">${fmtMS(tie)}</td>
      <td><span class="mg ${lag>=0?'ok':'bad'}">${lag>=0?'+':'−'}${fmtMS(lag)} <small>${lag>=0?`${esc(x.boat)} moet ≥ ${fmtMS(lag)} eerder finishen (jij mag zoveel achter liggen)`:`jij moet ≥ ${fmtMS(lag)} eerder finishen dan ${esc(x.boat)}`}</small></span></td>
      <td class="r">${Math.round(m)} m</td></tr>`}).join('');
  const parts=[];
  if(worstAhead)parts.push(`<li><span class="mg bad">−${fmtMS(worstAhead.lag)}</span> voor op <b>${esc(worstAhead.x.boat)}</b> (${worstAhead.x.f.toFixed(4)}): dat is de boot met een lagere factor waar je het meest op moet uitlopen.</li>`);
  if(worstBehind)parts.push(`<li><span class="mg ok">+${fmtMS(worstBehind.lag)}</span> achter <b>${esc(worstBehind.x.boat)}</b> (${worstBehind.x.f.toFixed(4)}): de snellere boot waar je het minst achter mag liggen.</li>`);
  $('dlSum').innerHTML=`<h2>Om te winnen bij ${fmtMS(Tmin)} zeiltijd</h2>${parts.length?'<ul>'+parts.join('')+'</ul>':'<div class="sub">Geen boten geselecteerd.</div>'}<p class="sub">Elke minuut langere zeiltijd vergroot alle marges met dezelfde verhouding (≈ ${((1-myf/(worstBehind?worstBehind.x.f:1))*60).toFixed(1)} s per minuut t.o.v. ${esc(worstBehind?worstBehind.x.boat:'')}).</p>`;
  $('dlBody').querySelectorAll('.dlOn').forEach(cb=>cb.onchange=()=>{FLEET[+cb.dataset.i].on=cb.checked;saveFleet();renderFleet()});
  const cur=c=>c==='dlMyT'?(+$('dlMy').value||DM0):null;
  $('dlBody').querySelectorAll('input.dlF,input.dlMyT').forEach(inp=>inp.onchange=()=>{const c=inp.classList.contains('dlMyT')?'dlMyT':'dlF';const v=+String(inp.value).replace(',','.');if(v>0.7&&v<1.3)setF(c,+inp.dataset.i,v);else renderFleet()});
  $('dlBody').querySelectorAll('.fst').forEach(b=>b.onclick=()=>{const c=b.dataset.c,i=+b.dataset.i;const base=c==='dlMyT'?cur(c):FLEET[i].f;setF(c,i,base+(+b.dataset.d))});
  $('dlBody').querySelectorAll('.frs').forEach(b=>b.onclick=()=>{const c=b.dataset.c,i=+b.dataset.i;setF(c,i,c==='dlMyT'?DM0:F0(FLEET[i]))});
}
['dlOver','dlMy'].forEach(id=>$(id).addEventListener('change',()=>{saveFleet();renderFleet()}));
$('dlAdd').onclick=()=>{const n=$('dlNewName').value.trim(),f=+$('dlNewF').value;if(!n||!(f>0.7&&f<1.3)){$('dlNewF').focus();return}FLEET.push({gc:'',zn:'',boat:n,type:$('dlNewType').value.trim(),f,src:'handmatig',on:true});$('dlNewName').value=$('dlNewType').value=$('dlNewF').value='';saveFleet();renderFleet()};
$('dlReset').onclick=()=>{FLEET=FLEET0.map(x=>Object.assign({on:true},x));$('dlMy').value=DM0;saveFleet();renderFleet()};

if(!fits(ST.baan)&&!ST.allC){const k=keys.find(n=>fits(n)&&D.courses[n].pair.includes(ST.area));if(k)ST.baan=k}
fitTo(ALL,0);show(true);
initRegels({store,setSig5:ms=>{setSig5(ms);try{rbSync()}catch(e){}}});
var PANELS=initPanels({store,onResize:()=>{try{applyVB()}catch(e){}}});
$('layReset').onclick=()=>{if(confirm('Alle vakken terug naar de standaardindeling?'))PANELS.reset()};
{const t0=ST.tab;ST.tab='Kaart';if(t0!=='Kaart')setTab(t0)}
new ResizeObserver(()=>applyVB()).observe(svg);
