const { chromium } = require('./browser.cjs');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'chrome'});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const pages = ['index','about','gallery','contact','book-now','legacy','glorious','grand-empire','garrison','privacy','terms','admin-login'];
  const failures = [];
  for (const route of pages) {
    await page.goto(`http://127.0.0.1:8080/${route}.html`);
    await page.waitForTimeout(150);
    for (const width of [320,375,430,768,1024,1440]) {
      await page.setViewportSize({width,height:1000});
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if(overflow) failures.push(`${route}: overflow at ${width}`);
    }
    if(route === 'index') {
      await page.waitForTimeout(1500);
      await page.screenshot({path:'tools/home-desktop.png',fullPage:true});
      await page.setViewportSize({width:375,height:850});
      await page.screenshot({path:'tools/home-mobile.png',fullPage:true});
      await page.getByRole('button',{name:'Open navigation',exact:true}).click();
      if(!await page.locator('#main-links').isVisible()) failures.push('Mobile menu did not open');
      await page.locator('.venue-dropdown summary').click();
      if(!await page.locator('.venue-dropdown-menu').isVisible()) failures.push('Mobile dropdown did not open');
      await page.keyboard.press('Escape');
    }
    if(route === 'gallery') {
      await page.getByRole('button',{name:'Legacy',exact:true}).click();
      const count = await page.locator('[data-lightbox]:visible').count();
      if(count !== 3) failures.push(`Gallery filtering returned ${count}`);
      await page.locator('[data-lightbox]:visible').first().click();
      const before = await page.locator('.lightbox img').getAttribute('src');
      await page.keyboard.press('ArrowRight');
      if(before === await page.locator('.lightbox img').getAttribute('src')) failures.push('Lightbox next did not work');
      await page.keyboard.press('Escape');
      if(await page.locator('.lightbox').isVisible()) failures.push('Lightbox failed to close');
      await page.screenshot({path:'tools/gallery-desktop.png',fullPage:true});
    }
  }
  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForTimeout(7500);
  if(await page.locator('.slide-count').textContent() === '01 / 03') failures.push('Slideshow did not advance');
  await page.emulateMedia({reducedMotion:'reduce'});
  const slide = await page.locator('.slide-count').textContent();
  await page.waitForTimeout(6500);
  if(slide !== await page.locator('.slide-count').textContent()) failures.push('Reduced motion slideshow advanced');
  await page.goto('http://127.0.0.1:8080/contact.html');
  await page.evaluate(() => { window.open = url => { window.testWhatsApp = url; }; });
  await page.locator('#name').fill('Test enquiry');
  await page.locator('#phone').fill('03218489366');
  await page.locator('#venue').selectOption({label:'Legacy Event Complex'});
  await page.locator('#type').selectOption({label:'Wedding'});
  await page.locator('#guests').fill('300');
  await page.getByRole('button',{name:'Send enquiry on WhatsApp'}).click();
  const url = await page.evaluate(() => window.testWhatsApp);
  if(!url?.startsWith('https://wa.me/923218489366?text=') || !decodeURIComponent(url).includes('Estimated guests: 300')) failures.push('Quotation URL is incorrect');
  if(!await page.locator('#quote-fallback').isVisible()) failures.push('Quotation fallback not visible');
  // Check every local HTML link and image against the filesystem, including anchors.
  const root = path.resolve(__dirname,'..');
  for (const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))) {
    const text = fs.readFileSync(path.join(root,file),'utf8');
    for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const link = match[1];
      if(/^(https?:|mailto:|tel:|data:)/.test(link)) continue;
      const [local,fragment] = decodeURIComponent(link.replace(/&amp;/g,'&')).split('#');
      const target = path.resolve(root,local || file);
      if(!fs.existsSync(target)) failures.push(`${file}: missing ${local}`);
      else if(fragment && target.endsWith('.html') && !fs.readFileSync(target,'utf8').includes(`id="${fragment}"`)) failures.push(`${file}: missing anchor ${fragment}`);
    }
  }
  fs.writeFileSync('tools/verification.json',JSON.stringify({failures,errors},null,2));
  console.log(JSON.stringify({failures,errors},null,2));
  await browser.close();
  if(failures.length || errors.length) process.exitCode = 1;
})().catch(e=>{console.error(e);process.exitCode=1;});
