/* ═══════════════════════════════════════
   ASTRA AI — app.js
═══════════════════════════════════════ */

// ─── CONFIG ────────────────────────────────────────────────────
const API_ENDPOINT = "/api/chat";

const PERSONAS = [
  {
    id: 'default', label: '🤖 Astra', emoji: '✦',
    prompt: 'Kamu adalah asisten AI bernama Astra yang cerdas, ramah, dan membantu. Jawab dalam Bahasa Indonesia yang natural.'
  },
  {
    id: 'guru', label: '📚 Guru', emoji: '📚',
    prompt: 'Kamu adalah guru yang sabar dan terstruktur. Jelaskan semua konsep dengan analogi mudah, contoh nyata, dan langkah demi langkah. Pastikan siswa benar-benar paham.'
  },
  {
    id: 'dev', label: '💻 Developer', emoji: '💻',
    prompt: 'Kamu adalah senior software engineer yang ahli. Berikan solusi kode yang bersih, efisien, dan mengikuti best practices. Sertakan komentar kode dan jelaskan time/space complexity bila relevan.'
  },
  {
    id: 'penulis', label: '✍️ Penulis', emoji: '✍️',
    prompt: 'Kamu adalah penulis profesional dengan gaya yang kaya dan ekspresif. Bantu menulis konten yang menarik, persuasif, dan sesuai konteks: artikel, esai, cerita, copywriting.'
  },
  {
    id: 'trans', label: '🌐 Translator', emoji: '🌐',
    prompt: 'Kamu adalah penerjemah profesional yang fasih dalam banyak bahasa. Terjemahkan dengan akurat, perhatikan nuansa budaya dan idiom. Jelaskan pilihan terjemahan bila perlu.'
  },
];

const FORMAT_PROMPTS = {
  default: '',
  singkat: ' Berikan jawaban yang singkat dan langsung ke inti, maksimal 3-4 kalimat.',
  detail:  ' Berikan jawaban yang sangat lengkap dan mendalam dengan semua aspek penting.',
  bullet:  ' Format jawaban kamu sebagai poin-poin / bullet points yang terstruktur.',
  dosen:   ' Jawab seperti dosen akademis: formal, sistematis, dengan referensi konsep jika perlu.',
};

// ─── STATE ─────────────────────────────────────────────────────
let sessions        = JSON.parse(localStorage.getItem('astra_sessions') || '[]');
let currentId       = null;
let pdfContext      = '';
let imageData       = null;
let imageFile       = null;
let isLoading       = false;
let currentPersona  = 'default';
let bookmarks       = JSON.parse(localStorage.getItem('astra_bookmarks') || '[]');
let tokenCount      = 0;
let translateCtx    = null;
let currentUtterance = null;

function saveSessionsLS() { localStorage.setItem('astra_sessions', JSON.stringify(sessions)); }
function saveBookmarksLS() { localStorage.setItem('astra_bookmarks', JSON.stringify(bookmarks)); }
function currentSession()  { return sessions.find(s => s.id === currentId); }
function countTokens(text) { return Math.ceil((text || '').length / 4); }

// ─── INIT ───────────────────────────────────────────────────────
function init() {
  renderPersonas();
  renderSessions();
  if (sessions.length === 0) newChat();
  else loadSession(sessions[0].id);
}

// ─── PERSONAS ──────────────────────────────────────────────────
function renderPersonas() {
  document.getElementById('personaStrip').innerHTML = PERSONAS.map(p =>
    `<button class="persona-pill ${p.id === currentPersona ? 'active' : ''}"
      onclick="setPersona('${p.id}')">${p.label}</button>`
  ).join('');
}

function setPersona(id) {
  currentPersona = id;
  renderPersonas();
  const p = PERSONAS.find(x => x.id === id);
  showToast(`${p.label} aktif`);
}

// ─── MULTI-CHAT / SESSIONS ─────────────────────────────────────
function newChat() {
  const id = 'c' + Date.now();
  sessions.unshift({ id, title: 'Chat Baru', history: [], createdAt: Date.now() });
  saveSessionsLS();
  loadSession(id);
  renderSessions();
  document.getElementById('sidebar').classList.remove('open');
}

