import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync('tests/fixture.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const page=await browser.newPage({viewport:{width:1800,height:1100},permissions:['clipboard-read','clipboard-write']});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/?modern`);
 await page.evaluate(()=>{
  const body=document.querySelector('[data-chatgpt-selection-message-id="msg-1"]');
  body.innerHTML='<h2>长回答完整性测试</h2>';
  for(let i=0;i<28;i++){const p=document.createElement('p');p.textContent=`第 ${i+1} 段：`+'正文改为较窄的分享图片后，应当重新计算换行和高度，完整保留最后一行。'.repeat(3);body.append(p);}
  const tail=document.createElement('p');tail.dataset.testTail='';tail.textContent='最后一段：固定远程入口与无人值守控制台。';tail.style.cssText='background:rgb(211,37,123);color:white;padding:10px';body.append(tail);
  // A floating UI helper must not freeze the height of this otherwise normal reply.
  const unit=body.parentElement;unit.style.position='relative';
  const helper=document.createElement('span');helper.style.cssText='position:absolute;right:0;bottom:0';helper.setAttribute('aria-hidden','true');helper.textContent='浮动辅助按钮';unit.append(helper);
  const remove=Element.prototype.remove;
  Element.prototype.remove=function(){if(this.tagName==='IFRAME'){
   const s=this.contentDocument?.querySelector('#sheet');if(s){const tail=s.querySelector('[data-test-tail]'),msg=s.querySelector('.msg'),foot=s.querySelector('.foot');const r=tail.getBoundingClientRect(),m=msg.getBoundingClientRect(),f=foot.getBoundingClientRect();window.clipping={tailBottom:r.bottom,msgBottom:m.bottom,footTop:f.top,tailText:tail.textContent,rootHeight:s.querySelector('[data-gpt-share-appearance]').style.height,sheetHeight:s.getBoundingClientRect().height};}
  }return remove.call(this);};
 });
 await page.addScriptTag({content:fs.readFileSync('dist/chatgpt-share-image.user.js','utf8')});
 await page.locator('[data-gpt-share-single]').first().click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'),{},{timeout:60000});
 const clipping=await page.evaluate(()=>window.clipping);
 const output=await page.evaluate(async()=>{
  const blob=await (await navigator.clipboard.read())[0].getType('image/png'),bmp=await createImageBitmap(blob);
  const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const x=c.getContext('2d');x.drawImage(bmp,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let pixels=0;for(let i=0;i<data.length;i+=4)if(data[i]===211&&data[i+1]===37&&data[i+2]===123)pixels++;bmp.close();return {bytes:Array.from(new Uint8Array(await blob.arrayBuffer())),pixels};
 });
 fs.writeFileSync('tests/output-clipping.png',Buffer.from(output.bytes));
 console.log(JSON.stringify({clipping,visibleTailPixels:output.pixels}));
 assert(clipping.tailBottom<=clipping.msgBottom-10,'last paragraph fits inside the reply card');
 assert(clipping.footTop>clipping.tailBottom,'footer is below all answer content');
 assert(output.pixels>15000,'final paragraph is actually visible in the PNG');
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.close();}
