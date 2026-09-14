const { chromium } = require('./browser.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Exercise the actual staff scripts with an isolated Supabase boundary. No live writes.
function installMock({ role = 'admin', signedIn = true, missingMenu = false }) {
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  window.fixture = { role, signedIn:signedIn && sessionStorage.getItem('fixture-signed-out') !== '1', writes:[], selects:[], ranges:[], exported:null };
  let records = Array.from({length:501},(_,i)=>({id:`id-${i}`,customer_name:i===0?'A & <guest>':`Customer ${i}`,phone:'03218489366',guests:2,visit_date:date,manager_name:'Fixture Manager',event_type:'Wedding',venue_name:'Garrison',hall_number:'1',event_timing:'Evening',notes:'',created_at:new Date().toISOString()}));
  const auth = {
    getUser:async()=>({data:{user:window.fixture.signedIn?{id:'staff-1',email:'staff@example.test'}:null}}),
    getSession:async()=>({data:{session:window.fixture.signedIn?{}:null}}),
    signInWithPassword:async()=>{window.fixture.signedIn=true;return {error:null};},
    signOut:async()=>{window.fixture.signedIn=false;sessionStorage.setItem('fixture-signed-out','1');return {error:null};}
  };
  window.supabase = { createClient:()=>({auth,from:table=>{
    let operation='select',values,selection='',range=[0,499],id;
    const query = {
      select(fields){selection=fields;window.fixture.selects.push({table,fields});return query;},
      eq(key,value){id=value;return query;}, order(){return query;},
      range(from,to){range=[from,to];window.fixture.ranges.push(range);return query;},
      single(){return Promise.resolve({data:{role:window.fixture.role},error:null});},
      insert(value){operation='insert';values=value;return query;},
      update(value){operation='update';values=value;return query;},
      delete(){operation='delete';return query;},
      then(resolve,reject){return Promise.resolve().then(()=>{
        if(table==='profiles') return {data:[{id:'staff-1',full_name:'Fixture Manager',role:window.fixture.role,created_at:new Date().toISOString()}],error:null};
        if(operation==='select') {
          if(missingMenu && selection.includes('menu_package')) return {data:null,error:{code:'42703',message:'column customer_visits.menu_package does not exist'}};
          if(!selection.includes('phone_number:phone') || !selection.includes('number_of_guests:guests')) throw new Error('Wrong live column mapping');
          return {data:records.slice(range[0],range[1]+1).map(r=>({...r,phone_number:r.phone,number_of_guests:r.guests})),error:null};
        }
        window.fixture.writes.push({operation,values,id});
        if(operation==='insert') records.unshift({...values,id:'new-id',created_at:new Date().toISOString()});
        if(operation==='update') records=records.map(r=>r.id===id?{...r,...values}:r);
        return {data:null,error:null};
      }).then(resolve,reject);}
    };return query;
  }})};
  window.XLSX = {utils:{json_to_sheet:rows=>rows,book_new:()=>({}),book_append_sheet:(book,sheet)=>{book.rows=sheet;}},writeFile:(book,name)=>{window.fixture.exported={book,name};}};
}
(async()=>{
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  const results=[];
  for(const role of ['admin','manager','unauthorized','signed-out','missing-menu']) {
    const context=await browser.newContext();
    await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
    await context.route('**/npm/@supabase/supabase-js@2',r=>r.fulfill({contentType:'text/javascript',body:''}));
    await context.route('**/xlsx.full.min.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
    await context.addInitScript(installMock,{role:role==='unauthorized'?'customer':role==='missing-menu'?'manager':role,signedIn:role!=='signed-out',missingMenu:role==='missing-menu'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:8080/admin-dashboard.html',{waitUntil:'domcontentloaded'});
    if(role==='signed-out'||role==='unauthorized') {
      await page.waitForURL('**/admin-login.html');
      results.push(`${role}: redirected to login`);
    } else if(role==='missing-menu') {
      await page.locator('#total-count').filter({hasText:'501'}).waitFor();
      assert.match(await page.locator('#global-message').textContent(),/supabase-menu-fields-migration.sql/);
      await page.locator('#customer-name').fill('Migration fixture');
      await page.locator('#manager-name').fill('Assigned Manager');
      await page.locator('#phone').fill('03001234567');
      await page.locator('#guests').fill('20');
      await page.locator('#venue-name').selectOption('Legacy');
      await page.locator('#hall-number').fill('1');
      await page.locator('#event-timing').selectOption('Morning');
      await page.locator('#menu-package').selectOption('Chicken one dish');
      await page.locator('#save-button').click();
      assert.equal(await page.evaluate(()=>window.fixture.writes.length),0);
      assert.match(await page.locator('#global-message').textContent(),/supabase-menu-fields-migration.sql/);
      results.push('Missing menu columns: existing records load; new menu data cannot be silently lost');
    } else {
      await page.locator('#total-count').filter({hasText:'501'}).waitFor();
      assert.equal(await page.locator('#today-count').textContent(),'501');
      assert.equal(await page.locator('#today-guests').textContent(),'1002');
      assert.equal(await page.locator('#records-body tr').count(),501);
      assert.equal(await page.locator('#records-body tr').first().locator('strong').textContent(),'A & <guest>');
      assert.equal(await page.locator('#staff-section').count(),0);
      assert.equal(await page.locator('[data-delete]').count(),role==='admin'?501:0);
      for(const width of [320,375,430,768,1024,1440]) {
        await page.setViewportSize({width,height:1000});
        const overflow = await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>(el.scrollWidth>el.clientWidth || el.getBoundingClientRect().right>innerWidth) && (!el.closest('.table-wrap') || el.className==='table-wrap')).map(el=>({tag:el.tagName,classes:el.className,right:el.getBoundingClientRect().right,sw:el.scrollWidth,cw:el.clientWidth})));
        const dimensions=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,width:innerWidth}));
        assert.equal(dimensions.doc>width,false,`Dashboard overflow ${width}: ${JSON.stringify({dimensions,overflow})}`);
      }
      await page.locator('#customer-name').fill('New fixture customer');
      await page.locator('#manager-name').fill('Assigned Manager');
      await page.locator('#phone').fill('03001234567');
      await page.locator('#guests').fill('125');
      await page.locator('#event-type').selectOption('Wedding');
      await page.locator('#venue-name').selectOption('Glorious');
      await page.locator('#hall-number').fill('2');
      await page.locator('#event-timing').selectOption('Morning');
      await page.locator('#menu-package').selectOption('Chicken one dish');
      await page.getByLabel('Russian salad', {exact:true}).check();
      await page.getByLabel('Tea', {exact:true}).check();
      await page.locator('#other-extras').fill('Coffee');
      await page.locator('#quoted-rate').fill('2500.50');
      await page.locator('#save-button').click();
      await page.locator('#total-count').filter({hasText:'502'}).waitFor();
      const values=await page.evaluate(()=>window.fixture.writes[0].values);
      assert.equal(values.phone,'03001234567');assert.equal(values.guests,125);
      assert.equal(values.menu_package,'Chicken one dish');
      assert.deepEqual(values.menu_extras,['Russian salad','Tea']);
      assert.equal(values.other_extras,'Coffee');assert.equal(values.quoted_rate,2500.5);assert.equal(values.rate_basis,'per_guest');
      assert.equal(await page.locator('#quoted-rate').inputValue(),'');
      assert.equal(await page.getByLabel('Tea',{exact:true}).isChecked(),false);
      assert.equal(values.venue_name,'Glorious');assert.equal(values.hall_number,'2');assert.equal(values.event_timing,'Morning');
      assert.equal('phone_number' in values,false);assert.equal(values.manager_name,'Assigned Manager');
      assert.equal('created_by' in values,false);
      await page.locator('#search-filter').fill('New fixture');
      assert.equal(await page.locator('#records-body tr').count(),1);
      await page.locator('[data-edit]').click();
      assert.equal(await page.locator('#manager-name').inputValue(),'Assigned Manager');
      await page.locator('#manager-name').fill('Updated Manager');
      assert.equal(await page.locator('#menu-package').inputValue(),'Chicken one dish');
      assert.equal(await page.locator('#quoted-rate').inputValue(),'2500.5');
      assert.equal(await page.getByLabel('Tea',{exact:true}).isChecked(),true);
      await page.locator('#menu-package').selectOption('Mutton one dish');
      await page.locator('#phone').fill('03009999999');
      await page.locator('#save-button').click();
      await page.waitForFunction(()=>window.fixture.writes.length===2);
      await page.locator('#export-button').click();
      const exported=await page.evaluate(()=>window.fixture.exported);
      assert.equal(exported.book.rows.length,1);assert.equal(exported.book.rows[0]['Phone Number'],'03009999999');
      assert.equal(exported.book.rows[0]['Number of Guests'],125);
      assert.equal(exported.book.rows[0]['Menu Package'],'Mutton one dish');
      assert.equal(exported.book.rows[0]['Extras'],'Russian salad, Tea, Coffee');
      assert.equal(exported.book.rows[0]['Rate Quoted (PKR)'],2500.5);
      assert.equal(exported.book.rows[0]['Manager Name'],'Updated Manager');
      assert.equal(exported.book.rows[0]['Venue Name'],'Glorious');
      assert.equal(exported.book.rows[0]['Hall Number'],'2');
      assert.equal(exported.book.rows[0]['Event Timing'],'Morning');
      if(role==='admin') {
        // Also exercise the existing production SheetJS CDN and a real XLSX download.
        if(fs.existsSync('tools/sheetjs-verification.js')) {
          await page.addScriptTag({path:'tools/sheetjs-verification.js'});
        } else {
          await context.unroute('**/xlsx.full.min.js');
          await page.addScriptTag({url:'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'});
        }
        const downloadPromise=page.waitForEvent('download');
        await page.locator('#export-button').click();
        const download=await downloadPromise;
        await download.saveAs('tools/verified-export.xlsx');
        const base64=fs.readFileSync('tools/verified-export.xlsx').toString('base64');
        const workbookRows=await page.evaluate(data=>{const book=XLSX.read(data,{type:'base64'});return XLSX.utils.sheet_to_json(book.Sheets.Customers);},base64);
        assert.equal(workbookRows.length,1);
        assert.equal(workbookRows[0]['Phone Number'],'03009999999');
        assert.equal(workbookRows[0]['Number of Guests'],125);
        assert.equal(workbookRows[0]['Venue Name'],'Glorious');
        assert.equal(workbookRows[0]['Hall Number'],'2');
        assert.equal(workbookRows[0]['Event Timing'],'Morning');
        results.push('Actual SheetJS workbook download and round-trip content verification passed (fixture data only)');
      }
      await page.locator('#logout-button').click();await page.waitForURL('**/admin-login.html');
      results.push(`${role}: pagination, totals, rendering, customer actions, insert, edit, search, filtered export, logout and six widths passed`);
    }
    assert.deepEqual(errors,[]);
    console.log(results.at(-1));
    await context.close();
  }
  await browser.close();
  fs.writeFileSync('tools/admin-verification.json',JSON.stringify({results,scope:'Mocked backend, real SheetJS export; live authentication, RLS and write acceptance require staff credentials.'},null,2));
  console.log(results.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1;});