function loadSession(id) {
  currentId  = id;
  tokenCount = 0;
  const sess = currentSession();
  renderSessions();
  const area = document.getElementById('chat-area');
  area.innerHTML = '';

  if (!sess || sess.history.length === 0) {
    area.innerHTML = buildEmptyState();
    return;
  }

  sess.history.forEach(m => {
    if (m.role === 'user')      addMessageDOM('user', m.display || m.content);
    else if (m.role === 'assistant') addMessageDOM('ai', m.content);
  });

  tokenCount = sess.history.reduce((a, m) => a + countTokens(m.content), 0);
  updateTokenDisplay();
}

function buildEmptyState() {
  return `<div class="empty-state" id="empty-state">
    <div class="empty-icon">✦</div>
    <div class="empty-title">Halo! Saya Astra</div>
    <div class="empty-desc">Asisten AI untuk tugas, koding, analisis PDF &amp; gambar.</div>
    <div class="suggestions">
      <button class="suggestion-btn" onclick="useSuggestion(this)">
        <div class="suggestion-icon">💻</div>
        <div class="suggestion-text">Buatkan fungsi Python untuk sorting data</div>
      </button>
      <button class="suggestion-btn" onclick="useSuggestion(this)">
        <div class="suggestion-icon">🌐</div>
        <div class="suggestion-text">Buat landing page HTML yang keren</div>
      </button>
      <button class="suggestion-btn" onclick="useSuggestion(this)">
        <div class="suggestion-icon">📐</div>
        <div class="suggestion-text">Jelaskan turunan matematika</div>
      </button>
      <button class="suggestion-btn" onclick="useSuggestion(this)">
        <div class="suggestion-icon">📝</div>
        <div class="suggestion-text">Bantu saya buat esai tentang AI</div>
      </button>
    </div>
  </div>`;
}

