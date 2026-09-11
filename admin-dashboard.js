(() => {
  const eventTypes = ['Wedding', 'Walima', 'Mehndi', 'Nikkah', 'Engagement', 'Birthday', 'Corporate Event', 'Other'];
  const state = { client: null, user: null, profile: null, records: [], editingId: null };
  const $ = (id) => document.getElementById(id);
  const fields = { name: $('customer-name'), phone: $('phone'), guests: $('guests'), date: $('visit-date'), event: $('event-type'), notes: $('notes') };
  const today = () => new Date().toISOString().slice(0, 10);
  const setMessage = (message, isError = false) => { const element = $('global-message'); element.textContent = message; element.style.color = isError ? 'var(--danger)' : ''; };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const friendlyError = (error) => error?.message || 'Something went wrong. Please try again.';

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
    $('records-body').innerHTML = rows.map((record) => `<tr><td>${escapeHtml(record.visit_date)}</td><td><strong>${escapeHtml(record.customer_name)}</strong></td><td>${escapeHtml(record.phone_number)}</td><td>${escapeHtml(record.number_of_guests)}</td><td>${escapeHtml(record.event_type || '—')}</td><td>${escapeHtml(record.manager_name)}</td><td>${escapeHtml(record.notes || '—')}</td><td class="row-actions"><button type="button" data-edit="${record.id}">Edit</button>${state.profile.role === 'admin' ? `<button type="button" class="delete-action" data-delete="${record.id}">Delete</button>` : ''}</td></tr>`).join('');
  };

  const loadRecords = async () => {
    $('table-status').textContent = 'Loading records...';
    const { data, error } = await state.client.from('customer_visits').select('id, customer_name, phone_number, number_of_guests, visit_date, manager_name, event_type, notes, created_at').order('visit_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    state.records = data || [];
    render();
  };

  const loadStaff = async () => {
    if (state.profile.role !== 'admin') return;
    $('staff-section').classList.remove('hidden');
    const { data, error } = await state.client.from('profiles').select('id, full_name, role, created_at').order('full_name');
    if (error) throw error;
    $('staff-body').innerHTML = (data || []).map((staff) => `<tr><td>${escapeHtml(staff.full_name)}</td><td><select data-role-id="${staff.id}" aria-label="Role for ${escapeHtml(staff.full_name)}"><option value="manager" ${staff.role === 'manager' ? 'selected' : ''}>Manager</option><option value="admin" ${staff.role === 'admin' ? 'selected' : ''}>Admin</option></select></td><td>${escapeHtml(new Date(staff.created_at).toLocaleDateString())}</td><td><button type="button" class="outline-button" data-save-role="${staff.id}">Save role</button></td></tr>`).join('');
  };

  const resetForm = () => { state.editingId = null; $('form-title').textContent = 'Add a customer'; $('save-button').textContent = 'Save customer'; $('cancel-edit').classList.add('hidden'); Object.values(fields).forEach((field) => { field.value = ''; }); fields.date.value = today(); };
  const editRecord = (record) => { state.editingId = record.id; $('form-title').textContent = 'Edit customer'; $('save-button').textContent = 'Update customer'; $('cancel-edit').classList.remove('hidden'); fields.name.value = record.customer_name; fields.phone.value = record.phone_number; fields.guests.value = record.number_of_guests; fields.date.value = record.visit_date; fields.event.value = record.event_type || ''; fields.notes.value = record.notes || ''; window.scrollTo({ top: $('customer-form').offsetTop - 100, behavior: 'smooth' }); };
  const validate = () => { const guests = Number(fields.guests.value); if (!Number.isInteger(guests) || guests < 1) { fields.guests.setCustomValidity('Enter a positive whole number.'); } else fields.guests.setCustomValidity(''); return $('customer-form').reportValidity(); };

  $('customer-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validate()) return;
    $('save-button').disabled = true;
    const values = { customer_name: fields.name.value.trim(), phone_number: fields.phone.value.trim(), number_of_guests: Number(fields.guests.value), visit_date: fields.date.value, event_type: fields.event.value || null, notes: fields.notes.value.trim() || null };
    try {
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
  $('staff-body').addEventListener('click', async (event) => {
    const staffId = event.target.dataset.saveRole;
    if (!staffId) return;
    const role = document.querySelector(`[data-role-id="${staffId}"]`).value;
    if (staffId === state.user.id && role !== 'admin' && !window.confirm('Remove admin access from your account?')) return;
    const { error } = await state.client.from('profiles').update({ role }).eq('id', staffId);
    if (error) setMessage(friendlyError(error), true); else { setMessage('Staff role updated.'); await loadStaff(); }
  });

  ['search-filter', 'date-filter', 'event-filter'].forEach((id) => $(id).addEventListener('input', render));
  $('clear-filters').addEventListener('click', () => { $('search-filter').value = ''; $('date-filter').value = ''; $('event-filter').value = ''; render(); });
  $('cancel-edit').addEventListener('click', resetForm);
  $('logout-button').addEventListener('click', async () => { await state.client.auth.signOut(); window.location.replace('admin-login.html'); });
  $('export-button').addEventListener('click', () => {
    const rows = filteredRecords().map((record) => ({ 'Visit Date': record.visit_date, 'Customer Name': record.customer_name, 'Phone Number': record.phone_number, 'Number of Guests': record.number_of_guests, 'Event Type': record.event_type || '', 'Manager Name': record.manager_name, Notes: record.notes || '' }));
    if (!rows.length) { setMessage('There are no filtered records to export.', true); return; }
    const worksheet = XLSX.utils.json_to_sheet(rows); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers'); XLSX.writeFile(workbook, `Empire-Marquee-Customers-${today()}.xlsx`);
  });

  (async () => {
    try {
      if (await requireProfile()) { await loadRecords(); await loadStaff(); }
    } catch (error) {
      console.error('[Dashboard loading] Dashboard initialization failed:', error);
      setMessage(`Dashboard loading failed: ${friendlyError(error)}`, true);
      $('table-status').textContent = `Unable to load dashboard: ${friendlyError(error)}`;
    }
  })();
})();
