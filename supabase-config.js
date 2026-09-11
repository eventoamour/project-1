/* Only use Supabase's publishable/anon key here. Never put a service-role key in browser code. */
window.EMPIRE_SUPABASE_CONFIG = {
  url: 'https://rmfpwpqmrcbylqlzxexu.supabase.co',
  anonKey: 'sb_publishable_9pA4yxEc-uePpNNkU2MLPg_Y1Hn9nh6'
};

window.createEmpireSupabaseClient = function () {
  const config = window.EMPIRE_SUPABASE_CONFIG;
  if (!window.supabase || !config || config.url.includes('YOUR-PROJECT-REF') || config.anonKey.includes('YOUR_SUPABASE')) {
    throw new Error('Supabase is not configured. Update supabase-config.js with your project URL and publishable key.');
  }
  return window.supabase.createClient(config.url, config.anonKey);
};

try {
  var supabaseClient = window.createEmpireSupabaseClient();
} catch (configurationError) {
  console.error('[Supabase config] Client initialization failed:', configurationError);
  var supabaseClient = null;
}
