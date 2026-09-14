const { chromium } = require('./browser.cjs');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage();
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',375,850]]) {
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:8080/index.html');
    await page.waitForTimeout(1600);
    await page.screenshot({path:`tools/hero-${name}.png`});
    for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=600) {
      await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1200);
    const broken=await page.locator('img[src]').evaluateAll(images=>images.filter(img=>!img.complete||!img.naturalWidth).map(img=>img.src));
    console.log(name,'broken images:',broken);
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`tools/home-${name}.png`,fullPage:true});
    await page.locator('#venues').scrollIntoViewIfNeeded();
    await page.screenshot({path:`tools/venues-${name}.png`});
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
