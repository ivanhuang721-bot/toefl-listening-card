const CACHE='toefl-listening-card-v11';
const ASSETS=['./','./index.html','./manifest.webmanifest','./sw.js'];

function transformIndex(html){
  html=html.replace('v7 · 驾驶模式支持原句开关','v11 · 听力熟悉度 + 继续上次');
  html=html.replace('.driverTop{display:flex;justify-content:space-between;align-items:center}','.driverTop{display:flex;justify-content:space-between;align-items:center}.driverTopActions{display:flex;align-items:center;gap:8px}.levelGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px}.levelBtn{border:0;border-radius:12px;padding:12px 8px;font-weight:800}.levelUnknown{background:#fee2e2;color:#991b1b}.levelUnfamiliar{background:#fef3c7;color:#92400e}.levelFamiliar{background:#dcfce7;color:#166534}.resumeBox{margin-top:12px;padding:12px;border-radius:12px;background:#f7f8fa}.resumeBox b{display:block;margin-bottom:4px}.resumeBox button{margin-top:8px}');
  html=html.replace('<div id="driver" class="driver hidden">','<audio id="driverAudio" preload="auto" playsinline></audio><div id="driver" class="driver hidden">');
  html=html.replace('<div class="driverTop"><b>🚗 TOEFL 驾驶模式</b><button class="bigBtn" id="driverStop" style="width:auto;margin:0;padding:9px 14px;background:#8b2635">停止</button></div>','<div class="driverTop"><b>🚗 TOEFL 驾驶模式</b><div class="driverTopActions"><button class="bigBtn" id="driverWordToggle" style="width:auto;margin:0;padding:9px 12px;background:#334155">👁 单词</button><button class="bigBtn" id="driverStop" style="width:auto;margin:0;padding:9px 14px;background:#8b2635">停止</button></div></div>');
  html=html.replace('let driver={on:false,paused:false,blind:true,sentence:true,meaning:false,token:0};','let driver={on:false,paused:false,blind:true,sentence:true,meaning:false,wordShown:false,token:0};');
  const audioBlock=`
const driverAudio=document.querySelector('#driverAudio');
function setAudioPlaybackMode(){try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch(e){}}
function naturalTtsUrl(t,lang='en-US'){return 'https://translate.google.com/translate_tts?client=tw-ob&ie=UTF-8&tl='+encodeURIComponent(lang)+'&q='+encodeURIComponent(t)}
function setMediaSession(title,artist='TOEFL 听力卡'){try{if(!('mediaSession' in navigator))return;navigator.mediaSession.metadata=new MediaMetadata({title:String(title).slice(0,80),artist,album:'驾驶模式'});navigator.mediaSession.playbackState='playing'}catch(e){}}
function playText(t,rate,lang='en-US'){
 return new Promise(resolve=>{
   if(!t){resolve(false);return}
   setAudioPlaybackMode();
   let done=false;
   const finish=v=>{if(done)return;done=true;driverAudio.onended=null;driverAudio.onerror=null;resolve(v)};
   driverAudio.onended=()=>finish(true);
   driverAudio.onerror=()=>{speechSynthesis.cancel();let u=speak(t,rate,lang,()=>finish(true));if(!u)finish(false)};
   driverAudio.playbackRate=Math.max(0.5,Math.min(1.5,Number(rate)||1));
   driverAudio.src=naturalTtsUrl(t,lang);
   driverAudio.load();
   setMediaSession(t);
   const p=driverAudio.play();
   if(p&&p.catch)p.catch(()=>{driverAudio.onerror()});
 });
}
`;
  html=html.replace('function voiceFor(lang){',audioBlock+'function voiceFor(lang){');
  html=html.replace("async function playSelected(){speechSynthesis.cancel();let c=cards[idx%cards.length],rate=+document.querySelector('#speed').value;if(reviewMode==='word'){speak(c.word,rate)}else if(reviewMode==='sentence'){speak(c.sentence,rate)}else{speak(c.word,rate,'en-US',()=>setTimeout(()=>speak(c.sentence,rate),500))}}","async function playSelected(){speechSynthesis.cancel();driverAudio.pause();let c=cards[idx%cards.length],rate=+document.querySelector('#speed').value;if(reviewMode==='word'){await playText(c.word,rate,'en-US')}else if(reviewMode==='sentence'){await playText(c.sentence,rate,'en-US')}else{await playText(c.word,rate,'en-US');await new Promise(r=>setTimeout(r,450));await playText(c.sentence,rate,'en-US')}}");
  const levelHtml='<div class="sub" style="margin-top:14px">听完后怎么判断？</div><div class="levelGrid"><button class="levelBtn levelUnknown" id="levelUnknown">不认识</button><button class="levelBtn levelUnfamiliar" id="levelUnfamiliar">不熟</button><button class="levelBtn levelFamiliar" id="levelFamiliar">熟悉</button></div>';
  html=html.replace('<div class="row" style="margin-top:14px"><button class="btn" id="playSelected">▶️ 播放当前选择</button><button class="btn bad" id="hard">没听出来</button><button class="btn good" id="easy">听懂了</button></div>', '<div class="row" style="margin-top:14px"><button class="btn" id="playSelected">▶️ 播放当前选择</button></div>'+levelHtml);
  const resumeHtml='<div class="resumeBox" id="resumeBox"><b id="resumeTitle">🧠 上次进度</b><div class="sub" id="resumeText">还没有开始记录</div><button class="btn secondary" id="resumeBtn">继续上次</button></div>';
  html=html.replace('</div>\n</section>\n<section id="review" class="hidden">', '</div>'+resumeHtml+'\n</section>\n<section id="review" class="hidden">');
  html=html.replace("let cards=[],idx=0,filter='all',reviewMode=localStorage.getItem('reviewAudioMode')||'word',revealed=false;","let cards=[],idx=0,filter='all',reviewMode=localStorage.getItem('reviewAudioMode')||'word',revealed=false;\nlet progressState={};try{progressState=JSON.parse(localStorage.getItem('listeningProgress')||'{}')}catch(e){progressState={}}\nfunction saveProgress(){localStorage.setItem('listeningProgress',JSON.stringify({idx,updatedAt:Date.now()}));}\nfunction loadProgress(){try{let p=JSON.parse(localStorage.getItem('listeningProgress')||'{}');if(Number.isInteger(p.idx)&&p.idx>=0&&p.idx<WORDS.length)idx=p.idx}catch(e){}}\nfunction renderResume(){let box=document.querySelector('#resumeBox'),text=document.querySelector('#resumeText'),btn=document.querySelector('#resumeBtn');if(!box||!text||!btn)return;let p={};try{p=JSON.parse(localStorage.getItem('listeningProgress')||'{}')}catch(e){}if(Number.isInteger(p.idx)&&p.idx>=0){text.textContent=`上次听到：第 ${p.idx+1} / ${WORDS.length} 个${p.updatedAt?' · 已保存':''}`;btn.classList.remove('hidden')}else{text.textContent='还没有开始记录';btn.classList.add('hidden')}}\n");
  html=html.replace("if(saved&&saved.length===WORDS.length){cards=saved}else makeCards()","if(saved&&saved.length===WORDS.length){cards=saved}else makeCards();loadProgress();");
  html=html.replace("function render(){if(!cards.length)return;", "function render(){if(!cards.length)return;saveProgress();renderResume();");
  html=html.replace("document.querySelector('#hard').onclick=()=>{cards[idx].hard=true;cards[idx].ok=0;idx=(idx+1)%cards.length;save();revealed=false;render()};\ndocument.querySelector('#easy').onclick=()=>{cards[idx].hard=false;cards[idx].ok=1;idx=(idx+1)%cards.length;save();revealed=false;render()};", "function rateCurrent(level){let c=cards[idx%cards.length];c.level=level;c.hard=(level!=='familiar');c.ok=(level==='familiar');save();idx=(idx+1)%cards.length;revealed=false;saveProgress();render();}\ndocument.querySelector('#levelUnknown').onclick=()=>rateCurrent('unknown');\ndocument.querySelector('#levelUnfamiliar').onclick=()=>rateCurrent('unfamiliar');\ndocument.querySelector('#levelFamiliar').onclick=()=>rateCurrent('familiar');");
  html=html.replace("document.querySelector('#start').onclick=()=>{tab('review');render()};", "document.querySelector('#start').onclick=()=>{idx=0;saveProgress();tab('review');render()};\ndocument.querySelector('#resumeBtn').onclick=()=>{loadProgress();tab('review');render()};");
  html=html.replace("load();updateModeButtons();render();setAudioPlaybackMode();", "load();updateModeButtons();render();renderResume();setAudioPlaybackMode();");
  return html;
}

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.pathname.endsWith('/index.html')||url.pathname.endsWith('/')){
    event.respondWith(fetch('./index.html',{cache:'no-store'}).then(async r=>{const text=await r.text();const out=new Response(transformIndex(text),{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});caches.open(CACHE).then(c=>c.put('./index.html',out.clone()));return out}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return r}).catch(()=>caches.match(event.request)));
});