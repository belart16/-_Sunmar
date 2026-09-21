'use strict';

const COPY_SVG = '<svg class="copy-ico" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M7 2.5h7A1.5 1.5 0 0 1 15.5 4v9A1.5 1.5 0 0 1 14 14.5H7A1.5 1.5 0 0 1 5.5 13V4A1.5 1.5 0 0 1 7 2.5Zm0 1.2A.3.3 0 0 0 6.7 4v9c0 .17.13.3.3.3h7a.3.3 0 0 0 .3-.3V4a.3.3 0 0 0-.3-.3H7ZM3.5 6.2v8.3A1.5 1.5 0 0 0 5 16h6.3v1.2H5A2.7 2.7 0 0 1 2.3 14.5V6.2H3.5Z"/></svg>';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* <img> с автоподбором расширения: пробуем расширение из JSON, затем png/jpg/jpeg/webp.
   Позволяет класть картинки в любом из этих форматов под одним базовым именем. */
function imgTag(folder, file, alt, cls) {
  const base = file.replace(/\.[^.]+$/, '');
  const mm = file.match(/\.([^.]+)$/);
  const stored = mm ? mm[1].toLowerCase() : 'png';
  const exts = [stored, 'png', 'jpg', 'jpeg', 'webp'].filter((v, i, a) => a.indexOf(v) === i);
  const list = exts.map((e) => folder + '/' + base + '.' + e);
  return '<img' + (cls ? ' class="' + cls + '"' : '') + ' loading="lazy" alt="' + esc(alt) +
    '" src="' + list[0] + '" data-exts=\'' + JSON.stringify(list) + '\' data-i="0" onerror="imgFallback(this)">';
}
window.imgFallback = function (img) {
  let list; try { list = JSON.parse(img.dataset.exts); } catch (e) { img.onerror = null; return; }
  const i = (+img.dataset.i || 0) + 1;
  if (i < list.length) { img.dataset.i = i; img.src = list[i]; }
  else { img.onerror = null; img.style.visibility = 'hidden'; }
};

/* построение блоков и навигации */
function copyBtn(vslug, name, small) {
  const cls = small ? 'copy-btn sm' : 'copy-btn';
  return '<button class="' + cls + '" data-code="' + vslug + '" type="button" aria-label="Копировать код «' + esc(name) + '»">' +
    COPY_SVG + '<span class="copy-txt">Копировать</span></button>';
}
function previewDiv(file, alt) {
  if (!file) return '';
  return '<div class="preview">' + imgTag('img/blocks', file, alt, '') + '</div>';
}

function build(data) {
  document.getElementById('hero-title').textContent = data.title;
  const total = data.groups.reduce((n, g) => n + g.blocks.length, 0);
  document.getElementById('hero-subtitle').innerHTML = (data.subtitle_html || '').replace('{TOTAL}', total);

  const nav = document.getElementById('nav');
  const root = document.getElementById('blocks-root');
  const navParts = [], mainParts = [], codeJobs = [];

  for (const group of data.groups) {
    navParts.push('<div class="nav-group"><div class="nav-grp-title">' + esc(group.title) + '</div>');
    mainParts.push('<h2 class="grp-head">' + esc(group.title) + '</h2>');
    for (const b of group.blocks) {
      navParts.push('<a class="nav-link" href="#' + b.slug + '" data-target="' + b.slug + '">' + esc(b.name) + '</a>');
      const single = (b.variants.length === 1 && b.variants[0].label == null);
      const actions = single ? copyBtn(b.variants[0].vslug, b.name, false) : '';
      let body =
        '  <div class="block-head">\n' +
        '    <div class="block-meta"><h3 class="block-title">' + esc(b.name) + '</h3>' +
        '<p class="block-purpose">' + esc(b.purpose) + '</p></div>\n' +
        '    <div class="head-actions">' + actions + '</div>\n' +
        '  </div>';
      if (single) {
        const v = b.variants[0];
        body += '\n  ' + previewDiv(v.preview, b.name) + '<pre class="code"><code id="code-' + v.vslug + '"></code></pre>';
        codeJobs.push(v);
      } else {
        for (const v of b.variants) {
          body += '\n  <div class="variant">\n    ' + previewDiv(v.preview, v.label) +
            '<div class="variant-head"><span class="variant-label">' + esc(v.label || '') + '</span>' +
            copyBtn(v.vslug, v.label || b.name, true) + '</div>\n' +
            '    <pre class="code"><code id="code-' + v.vslug + '"></code></pre>\n  </div>';
          codeJobs.push(v);
        }
      }
      mainParts.push('<section class="block" id="' + b.slug + '" data-name="' + esc(b.name.toLowerCase()) + '">\n' + body + '\n</section>');
    }
    navParts.push('</div>');
  }
  nav.innerHTML = navParts.join('\n');
  root.innerHTML = mainParts.join('\n');
  return codeJobs;
}

