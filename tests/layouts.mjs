import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync('tests/fixture.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const page=await browser.newPage({viewport:{width:1600,height:1100},permissions:['clipboard-read','clipboard-write']});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/?modern`);
 await page.evaluate(()=>{
  const style=document.createElement('style');
  style.textContent='.compare{border:2px solid #ccc;border-radius:18px;padding:24px;background:white;color:#111}.pair{display:grid;grid-template-columns:1fr 1fr;gap:32px;text-align:center}.device{display:flex;flex-direction:column;align-items:center;gap:10px}.device-title,.class-bold{font-weight:700}.account{display:inline-flex;padding:4px 12px;border-radius:20px;background:rgb(222,244,225);color:rgb(41,137,66)}.state{display:flex;justify-content:center;align-items:center;gap:12px;margin:24px 0}.ok{color:rgb(23,143,69)}.bad{color:rgb(220,38,38)}.icon{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:3}.compare hr{border:0;border-top:1px solid #ddd;margin:24px 0}';
  document.head.append(style);
  const icon=(color,path)=>`<svg aria-hidden="true" viewBox="0 0 24 24" class="icon ${color}"><path d="${path}"/></svg>`;
  const devices=account=>`<div class="pair"><div class="device">${icon('','M3 4h18v13H3z M1 21h22')}<span class="device-title">Mac Codex</span><span class="account">账号 ${account}</span></div><div class="device">${icon('','M7 2h10v20H7z')}<span class="device-title">手机 ChatGPT</span><span class="account">账号 A</span></div></div>`;
  document.querySelector('[data-chatgpt-selection-message-id="msg-1"]').innerHTML='<p><span class="class-bold">这句加粗应保留。</span></p><div class="compare">'+devices('A')+`<div class="state">${icon('ok','M2 12l7 7L22 3')}<span>官方 Remote 可以连接</span></div><hr>`+devices('B')+`<div class="state">${icon('bad','M3 3l18 18 M21 3L3 21')}<span>账号不同，不能连接</span></div></div><p>相邻正文。<span data-testid="webpage-citation-pill">不应导出的来源 +1</span></p>`;
  const remove=Element.prototype.remove;
  Element.prototype.remove=function(){
   if(this.tagName==='IFRAME'){
    const d=this.contentDocument,s=d?.querySelector('#sheet');
    if(s){
     const pair=s.querySelector('.pair'), a=pair.children[0].getBoundingClientRect(),b=pair.children[1].getBoundingClientRect();
     const label=s.querySelector('.account'),card=s.querySelector('.compare');
     window.exported={text:s.textContent,first:[a.x,a.y,a.width],second:[b.x,b.y,b.width],sheetWidth:s.getBoundingClientRect().width,cardWidth:card.getBoundingClientRect().width,overflow:card.scrollWidth>card.clientWidth,border:d.defaultView.getComputedStyle(card).borderTopWidth,background:d.defaultView.getComputedStyle(s.querySelector('[data-gpt-share-appearance]')).backgroundColor,label:d.defaultView.getComputedStyle(label).backgroundColor,labelHeight:label.getBoundingClientRect().height,bold:d.defaultView.getComputedStyle(s.querySelector('.class-bold')).fontWeight,icons:s.querySelectorAll('img').length,html:d.documentElement.outerHTML};
    }
   }
   return remove.call(this);
  };
 });
 await page.addScriptTag({content:fs.readFileSync('dist/chatgpt-share-image.user.js','utf8')});
 await page.locator('[data-gpt-share-single]').first().click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'),{},{timeout:45000});
 const result=await page.evaluate(()=>window.exported);
 assert(Math.abs(result.first[1]-result.second[1])<2,'device columns stay side by side');
 assert(result.second[0]>result.first[0]+result.first[2],'column gap preserved');
 assert(result.cardWidth<result.sheetWidth && !result.overflow,'wide source grid adapts to share card');
 assert.equal(result.border,'2px');assert.equal(result.label,'rgb(222, 244, 225)');assert.equal(result.bold,'700');
 assert(result.labelHeight<45,'account label stays on one line inside a flex column');
 assert.equal(result.icons,6,'all device and state SVG icons retained');assert(result.text.includes('不应导出的来源'));
 assert(!(await page.locator('#gpt-share-local #toast').textContent()).includes('无法读取'));
 const png=await page.evaluate(async()=>Array.from(new Uint8Array(await (await (await navigator.clipboard.read())[0].getType('image/png')).arrayBuffer())));
 fs.writeFileSync('tests/output-layout.png',Buffer.from(png));
 const colors=await page.evaluate(async()=>{
  const bmp=await createImageBitmap(await (await navigator.clipboard.read())[0].getType('image/png'));
  const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const x=c.getContext('2d');x.drawImage(bmp,0,0);
  const p=x.getImageData(0,0,c.width,c.height).data;let green=0,red=0;for(let i=0;i<p.length;i+=4){if(p[i]===23&&p[i+1]===143&&p[i+2]===69)green++;if(p[i]===220&&p[i+1]===38&&p[i+2]===38)red++;}bmp.close();return {green,red};
 });
 assert(colors.green>30 && colors.red>30,'colored SVG strokes are visible in the final PNG');
 assert.deepEqual(errors,[]);
 // Keep a standalone visual artifact of the exact exported card for inspection.
 fs.writeFileSync('tests/output-layout.html',result.html);
 await page.evaluate(()=>{document.body.style.backgroundColor='rgb(23, 34, 29)';document.querySelector('.compare').style.cssText='background:transparent;color:white';});
 await page.locator('[data-gpt-share-single]').first().click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'),{},{timeout:45000});
 assert.equal(await page.evaluate(()=>window.exported.background),'rgb(23, 34, 29)','transparent dark-source card keeps a readable background');
 console.log(JSON.stringify({twoColumns:true,borderAndLabels:true,classBold:true,bodySVGIcons:result.icons,compactSourcesRetained:true,renderedIconPixels:colors,pageErrors:errors}));
}finally{await browser.close();server.close();}
