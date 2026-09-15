const CACHE='toefl-listening-card-v7';
const ASSETS=['./','./index.html','./manifest.webmanifest','./sw.js'];

async function transformIndex(response){
  try{
    const text=await response.text();
    let html=text;
    const meaningSetting='<div class="setting"><div><label>中文解释</label><small>在原句后播放中文释义</small></div><button class="toggle" id="meaningToggle"></button></div>';
    const sentenceSetting='<div class="setting"><div><label>原句播放</label><small>关闭后驾驶模式只播放单词，不自动播放原句</small></div><button class="toggle on" id="sentenceToggle"></button></div>';
    if(html.includes(meaningSetting)&&!html.includes('id="sentenceToggle"')) html=html.replace(meaningSetting,meaningSetting+sentenceSetting);
    html=html.replace('driver={on:false,paused:false,blind:true,meaning:false,token:0}','driver={on:false,paused:false,blind:true,meaning:false,sentence:true,token:0}');
    html=html.replace("document.querySelector('#meaningToggle').onclick=()=>{driver.meaning=!driver.meaning;toggle('meaningToggle','meaning')};","document.querySelector('#meaningToggle').onclick=()=>{driver.meaning=!driver.meaning;toggle('meaningToggle','meaning')};document.querySelector('#sentenceToggle').onclick=()=>{driver.sentence=!driver.sentence;toggle('sentenceToggle','sentence')};");
    html=html.replace("setDriverText(c,'🎧 播放原句');await say(c.sentence,+document.querySelector('#sentenceSpeed').value,'en-US',token);if(!driver.on||token!==driver.token)break;if(driver.meaning){","if(driver.sentence){setDriverText(c,'🎧 播放原句');await say(c.sentence,+document.querySelector('#sentenceSpeed').value,'en-US',token);if(!driver.on||token!==driver.token)break;}if(driver.meaning){");
    return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(e){ return response; }
}

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>{const u=new URL(event.request.url);const isIndex=u.pathname.endsWith('/index.html')||u.pathname.endsWith('/');return (isIndex?transformIndex(r):Promise.resolve(r)).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return resp})}).catch(()=>caches.match(event.request)))});