import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(fs.readFileSync('tests/fixture.html'));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const page=await browser.newPage({permissions:['clipboard-read','clipboard-write']});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(()=>{const body=document.querySelector('[data-message-id="msg-1"] .markdown');for(let i=0;i<150;i++){const p=document.createElement('p');p.textContent=`段落 ${i}：`+'较长回答应完整复制为同一张图片。'.repeat(5);body.append(p);}});
 await page.addScriptTag({content:fs.readFileSync('dist/chatgpt-share-image.user.js','utf8')});
 await page.locator('[data-gpt-share-single]').first().click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'),{},{timeout:60000});
 const size=await page.evaluate(async()=>{const item=(await navigator.clipboard.read())[0];const bmp=await createImageBitmap(await item.getType('image/png'));const size=[bmp.width,bmp.height];bmp.close();return size;});
 assert(size[1]>9600 && size[1]<=32760,'whole long reply copied into one bounded image');
 assert.equal(await page.locator('#gpt-share-local #panel').isVisible(),false);
 await page.evaluate(()=>{window.originalClipboardWrite=navigator.clipboard.write.bind(navigator.clipboard);navigator.clipboard.write=()=>Promise.reject(new DOMException('Test denied','NotAllowedError'));});
 await page.locator('[data-gpt-share-single]').nth(1).click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.includes('浏览器未允许复制'));
 assert.equal(await page.locator('#gpt-share-local #panel').isVisible(),false,'clipboard refusal still does not open panel');
 assert.equal(await page.getByRole('button',{name:'保存 PNG',exact:true}).isVisible(),true);
 await page.evaluate(()=>{navigator.clipboard.write=window.originalClipboardWrite;});
 await page.getByRole('button',{name:'重试复制'}).click();
 await page.waitForFunction(()=>document.querySelector('#gpt-share-local').shadowRoot.querySelector('#toast').textContent.startsWith('图片已复制'));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({directCopy:true,panelHidden:true,longReply:size,retryAfterClipboardRefusal:true,pageErrors:errors}));
} finally {await browser.close();server.close();}
