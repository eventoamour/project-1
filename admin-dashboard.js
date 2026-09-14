(() => {
  const eventTypes = ['Wedding', 'Walima', 'Mehndi', 'Nikkah', 'Engagement', 'Birthday', 'Corporate Event', 'Other'];
  const state = { client: null, user: null, profile: null, records: [], editingId: null };
  const $ = (id) => document.getElementById(id);
  const fields = { name: $('customer-name'), phone: $('phone'), guests: $('guests'), date: $('visit-date'), event: $('event-type'), manager: $('manager-name'), venue: $('venue-name'), hall: $('hall-number'), timing: $('event-timing'), notes: $('notes') };
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const setMessage = (message, isError = false) => { const element = $('global-message'); element.textContent = message; element.style.color = isError ? 'var(--danger)' : ''; };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const friendlyError = (error) => {
    const message = error?.message || 'Something went wrong. Please try again.';
    if (message.includes("event_timing") && message.includes('schema cache')) return 'Supabase is missing the event_timing column. Run supabase-visit-fields-migration.sql in the SQL Editor, then reload the dashboard.';
    return message;
  };
  const menuFields = { menu: $('menu-package'), other: $('other-extras'), rate: $('quoted-rate'), basis: $('rate-basis') };
  const extras = () => [...document.querySelectorAll('input[name="menu-extra"]:checked')].map(input => input.value);
  const menuColumns = 'menu_package, menu_extras, other_extras, quoted_rate, rate_basis';
  let menuAvailable = true;
  const migrationMessage = 'To save menu and rate details, run supabase-menu-fields-migration.sql in Supabase SQL Editor, then reload this page.';
  const resetMenu = () => { menuFields.menu.value = ''; menuFields.other.value = ''; menuFields.rate.value = ''; menuFields.basis.value = 'per_guest'; document.querySelectorAll('input[name="menu-extra"]').forEach(input => { input.checked = false; }); };
  const editMenu = record => { menuFields.menu.value = record.menu_package || ''; menuFields.other.value = record.other_extras || ''; menuFields.rate.value = record.quoted_rate ?? ''; menuFields.basis.value = record.rate_basis || 'per_guest'; document.querySelectorAll('input[name="menu-extra"]').forEach(input => { input.checked = (record.menu_extras || []).includes(input.value); }); };
  const extrasLabel = record => [...(record.menu_extras || []), record.other_extras].filter(Boolean).join(', ');
  const rateLabel = record => record.quoted_rate == null ? '—' : `PKR ${Number(record.quoted_rate).toLocaleString('en-PK', { maximumFractionDigits: 2 })} / ${record.rate_basis === 'total_event' ? 'event' : 'guest'}`;

  const requireProfile = async () => {
    if (!supabaseClient) throw new Error('Supabase client is unavailable. Check supabase-config.js.');
    state.client = supabaseClient;
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      window.location.href = "admin-login.html";
      return false;
    }
    state.user = user;
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (error) {
      console.error('[Dashboard profile] Profile lookup failed:', error);
      setMessage(`Profile lookup failed: ${friendlyError(error)}`, true);
      return false;
    }
    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      const roleError = new Error('Your profile is not authorized for the staff dashboard.');
      console.error('[Dashboard profile] Unauthorized profile:', roleError);
      setMessage(roleError.message, true);
      await supabaseClient.auth.signOut();
      window.location.href = "admin-login.html";
      return false;
    }
    state.profile = profile;
    $('user-name').textContent = user.email || 'Signed-in staff';
    $('user-role').textContent = profile.role;
    $('manager-name').value = '';
    fields.date.value = today();
    return true;
  };

  const filteredRecords = () => {
    const search = $('search-filter').value.trim().toLowerCase();
    const date = $('date-filter').value;
    const event = $('event-filter').value;
    return state.records.filter((record) => (!search || record.customer_name.toLowerCase().includes(search) || record.phone_number.toLowerCase().includes(search)) && (!date || record.visit_date === date) && (!event || record.event_type === event));
  };

  const render = () => {
    const rows = filteredRecords();
    $('today-count').textContent = state.records.filter((record) => record.visit_date === today()).length;
    $('today-guests').textContent = state.records.filter((record) => record.visit_date === today()).reduce((sum, record) => sum + record.number_of_guests, 0);
    $('total-count').textContent = state.records.length;
    $('table-status').textContent = rows.length ? '' : 'No customer records match these filters.';
    $('records-body').innerHTML = rows.map((record) => `<tr><td>${escapeHtml(record.visit_date)}</td><td><strong>${escapeHtml(record.customer_name)}</strong></td><td>${escapeHtml(record.phone_number)}</td><td>${escapeHtml(record.number_of_guests)}</td><td>${escapeHtml(record.event_type || '—')}</td><td>${escapeHtml(record.manager_name)}</td><td>${escapeHtml(record.venue_name)}</td><td>${escapeHtml(record.hall_number)}</td><td>${escapeHtml(record.event_timing)}</td><td>${escapeHtml(record.menu_package || '—')}</td><td>${escapeHtml(extrasLabel(record) || '—')}</td><td>${escapeHtml(rateLabel(record))}</td><td>${escapeHtml(record.notes || '—')}</td><td class="row-actions"><button type="button" data-edit="${record.id}">Edit</button>${state.profile.role === 'admin' ? `<button type="button" class="delete-action" data-delete="${record.id}">Delete</button>` : ''}</td></tr>`).join('');
  };

  const loadRecords = async () => {
    $('table-status').textContent = 'Loading records...';
    // Live table uses phone/guests. Aliases preserve the existing render/export model.
    const records = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const baseColumns = 'id, customer_name, phone_number:phone, number_of_guests:guests, visit_date, manager_name, event_type, venue_name, hall_number, event_timing, notes, created_at';
      const queryPage = columns => state.client.from('customer_visits').select(columns).order('visit_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1);
      let { data, error } = await queryPage(baseColumns + (menuAvailable ? ', ' + menuColumns : ''));
      if (error && ['42703', 'PGRST204'].includes(error.code) && /menu_package|menu_extras|other_extras|quoted_rate|rate_basis/.test(error.message)) {
        menuAvailable = false;
        setMessage(migrationMessage, true);
        ({ data, error } = await queryPage(baseColumns));
      }
      if (error) throw error;
      records.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    state.records = records.map(record => ({ ...record, customer_name: String(record.customer_name ?? ''), phone_number: String(record.phone_number ?? ''), number_of_guests: Number(record.number_of_guests) || 0 }));
    render();
  };

  const resetForm = () => { resetMenu(); state.editingId = null; $('form-title').textContent = 'Add a customer'; $('save-button').textContent = 'Save customer'; $('cancel-edit').classList.add('hidden'); Object.values(fields).forEach((field) => { field.value = ''; }); $('manager-name').value = ''; fields.date.value = today(); };
  const editRecord = (record) => { editMenu(record); state.editingId = record.id; $('form-title').textContent = 'Edit customer'; $('save-button').textContent = 'Update customer'; $('cancel-edit').classList.remove('hidden'); fields.name.value = record.customer_name; fields.phone.value = record.phone_number; fields.guests.value = record.number_of_guests; fields.date.value = record.visit_date; fields.event.value = record.event_type || ''; fields.manager.value = record.manager_name || ''; fields.venue.value = record.venue_name || ''; fields.hall.value = record.hall_number || ''; fields.timing.value = record.event_timing || ''; fields.notes.value = record.notes || ''; window.scrollTo({ top: $('customer-form').offsetTop - 100, behavior: 'smooth' }); };
  fields.manager.addEventListener('input', () => fields.manager.setCustomValidity(''));
  const validate = () => { fields.manager.setCustomValidity(fields.manager.value.trim() ? '' : 'Enter the manager handling this enquiry.'); const guests = Number(fields.guests.value); if (!Number.isInteger(guests) || guests < 1) { fields.guests.setCustomValidity('Enter a positive whole number.'); } else fields.guests.setCustomValidity(''); return $('customer-form').reportValidity(); };

  $('customer-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate()) return;
    $('save-button').disabled = true;
    const values = { manager_name: fields.manager.value.trim(), customer_name: fields.name.value.trim(), phone: fields.phone.value.trim(), guests: Number(fields.guests.value), visit_date: fields.date.value, event_type: fields.event.value || null, venue_name: fields.venue.value, hall_number: fields.hall.value.trim(), event_timing: fields.timing.value, notes: fields.notes.value.trim() || null };
    try {
      const menuValues = { menu_package: menuFields.menu.value || null, menu_extras: extras(), other_extras: menuFields.other.value.trim() || null, quoted_rate: menuFields.rate.value === '' ? null : Number(menuFields.rate.value), rate_basis: menuFields.basis.value };
      if (!menuAvailable && (menuValues.menu_package || menuValues.menu_extras.length || menuValues.other_extras || menuValues.quoted_rate !== null)) throw new Error(migrationMessage);
      if (menuAvailable) Object.assign(values, menuValues);
      const query = state.editingId ? state.client.from('customer_visits').update(values).eq('id', state.editingId) : state.client.from('customer_visits').insert(values);
      const { error } = await query;
      if (error) throw error;
      setMessage(state.editingId ? 'Customer record updated.' : 'Customer record saved.'); resetForm(); await loadRecords();
    } catch (error) { setMessage(friendlyError(error), true); } finally { $('save-button').disabled = false; }
  });

  $('records-body').addEventListener('click', async (event) => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) editRecord(state.records.find((record) => record.id === editId));
    if (deleteId && window.confirm('Delete this customer record permanently?')) { const { error } = await state.client.from('customer_visits').delete().eq('id', deleteId); if (error) setMessage(friendlyError(error), true); else { setMessage('Customer record deleted.'); await loadRecords(); } }
  });
  ['search-filter', 'date-filter', 'event-filter'].forEach((id) => $(id).addEventListener('input', render));
  $('clear-filters').addEventListener('click', () => { $('search-filter').value = ''; $('date-filter').value = ''; $('event-filter').value = ''; render(); });
  $('cancel-edit').addEventListener('click', resetForm);
  $('logout-button').addEventListener('click', async () => { await state.client.auth.signOut(); window.location.replace('admin-login.html'); });
  $('export-button').addEventListener('click', () => {
    const rows = filteredRecords().map((record) => ({ 'Visit Date': record.visit_date, 'Customer Name': record.customer_name, 'Phone Number': record.phone_number, 'Number of Guests': record.number_of_guests, 'Event Type': record.event_type || '', 'Manager Name': record.manager_name, 'Venue Name': record.venue_name, 'Hall Number': record.hall_number, 'Event Timing': record.event_timing, 'Menu Package': record.menu_package || '', Extras: extrasLabel(record), 'Rate Quoted (PKR)': record.quoted_rate == null ? '' : Number(record.quoted_rate), 'Rate Basis': record.quoted_rate == null ? '' : (record.rate_basis === 'total_event' ? 'Total event' : 'Per guest'), Notes: record.notes || '' }));
    if (!rows.length) { setMessage('There are no filtered records to export.', true); return; }
    const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers'); XLSX.writeFile(workbook, `Empire-Marquee-Customers-${today()}.xlsx`);
  });

  (async () => {
    try {
      if (await requireProfile()) await loadRecords();
    } catch (error) {
      console.error('[Dashboard loading] Dashboard initialization failed:', error);
      setMessage(`Dashboard loading failed: ${friendlyError(error)}`, true);
      $('table-status').textContent = `Unable to load dashboard: ${friendlyError(error)}`;
    }
  })();
})();