/* загрузка кода блоков в <code> */
async function loadCode(v) {
  const el = document.getElementById('code-' + v.vslug);
  if (!el) return;
  try {
    const res = await fetch('data/' + v.code);
    let txt = res.ok ? await res.text() : '/* не удалось загрузить ' + v.code + ' */';
    // Страховка: убрать скрипт авто-перезагрузки, если сервер (напр. Live Server) его вставил
    txt = txt.replace(/\s*<!-- Code injected by live-server -->[\s\S]*?<\/script>/g, '');
    el.textContent = txt;
  } catch (e) {
    el.textContent = '/* ошибка загрузки ' + v.code + ' */';
  }
}

/* копирование, поиск, навигация, пейджер */
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta); return ok;
  }
}

function wire() {
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = document.getElementById('code-' + btn.dataset.code);
      const ok = await copyText(code ? code.textContent : '');
      const txt = btn.querySelector('.copy-txt');
      if (ok) {
        btn.classList.add('done'); txt.textContent = 'Скопировано';
        clearTimeout(btn._t);
        btn._t = setTimeout(() => { btn.classList.remove('done'); txt.textContent = 'Копировать'; }, 1600);
      } else { txt.textContent = 'Не удалось'; }
    });
  });

  const search = document.getElementById('search');
  const blocks = [...document.querySelectorAll('.block')];
  const navlinks = [...document.querySelectorAll('.nav-link')];
  const grpHeads = [...document.querySelectorAll('.grp-head')];
  const empty = document.getElementById('empty');
  const blocksRoot = document.getElementById('blocks-root');
  const counter = document.getElementById('pager-counter');
  const isPhone = () => window.matchMedia('(max-width:560px)').matches;
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase(); let any = false;
    blocks.forEach((b) => { const hit = !q || b.dataset.name.includes(q); b.classList.toggle('hide', !hit); if (hit) any = true; });
    navlinks.forEach((a) => { a.classList.toggle('hide', !!q && !a.textContent.toLowerCase().includes(q)); });
    grpHeads.forEach((h) => {
      let n = h.nextElementSibling, vis = false;
      while (n && !n.matches('.grp-head')) { if (n.classList.contains('block') && !n.classList.contains('hide')) { vis = true; break; } n = n.nextElementSibling; }
      h.classList.toggle('hide', !vis);
    });
    empty.classList.toggle('show', !any);
    if (isPhone()) { blocksRoot.style.display = any ? '' : 'none'; blocksRoot.scrollLeft = 0; updatePager(); }
  });

  const byId = Object.fromEntries(navlinks.map((a) => [a.dataset.target, a]));

  /* мобильная выезжающая панель навигации */
  const sidebar = document.getElementById('sidebar');
  const fab = document.getElementById('nav-toggle');
  const navClose = document.getElementById('nav-close');
  const backdrop = document.getElementById('nav-backdrop');
  const isMobile = () => window.matchMedia('(max-width:880px)').matches;
  const openNav = () => { sidebar.classList.add('open'); document.body.classList.add('nav-open'); if (fab) fab.setAttribute('aria-expanded', 'true'); };
  const closeNav = () => { sidebar.classList.remove('open'); document.body.classList.remove('nav-open'); if (fab) fab.setAttribute('aria-expanded', 'false'); };
  if (fab) fab.addEventListener('click', openNav);
  if (navClose) navClose.addEventListener('click', closeNav);
  if (backdrop) backdrop.addEventListener('click', closeNav);

  /* Надёжный переход к блоку: мгновенный прыжок + «доводка», пока позиция не
     стабилизируется — иначе ленивые картинки, догружаясь, сдвигают цель. */
  function goToBlock(el) {
    let last = null, stable = 0, tries = 0;
    const tick = () => {
      el.scrollIntoView({ block: 'start', behavior: 'auto' });
      const top = Math.round(el.getBoundingClientRect().top);
      if (top === last) { if (++stable >= 2) return; } else { stable = 0; last = top; }
      if (++tries < 24) setTimeout(tick, 55);
    };
    tick();
  }
  navlinks.forEach((a) => a.addEventListener('click', (e) => {
    const el = document.getElementById(a.dataset.target);
    if (!el) return;
    e.preventDefault();
    if (isPhone()) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    } else {
      goToBlock(el);
    }
    navlinks.forEach((x) => x.classList.remove('active'));
    a.classList.add('active');
    if (isMobile()) closeNav();
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  window.addEventListener('resize', () => { if (!isMobile()) closeNav(); if (!isPhone()) blocksRoot.style.display = ''; setupSpy(); });

  /* scroll-spy: десктоп — IntersectionObserver (вертикаль); телефон — горизонтальный пейджер */
  let io = null, rafPending = false;
  function updatePager() {
    if (!isPhone()) { if (counter) counter.textContent = ''; return; }
    const vis = blocks.filter((b) => !b.classList.contains('hide'));
    if (!vis.length) { if (counter) counter.textContent = ''; return; }
    const w = blocksRoot.clientWidth || 1;
    let idx = Math.round(blocksRoot.scrollLeft / w);
    idx = Math.max(0, Math.min(idx, vis.length - 1));
    navlinks.forEach((a) => a.classList.remove('active'));
    const a = byId[vis[idx].id]; if (a) a.classList.add('active');
    if (counter) counter.textContent = (idx + 1) + ' / ' + vis.length;
  }
  const onPagerScroll = () => { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; updatePager(); }); };
  function setupSpy() {
    if (io) { io.disconnect(); io = null; }
    blocksRoot.removeEventListener('scroll', onPagerScroll);
    if (isPhone()) {
      blocksRoot.addEventListener('scroll', onPagerScroll, { passive: true });
      updatePager();
    } else {
      navlinks.forEach((a) => a.classList.remove('active'));
      io = new IntersectionObserver((ents) => {
        ents.forEach((e) => { if (e.isIntersecting) { navlinks.forEach((a) => a.classList.remove('active')); const a = byId[e.target.id]; if (a) a.classList.add('active'); } });
      }, { rootMargin: '-18% 0px -72% 0px', threshold: 0 });
      blocks.forEach((b) => io.observe(b));
    }
  }
  setupSpy();
}

/* старт */
(async function init() {
  try {
    const blocksData = await fetch('data/blocks.json').then((r) => r.json());
    const jobs = build(blocksData);
    wire();
    await Promise.all(jobs.map(loadCode));
  } catch (e) {
    document.getElementById('blocks-root').innerHTML =
      '<p style="padding:24px;color:#b00">Не удалось загрузить данные. Открой страницу через локальный сервер (Live Server в VS Code) или с сервера — по протоколу file:// браузер блокирует загрузку JSON.</p>';
    console.error(e);
  }
})();
