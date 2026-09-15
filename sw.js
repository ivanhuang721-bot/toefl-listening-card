const CACHE='toefl-listening-card-v9';
const ASSETS=['./','./index.html','./manifest.webmanifest','./sw.js'];

function transformIndex(html){
  html=html.replace('v7 · 驾驶模式支持原句开关','v9 · 更自然语音 + 锁屏播放');
  html=html.replace('.driverTop{display:flex;justify-content:space-between;align-items:center}','.driverTop{display:flex;justify-content:space-between;align-items:center}.driverTopActions{display:flex;align-items:center;gap:8px}');
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
  html=html.replace('function stopDriver(){driver.on=false;driver.paused=false;driver.token++;speechSynthesis.cancel();document.querySelector(\'#driver\').classList.add(\'hidden\')}','function stopDriver(){driver.on=false;driver.paused=false;driver.token++;speechSynthesis.cancel();driverAudio.pause();driverAudio.removeAttribute(\'src\');document.querySelector(\'#driver\').classList.add(\'hidden\');try{if(\'mediaSession\' in navigator)navigator.mediaSession.playbackState=\'none\'}catch(e){}}');
  html=html.replace('w.classList.toggle(\'driverHidden\',driver.blind);s.classList.toggle(\'driverHidden\',driver.blind);','w.classList.toggle(\'driverHidden\',!driver.wordShown);s.classList.toggle(\'driverHidden\',driver.blind);');
  html=html.replace("function say(t,rate,lang,token){return new Promise(resolve=>{if(token!==driver.token||!driver.on)return resolve(false);let u=speak(t,rate,lang,()=>resolve(true));if(!u)resolve(false)})}","function say(t,rate,lang,token){if(token!==driver.token||!driver.on)return Promise.resolve(false);return playText(t,rate,lang)}");
  html=html.replace("function openDriver(){driver.on=true;driver.paused=false;driver.token++;document.querySelector('#driver').classList.remove('hidden');startDriverSequence(driver.token)}","function openDriver(){driver.on=true;driver.paused=false;driver.wordShown=!driver.blind;driver.token++;document.querySelector('#driver').classList.remove('hidden');setAudioPlaybackMode();startDriverSequence(driver.token)}");
  html=html.replace("document.querySelector('#blindToggle').onclick=()=>setToggleState('blindToggle','blind',!driver.blind);","document.querySelector('#blindToggle').onclick=()=>{setToggleState('blindToggle','blind',!driver.blind);driver.wordShown=!driver.blind;document.querySelector('#driverWordToggle').textContent=driver.wordShown?'🙈 隐藏单词':'👁 显示单词'};");
  html=html.replace("document.querySelector('#driverStop').onclick=stopDriver;","document.querySelector('#driverStop').onclick=stopDriver;document.querySelector('#driverWordToggle').onclick=()=>{driver.wordShown=!driver.wordShown;document.querySelector('#driverWordToggle').textContent=driver.wordShown?'🙈 隐藏单词':'👁 显示单词';setDriverText(cards[idx%cards.length],driver.wordShown?'👁 已显示单词':'🙈 已隐藏单词')};");
  html=html.replace("document.querySelector('#driverPause').onclick=()=>{driver.paused=true;speechSynthesis.pause();document.querySelector('#dStatus').textContent='⏸ 已暂停'};","document.querySelector('#driverPause').onclick=()=>{driver.paused=true;speechSynthesis.pause();driverAudio.pause();try{if('mediaSession' in navigator)navigator.mediaSession.playbackState='paused'}catch(e){}document.querySelector('#dStatus').textContent='⏸ 已暂停'};");
  html=html.replace("document.querySelector('#driverResume').onclick=()=>{if(!driver.on)return;driver.paused=false;speechSynthesis.resume();document.querySelector('#dStatus').textContent='▶️ 继续播放'};","document.querySelector('#driverResume').onclick=()=>{if(!driver.on)return;driver.paused=false;speechSynthesis.resume();setAudioPlaybackMode();if(driverAudio.src)driverAudio.play().catch(()=>{});try{if('mediaSession' in navigator)navigator.mediaSession.playbackState='playing'}catch(e){}document.querySelector('#dStatus').textContent='▶️ 继续播放'};");
  html=html.replace("load();updateModeButtons();render();if('speechSynthesis' in window)speechSynthesis.getVoices();","load();updateModeButtons();render();setAudioPlaybackMode();if('mediaSession' in navigator){try{navigator.mediaSession.setActionHandler('play',()=>document.querySelector('#driverResume').click());navigator.mediaSession.setActionHandler('pause',()=>document.querySelector('#driverPause').click())}catch(e){}}if('speechSynthesis' in window)speechSynthesis.getVoices();");
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