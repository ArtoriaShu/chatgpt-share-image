import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const page=await browser.newPage({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=480;c.height=240;const x=c.getContext('2d');x.fillStyle='rgb(23,143,69)';x.fillRect(0,0,480,240);x.fillStyle='white';x.font='24px sans-serif';x.fillText('BODY IMAGE',70,100);return c.toDataURL().split(',')[1];}),'base64');
const requested=[], gmRequests=[];
const imageServer=http.createServer((req,res)=>{requested.push(req.url);if(req.url==='/missing.png'){res.writeHead(404);res.end();return;}if(req.url==='/cors.png')res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','image/png');res.end(image);});
await new Promise(r=>imageServer.listen(0,'127.0.0.1',r));
const imageOrigin=`http://127.0.0.1:${imageServer.address().port}`;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync('tests/fixture.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
await page.exposeFunction('testGMRequest',async url=>{assert.equal(new URL(url).origin,imageOrigin);gmRequests.push(url);const response=await fetch(url);return {status:response.status,bytes:Array.from(new Uint8Array(await response.arrayBuffer()))};});
const copied=()=>page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'),{},{timeout:45000});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/?modern`);
 await page.evaluate(origin=>{
  const body=document.querySelector('[data-chatgpt-selection-message-id="msg-1"]');
  body.innerHTML='<h2>正文配图测试</h2><p>正文正常保留。</p>'+
   `<span data-testid="webpage-citation-pill"><img src="${origin}/favicon.ico" width="16" height="16">来源网站 +1</span>`+
   `<span data-state="closed"><a href="https://example.com"><img src="${origin}/source-logo.png" width="16" height="16"><span>cheatengin…</span> +1</a></span>`+
   '<span data-testid="source-chip">纯文字来源 +2</span>'+
   '<p>保留前文。<span data-state="closed"><img src="'+origin+'/favicon.ico" width="16" height="16"><span>弹出来源 +3</span></span>保留后文。</p>'+
   '<p><a href="https://example.com/guide">普通正文链接</a></p>'+
   `<div class="citation-image-card"><button data-testid="image-thumbnail"><picture><source srcset="${origin}/no-cors.png"><img src="${origin}/no-cors.png" aria-hidden="true" width="480" height="240" alt="正文配图"></picture></button></div>`+
   `<a href="https://example.com"><img src="${origin}/favicon.ico" width="16" height="16" alt=""></a>`+
   `<img src="${origin}/cors.png" crossorigin="anonymous" width="480" height="240" alt="可直接读取的配图">`;
 },imageOrigin);
 await page.locator('[alt="正文配图"]').evaluate(img=>img.decode());
 await page.locator('[alt="可直接读取的配图"]').evaluate(img=>img.decode());
 await page.evaluate(()=>{window.GM_xmlhttpRequest=options=>{if(options.anonymous!==true || options.method!=='GET' || options.responseType!=='blob') throw new Error('Image request must be anonymous GET');window.testGMRequest(options.url).then(r=>options.onload({status:r.status,response:new Blob([new Uint8Array(r.bytes)],{type:'image/png'})}),options.onerror);};});
 await page.evaluate(()=>{const remove=Element.prototype.remove;Element.prototype.remove=function(){if(this.tagName==='IFRAME'){const sheet=this.contentDocument?.querySelector('#sheet');if(sheet)window.exportedContent={text:sheet.textContent,images:sheet.querySelectorAll('img').length,links:[...sheet.querySelectorAll('a')].map(a=>a.textContent)};}return remove.call(this);};});
 await page.addScriptTag({content:fs.readFileSync('dist/chatgpt-share-image.user.js','utf8')});
 const callsBefore=gmRequests.length;
 await page.locator('[data-gpt-share-single]').first().click();await copied();
 const toast=await page.locator('#gpt-share-local #toast').textContent();assert(!toast.includes('无法读取'),toast);
 const exported=await page.evaluate(()=>window.exportedContent);
 for(const text of ['来源网站','cheatengin','纯文字来源','弹出来源','+1','+2','+3']) {
  assert(exported.text.includes(text),`compact source badge text retained: ${text}`);

 }
 assert(exported.text.includes('保留前文。') && exported.text.includes('保留后文。'),'surrounding prose preserved');
 assert(exported.links.includes('普通正文链接'),'ordinary body links preserved');
 assert.equal(exported.images,2,'only body images remain in export');
 assert.equal(gmRequests.length-callsBefore,1,'only tainted cross-origin body image uses GM fallback');
 assert(gmRequests[0].endsWith('/no-cors.png'),'favicon and source badges never use GM fallback');
 const pixels=await page.evaluate(async()=>{const blob=await (await navigator.clipboard.read())[0].getType('image/png');const bmp=await createImageBitmap(blob);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;const x=c.getContext('2d');x.drawImage(bmp,0,0);const data=x.getImageData(0,0,c.width,c.height).data;let green=0;for(let i=0;i<data.length;i+=4)if(data[i]===23&&data[i+1]===143&&data[i+2]===69)green++;bmp.close();return green;});
 assert(pixels>700000,`both body images are actually in PNG (${pixels} green pixels)`);
 assert.equal(await page.locator('#gpt-share-local #panel').isVisible(),false);
 await page.evaluate(origin=>{document.querySelector('[data-chatgpt-selection-message-id="msg-1"]').insertAdjacentHTML('beforeend',`<button><img src="${origin}/missing.png" alt="失效配图" width="240" height="120"></button>`);},imageOrigin);
 await page.locator('[data-gpt-share-single]').first().click();await copied();
 assert((await page.locator('#gpt-share-local #toast').textContent()).includes('1 张原图无法读取'),'only real failed content image counts');
 // Without the new Tampermonkey grant, leave a clear placeholder rather than tainting the export.
 await page.evaluate(()=>{delete window.GM_xmlhttpRequest;document.querySelector('[alt="失效配图"]').remove();});
 await page.locator('[data-gpt-share-single]').first().click();await copied();
 assert((await page.locator('#gpt-share-local #toast').textContent()).includes('1 张原图无法读取'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({bodyImageButtonPreserved:true,crossOriginFallback:true,compactSourceLabels:true,bodyLinksPreserved:true,renderedImagePixels:pixels,failedContentImageCount:1,missingGrantFallback:true,pageErrors:errors}));
}finally{await browser.close();server.close();imageServer.close();}