function renderSessions() {
  const list = document.getElementById('chatList');
  if (!sessions.length) {
    list.innerHTML = '<div style="padding:16px;font-size:12px;color:var(--muted);text-align:center">Belum ada chat</div>';
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="chat-item ${s.id === currentId ? 'active' : ''}" onclick="loadSession('${s.id}')">
      <span class="chat-item-title">${escHtml(s.title)}</span>
      <button class="chat-item-del" onclick="deleteSession(event,'${s.id}')" title="Hapus">🗑</button>
    </div>`
  ).join('');
}

function deleteSession(e, id) {
  e.stopPropagation();
  sessions = sessions.filter(s => s.id !== id);
  saveSessionsLS();
  if (currentId === id) {
    if (sessions.length) loadSession(sessions[0].id);
    else newChat();
  }
  renderSessions();
}

// ─── PDF ───────────────────────────────────────────────────────
async function handlePDFUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  showToast('📄 Membaca PDF…');
  try {
    const text = await readPDFText(file);
    pdfContext = text;
    document.getElementById('pdf-strip').style.display = 'block';
    document.getElementById('pdf-name').textContent = file.name;
    document.getElementById('pdf-meta').textContent = `${(text.length / 1000).toFixed(1)}k karakter`;
    showToast('PDF berhasil dibaca ✓', 'success');
  } catch (err) {
    showToast('Gagal baca PDF: ' + err.message, 'error');
  }
  e.target.value = '';
}

async function readPDFText(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => {
      const bytes = new Uint8Array(e.target.result);
      let text = '';
      for (let i = 0; i < bytes.length; i++)
        text += (bytes[i] >= 32 && bytes[i] < 127) ? String.fromCharCode(bytes[i]) : ' ';
      text = text.replace(/\s{3,}/g, '\n').trim();
      res(text.substring(0, 6000));
    };
    r.readAsArrayBuffer(file);
  });
}

function removePDF() {
  pdfContext = '';
  document.getElementById('pdf-strip').style.display = 'none';
  showToast('PDF dihapus');
}

// ─── IMAGE ─────────────────────────────────────────────────────
async function handleImageUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  imageFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    imageData = ev.target.result;
    document.getElementById('img-strip').style.display = 'block';
    document.getElementById('imgPreviewThumb').src = imageData;
    document.getElementById('imgFileName').textContent = file.name;
    showToast('Gambar siap dikirim 🖼', 'success');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function removeImage() {
  imageData = null; imageFile = null;
  document.getElementById('img-strip').style.display = 'none';
  showToast('Gambar dihapus');
}

// ─── SEND MESSAGE ──────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if ((!text && !imageData) || isLoading) return;

  document.getElementById('empty-state')?.remove();
  input.value = ''; autoResize(input);

  const sess = currentSession(); if (!sess) return;

  // Build display content
  let displayContent = text;
  if (imageData) {
    displayContent = `<img class="uploaded-img" src="${imageData}"
      onclick="openImgModal('${imageData}')"
      style="cursor:pointer;max-width:220px;border-radius:8px;margin-bottom:6px;display:block">
      ${text || 'Tolong analisis gambar ini.'}`;
  }

  addMessageDOM('user', displayContent);

  // Build API content
  let apiContent = text || 'Tolong analisis gambar ini.';
  if (pdfContext) apiContent = `Konteks dokumen:\n---\n${pdfContext.substring(0, 3000)}\n---\n\nPertanyaan: ${apiContent}`;
  if (imageData)  apiContent += `\n\n[GAMBAR: ${imageFile?.name || 'image'} — deskripsikan dan analisis gambar ini berdasarkan konteks pertanyaan]`;

  const format      = document.getElementById('formatSel').value;
  const formatHint  = FORMAT_PROMPTS[format] || '';
  const persona     = PERSONAS.find(p => p.id === currentPersona);
  const systemPrompt = persona.prompt + formatHint;

  sess.history.push({ role: 'user', content: apiContent, display: displayContent });
  if (sess.title === 'Chat Baru' && text) sess.title = text.substring(0, 40);
  saveSessionsLS(); renderSessions();

  const typingEl = addTypingDOM();
  isLoading = true;
  document.getElementById('send-btn').disabled = true;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sess.history.slice(-14).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const res  = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mendapat respons');

    const reply = data.reply;
    typingEl.remove();
    addMessageDOM('ai', reply);
    sess.history.push({ role: 'assistant', content: reply });
    saveSessionsLS();

    tokenCount += countTokens(apiContent) + countTokens(reply);
    updateTokenDisplay();

    if (imageData) removeImage();

  } catch (err) {
    typingEl.remove();
    addMessageDOM('ai', `⚠️ Error: ${err.message}`);
    showToast(err.message, 'error');
  }

  isLoading = false;
  document.getElementById('send-btn').disabled = false;
}

// ─── ADD MESSAGE DOM ───────────────────────────────────────────
function addMessageDOM(role, text) {
  const area   = document.getElementById('chat-area');
  const div    = document.createElement('div');
  div.className = `msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  if (role === 'user') {
    avatar.textContent = '👤';
  } else {
    const p = PERSONAS.find(x => x.id === currentPersona);
    avatar.textContent = p ? p.emoji : '✦';
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  if (role === 'user') {
    bubble.innerHTML = text;
  } else {
    bubble.innerHTML = renderMarkdown(text);

    // Copy buttons for code blocks
    bubble.querySelectorAll('pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className   = 'copy-btn';
      btn.textContent = 'Salin';
      btn.onclick = () => {
        navigator.clipboard.writeText(pre.querySelector('code')?.textContent || pre.textContent);
        btn.textContent = '✓ Tersalin';
        setTimeout(() => btn.textContent = 'Salin', 2000);
      };
      pre.appendChild(btn);
    });

    // Live preview for HTML code blocks
    const htmlBlock = [...bubble.querySelectorAll('pre code')].find(c =>
      (c.className || '').includes('html') || (c.className || '').includes('lang-html')
    );
    if (htmlBlock) {
      const wrap = document.createElement('div');
      wrap.className = 'preview-wrap';
      wrap.innerHTML = `
        <div class="preview-bar">
          <span>👁 Preview HTML</span>
          <button class="btn-icon" onclick="this.closest('.preview-wrap').querySelector('iframe').style.display=
            this.closest('.preview-wrap').querySelector('iframe').style.display==='none'?'block':'none'">⊡</button>
        </div>`;
      const iframe = document.createElement('iframe');
      iframe.className = 'preview-iframe';
      iframe.sandbox   = 'allow-scripts allow-same-origin';
      wrap.appendChild(iframe);
      bubble.appendChild(wrap);
      setTimeout(() => { iframe.srcdoc = htmlBlock.textContent; }, 50);
    }

    // Bubble toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'bubble-toolbar';

    // TTS button
    const ttsBtn = document.createElement('button');
    ttsBtn.className   = 'bubble-btn';
    ttsBtn.textContent = '🔊 Dengar';
    ttsBtn.onclick = () => speakText(text, ttsBtn);
    toolbar.appendChild(ttsBtn);

    // Bookmark button
    const bkBtn = document.createElement('button');
    bkBtn.className   = 'bubble-btn';
    bkBtn.textContent = '🔖 Simpan';
    bkBtn.onclick = () => toggleBookmark(text, bkBtn);
    toolbar.appendChild(bkBtn);

    // Translate button
    const tlBtn = document.createElement('button');
    tlBtn.className   = 'bubble-btn';
    tlBtn.textContent = '🌐 Terjemahkan';
    tlBtn.onclick = e => openTranslatePopup(e, text, bubble);
    toolbar.appendChild(tlBtn);

    // Copy all button
    const cpBtn = document.createElement('button');
    cpBtn.className   = 'bubble-btn';
    cpBtn.textContent = '📋 Salin';
    cpBtn.onclick = () => { navigator.clipboard.writeText(text); showToast('Disalin!', 'success'); };
    toolbar.appendChild(cpBtn);

    bubble.appendChild(toolbar);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return div;
}

function addTypingDOM() {
  const area = document.getElementById('chat-area');
  const div  = document.createElement('div');
  div.className = 'msg ai';
  const p = PERSONAS.find(x => x.id === currentPersona);
  div.innerHTML = `
    <div class="msg-avatar">${p ? p.emoji : '✦'}</div>
    <div class="msg-bubble">
      <div class="typing"><span></span><span></span><span></span></div>
    </div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
  return div;
}

// ─── TTS ───────────────────────────────────────────────────────
function speakText(text, btn) {
  if (!window.speechSynthesis) { showToast('Browser tidak support TTS', 'error'); return; }
  if (currentUtterance) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
    btn.textContent = '🔊 Dengar'; return;
  }
  const plain = text.replace(/```[\s\S]*?```/g, 'kode').replace(/[*_`#]/g, '').trim();
  const utt   = new SpeechSynthesisUtterance(plain);
  utt.lang = 'id-ID'; utt.rate = 0.95;
  utt.onend = () => { btn.textContent = '🔊 Dengar'; currentUtterance = null; };
  currentUtterance = utt;
  btn.textContent  = '⏹ Stop';
  window.speechSynthesis.speak(utt);
}

// ─── BOOKMARK ──────────────────────────────────────────────────
function toggleBookmark(text, btn) {
  const idx = bookmarks.findIndex(b => b.text === text);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    btn.textContent = '🔖 Simpan'; btn.classList.remove('bookmarked');
    showToast('Bookmark dihapus');
  } else {
    bookmarks.unshift({ text, time: Date.now() });
    btn.textContent = '⭐ Tersimpan'; btn.classList.add('bookmarked');
    showToast('Disimpan ke bookmark ⭐', 'success');
  }
  saveBookmarksLS(); renderBookmarks();
}

function renderBookmarks() {
  const list = document.getElementById('bkList');
  if (!bookmarks.length) {
    list.innerHTML = '<div class="bk-empty">Belum ada yang disimpan.<br>Klik 🔖 pada balasan AI.</div>'; return;
  }
  list.innerHTML = bookmarks.map((b, i) => `
    <div class="bk-item" onclick="copyBookmark(${i})">
      <div class="bk-item-text">${escHtml(b.text.substring(0, 200))}</div>
      <div class="bk-item-time">${new Date(b.time).toLocaleString('id-ID')} · klik untuk salin</div>
    </div>`
  ).join('');
}

function copyBookmark(i) {
  navigator.clipboard.writeText(bookmarks[i].text);
  showToast('Disalin!', 'success');
}

function toggleBookmarks() {
  const panel = document.getElementById('bookmarksPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) renderBookmarks();
}

// ─── TRANSLATE ─────────────────────────────────────────────────
function openTranslatePopup(e, text, bubbleEl) {
  translateCtx = { text, bubbleEl };
  const popup = document.getElementById('translatePopup');
  const rect  = e.target.getBoundingClientRect();
  popup.style.top  = (rect.top - popup.offsetHeight - 8 + window.scrollY) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
  popup.classList.add('open');
  e.stopPropagation();
}

document.addEventListener('click', () =>
  document.getElementById('translatePopup').classList.remove('open')
);

async function doTranslate(lang) {
  if (!translateCtx) return;
  const { text, bubbleEl } = translateCtx;
  document.getElementById('translatePopup').classList.remove('open');
  showToast(`Menerjemahkan ke ${lang}…`);

  try {
    const messages = [
      { role: 'system', content: 'Kamu adalah penerjemah profesional. Terjemahkan teks yang diberikan dengan akurat. Hanya balas dengan hasil terjemahan saja, tanpa penjelasan tambahan.' },
      { role: 'user',   content: `Terjemahkan teks berikut ke bahasa ${lang}:\n\n${text.substring(0, 3000)}` }
    ];
    const res  = await fetch(API_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const box = document.createElement('div');
    box.style.cssText = 'margin-top:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:12.5px;color:var(--muted)';
    box.innerHTML = `<div style="font-size:11px;color:var(--accent2);font-weight:600;margin-bottom:4px">🌐 Terjemahan (${lang})</div>${renderMarkdown(data.reply)}`;
    bubbleEl.appendChild(box);
    showToast(`Terjemahan ${lang} selesai ✓`, 'success');
  } catch (err) {
    showToast('Gagal terjemahkan: ' + err.message, 'error');
  }
}

// ─── IMAGE MODAL ───────────────────────────────────────────────
function openImgModal(src) {
  document.getElementById('modalImg').src = src;
  document.getElementById('imgModal').classList.add('open');
}

// ─── TOKEN COUNTER ─────────────────────────────────────────────
function updateTokenDisplay() {
  document.getElementById('tokenCount').textContent = tokenCount.toLocaleString();
}

// ─── SIDEBAR ───────────────────────────────────────────────────
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
function closeSidebar()  { document.getElementById('sidebar').classList.remove('open'); }

// ─── MARKDOWN ──────────────────────────────────────────────────
function renderMarkdown(text) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${esc(lang)}">${esc(code.trim())}</code></pre>`
  );
  text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g,   '<em>$1</em>');
  text = text.replace(/^### (.+)$/gm, '<strong style="display:block;margin:10px 0 4px">$1</strong>');
  text = text.replace(/^## (.+)$/gm,  '<strong style="display:block;margin:12px 0 4px;font-size:15px">$1</strong>');
  text = text.replace(/^# (.+)$/gm,   '<strong style="display:block;margin:14px 0 6px;font-size:16px">$1</strong>');
  text = text.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  text = text.replace(/<\/ul>\s*<ul>/g, '');
  text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  const parts = text.split(/\n{2,}/);
  return parts.map(p => {
    if (p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<strong')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

// ─── HELPERS ───────────────────────────────────────────────────
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function useSuggestion(btn) {
  const input = document.getElementById('msg-input');
  input.value = btn.querySelector('.suggestion-text').textContent;
  input.focus(); autoResize(input);
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function clearChat() {
  if (!confirm('Hapus semua isi chat ini?')) return;
  const sess = currentSession(); if (!sess) return;
  sess.history = []; sess.title = 'Chat Baru';
  saveSessionsLS(); renderSessions(); loadSession(currentId);
  showToast('Chat dikosongkan');
}

function exportChat() {
  const sess = currentSession();
  if (!sess || !sess.history.length) { showToast('Tidak ada chat', 'error'); return; }
  let out = `=== Astra AI — ${sess.title} ===\nTanggal: ${new Date().toLocaleString('id-ID')}\n\n`;
  sess.history.forEach(m => { out += `[${m.role === 'user' ? 'KAMU' : 'ASTRA'}]\n${m.content}\n\n`; });
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([out], { type: 'text/plain' }));
  a.download = `astra-${Date.now()}.txt`;
  a.click();
  showToast('Chat diekspor ✓', 'success');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = type ? `show ${type}` : 'show';
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = '', 2800);
}

// ─── START ─────────────────────────────────────────────────────
init();
