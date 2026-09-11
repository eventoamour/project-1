(() => {
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const button = form.querySelector('button');
  const label = document.getElementById('login-label');
  const spinner = document.getElementById('login-spinner');

  const showError = (message) => { error.textContent = message; };
  const setLoading = (loading) => {
    button.disabled = loading;
    label.textContent = loading ? 'Signing in...' : 'Sign in';
    spinner.classList.toggle('hidden', !loading);
  };

  const start = async () => {
    try {
      const client = createEmpireSupabaseClient();
      const { data: { session } } = await client.auth.getSession();
      if (session) window.location.replace('admin-dashboard.html');
    } catch (configurationError) {
      showError(configurationError.message);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    if (!form.reportValidity()) return;
    setLoading(true);
    try {
      const client = createEmpireSupabaseClient();
      const { error: signInError } = await client.auth.signInWithPassword({
        email: form.email.value.trim(),
        password: form.password.value
      });
      if (signInError) throw signInError;
      const { data: { user } } = await client.auth.getUser();
      const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || !['admin', 'manager'].includes(profile.role)) {
        await client.auth.signOut();
        throw new Error('This account is not authorized for the staff dashboard.');
      }
      window.location.replace('admin-dashboard.html');
    } catch (loginError) {
      showError(loginError.message || 'Unable to sign in. Check your details and try again.');
      setLoading(false);
    }
  });

  start();
})();
