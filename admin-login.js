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
      if (!supabaseClient) throw new Error('Supabase client is unavailable. Check supabase-config.js.');
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session) {
        window.location.href = "admin-dashboard.html";
      }
    } catch (configurationError) {
      console.error('[Login session] Unable to check the current session:', configurationError);
      showError(configurationError.message);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    if (!form.reportValidity()) return;
    setLoading(true);
    try {
      if (!supabaseClient) throw new Error('Supabase client is unavailable. Check supabase-config.js.');
      const { error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: form.email.value.trim(),
        password: form.password.value
      });
      if (signInError) throw signInError;
      const { data: { user } } = await supabaseClient.auth.getUser();
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profileError) {
        console.error('[Login profile] Profile lookup failed:', profileError);
        throw profileError;
      }
      if (!profile || !['admin', 'manager'].includes(profile.role)) {
        await supabaseClient.auth.signOut();
        throw new Error('This account is not authorized for the staff dashboard.');
      }
      window.location.href = "admin-dashboard.html";
    } catch (loginError) {
      console.error('[Login] Sign-in or redirect failed:', loginError);
      showError(loginError.message || 'Unable to sign in. Check your details and try again.');
      setLoading(false);
    }
  });

  start();
})();
