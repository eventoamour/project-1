/* Public interactions only. No staff data or Supabase client is loaded here. */
(() => {
  'use strict';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu-toggle');
  const links = document.querySelector('#main-links');
  const closeMenu = () => {
    menu?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-label', 'Open navigation');
    links?.classList.remove('is-open');
  };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    links.classList.toggle('is-open', open);
  });
  links?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('click', event => {
    if (!header?.contains(event.target)) {
      closeMenu();
      document.querySelectorAll('.venue-dropdown[open]').forEach(el => { el.open = false; });
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (menu?.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); }
      document.querySelectorAll('.venue-dropdown[open]').forEach(el => { el.open = false; el.querySelector('summary').focus(); });
    }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', closeMenu);
  const updateHeader = () => header?.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  const hero = document.querySelector('.hero');
  if (hero) {
    const slides = [...hero.querySelectorAll('.hero-slide')];
    const dots = [...hero.querySelectorAll('[data-slide]')];
    const pause = hero.querySelector('.slide-pause');
    const names = ['GRAND EMPIRE MARQUEE', 'LEGACY EVENT COMPLEX', 'GLORIOUS MARQUEE'];
    let index = 0, timer, paused = motion.matches, inView = true, request = 0;
    const syncTimer = () => {
      clearInterval(timer);
      pause.textContent = paused || motion.matches ? '▷' : 'Ⅱ';
      pause.setAttribute('aria-label', paused || motion.matches ? 'Play slideshow' : 'Pause slideshow');
      if (!paused && !motion.matches && !document.hidden && inView) timer = setInterval(() => show(index + 1), 6000);
    };
    const show = async next => {
      next = (next + slides.length) % slides.length;
      const token = ++request;
      const image = slides[next];
      if (image.dataset.src) {
        image.srcset = image.dataset.srcset;
        image.src = image.dataset.src;
        delete image.dataset.src;
      }
      try { await image.decode(); } catch { return; }
      if (token !== request) return;
      slides[index].classList.remove('is-active');
      index = next;
      slides[index].classList.add('is-active');
      dots.forEach((dot, n) => { dot.classList.toggle('active', n === index); dot.setAttribute('aria-pressed', String(n === index)); });
      hero.querySelector('.slide-count').textContent = `0${index + 1} / 03`;
      hero.querySelector('.hero-venue-name').textContent = names[index];
    };
    dots.forEach((dot, n) => dot.addEventListener('click', () => { show(n); syncTimer(); }));
    pause.addEventListener('click', () => { paused = !paused; syncTimer(); });
    document.addEventListener('visibilitychange', syncTimer);
    motion.addEventListener('change', () => { paused = motion.matches; syncTimer(); });
    // Stop moving content while a visitor is using its controls or links.
    hero.addEventListener('focusin', () => { paused = true; syncTimer(); });
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting; syncTimer(); }).observe(hero);
    syncTimer();
  }

  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => {
    // Content above the fold stays visible if a visitor arrives at an anchor.
    if (!motion.matches && el.getBoundingClientRect().top > innerHeight) el.classList.add('will-reveal');
    revealObserver.observe(el);
  });
  const counters = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    counters.unobserve(entry.target);
    const el = entry.target, target = Number(el.dataset.counter), start = performance.now();
    const draw = now => {
      const progress = motion.matches ? 1 : Math.min((now - start) / 1000, 1);
      const value = Math.round(target * (1 - Math.pow(1 - progress, 3)));
      el.textContent = (el.dataset.prefix || '') + value + (el.dataset.suffix || '');
      if (progress < 1) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }), { threshold: 0.6 });
  document.querySelectorAll('[data-counter]').forEach(el => counters.observe(el));

  // Retain every existing venue gallery image and add a real link as the fallback.
  document.querySelectorAll('figure[class$="-photo"], figure[class*="-photo "]').forEach(figure => {
    const img = figure.querySelector('img');
    if (!img) return;
    const anchor = document.createElement('a');
    anchor.href = img.dataset.full || img.src;
    anchor.dataset.lightbox = '';
    anchor.setAttribute('aria-label', `View ${img.alt}`);
    anchor.style.cssText = 'display:block;height:100%';
    img.before(anchor);
    anchor.append(img);
    const caption = figure.querySelector('span');
    if (caption) anchor.append(caption);
  });
  const galleryLinks = [...document.querySelectorAll('[data-lightbox]')];
  if (galleryLinks.length) {
    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Venue photograph viewer');
    dialog.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close photo viewer">×</button><button type="button" class="lightbox-prev" aria-label="Previous photograph">←</button><div class="lightbox-inner"><img alt=""><p class="lightbox-caption" aria-live="polite"></p></div><button type="button" class="lightbox-next" aria-label="Next photograph">→</button>';
    document.body.append(dialog);
    let active = 0, opener, touchX;
    const visible = () => galleryLinks.filter(link => !link.hidden);
    const update = () => {
      const list = visible();
      active = (active + list.length) % list.length;
      const link = list[active], source = link.querySelector('img');
      const img = dialog.querySelector('img');
      img.src = link.href;
      img.alt = source.alt;
      dialog.querySelector('.lightbox-caption').textContent = `${source.alt} · ${active + 1} / ${list.length}`;
    };
    const close = () => dialog.close();
    dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); opener?.focus(); });
    galleryLinks.forEach(link => link.addEventListener('click', event => {
      event.preventDefault(); opener = link; active = visible().indexOf(link); update();
      dialog.showModal(); document.body.classList.add('modal-open'); dialog.querySelector('.lightbox-close').focus();
    }));
    dialog.querySelector('.lightbox-close').addEventListener('click', close);
    dialog.querySelector('.lightbox-prev').addEventListener('click', () => { active--; update(); });
    dialog.querySelector('.lightbox-next').addEventListener('click', () => { active++; update(); });
    dialog.addEventListener('click', event => { if (event.target === dialog || event.target.classList.contains('lightbox-inner')) close(); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); active++; update(); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); active--; update(); }
    });
    dialog.addEventListener('touchstart', event => { touchX = event.changedTouches[0].screenX; }, { passive: true });
    dialog.addEventListener('touchend', event => {
      const distance = event.changedTouches[0].screenX - touchX;
      if (Math.abs(distance) > 60) { active += distance < 0 ? 1 : -1; update(); }
    }, { passive: true });
  }
  const filters = [...document.querySelectorAll('[data-filter]')];
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    galleryLinks.forEach(link => { link.hidden = button.dataset.filter !== 'all' && link.dataset.category !== button.dataset.filter; });
    document.querySelector('.gallery-status').textContent = `${galleryLinks.filter(link => !link.hidden).length} photographs · ${button.textContent}`;
  }));

  const form = document.querySelector('#quote-form');
  if (form) {
    const status = document.querySelector('#quote-status');
    const phone = document.querySelector('#phone');
    phone.addEventListener('input', () => phone.setCustomValidity(''));
    form.addEventListener('submit', event => {
      event.preventDefault();
      const value = id => document.getElementById(id).value.trim();
      phone.setCustomValidity(phone.value.replace(/\D/g, '').length < 7 ? 'Please enter a phone number with at least 7 digits.' : '');
      if (!form.reportValidity()) { status.textContent = 'Please check the highlighted field.'; status.classList.add('error'); return; }
      const lines = ['Hello Empire Group,', '', 'I would like a quotation for an event.', '', `Name: ${value('name')}`, `Phone: ${value('phone')}`, `Preferred venue: ${value('venue')}`, `Event type: ${value('type')}`, `Preferred date: ${value('date') || 'Not specified'}`, `Estimated guests: ${value('guests') || 'Not specified'}`, `Event details: ${value('details') || 'Not specified'}`];
      // Preserve the existing central quotation destination.
      const url = 'https://wa.me/923218489366?text=' + encodeURIComponent(lines.join('\n'));
      const fallback = document.querySelector('#quote-fallback');
      fallback.href = url; fallback.hidden = false;
      window.open(url, '_blank', 'noopener');
      status.classList.remove('error');
      status.textContent = 'Your enquiry is ready. Press Send in WhatsApp to deliver it. If WhatsApp did not open, use the link below. Your booking is not confirmed yet.';
    });
  }
})();
