/* Local ChatGPT conversation capture. No conversation API, telemetry or uploads. */
(() => {
  'use strict';
  if (document.getElementById('gpt-share-local')) return;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const host = document.createElement('div');
  host.id = 'gpt-share-local';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483600;pointer-events:none;';
  const ui = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  ui.innerHTML = `<style>
    :host{all:initial;font-family:system-ui,-apple-system,"PingFang SC",sans-serif;color:#1c2925;font-size:14px}
    *{box-sizing:border-box}button,input,select{font:inherit}button,select,input{pointer-events:auto}
    button{border:1px solid #dce4df;background:#fff;color:#263d33;border-radius:9px;padding:9px 12px;cursor:pointer}
    button:hover{background:#edf5ef}button:disabled{opacity:.45;cursor:wait}.primary{background:#176c4c;color:#fff;border-color:#176c4c}.primary:hover{background:#105a3e}
    #launch{position:fixed;right:22px;bottom:108px;padding:12px 17px;box-shadow:0 3px 18px #0002;font-weight:600}
    #veil{position:fixed;inset:0;background:#17211c66;pointer-events:auto;display:none}
    #panel{position:fixed;right:20px;top:20px;bottom:20px;width:min(470px,calc(100vw - 40px));background:#f8faf8;border:1px solid #dfe7e1;border-radius:18px;box-shadow:0 16px 70px #0003;pointer-events:auto;display:none;overflow:hidden;flex-direction:column}
    header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 10px}h2{margin:0;font-size:20px;letter-spacing:-.4px}
    #close{font-size:20px;padding:3px 10px;border:0;background:transparent}.intro{padding:0 20px 14px;color:#62736b;font-size:12px;line-height:1.7}
    .options{padding:0 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{display:flex;gap:6px;flex-direction:column;font-size:12px;color:#62736b}.field input,.field select{padding:9px;border:1px solid #dce4df;background:#fff;border-radius:8px;color:#203c2e;min-width:0}.wide{grid-column:1/-1}
    .tools{display:flex;flex-wrap:wrap;gap:6px;padding:14px 20px 10px}.tools button{font-size:12px;padding:6px 9px}
    #status{padding:0 20px 12px;color:#426253;font-size:12px;line-height:1.7;white-space:pre-wrap}
    #list{margin:0 20px;overflow:auto;flex:1;min-height:80px;border:1px solid #e0e7e1;border-radius:10px;background:#fff}
    .row{display:flex;gap:10px;align-items:flex-start;padding:12px;border-bottom:1px solid #edf1ee;cursor:pointer}.row:last-child{border:0}.row input{margin-top:3px;accent-color:#176c4c}.row span{overflow:hidden;line-height:1.6}.row b{display:block;font-size:11px;color:#176c4c}.row small{display:block;font-size:12px;color:#66766e;white-space:pre-wrap;overflow-wrap:anywhere;max-height:57px;overflow:hidden}
    footer{padding:16px 20px;display:flex;gap:8px;border-top:1px solid #e2e8e3;margin-top:14px}footer .primary{flex:1}
    #previews{overflow:auto;flex:1;display:none;padding:16px 20px}.preview{margin-bottom:18px}.preview img{display:block;width:100%;border:1px solid #dbe3dd;border-radius:8px;background:#fff}.actions{display:flex;gap:8px;margin:10px 0}.actions button{flex:1;font-size:12px}
    #cancel{display:none}.error{color:#a33!important}#count{font-size:12px;color:#65766c;margin-left:auto;align-self:center}
    #toast{display:none;position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:calc(100vw - 32px);padding:12px 18px;border-radius:12px;background:#203d30;color:#fff;box-shadow:0 4px 24px #0002;pointer-events:auto;line-height:1.6}#toast button{margin-left:8px;padding:4px 8px;font-size:12px}
    @media(max-width:500px){#panel{inset:10px;width:calc(100vw - 20px)}#launch{right:12px;bottom:92px}}
  </style>
  <button id="launch" class="primary">分享为图片</button><div id="veil"></div><div id="toast" role="status" aria-live="polite"></div>
  <section id="panel" role="dialog" aria-modal="true" aria-label="分享对话为图片">
    <header><h2>分享对话为图片</h2><button id="close" aria-label="关闭">×</button></header>
    <div class="intro">勾选你想分享的消息，生成后可复制或保存 PNG。<br>内容在本机处理，不上传对话。</div>
    <div class="options">
      <label class="field wide">图片标题（可修改或留空）<input id="title" maxlength="160"></label>
      <label class="field">配色<select id="theme"><option value="light">浅色</option><option value="dark">深色</option></select></label>
      <label class="field">图片长度<select id="length"><option value="4800">自动分图 · 适合发微信</option><option value="12000">较长图片 · 适合保存</option></select></label>
    </div>
    <div class="tools"><button id="all">全选</button><button id="none">清空</button><button id="ai">只选回答</button><button id="reload">重新读取整段</button><span id="count"></span></div>
    <div id="status" role="status" aria-live="polite"></div><div id="list"></div><div id="previews"></div>
    <footer><button id="back" hidden>返回选择</button><button id="cancel">停止读取</button><button id="generate" class="primary">生成图片</button></footer>
  </section>`;
  const $ = id => ui.getElementById(id);
  let records = [], selected = new Set(), outputs = [], busy = false, stop = false, sourceURL = '';
  let lastFocus = null;
  const nodeKeys = new WeakMap();
  const nodeRoles = new WeakMap();
  let snapshots = new WeakMap();
  let nodeCounter = 0;
  let toastTimer;
  function toast(text, retry = false, duration = 4500) {
    clearTimeout(toastTimer); $('toast').replaceChildren(document.createTextNode(text)); $('toast').style.display = 'block';
    if (retry) {
      const copy = document.createElement('button'); copy.textContent = '重试复制';
      copy.onclick = async () => {
        try { await navigator.clipboard.write([new ClipboardItem({'image/png':outputs[0].blob})]); toast('图片已复制，可以直接粘贴。'); clearOutputs(); }
        catch { toast('复制失败，可保存 PNG 后发送。', true, 0); }
      };
      const saveButton = document.createElement('button'); saveButton.textContent = '保存 PNG'; saveButton.onclick = () => save(0);
      $('toast').append(copy, saveButton);
    }
    if (duration) toastTimer = setTimeout(() => { $('toast').style.display = 'none'; }, duration);
  }
  function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function setBusy(value, scanning = false) {
    busy = value;
    for (const id of ['generate','reload','all','none','ai','title','theme','length']) $(id).disabled = value;
    document.querySelectorAll('[data-gpt-share-single]').forEach(button => { button.disabled = value; });
    $('cancel').style.display = value && scanning ? 'block' : 'none';
  }
  function messages() {
    const main = document.querySelector('main') || document.body;
    const found = [...main.querySelectorAll('[data-message-author-role="user"], [data-message-author-role="assistant"]')]
      .filter(el => !el.parentElement?.closest('[data-message-author-role]') && !host.contains(el));
    for (const node of found) nodeRoles.set(node, node.getAttribute('data-message-author-role'));
    const unitSelector = '[data-content-search-unit-key], [data-chatgpt-search-unit-key]';
    const add = (node, role) => {
      if (!node || host.contains(node) || found.some(existing => existing === node || existing.contains(node) || node.contains(existing))) return;
      nodeRoles.set(node, role); found.push(node);
    };
    // Current web renderer: user bubbles and assistant headings live in search units.
    for (const bubble of main.querySelectorAll('[data-user-message-bubble]')) add(bubble.closest(unitSelector) || bubble, 'user');
    for (const marker of main.querySelectorAll('[data-conversation-role="assistant"]')) add(marker.closest(unitSelector) || marker.parentElement, 'assistant');
    // Virtualization can leave a partial message without its heading in the DOM.
    for (const unit of main.querySelectorAll(unitSelector)) {
      const label = unit.getAttribute('data-content-search-unit-key') || unit.getAttribute('data-chatgpt-search-unit-key') || '';
      const role = /:user$/.test(label) ? 'user' : /:assistant$/.test(label) ? 'assistant' : null;
      if (role && unit.querySelector('[data-user-message-bubble], [data-markdown-text-style], [class*="MarkdownRoot-"]')) add(unit, role);
    }
    return found.sort((a,b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }
  const roleOf = node => nodeRoles.get(node) || node.getAttribute('data-message-author-role');
  function keyOf(node) {
    const turn = node.closest('[data-testid^="conversation-turn-"]');
    const role = roleOf(node);
    const unit = node.closest('[data-content-search-unit-key], [data-chatgpt-search-unit-key]');
    const content = node.matches('[data-chatgpt-selection-message-id]') ? node : node.querySelector('[data-chatgpt-selection-message-id]');
    const userTurn = role === 'user' ? node.closest('[data-turn-key]')?.getAttribute('data-turn-key') : null;
    const searchIds = node.closest('[data-chatgpt-search-message-ids]')?.getAttribute('data-chatgpt-search-message-ids');
    const id = node.getAttribute('data-message-id') || content?.getAttribute('data-chatgpt-selection-message-id') || userTurn || searchIds?.trim().split(/\s+/)[0];
    if (id) return `${role}:${id}`;
    if (turn) return `${turn.getAttribute('data-testid')}:${role}:${[...turn.querySelectorAll('[data-message-author-role]')].indexOf(node)}`;
    if (unit) return `${role}:${unit.getAttribute('data-content-search-unit-key') || unit.getAttribute('data-chatgpt-search-unit-key')}`;
    if (!nodeKeys.has(node)) nodeKeys.set(node, `node:${++nodeCounter}`);
    return nodeKeys.get(node);
  }
  const mathProps = ['display','position','top','left','right','bottom','width','height','min-width','vertical-align','font-family','font-size','font-style','font-weight','line-height','letter-spacing','margin-left','margin-right','margin-top','margin-bottom','padding-left','padding-right','border-top-width','border-top-style','border-bottom-width','border-bottom-style','transform','transform-origin','text-align','white-space'];
  const citationSelector = '[data-testid*="citation"], [data-testid*="source-pill"], [data-testid*="source-chip"], [data-citation-id], [data-type="citation"], .citation-link, [class*="Citation"], [class*="citation"]';
  function decorativeImage(img) {
    const url = img.currentSrc || img.src || '';
    if (/\/(?:favicon(?:s)?(?:[/.?]|$)|s2\/favicons)|[?&](?:isFavicon|favicon)=/i.test(url)) return true;
    const rect = img.getBoundingClientRect();
    // A citation container can also include a genuine large illustration.
    if (img.closest(citationSelector) && !(rect.width > 48 && rect.height > 48 || !rect.width && img.naturalWidth > 64 && img.naturalHeight > 64)) return true;
    return rect.width > 0 && rect.height > 0 && rect.width <= 32 && rect.height <= 32 &&
      (img.getAttribute('role') === 'presentation' || img.alt === '' || img.naturalWidth <= 64 && img.naturalHeight <= 64);
  }
  function sourceBadges(node) {
    const badges = new Set();
    const hasBodyImage = el => [...el.querySelectorAll('img')].some(img => !decorativeImage(img));
    node.querySelectorAll(citationSelector).forEach(el => {
      if (el.tagName !== 'IMG' && !hasBodyImage(el)) badges.add(el);
    });
    // Some ChatGPT source pills have only a popover marker and a favicon,
    // without any citation attributes. Remove the compact control as a whole.
    node.querySelectorAll('img').forEach(img => {
      if (!decorativeImage(img)) return;
      for (let el = img.parentElement; el && el !== node; el = el.parentElement) {
        if (el.matches('p,li,blockquote,pre,figure')) break;
        const control = el.matches('a,button,[role="button"],span[data-state],span.inline-flex[class*="rounded"]');
        if (control && el.textContent.trim().length <= 160 && !hasBodyImage(el)) {
          badges.add(el); break;
        }
      }
    });
    return badges;
  }
  function rasterImage(loaded) {
    const canvas = document.createElement('canvas');
    const factor = Math.min(1, 1600 / loaded.naturalWidth, 2400 / loaded.naturalHeight);
    canvas.width = Math.max(1, Math.round(loaded.naturalWidth * factor)); canvas.height = Math.max(1, Math.round(loaded.naturalHeight * factor));
    canvas.getContext('2d').drawImage(loaded, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/png'); canvas.width = 1; canvas.height = 1; return data;
  }
  const cardProps = ['display','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','justify-content','align-items','align-self','align-content','order','grid-column','grid-row','grid-auto-flow','column-gap','row-gap','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-top','border-right','border-bottom','border-left','border-radius','background-color','color','font-size','font-weight','font-style','line-height','text-align','text-decoration','white-space','vertical-align'];
  function cardRoots(node) {
    // Custom diagrams use layout containers rather than semantic Markdown tables.
    return [...node.querySelectorAll('div,section,figure')].filter(el => {
      if (el.closest('pre,.katex,.turn-action-controls') || el.matches('[data-markdown-text-style],.markdown')) return false;
      const css = getComputedStyle(el);
      return !!el.textContent.trim() && (/^(inline-)?(flex|grid)$/.test(css.display) ||
        el.children.length > 0 && ['border-top-width','border-right-width','border-bottom-width','border-left-width'].some(p => parseFloat(css.getPropertyValue(p)) > 0));
    });
  }
  function preserveCardStyle(el, copy) {
    const css = getComputedStyle(el);
    for (const p of cardProps) copy.style.setProperty(p, css.getPropertyValue(p));
    // Resolve source grid tracks into proportions so wide cards fit the PNG width.
    for (const p of ['grid-template-columns','grid-template-rows']) {
      const tracks = css.getPropertyValue(p);
      if (p.endsWith('columns') && /^(?:[\d.]+px\s*)+$/.test(tracks)) {
        copy.style.setProperty(p, tracks.replace(/([\d.]+)px/g, 'minmax(0,$1fr)'));
      } else if (!p.endsWith('rows') || tracks === 'none') copy.style.setProperty(p, tracks);
    }
    copy.style.maxWidth = '100%'; copy.style.minWidth = '0';
  }
  function cardBackground(el) {
    for (let current = el; current; current = current.parentElement) {
      const bg = getComputedStyle(current).backgroundColor;
      if (bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) return bg;
    }
    return '#fff';
  }
  function exportSVG(svg) {
    const copy = svg.cloneNode(true);
    const originals = [svg, ...svg.querySelectorAll('*')];
    const clones = [copy, ...copy.querySelectorAll('*')];
    originals.forEach((el,i) => {
      const c = clones[i], css = getComputedStyle(el);
      for (const attr of [...c.attributes]) {
        if (/^on/i.test(attr.name) || /(?:href)$/i.test(attr.name) && !attr.value.startsWith('#')) c.removeAttribute(attr.name);
      }
      for (const p of ['color','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-opacity','opacity','font-family','font-size','font-weight']) c.style.setProperty(p, css.getPropertyValue(p));
    });
    copy.querySelectorAll('script,style,foreignObject,iframe,image').forEach(el => el.remove());
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const rect = svg.getBoundingClientRect();
    const width = rect.width || Number(svg.getAttribute('width')) || 24;
    const height = rect.height || Number(svg.getAttribute('height')) || 24;
    if (!copy.hasAttribute('viewBox')) copy.setAttribute('viewBox',`0 0 ${width} ${height}`);
    // Rasterize SVG at export resolution while retaining its CSS display size.
    copy.setAttribute('width',width * 2); copy.setAttribute('height',height * 2);
    copy.style.width = `${width * 2}px`; copy.style.height = `${height * 2}px`;
    const img = document.createElement('img');
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copy))}`;
    img.alt = svg.getAttribute('aria-label') || '';
    img.style.cssText = `display:inline-block;width:${width}px;height:${height}px;max-width:100%;margin:0;vertical-align:middle;flex-shrink:0`;
    return img;
  }
  function cleanMessage(node) {
    const copy = node.cloneNode(true);
    const original = [node, ...node.querySelectorAll('*')];
    const cloned = [copy, ...copy.querySelectorAll('*')];
    const badges = sourceBadges(node);
    const cards = cardRoots(node);
    original.forEach((el, i) => {
      const c = cloned[i];
      if (badges.has(el)) { c.remove(); return; }
      if (c !== copy && !copy.contains(c)) return;
      c.removeAttribute('id');
      for (const attr of [...c.attributes]) if (/^on/i.test(attr.name)) c.removeAttribute(attr.name);
      c.removeAttribute('style');
      if (cards.some(root => root === el || root.contains(el))) preserveCardStyle(el, c);
      else if (Number(getComputedStyle(el).fontWeight) >= 600) c.style.fontWeight = getComputedStyle(el).fontWeight;
      if (cards.includes(el) && !cards.some(root => root !== el && root.contains(el))) c.style.backgroundColor = cardBackground(el);
      if (el.tagName.toLowerCase() === 'svg' && !el.closest('.katex')) {
        c.replaceWith(exportSVG(el)); return;
      }
      if (el.closest('.katex')) {
        const css = getComputedStyle(el);
        for (const p of mathProps) c.style.setProperty(p, css.getPropertyValue(p));
      }
      if (el.tagName === 'CANVAS') {
        try { const img = document.createElement('img'); img.src = el.toDataURL(); c.replaceWith(img); }
        catch { c.replaceWith(document.createTextNode('[画布无法读取]')); }
      }
      if (el.tagName === 'IMG') {
        if (decorativeImage(el)) { c.remove(); return; }
        c.src = el.currentSrc || el.src || el.getAttribute('data-src') || '';
        // Capture an already loaded, origin-clean image without requesting it again.
        if (el.complete && el.naturalWidth) { try { c.src = rasterImage(el); } catch { /* use the image loader below */ } }
        for (const attr of ['srcset','loading','width','height','crossorigin','referrerpolicy']) c.removeAttribute(attr);
      }
      // Image cards may mark the visible image aria-hidden because the button labels it.
      const hasImage = el.tagName === 'IMG' || el.querySelector('img');
      if (el.hidden || el.getAttribute('aria-hidden') === 'true' && !hasImage && !el.closest('.katex')) c.remove();
    });
    copy.querySelectorAll('script,style,iframe,video,audio,form,input,textarea,select,.turn-action-controls,.sr-only,.katex-mathml').forEach(el => el.remove());
    // <picture> sources can override an embedded data URL inside the export frame.
    copy.querySelectorAll('picture source').forEach(el => el.remove());
    copy.querySelectorAll('button').forEach(el => {
      // Image cards are buttons too: unwrap them, preserving their actual content.
      if (el.querySelector('img')) el.replaceWith(...el.childNodes);
      else el.remove();
    });
    copy.querySelectorAll('svg').forEach(el => { if (!el.closest('.katex')) el.remove(); });
    copy.querySelectorAll('a').forEach(el => {
      if (/^javascript:/i.test(el.getAttribute('href') || '')) el.removeAttribute('href');
    });
    // Code headers (language/copy controls) are outside <code> and should not become paragraphs.
    copy.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if (code) pre.replaceChildren(code);
    });
    if (roleOf(node) === 'user') copy.setAttribute('data-message-author-role','user');
    return copy;
  }
  function collect(prepend = false) {
    const nodes = messages();
    const keys = nodes.map(keyOf);
    let inserted = 0;
    nodes.forEach((node, i) => {
      const key = keys[i], role = roleOf(node);
      const raw = node.innerHTML;
      const old = records.findIndex(r => r.key === key);
      const cached = snapshots.get(node);
      if (old >= 0 && cached?.key === key && cached.raw === raw) return;
      const copy = cleanMessage(node);
      const record = { key, role, copy, text: copy.textContent.trim() || (copy.querySelector('img') ? '[图片]' : '') };
      if (!record.text) return;
      snapshots.set(node, {key,raw});
      if (old >= 0) { records[old] = record; return; }
      const next = keys.slice(i + 1).map(k => records.findIndex(r => r.key === k)).find(index => index >= 0);
      const prev = i ? records.findIndex(r => r.key === keys[i - 1]) : -1;
      records.splice(next !== undefined ? next : prev >= 0 ? prev + 1 : prepend ? inserted : records.length, 0, record);
      selected.add(key); inserted++;
    });
  }
  function scroller() {
    const node = messages()[0];
    for (let el = node?.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return document.scrollingElement;
  }
  function assertSource() {
    if (location.href !== sourceURL) throw new Error('对话页面已经切换，请在新对话中重新读取。');
  }
  async function scan() {
    if (busy) return;
    sourceURL = location.href; stop = false;
    records = []; snapshots = new WeakMap(); selected.clear(); clearOutputs(); showSelection();
    setBusy(true, true);
    const scroll = scroller(), oldTop = scroll.scrollTop;
    const reversed = getComputedStyle(scroll).flexDirection === 'column-reverse';
    const extent = () => Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    const readTop = () => reversed ? extent() + scroll.scrollTop : scroll.scrollTop;
    const setTop = value => { scroll.scrollTop = reversed ? value - extent() : value; };
    const oldBehavior = scroll.style.scrollBehavior, oldSnap = scroll.style.scrollSnapType;
    scroll.style.scrollBehavior = 'auto'; scroll.style.scrollSnapType = 'none';
    let complete = false;
    const started = Date.now();
    try {
      collect();
      let topStable = 0, lastFirst = '';
      // Revisit the top until both the position and oldest loaded turn stop changing.
      for (let i = 0; i < 20 && topStable < 3; i++) {
        assertSource(); if (stop) break;
        setTop(0); await wait(240); collect(true);
        const first = messages()[0]; const firstKey = first ? keyOf(first) : '';
        topStable = readTop() <= 2 && firstKey === lastFirst ? topStable + 1 : 0;
        lastFirst = firstKey;
      }
      if (topStable < 3 && !stop) throw new Error('历史消息仍在加载，暂时无法确认已读到开头，请稍后重新读取。');
      let bottomStable = 0, lastSignature = '';
      for (let i = 0; i < 600 && !stop; i++) {
        assertSource(); collect();
        status(`正在读取对话… 已找到 ${records.length} 条消息。\n页面会自动滚动，读取后恢复原位置。`);
        const bottom = extent();
        const signature = `${scroll.scrollHeight}:${records.length}:${messages().at(-1) ? keyOf(messages().at(-1)) : ''}`;
        if (readTop() >= bottom - 3) {
          bottomStable = signature === lastSignature ? bottomStable + 1 : 0;
          if (bottomStable >= 3) { complete = true; break; }
        } else bottomStable = 0;
        lastSignature = signature;
        setTop(Math.min(bottom, readTop() + Math.max(240, scroll.clientHeight * .7)));
        await wait(180);
        if (Date.now() - started > 90000) break;
      }
      if (!records.length) throw new Error('没有识别到对话。请打开一段 ChatGPT 对话，等回答结束后重试。');
      if (sourceURL === location.href) {
        renderList();
        status(complete ? `已读取 ${records.length} 条消息。可全选，或只勾选要分享的内容。` : `读取已停止，目前找到 ${records.length} 条消息。尚未确认整段完整，可重新读取。`, !complete);
      }
    } catch (error) { renderList(); status(error.message, true); }
    finally {
      if (sourceURL === location.href) scroll.scrollTop = oldTop;
      scroll.style.scrollBehavior = oldBehavior; scroll.style.scrollSnapType = oldSnap;
      setBusy(false); updateCount();
    }
  }
  function updateCount() { $('count').textContent = `${selected.size} / ${records.length} 条`; }
  function renderList() {
    $('list').replaceChildren();
    records.forEach((record, i) => {
      const label = document.createElement('label'); label.className = 'row';
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(record.key);
      checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(record.key) : selected.delete(record.key); updateCount(); });
      const span = document.createElement('span'), title = document.createElement('b'), text = document.createElement('small');
      title.textContent = `${i + 1} · ${record.role === 'user' ? '你' : 'ChatGPT'}`;
      text.textContent = record.text.slice(0, 220);
      span.append(title, text); label.append(checkbox, span); $('list').append(label);
    }); updateCount();
  }
  function clearOutputs() { for (const out of outputs) URL.revokeObjectURL(out.url); outputs = []; $('previews').replaceChildren(); }
  function showSelection() {
    $('list').style.display = 'block'; $('previews').style.display = 'none';
    $('back').hidden = true; $('generate').hidden = false;
    ui.querySelector('.options').style.display = 'grid'; ui.querySelector('.tools').style.display = 'flex';
  }
  function makeFrame(dark) {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('aria-hidden', 'true'); frame.dataset.html2canvasIgnore = 'true';
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;height:1000px;border:0;pointer-events:none;';
    document.body.append(frame);
    const d = frame.contentDocument;
    const bg = dark ? '#17221d' : '#ffffff', fg = dark ? '#e2ebe5' : '#20312a';
    d.open(); d.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'); d.close();
    const style = d.createElement('style');
    style.textContent = `*{box-sizing:border-box}html,body{margin:0;padding:0;background:${bg};color:${fg};font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif;font-size:18px;line-height:1.75}#sheet{width:760px;padding:32px 38px 24px;background:${bg};overflow:hidden}
    h1{font-size:27px;line-height:1.45;margin:0 0 9px;overflow-wrap:anywhere}.meta,.foot{font-size:12px;color:${dark?'#9bab9f':'#76837b'}}.head{margin-bottom:24px;border-bottom:1px solid ${dark?'#34483b':'#e0e9e3'};padding-bottom:20px}.msg{padding:20px 24px;margin:16px 0;border:1px solid ${dark?'#34483b':'#e0e9e3'};border-radius:14px;overflow:hidden;background:${bg};break-inside:avoid}.msg.user{background:${dark?'#253c2d':'#f1f6f2'}}.role{font-size:12px;line-height:1.5;color:${dark?'#b1c4b6':'#52745c'};font-weight:700;margin-bottom:12px}.content{overflow-wrap:anywhere}.content div{max-height:none;overflow:visible}.content p{margin:0 0 14px}.content p:last-child{margin-bottom:0}.content h1,.content h2,.content h3,.content h4{font-weight:700;margin:22px 0 12px;line-height:1.5}.content h1{font-size:26px}.content h2{font-size:23px}.content h3{font-size:21px}.content ul,.content ol{padding-left:25px;margin:12px 0}.content li{margin:5px 0}.content blockquote{margin:16px 0;padding:4px 0 4px 16px;border-left:3px solid #83a28a;color:${dark?'#b6c7bc':'#586d60'}}.content a{color:${dark?'#98d8b6':'#236b4b'};text-decoration:underline}.content pre{background:${dark?'#111a15':'#f4f6f4'};border-radius:9px;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font-size:14px;line-height:1.6;margin:16px 0}.content code{font-family:Menlo,Consolas,monospace;font-size:15px;white-space:pre-wrap}.content pre code{font-size:inherit}.content table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px;margin:16px 0}.content td,.content th{border:1px solid ${dark?'#425347':'#dce5de'};padding:9px;overflow-wrap:anywhere}.content th{background:${dark?'#25382b':'#edf3ee'}}.content img{display:block;max-width:100%;max-height:1800px;height:auto;margin:12px 0;object-fit:contain}.content hr{border:0;border-top:1px solid ${dark?'#34483b':'#dfe7e1'};margin:20px 0}.content [data-message-author-role=user],.content .whitespace-pre-wrap{white-space:pre-wrap}.foot{padding-top:16px;margin-top:18px;border-top:1px solid ${dark?'#34483b':'#e0e9e3'}}.gap{font-size:12px;text-align:center;color:${dark?'#9bab9f':'#76837b'};margin:10px 0}.placeholder{padding:16px;border:1px dashed #83998a;border-radius:8px;font-size:13px}.katex-mathml{display:none}.katex{font-size:1.1em!important}.katex-display{display:block;text-align:center;margin:16px 0;overflow:hidden}`;
    d.head.append(style);
    const sheet = d.createElement('div'); sheet.id = 'sheet'; d.body.append(sheet);
    // Reuse the fonts the site has already loaded, including KaTeX's math fonts.
    for (const face of document.fonts) { try { d.fonts.add(face); } catch { /* fallback to system fonts */ } }
    return { frame, d, sheet, bg };
  }
  async function embedImages(sheet) {
    let failed = 0;
    const pending = new Map();
    await Promise.all([...sheet.querySelectorAll('img')].map(async img => {
      const url = img.src;
      try {
        if (!pending.has(url)) pending.set(url, embedImage(url));
        img.src = await pending.get(url); await img.decode();
      } catch {
        failed++;
        const placeholder = sheet.ownerDocument.createElement('div'); placeholder.className = 'placeholder';
        placeholder.textContent = `[图片无法嵌入${img.alt ? `：${img.alt}` : '，原站未允许读取'}]`; img.replaceWith(placeholder);
      }
    })); return failed;
  }
  async function loadImage(url, cors = false) {
    const loaded = new Image();
    if (cors) loaded.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { loaded.src = ''; reject(new Error('图片读取超时')); }, 8000);
      loaded.onload = () => { clearTimeout(timer); resolve(); };
      loaded.onerror = () => { clearTimeout(timer); reject(new Error('图片读取失败')); };
      loaded.src = url;
    });
    if (!loaded.naturalWidth || !loaded.naturalHeight) throw new Error('图片为空');
    return loaded;
  }
  function requestImageBlob(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('请更新油猴脚本以启用跨域配图读取')); return; }
      // Only retrieve an image URL already present in this reply. No page text or cookies are sent.
      GM_xmlhttpRequest({method:'GET', url, anonymous:true, responseType:'blob', timeout:12000,
        onload: response => {
          if (response.status < 200 || response.status >= 300 || !response.response || response.response.size > 25000000) { reject(new Error('图片响应无效')); return; }
          resolve(response.response);
        },
        onerror: () => reject(new Error('图片请求失败')), ontimeout: () => reject(new Error('图片请求超时')),
        onabort: () => reject(new Error('图片请求已取消'))
      });
    });
  }
  async function embedImage(url) {
    const parsed = new URL(url, location.href);
    if (!['https:','http:','data:','blob:'].includes(parsed.protocol)) throw new Error('不支持的图片地址');
    try { return rasterImage(await loadImage(url, /^https?:/.test(parsed.protocol))); }
    catch (error) {
      if (!/^https?:/.test(parsed.protocol)) throw error;
      // Same-origin protected attachments can use the existing site session.
      let blob;
      if (parsed.origin === location.origin) {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(url, {credentials:'same-origin', signal:controller.signal});
          if (!response.ok) throw new Error('图片请求失败');
          blob = await response.blob();
          if (blob.size > 25000000) throw new Error('图片过大');
        } finally { clearTimeout(timer); }
      } else blob = await requestImageBlob(url);
      const objectURL = URL.createObjectURL(blob);
      try { return rasterImage(await loadImage(objectURL)); }
      finally { URL.revokeObjectURL(objectURL); }
    }
  }
  // Split at message/block/line boundaries; never allocate an unbounded canvas.
  function cutsFor(sheet, maxHeight) {
    const height = Math.ceil(sheet.getBoundingClientRect().height);
    const candidates = new Set([0, height]);
    const occupied = [];
    const rootTop = sheet.getBoundingClientRect().top;
    sheet.querySelectorAll('.msg,p,li,pre,tr,blockquote,h1,h2,h3,.gap').forEach(el => {
      const rect = el.getBoundingClientRect(); candidates.add(Math.floor(rect.top - rootTop)); candidates.add(Math.ceil(rect.bottom - rootTop));
    });
    const walker = sheet.ownerDocument.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim() || node.parentElement.closest('.katex')) continue;
      const range = sheet.ownerDocument.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        occupied.push([r.top-rootTop,r.bottom-rootTop]);
        candidates.add(Math.ceil(r.bottom - rootTop + 2));
      }
    }
    sheet.querySelectorAll('img,.katex').forEach(el => {
      const r=el.getBoundingClientRect(); occupied.push([r.top-rootTop,r.bottom-rootTop]);
    });
    const sorted = [...candidates].filter(x => x >= 0 && x <= height && !occupied.some(([top,bottom])=>x>top && x<bottom)).sort((a,b) => a-b);
    const cuts = [0];
    while (cuts.at(-1) + maxHeight < height) {
      const start = cuts.at(-1), ceiling = start + maxHeight;
      const match = sorted.filter(x => x > start + maxHeight * .5 && x <= ceiling).at(-1);
      cuts.push(match || ceiling);
    }
    cuts.push(height); return cuts;
  }
  async function generate(direct = false) {
    // DOM onclick handlers pass an event; only an explicit true requests silent copying.
    direct = direct === true;
    if (busy && !direct) return;
    try { assertSource(); } catch (e) { if (direct) throw e; status(e.message, true); return; }
    const chosen = records.filter(r => selected.has(r.key));
    if (!chosen.length) { status('请至少勾选一条消息。', true); return; }
    if (document.querySelector('button[data-testid="stop-button"]')) { status('回答还在生成，请等它结束后重新读取。', true); return; }
    setBusy(true); clearOutputs();
    let capture;
    try {
      status('正在排版和生成图片…');
      capture = makeFrame($('theme').value === 'dark');
      const {d, sheet, bg} = capture;
      const header = d.createElement('div'); header.className = 'head';
      if ($('title').value.trim()) { const h = d.createElement('h1'); h.textContent = $('title').value.trim(); header.append(h); }
      const meta = d.createElement('div'); meta.className = 'meta'; meta.textContent = `ChatGPT 对话 · ${chosen.length} 条消息`; header.append(meta); sheet.append(header);
      let previousIndex = -1;
      for (const record of chosen) {
        const index = records.indexOf(record);
        if (previousIndex >= 0 && index > previousIndex + 1) { const gap = d.createElement('div'); gap.className = 'gap'; gap.textContent = `已省略 ${index-previousIndex-1} 条消息`; sheet.append(gap); }
        const msg = d.createElement('div'); msg.className = `msg ${record.role}`;
        const role = d.createElement('div'); role.className = 'role'; role.textContent = record.role === 'user' ? '你' : 'ChatGPT';
        const body = d.createElement('div'); body.className = 'content'; body.append(d.importNode(record.copy, true));
        msg.append(role, body); sheet.append(msg); previousIndex = index;
      }
      const foot = d.createElement('div'); foot.className = 'foot'; foot.textContent = 'ChatGPT · 对话分享'; sheet.append(foot);
      const failedImages = await embedImages(sheet);
      await d.fonts.ready; await wait(100);
      const height = Math.ceil(sheet.scrollHeight);
      if (direct && height > 32000) throw new Error('这条回答过长，请用“分享为图片”分图保存。');
      const cuts = direct ? [0, height] : cutsFor(sheet, Number($('length').value));
      const scale = direct ? Math.min(2, 32760 / height, Math.sqrt(48000000 / (760 * height))) : 2;
      if (cuts.length > 41) throw new Error('所选内容超过 40 张图片，请减少选择后分批导出。');
      for (let i = 0; i < cuts.length - 1; i++) {
        assertSource();
        status(`正在生成第 ${i+1} / ${cuts.length-1} 张图片…`);
        const canvas = await renderCanvas(sheet, { backgroundColor: bg, scale, width: 760, height: cuts[i+1]-cuts[i], x: 0, y: cuts[i], scrollX: 0, scrollY: 0, windowWidth: 760, windowHeight: 1000, useCORS: true, logging: false, imageTimeout: 8000 });
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        canvas.width = 1; canvas.height = 1;
        if (!blob) throw new Error('图片生成失败，请减少消息数量后重试。');
        outputs.push({blob, url:URL.createObjectURL(blob)});
      }
      if (direct) return {blob: outputs[0].blob, failedImages};
      showPreviews();
      status(`已生成 ${outputs.length} 张高清图片。${failedImages ? `\n${failedImages} 张原图因无法读取已用提示框标明。` : ''}`);
    } catch (error) { clearOutputs(); if (direct) throw error; showSelection(); status(`生成失败：${error.message}`, true); }
    finally { capture?.frame.remove(); if (!direct) setBusy(false); }
  }
  function filename(index) {
    const name = ($('title').value || 'ChatGPT对话').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 70);
    return `${name}-${String(index+1).padStart(2,'0')}.png`;
  }
  function save(index) {
    const a = document.createElement('a'); a.href = outputs[index].url; a.download = filename(index); document.body.append(a); a.click(); a.remove();
  }
  async function copyImage(index) {
    try {
      if (!navigator.clipboard?.write || !globalThis.ClipboardItem) throw new Error('当前浏览器不允许复制图片');
      await navigator.clipboard.write([new ClipboardItem({'image/png':outputs[index].blob})]);
      status(`第 ${index+1} 张图片已复制，可以粘贴给朋友。`);
    } catch { status('浏览器没有允许复制。可点击“保存 PNG”，或右键预览图片复制。', true); }
  }
  function showPreviews() {
    $('list').style.display = 'none'; $('previews').style.display = 'block'; $('back').hidden = false; $('generate').hidden = true;
    ui.querySelector('.options').style.display = 'none'; ui.querySelector('.tools').style.display = 'none';
    outputs.forEach((out, i) => {
      const item = document.createElement('div'); item.className = 'preview';
      const actions = document.createElement('div'); actions.className = 'actions';
      const saveButton = document.createElement('button'); saveButton.textContent = `保存 PNG · ${i+1}/${outputs.length}`; saveButton.onclick = () => save(i);
      const copyButton = document.createElement('button'); copyButton.textContent = '复制图片'; copyButton.onclick = () => copyImage(i);
      const image = document.createElement('img'); image.src = out.url; image.alt = `对话分享图片 ${i+1}`;
      actions.append(saveButton, copyButton); item.append(actions, image); $('previews').append(item);
    });
  }
  function showPanel() {
    lastFocus = document.activeElement; $('veil').style.display = 'block'; $('panel').style.display = 'flex'; $('launch').hidden = true;
    $('title').value = document.title.replace(/\s*[-–|]\s*ChatGPT\s*$/i, '').replace(/^ChatGPT$/i, '');
    $('close').focus();
  }
  async function open() {
    if (busy) return;
    clearTimeout(toastTimer); $('toast').style.display = 'none';
    showPanel(); await scan();
  }
  async function openSingle(node) {
    if (busy || !node.isConnected) return;
    const copy = cleanMessage(node);
    const text = copy.textContent.trim() || (copy.querySelector('img') ? '[图片]' : '');
    if (!text) return;
    sourceURL = location.href; stop = false;
    const key = keyOf(node);
    records = [{key, role: roleOf(node), copy, text}]; selected = new Set([key]);
    clearOutputs(); renderList();
    $('title').value = document.title.replace(/\s*[-–|]\s*ChatGPT\s*$/i, '').replace(/^ChatGPT$/i, '');
    if (document.querySelector('button[data-testid="stop-button"]')) { toast('回答还在生成，请等它结束后再复制。'); return; }
    if (!navigator.clipboard?.write || !globalThis.ClipboardItem) { toast('浏览器不支持复制图片，请用“分享为图片”保存。'); return; }
    setBusy(true); toast('正在生成并复制图片…', false, 0);
    // Start clipboard.write in the click gesture; resolve its PNG after rendering.
    const rendering = Promise.resolve().then(() => generate(true));
    const png = rendering.then(result => result.blob); png.catch(() => {});
    let writing;
    try { writing = navigator.clipboard.write([new ClipboardItem({'image/png': png})]); }
    catch (error) { writing = Promise.reject(error); }
    const [rendered, copied] = await Promise.allSettled([rendering, writing]);
    setBusy(false);
    if (rendered.status === 'rejected' || !rendered.value) {
      toast(`生成失败：${rendered.reason?.message || '请稍后重试。'}`, false, 7000); clearOutputs();
    } else if (copied.status === 'rejected') {
      toast('图片已生成，但浏览器未允许复制。', true, 0);
    } else {
      toast(`图片已复制，可以直接粘贴。${rendered.value.failedImages ? `（${rendered.value.failedImages} 张原图无法读取，已标明。）` : ''}`); clearOutputs();
    }
  }
  function close() {
    if (busy) { stop = true; status('正在停止读取…'); return; }
    $('veil').style.display = 'none'; $('panel').style.display = 'none'; $('launch').hidden = false; clearOutputs(); records = []; selected.clear(); lastFocus?.focus();
  }
  $('launch').onclick = open; $('close').onclick = close; $('veil').onclick = close;
  $('reload').onclick = scan; $('cancel').onclick = () => { stop = true; };
  $('all').onclick = () => { selected = new Set(records.map(r=>r.key)); renderList(); };
  $('none').onclick = () => { selected.clear(); renderList(); };
  $('ai').onclick = () => { selected = new Set(records.filter(r=>r.role==='assistant').map(r=>r.key)); renderList(); };
  $('generate').onclick = generate; $('back').onclick = () => { showSelection(); status(`已读取 ${records.length} 条消息。`); };
  ui.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
    if (event.key !== 'Tab' || $('panel').style.display !== 'flex') return;
    const controls = [...$('panel').querySelectorAll('button,input,select')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && ui.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && ui.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('分享当前对话为图片', open);
  const singleStyle = document.createElement('style');
  singleStyle.id = 'gpt-share-single-style';
  singleStyle.textContent = `
    button[data-gpt-share-single]{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex-shrink:0;width:32px;height:32px;min-width:32px;padding:6px;border:0;border-radius:8px;background:transparent;color:inherit;opacity:.65;cursor:pointer;font:500 12px/20px system-ui,-apple-system,"PingFang SC",sans-serif;vertical-align:middle}
    button[data-gpt-share-single]:hover{opacity:1;background:color-mix(in srgb,currentColor 8%,transparent)}
    button[data-gpt-share-single]:focus-visible{opacity:1;outline:2px solid #23845e;outline-offset:2px}
    button[data-gpt-share-single] svg{width:18px;height:18px;flex-shrink:0}
  `;
  document.head.append(singleStyle);
  const singleButtons = new WeakMap();
  function actionBar(node) {
    // The current renderer puts the footer beside the message search unit.
    for (let scope = node, i = 0; scope && scope.tagName !== 'MAIN' && i < 8; scope = scope.parentElement, i++) {
      if (scope.querySelectorAll('[data-conversation-role="assistant"], [data-message-author-role="assistant"]').length > 1) break;
      const copy = scope.querySelector('[data-testid="copy-turn-action-button"]');
      if (copy) return copy.parentElement;
      const bars = [...scope.querySelectorAll('.turn-action-controls')];
      const controls = bars.find(bar => bar.querySelector('button[aria-label="复制"], button[aria-label="Copy"], button[aria-label="更多操作"], button[aria-label="More actions"]'))
        || bars.find(bar => !bar.querySelector('button[aria-label="复制消息"], button[aria-label="Copy message"], button[aria-label="编辑消息"], button[aria-label="Edit message"]'));
      if (controls) return controls;
    }
    // Older layouts without native action markers still get a footer button.
    return node;
  }
  function addSingleButtons() {
    for (const node of messages()) {
      if (roleOf(node) !== 'assistant') continue;
      const bar = actionBar(node);
      const existing = singleButtons.get(node);
      if (existing?.isConnected && existing.parentElement === bar) continue;
      existing?.remove();
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.gptShareSingle = '';
      button.title = '将这条回答复制为图片'; button.setAttribute('aria-label', '将这条回答复制为图片'); button.disabled = busy;
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>';
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openSingle(node); });
      singleButtons.set(node, button); bar.append(button);
    }
  }
  let singleTimer;
  const owned = node => node.nodeType === Node.ELEMENT_NODE && (node === host || node === singleStyle || node.matches('[data-gpt-share-single]'));
  new MutationObserver(changes => {
    if (!changes.some(change => !host.contains(change.target) && !change.target.closest?.('[data-gpt-share-single]') && [...change.addedNodes, ...change.removedNodes].some(node => !owned(node)))) return;
    clearTimeout(singleTimer); singleTimer = setTimeout(addSingleButtons, 150);
  }).observe(document.body, {childList:true, subtree:true});
  addSingleButtons();
})();
