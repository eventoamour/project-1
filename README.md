# Empire Group website

This is a plain HTML, CSS, and JavaScript website. The private staff dashboard uses Supabase Auth/PostgreSQL and SheetJS for filtered Excel exports.

## Configure Supabase

1. Create a Supabase project.
2. Open the SQL Editor and run [`supabase-schema.sql`](supabase-schema.sql).
3. In Authentication > Users, create each staff user with email and password. Disable public sign-ups in Authentication settings.
4. Add a profile for each Auth user in the SQL Editor, replacing the UUIDs:

```sql
insert into public.profiles (id, full_name, role)
values
  ('AUTH_USER_UUID', 'Main Admin', 'admin'),
  ('MANAGER_AUTH_USER_UUID', 'Manager Name', 'manager');
```

The first profile must be inserted in the SQL Editor by the project owner because there is no existing admin profile yet. Never expose a service-role key to the browser.

5. Copy the Supabase project URL and publishable/anon key into [`supabase-config.js`](supabase-config.js):

```js
window.EMPIRE_SUPABASE_CONFIG = {
  url: 'https://your-project-ref.supabase.co',
  anonKey: 'your-publishable-or-anon-key'
};
```

Only this public key belongs in the static site. The SQL functions and RLS policies are the security boundary; hiding buttons is not relied upon.

## Run locally

Serve the folder over HTTP so browser modules and hosted CDN assets behave like production. For example, with Python installed:

```powershell
py -m http.server 8080
```

Open `http://localhost:8080/`, choose **Admin**, and test with a configured Supabase user. Do not open the HTML with `file://`.

## Test checklist

- Invalid login and unauthorized profile redirect to `admin-login.html`.
- Authorized admin and manager can add, view, search, filter, edit, and export records.
- The database trigger sets `created_by` and `manager_name` from the authenticated user.
- Only an admin can delete records or update profiles; RLS enforces this even if browser JavaScript is changed.
- Check the dashboard at desktop and narrow mobile widths.
- Verify the downloaded workbook contains only the currently filtered records.

The Supabase flows require your project URL, key, Auth users, and schema, so they cannot be live-tested from this repository without your backend configuration. Node.js is not currently available in the authoring environment; use a browser and your normal CI checks for JavaScript syntax validation.

## Netlify and GitHub

This repository is static and needs no Netlify Function or service-role secret. Netlify can deploy the repository root directly. If you later add a function, keep service-role credentials in Netlify environment variables only.

Typical commands:

```powershell
git add .
git commit -m "Add secure staff customer dashboard"
git push origin main
```

In Netlify, connect the GitHub repository, set the publish directory to the repository root, and deploy. Do not commit `.env`, Supabase passwords, or service-role keys. Netlify deploy previews should use the same configured `supabase-config.js` placeholder replacement process as production.
