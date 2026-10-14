/* Moteur du blog : lit les données d'une page articleN.html et construit l'affichage. */

(function () {
  const html = document.documentElement;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  // Mini-Markdown : ## titres, **gras**, *italique*, `code`, [lien](url), ![image](url), listes "- ", citations "> "
  const okUrl = u => /^(https?:\/\/|mailto:|#|[^:]*$)/i.test(u);
  function inline(s) {
    const codes = [];
    s = esc(s).replace(/`([^`]+)`/g, (m, c) => '\u0000' + (codes.push('<code>' + c + '</code>') - 1) + '\u0000');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => okUrl(u) ? '<img src="' + u + '" alt="' + a + '">' : m)
         .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => okUrl(u) ? '<a href="' + u + '"' + (/^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>' : m)
         .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
         .replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => codes[i]);
  }
  const paragraphs = t => t.trim().split(/\n\s*\n/).map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    const h = lines[0].match(/^(#{1,3})\s+(.*)$/);
    if (h && lines.length === 1) return '<h' + Math.max(2, h[1].length) + '>' + inline(h[2]) + '</h' + Math.max(2, h[1].length) + '>';
    if (lines.every(l => /^[-*]\s+/.test(l))) return '<ul>' + lines.map(l => '<li>' + inline(l.replace(/^[-*]\s+/, '')) + '</li>').join('') + '</ul>';
    if (lines.every(l => /^>\s?/.test(l))) return '<blockquote>' + inline(lines.map(l => l.replace(/^>\s?/, '')).join('\n')).replace(/\n/g, '<br>') + '</blockquote>';
    return '<p>' + inline(lines.join('\n')).replace(/\n/g, '<br>') + '</p>';
  }).join('');
  const plain = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^#+\s+/gm, '').replace(/^[-*>]\s+/gm, '').replace(/[*`]/g, '');

  // Thème (partagé avec la page d'accueil)
  function setTheme(t) {
    html.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) {}
    const i = document.getElementById('themeIcon'); if (i) i.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  let saved = null; try { saved = localStorage.getItem('theme'); } catch (e) {}
  setTheme(saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  const btn = document.getElementById('themeToggle');
  if (btn) btn.onclick = () => setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

  // Extrait les données d'un document article
  function read(doc) {
    const meta = n => (doc.querySelector('meta[name="' + n + '"]') || {}).content || '';
    const t = doc.getElementById('texte');
    return {
      titre: (doc.querySelector('title') || {}).textContent || 'Sans titre',
      image: meta('image'), date: meta('date'),
      texte: t ? t.textContent : ''
    };
  }
  const fmtDate = d => { const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'}); };

  const root = document.getElementById('blog-root');
  if (!root) return;

  // Page article : se construit toute seule à partir de ses propres données
  if (root.dataset.mode === 'article') {
    const a = read(document);
    document.title = a.titre;
    root.innerHTML =
      '<a class="back" href="blog.html">← Tous les articles</a>' +
      (a.image ? '<img class="cover" src="' + esc(a.image) + '" alt="">' : '') +
      '<h1>' + esc(a.titre) + '</h1>' +
      (a.date ? '<div class="meta">' + esc(fmtDate(a.date)) + '</div>' : '') +
      '<div class="texte">' + paragraphs(a.texte) + '</div>';
    return;
  }

  // Page liste : cherche article1.html, article2.html, ... (s'arrête après 3 absents d'affilée)
  (async function () {
    const items = []; let miss = 0;
    for (let n = 1; miss < 3 && n < 500; n++) {
      try {
        const r = await fetch('article' + n + '.html', {cache: 'no-cache'});
        if (!r.ok) throw 0;
        const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
        items.push(Object.assign(read(doc), {n})); miss = 0;
      } catch (e) { miss++; }
    }
    items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.n - a.n);
    root.innerHTML = items.length ? '<div class="posts">' + items.map(a =>
      '<a class="post" href="article' + a.n + '.html">' +
      (a.image ? '<img src="' + esc(a.image) + '" alt="">' : '') +
      '<div class="post-body"><h2>' + esc(a.titre) + '</h2>' +
      (a.date ? '<div class="meta">' + esc(fmtDate(a.date)) + '</div>' : '') +
      '<p>' + esc(plain(a.texte).trim().replace(/\s+/g, ' ').slice(0, 160)) + '…</p></div></a>').join('') + '</div>'
      : '<p class="empty">Aucun article pour le moment.</p>';
  })();
})();
