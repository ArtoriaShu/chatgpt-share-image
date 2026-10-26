import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync('tests/fixture.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const page=await browser.newPage({viewport:{width:1600,height:1300},permissions:['clipboard-read','clipboard-write']});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/?modern`);
 await page.evaluate(()=>{
  const style=document.createElement('style');
  style.textContent=`.native{font:16px/1.6 Arial;color:#20262e}.native h2{font-size:23px;font-weight:700}.columns{display:grid;grid-template-columns:2fr 1fr 1fr;gap:16px}.tile{padding:14px;background:#eef3fa;border-radius:12px}.timeline{list-style:none;padding:0 0 0 24px}.timeline li{position:relative;padding:0 0 16px 12px;border-left:2px solid #d7c1ec}.timeline li::before{content:"";position:absolute;top:4px;left:-6px;width:10px;height:10px;border-radius:50%;background:rgb(153,51,204)}.diagram{position:relative;height:90px;margin:16px 0}.step{position:absolute;top:16px;padding:12px;border:1px solid #88a7bd;background:#eef3fa;width:150px}.step.a{left:0}.step.b{left:70%}.code{background:#18202b;color:#e5e7eb;padding:16px;border-radius:10px}.token{color:rgb(255,170,51)}.surface{height:36px;background-size:cover;margin:12px 0}.native td,.native th{border:1px solid #abc;padding:6px}.native table{width:100%;border-collapse:collapse}.native svg{display:block;width:900px;height:80px}.splitter{margin:20px 0}`;
  document.head.append(style);
  const body=document.querySelector('[data-chatgpt-selection-message-id="msg-1"]');body.classList.add('native');
  body.innerHTML=`<h2>多布局导出示例</h2><section class="columns"><div class="tile">主要内容<br>保留 2:1:1 多栏布局</div><div class="tile">第二栏</div><div class="tile">第三栏</div></section><ol class="timeline"><li>第一步：时间线圆点</li><li>第二步：保持间距</li></ol><div class="diagram"><div class="step a">开始</div><div class="step b">完成</div></div><pre class="code"><code><span class="token">const</span> value = 42;<br>${'long_code_'.repeat(15)}</code></pre><table><tr><th>项目</th><th>状态</th></tr><tr><td>表格</td><td>保留样式</td></tr></table><svg viewBox="0 0 900 80" aria-hidden="true"><rect x="0" y="0" width="900" height="80" fill="#22aabb"/><text x="20" y="45" fill="white">Wide SVG diagram</text></svg><canvas width="400" height="70" style="width:400px;height:70px"></canvas><div class="surface"></div><p>来源 <span data-testid="webpage-citation-pill"><img width="16" height="16" src="/favicon.ico">一个非常长的来源名称，用来确认它始终保持紧凑而不会撑大整个段落 example.com +2</span></p>`;
  const canvas=body.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle='rgb(30,90,170)';ctx.fillRect(0,0,400,70);
  body.querySelector('.surface').style.backgroundImage=`url("${canvas.toDataURL()}")`;
  const remove=Element.prototype.remove;
  Element.prototype.remove=function(){if(this.tagName==='IFRAME'){
   const d=this.contentDocument,s=d?.querySelector('#sheet');if(s){
    const css=el=>d.defaultView.getComputedStyle(el),rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
    const badge=s.querySelector('[data-gpt-share-source]'),wide=s.querySelector('.content svg')||s.querySelector('.content img');
    window.appearance={columns:[...s.querySelector('.columns').children].map(rect),pseudo:[...s.querySelectorAll('[data-gpt-share-pseudo]')].map(el=>({r:rect(el),color:css(el).backgroundColor})),steps:[...s.querySelectorAll('.step')].map(rect),diagram:rect(s.querySelector('.diagram')),code:css(s.querySelector('.code')).backgroundColor,syntax:css(s.querySelector('.token')).color,badge:{r:rect(badge),font:css(badge).fontSize,text:badge.textContent,images:badge.querySelectorAll('img').length},wide:rect(wide),images:s.querySelectorAll('img').length,background:s.querySelector('.surface').style.backgroundImage,html:d.documentElement.outerHTML,overflow:s.scrollWidth>s.clientWidth};
   }
  }return remove.call(this);};
 });
 await page.addScriptTag({content:fs.readFileSync('dist/chatgpt-share-image.user.js','utf8')});
 await page.locator('[data-gpt-share-single]').first().click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'),{},{timeout:45000});
 const a=await page.evaluate(()=>window.appearance);
 assert(a.columns.every(c=>Math.abs(c.y-a.columns[0].y)<1));assert(a.columns[0].w/a.columns[1].w>1.8,'unequal grid proportions retained');
 assert.equal(a.pseudo.length,2);assert(a.pseudo.every(p=>p.r.w===10&&p.r.h===10&&p.color==='rgb(153, 51, 204)'),'CSS timeline markers retained');
 assert(a.steps[1].x>a.steps[0].x+a.steps[0].w,'positioned diagram remains horizontal');assert(a.steps[1].x+a.steps[1].w<=a.diagram.x+a.diagram.w+1,'positioned diagram fits card');
 assert.equal(a.code,'rgb(24, 32, 43)');assert.equal(a.syntax,'rgb(255, 170, 51)');
 assert(a.badge.r.w<=180&&a.badge.r.h<=20);assert.equal(a.badge.font,'11px');assert.equal(a.badge.images,0,'source favicon never becomes a body image');assert(a.badge.text.includes('example.com +2'));
 assert(Math.abs(a.wide.w/a.wide.h-900/80)<.1,'wide SVG scales without distortion');
 assert.equal(a.images,2,'SVG and canvas preserved');assert(a.background.includes('data:image/png'),'background image embedded');assert(!a.overflow);
 assert(!(await page.locator('#gpt-share-local #toast').textContent()).includes('无法读取'));assert.deepEqual(errors,[]);
 const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await (await (await navigator.clipboard.read())[0].getType('image/png')).arrayBuffer())));
 fs.writeFileSync('tests/output-appearance.png',Buffer.from(bytes));fs.writeFileSync('tests/output-appearance.html',a.html);
 console.log(JSON.stringify({threeColumnGrid:true,timelinePseudoElements:true,absoluteDiagram:true,syntaxColors:true,compactSource:a.badge.r,svgAndCanvas:true,backgroundImage:true,pageErrors:errors}));
}finally{await browser.close();server.close();}
