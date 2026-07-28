(function () {
  const root = document.querySelector('[data-elle]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  const STORAGE_KEY = 'oryele-elle-conversation-v5';
  const panel = root.querySelector('.elle-panel');
  const launcher = root.querySelector('.elle-launcher');
  const messagesEl = root.querySelector('[data-elle-messages]');
  const welcome = root.querySelector('[data-elle-welcome]');
  const form = root.querySelector('[data-elle-form]');
  const input = root.querySelector('[data-elle-input]');
  const send = root.querySelector('.elle-send');
  const stop = root.querySelector('[data-elle-stop]');
  const statusEl = root.querySelector('[data-elle-status]');
  const contextEl = root.querySelector('[data-elle-context]');
  const introEl = root.querySelector('[data-elle-intro]');
  const defaultStatus = 'Elle can make mistakes. Verify important information.';
  let pending = false;
  let controller = null;
  let messages = load();
  const page = getPageContext();

  applyPageContext();
  restore();
  updateComposer();

  root.querySelector('[data-elle-close]').onclick = () => setOpen(false);
  root.querySelector('[data-elle-new]').onclick = reset;
  launcher.onclick = () => setOpen(!root.classList.contains('is-open'));
  stop.onclick = () => controller && controller.abort();
  root.querySelectorAll('[data-prompt]').forEach((button) => {
    button.onclick = () => submitPrompt(button.dataset.prompt || '', false);
  });
  input.addEventListener('input', updateComposer);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!send.disabled) form.requestSubmit();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitPrompt(input.value.trim(), false);
  });

  function getPageContext() {
    const body = document.body;
    const path = body.dataset.pagePath || window.location.pathname;
    const title = body.dataset.pageTitle || document.title.replace(/\s*\|\s*Oryele.*$/i, '');
    let section = 'Oryele';
    if (path.startsWith('/pricing')) section = 'Pricing';
    else if (path.startsWith('/careers')) section = 'Careers';
    else if (path.startsWith('/support') || path.startsWith('/resources/help-center')) section = 'Help Center';
    else if (path.startsWith('/platform/')) section = title || 'Platform';
    else if (path.startsWith('/solutions')) section = 'Solutions';
    else if (path.startsWith('/resources')) section = 'Resources';
    else if (path.startsWith('/company')) section = 'Company';
    else if (path.startsWith('/contact')) section = 'Contact';
    return { path, title: title || 'Oryele', section };
  }

  function applyPageContext() {
    contextEl.textContent = page.section;
    if (page.section === 'Pricing') introEl.textContent = 'Ask about plans, capabilities, implementation, or the best fit for your firm.';
    else if (page.section === 'Careers') introEl.textContent = 'Ask about Oryele’s mission, culture, roles, and what it is like to work with us.';
    else if (page.section === 'Help Center') introEl.textContent = 'Ask for product guidance, setup help, troubleshooting, or support information.';
    else if (page.section !== 'Oryele') introEl.textContent = `Ask Elle about ${page.section} or anything else about Oryele.`;
  }

  function setOpen(open) {
    root.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(() => input.focus(), 120);
  }

  async function submitPrompt(text, regenerate) {
    if (pending || (!text && !regenerate)) return;
    if (!regenerate) {
      input.value = '';
      const at = Date.now();
      messages.push({ role: 'user', content: text, at });
      appendUser(text, at);
    }
    pending = true;
    controller = new AbortController();
    welcome.hidden = true;
    removeFollowups();
    updateComposer();
    setStatus('Connecting…');
    const startedAt = performance.now();
    const card = appendAssistant('', Date.now(), true);
    const thinkingTimer = setTimeout(() => showThinking(card), 500);

    try {
      const system = `You are Elle, Oryele’s warm, precise enterprise AI assistant. You are branded as “Ask Elle.” The visitor is viewing the ${page.section} area, page title “${page.title}”, at path ${page.path}. Use this page context as the primary interpretation of short or ambiguous questions, but never claim to see private account data. Answer directly and concisely. Use clear Markdown headings when useful. Never include images, image Markdown, avatar images, or HTML image tags in responses. Include relevant Oryele source links in Markdown. The official support email is support@oryele.com. Never use an @oryele.ai email address.`;
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ stream: true, page, messages: messages.slice(-8).map(({ role, content }) => ({ role, content })), system })
      });
      if (!response.ok) throw new Error(await response.text());
      let firstToken = true;
      let answer = await streamResponse(response, (text) => {
        if (firstToken && text) {
          firstToken = false;
          clearTimeout(thinkingTimer);
          setStatus('Streaming…');
        }
        updateAssistant(card, text, true);
      });
      clearTimeout(thinkingTimer);
      if (!answer.trim()) answer = 'I could not generate a response.';
      updateAssistant(card, answer, false);
      messages.push({ role: 'assistant', content: answer, at: Date.now() });
      save();
      appendFollowups(answer);
      setStatus(`Completed in ${((performance.now() - startedAt) / 1000).toFixed(1)}s`);
      setTimeout(() => !pending && setStatus(defaultStatus), 2600);
    } catch (error) {
      clearTimeout(thinkingTimer);
      if (error && error.name === 'AbortError') {
        const partial = card.dataset.raw || '';
        updateAssistant(card, partial || 'Response stopped.', false);
        if (partial) messages.push({ role: 'assistant', content: partial, at: Date.now() });
        save();
        setStatus('Response stopped');
      } else {
        card.remove();
        console.error('[Elle] /api/chat failed:', error && error.message ? error.message : error);
        appendError('I’m having trouble reaching the AI service. Please try again in a few moments.');
        setStatus('Unable to contact Elle');
      }
    } finally {
      pending = false;
      controller = null;
      updateComposer();
      input.focus();
    }
  }

  function sanitizeElleText(text) {
    return String(text || '')
      .replace(/\bartificial intelligence assistant\b/gi, 'Oryele assistant')
      .replace(/\bAI[\s-]?(assistant|chatbot|bot)\b/gi, 'Oryele assistant')
      .replace(/^[ \t]*(?:[*+\u2022]|\d+\.)[ \t]*\**(?:project management|resource management|resource planning|time tracking|timesheets?|billing|invoicing|expense management|collaboration tools|document co[- ]?editing)\b.*$/gim, '')
      .replace(/\n{3,}/g, '\n\n');
  }
  async function streamResponse(response, onUpdate) {
    if (!response.body || !response.body.getReader) {
      const data = await response.json();
      const text = data.content && data.content[0] ? data.content[0].text : '';
      return sanitizeElleText(text);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      lines.forEach((line) => {
        line = line.trim();
        if (!line.startsWith('data:')) return;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content || '';
          if (token) { full += token; onUpdate(sanitizeElleText(full)); }
        } catch (_) {}
      });
    }
    const cleaned = sanitizeElleText(full);
    onUpdate(cleaned);
    return cleaned;
  }

  function appendUser(text, at) {
    const item = document.createElement('article');
    item.className = 'elle-turn elle-turn--user';
    item.innerHTML = `<div class="elle-turn-head"><span class="elle-user-icon">●</span><strong>You</strong><time>${timeLabel(at)}</time></div><div class="elle-user-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
    messagesEl.appendChild(item);
    scrollBottom();
  }

  function appendAssistant(text, at, streaming) {
    const item = document.createElement('article');
    item.className = `elle-turn elle-turn--assistant${streaming ? ' is-streaming' : ''}`;
    item.dataset.raw = text || '';
    item.innerHTML = `<div class="elle-turn-head"><span class="elle-mini-avatar"><img src="/elle-avatar.png" alt=""></span><strong>Elle</strong><time>${timeLabel(at)}</time></div><div class="elle-answer"></div>`;
    messagesEl.appendChild(item);
    scrollBottom();
    return item;
  }

  function showThinking(item) {
    if (!item || item.dataset.raw) return;
    item.querySelector('.elle-answer').innerHTML = '<span class="elle-thinking-dots" aria-label="Elle is thinking"><i></i><i></i><i></i></span>';
  }

  function updateAssistant(item, text, streaming) {
    item.dataset.raw = text;
    item.classList.toggle('is-streaming', streaming);
    const answer = item.querySelector('.elle-answer');
    if (streaming) answer.innerHTML = `<div class="elle-answer-content">${escapeHtml(stripImages(text)).replace(/\n/g, '<br>')}<span class="elle-cursor"></span></div>`;
    else {
      const cleaned = extractLinks(stripImages(text));
      answer.innerHTML = `<div class="elle-answer-content">${renderMarkdown(cleaned.body)}</div>`;
      addCitations(item, cleaned.links);
      addTools(item, text);
    }
    scrollBottom();
  }

  function stripImages(value) {
    return String(value || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<img\b[^>]*>/gi, '');
  }

  function extractLinks(text) {
    const links = [];
    const seen = {};
    const body = String(text || '');
    body.replace(/\[([^\]]+)\]\s*\(\s*((?:https?:\/\/|\/)[^)\s]+)\s*\)/g, (_, title, url) => {
      if (!seen[url]) { seen[url] = true; links.push({ title, url }); }
      return _;
    });
    links.sort((a, b) => a.title.localeCompare(b.title));
    return { body, links: links.slice(0, 6) };
  }

  function addCitations(item, links) {
    if (!links.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'elle-citations';
    wrap.innerHTML = `<strong>Sources (${links.length})</strong><div>${links.map((link) => `<a href="${escapeAttr(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.title)} ↗</a>`).join('')}</div>`;
    item.appendChild(wrap);
  }

  function addTools(item, text) {
    const tools = document.createElement('div');
    tools.className = 'elle-tools';
    tools.innerHTML = '<button data-copy>Copy</button><button data-feedback="yes">Helpful</button><button data-feedback="no">Not helpful</button><button data-regenerate>Regenerate</button>';
    item.appendChild(tools);
    tools.querySelector('[data-copy]').onclick = async function () { try { await navigator.clipboard.writeText(text); this.textContent = 'Copied'; } catch (_) { this.textContent = 'Copy failed'; } };
    tools.querySelectorAll('[data-feedback]').forEach((button) => button.onclick = function () { tools.querySelectorAll('[data-feedback]').forEach((b) => b.disabled = true); button.textContent = button.dataset.feedback === 'yes' ? 'Helpful ✓' : 'Not helpful ✓'; });
    tools.querySelector('[data-regenerate]').onclick = () => { if (pending || !messages.length || messages[messages.length - 1].role !== 'assistant') return; messages.pop(); item.remove(); save(); removeFollowups(); submitPrompt('', true); };
  }

  function appendFollowups(answer) {
    removeFollowups();
    const lower = answer.toLowerCase();
    const prompts = lower.includes('workflow') ? ['Show an example workflow', 'How are approvals handled?', 'What can trigger a workflow?'] : lower.includes('security') ? ['Explain the security controls', 'How is access governed?', 'What audit evidence is available?'] : ['Tell me more', 'Give me a practical example', 'What should I do next?'];
    const wrap = document.createElement('div');
    wrap.className = 'elle-followups';
    wrap.innerHTML = '<strong>Suggested follow-up questions</strong><div></div>';
    prompts.forEach((prompt) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = prompt; button.onclick = () => submitPrompt(prompt, false); wrap.lastElementChild.appendChild(button); });
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  function renderMarkdown(value) {
    let safe = escapeHtml(stripImages(value));

    // Anchors are stashed as placeholders so later passes (bare email/URL
    // linkifying, <br> insertion) cannot match inside generated markup.
    const anchors = [];
    const stash = (html) => `\u0000A${anchors.push(html) - 1}\u0000`;

    // Markdown links. \s* absorbs the stray space some models emit between
    // the closing bracket and the opening parenthesis, which previously left
    // the whole link rendering as literal text.
    safe = safe.replace(
      /\[([^\]]+)\]\s*\(\s*((?:https?:\/\/|mailto:|\/)[^)\s]+)\s*\)/g,
      (_, title, url) => { const tail = url.match(/[.,;:]+$/); if (tail) { url = url.slice(0, url.length - tail[0].length); title = title.replace(/[.,;:]+\s*$/, ''); } return stash(`<a href="${escapeAttr(url)}"${url.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${title}</a>`) + (tail ? tail[0] : ''); }
    );

    // Bare addresses and URLs, for when the model skips link syntax entirely.
    safe = safe.replace(
      /(^|[\s(])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)(?=[\s).,;:]|$)/g,
      (_, lead, addr) => lead + stash(`<a href="mailto:${escapeAttr(addr)}">${addr}</a>`)
    );
    safe = safe.replace(
      /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
      (_, lead, url) => lead + stash(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    );

    safe = safe.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${stash(code.replace(/^\n+|\n+$/g, ''))}</code></pre>`);
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    safe = safe.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    safe = safe.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    safe = safe.replace(/^[-*] (.+)$/gm, '<li>$1</li>');

    // Collapse the newlines inside a list block before <br> insertion runs,
    // otherwise every item is separated by a stray <br> between </li> and <li>.
    safe = safe.replace(/((?:<li>.*?<\/li>\s*)+)/gs, (block) => `<ul>${block.replace(/\s*\n\s*/g, '')}</ul>`);

    // Block elements cannot sit inside <p>. Left nested, the browser
    // auto-closes the paragraph and adds its own margin, which is the
    // remaining source of the oversized gaps.
    safe = safe.replace(/\n*<(ul|pre|h2|h3|h4)>/g, '</p><$1>');
    safe = safe.replace(/<\/(ul|pre|h2|h3|h4)>\n*/g, '</$1><p>');

    safe = safe.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
    safe = safe.replace(/\u0000A(\d+)\u0000/g, (_, index) => anchors[Number(index)]);

    return `<p>${safe}</p>`.replace(/<p>\s*(<br>\s*)*<\/p>/g, '');
  }

  function appendError(text) { const item = document.createElement('div'); item.className = 'elle-error'; item.textContent = text; messagesEl.appendChild(item); scrollBottom(); }
  function setStatus(text) { statusEl.textContent = text; }
  function updateComposer() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; send.disabled = pending || !input.value.trim(); send.hidden = pending; stop.hidden = !pending; }
  function reset() { if (controller) controller.abort(); messages = []; messagesEl.innerHTML = ''; welcome.hidden = false; localStorage.removeItem(STORAGE_KEY); pending = false; setStatus(defaultStatus); updateComposer(); }
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { return []; } }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20))); } catch (_) {} }
  function restore() { if (!messages.length) return; welcome.hidden = true; messages.forEach((m) => m.role === 'user' ? appendUser(m.content, m.at) : updateAssistant(appendAssistant(m.content, m.at, false), m.content, false)); }
  function removeFollowups() { messagesEl.querySelectorAll('.elle-followups').forEach((el) => el.remove()); }
  function timeLabel(at) { const seconds = Math.max(0, Math.floor((Date.now() - (at || Date.now())) / 1000)); if (seconds < 60) return 'Just now'; const minutes = Math.floor(seconds / 60); return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`; }
  function scrollBottom() { requestAnimationFrame(() => { const body = root.querySelector('.elle-body'); body.scrollTop = body.scrollHeight; }); }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[c]); }
  function escapeAttr(value) { return escapeHtml(value); }
}());
