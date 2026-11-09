// 操作説明のスライド（public/slides/）。依存なし。
// ・1280×720 の舞台を窓に合わせて拡大・縮小する
// ・← → ・スペース・PageUp / PageDown・Home / End で送る。#n でページを指定。F で全画面
// ・実演のページは、開いたときに iframe の src を入れ、ほかのページへ移ると外す（同じデータを2つの画面で同時に書かない）
// ・アプリは ?space=slides で開く（保存のキーに vrdemo:space:slides: が付き、ふだんのデータとは別になる。ADR-0112）
// ・URL の ?to=名前 のときだけ、表紙に「〇〇様向け」を出す（textContent で入れる）
(() => {
  const SPACE_PREFIX = 'vrdemo:space:slides:';
  const APP_URL = '../?space=slides#';
  const STAGE_W = 1280;
  const STAGE_H = 720;

  const stage = document.getElementById('stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const pageNum = document.getElementById('page-num');
  const pageTitle = document.getElementById('page-title');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  let current = -1;

  // 表紙の宛名（?to=）。長すぎるものは切る
  const to = (new URLSearchParams(location.search).get('to') ?? '').trim().slice(0, 40);
  if (to !== '') {
    const el = document.getElementById('cover-to');
    el.textContent = `${to}様向け`;
    el.hidden = false;
    document.title = `${to}様向け ${document.title}`;
  }

  function fitStage() {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.setProperty('--scale', String(scale));
  }

  const boxOf = (slide) => slide.querySelector('.demo-box');
  const frameOf = (box) => box.querySelector('iframe');
  const appSrc = (box) => APP_URL + box.dataset.route;

  function loadFrame(box) {
    const frame = frameOf(box);
    if (frame.getAttribute('src') !== appSrc(box)) frame.setAttribute('src', appSrc(box));
  }

  function unloadFrame(box) {
    const frame = frameOf(box);
    if (frame.hasAttribute('src')) frame.removeAttribute('src');
    // 外すだけでは前の画面が残るので、空のページにする
    try {
      frame.contentWindow?.location.replace('about:blank');
    } catch {
      // 別のオリジンなど。何もしない
    }
  }

  function pageFromHash() {
    const n = Number.parseInt(location.hash.replace('#', ''), 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), slides.length) - 1 : 0;
  }

  function show(index) {
    const next = Math.min(Math.max(index, 0), slides.length - 1);
    if (next === current) return;
    exitBig();
    if (current >= 0) {
      const box = boxOf(slides[current]);
      if (box) unloadFrame(box);
    }
    slides.forEach((s, i) => {
      s.hidden = i !== next;
    });
    current = next;
    const box = boxOf(slides[current]);
    if (box) loadFrame(box);
    pageNum.textContent = `${current + 1} / ${slides.length}`;
    pageTitle.textContent = slides[current].dataset.title ?? '';
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;
    const hash = `#${current + 1}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  // ［大きく表示］：アプリの枠を窓いっぱいに。iframe は動かさない（動かすと読み直しになる）
  function enterBig(box) {
    document.body.classList.add('is-big');
    box.classList.add('is-big');
    box.querySelector('[data-act="small"]')?.focus();
  }

  function exitBig() {
    const box = document.querySelector('.demo-box.is-big');
    if (!box) return;
    box.classList.remove('is-big');
    document.body.classList.remove('is-big');
    box.closest('.slide')?.querySelector('[data-act="big"]')?.focus();
  }

  // ［説明用データを最初に戻す］：説明用の領域のキーだけ消して読み直す。先に空のページにして、アプリが消したあとに書き戻さないようにする
  function clearSpace(storage) {
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k?.startsWith(SPACE_PREFIX)) keys.push(k);
    }
    for (const k of keys) storage.removeItem(k);
  }

  function resetData(box) {
    const ok = window.confirm(
      '説明用のデータを消して、最初の設定から始め直します。ふだんのデータは消えません。よろしいですか。',
    );
    if (!ok) return;
    const frame = frameOf(box);
    const done = () => {
      clearSpace(window.localStorage);
      clearSpace(window.sessionStorage);
      frame.setAttribute('src', appSrc(box));
    };
    frame.removeAttribute('src');
    frame.addEventListener('load', done, { once: true });
    frame.setAttribute('src', 'about:blank');
  }

  // アプリの中のキーは親に届かないので、送りは起きない。Esc だけは中でも拾って［大きく表示］を戻す（開いている欄が無いとき）
  function watchFrameKeys(frame) {
    frame.addEventListener('load', () => {
      try {
        const win = frame.contentWindow;
        win.addEventListener('keydown', (e) => {
          if (e.key !== 'Escape' || !document.body.classList.contains('is-big')) return;
          const doc = win.document;
          if (doc.querySelector('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')) return;
          exitBig();
        });
      } catch {
        // 別のオリジンなど。Esc は枠の外か［元の大きさに戻す］で
      }
    });
  }

  for (const box of document.querySelectorAll('.demo-box')) watchFrameKeys(frameOf(box));

  document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-act]') : null;
    if (!btn) return;
    const slide = btn.closest('.slide');
    const box = slide ? boxOf(slide) : null;
    if (!box) return;
    if (btn.dataset.act === 'big') enterBig(box);
    else if (btn.dataset.act === 'small') exitBig();
    else if (btn.dataset.act === 'reset') resetData(box);
  });

  prevBtn.addEventListener('click', () => show(current - 1));
  nextBtn.addEventListener('click', () => show(current + 1));

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    const tag = t instanceof Element ? t.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape') {
      exitBig();
      return;
    }
    // 大きく表示している間は送らない
    if (document.body.classList.contains('is-big')) return;
    const onControl = tag === 'BUTTON' || tag === 'A';
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        show(current + 1);
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        show(current - 1);
        break;
      case ' ':
        // ボタン・リンクの上のスペースは押す操作のまま
        if (onControl) return;
        e.preventDefault();
        show(current + (e.shiftKey ? -1 : 1));
        break;
      case 'Home':
        e.preventDefault();
        show(0);
        break;
      case 'End':
        e.preventDefault();
        show(slides.length - 1);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      default:
        break;
    }
  });

  window.addEventListener('hashchange', () => show(pageFromHash()));
  window.addEventListener('resize', fitStage);
  fitStage();
  show(pageFromHash());
})();
