# Empire Group website

The existing static HTML/CSS/JavaScript site, with a shared public design and a separate private Supabase dashboard. No framework, production build, or Netlify configuration changes are required. Deploy the repository root as before.

## Local preview

With Node.js installed, run `node tools/serve.cjs`, then open http://127.0.0.1:8080/. The server binds only to localhost and does not serve dotfiles or database files. Use HTTP rather than opening HTML directly.

## Public website

- All original public/staff routes remain. Privacy and terms pages are new.
- `styles.css` retains the original shared styling; `luxury.css` supplies the public redesign. Venue-specific styles remain in their HTML files.
- `site.js` handles navigation, the six-second slideshow, reduced motion, visibility-aware playback, reveals, counters, gallery filters/lightbox, and quotation feedback. It loads no Supabase code or customer information.
- The contact form still prepares a WhatsApp message for **923218489366**. Sending happens in WhatsApp; the form neither confirms a reservation nor saves to the staff database. A fallback link is provided if a popup is blocked.
- Existing telephone, WhatsApp and Facebook destinations are retained. The existing Garrison page uses the central number, while its gallery directory lists **923008489366**; this distinction has been preserved.
- Numerical claims use the original About page's **30+ years** and **four venues**. Event/guest totals and capacities were not invented.

### Photography

All photography comes from existing local assets. Originals are unchanged. `assets/images/venues/` contains responsive WebP derivatives capped at source resolution. `assets/images/hero/` holds three photographs at two sizes. Only the first hero is preloaded; subsequent slides load on demand. Below-fold images use lazy loading and responsive sources.

`tools/optimize-images.py` uses Pillow and `tools/images.json` to regenerate derivatives; `tools/image-manifest.json` records paths and dimensions.

### SEO

Public pages have descriptive titles/descriptions, social metadata, semantic headings and image descriptions. The homepage includes LocalBusiness data using existing contact information. Staff routes are marked noindex; authentication/RLS remain the security boundary.

The production domain was not supplied. Before publishing, set absolute `og:image` URLs and canonical URLs for the actual production domain; social images currently use relative paths. Do not invent a domain, address or capacity.

## Dashboard column fix

### Menu and quotation fields

The daily register now includes Chicken/Mutton one-dish packages; Russian salad, soup and tea checkboxes; other extras; and an optional PKR quoted rate (per guest or total event). These values appear in saved records, reopen for editing, and export to Excel as separate fields with a numeric rate.

For an existing database, run `supabase-menu-fields-migration.sql` in Supabase SQL Editor, then reload the dashboard. It only adds optional columns; it does not delete records or change authorization. This migration has not been applied to the live project. Before it is applied, existing records can still load, and attempts to save new menu details show a migration message rather than silently discarding them.

Read-only **zero-row** queries of the configured live Supabase API on 2026-09-14 confirmed:

| Live column | Dashboard model |
| --- | --- |
| `phone` | `phone_number` |
| `guests` | `number_of_guests` |

The originally requested database columns do not exist. Reads now use PostgREST aliases; inserts/updates use `phone` and `guests`. Rendering and Excel labels remain unchanged. Stable pagination avoids the default API row limit truncating totals/exports; today uses Lahore's timezone.

No live database/schema/customer data, Supabase configuration, authentication code, or role policies were changed. The checked-in fresh-project schema now uses the confirmed names. **Do not run the setup SQL against the existing database to apply this frontend fix.**

### Fresh Supabase projects only

1. Run `supabase-schema.sql` only for a new, empty setup.
2. Create staff accounts in Supabase Authentication and disable public sign-ups.
3. Insert matching profiles as the owner:

```sql
insert into public.profiles (id, full_name, role)
values ('AUTH_USER_UUID', 'Main Admin', 'admin'),
       ('MANAGER_AUTH_USER_UUID', 'Manager Name', 'manager');
```

4. Configure the project URL and public publishable/anon key in `supabase-config.js`. Never put service-role keys or passwords in frontend code.

Manager name is now editable for authorized staff and is included in create/edit payloads and Excel exports. For an existing database, run `supabase-manager-name-migration.sql` so the previous trigger does not overwrite the entered name. This migration has not been applied to the live project. It preserves `created_by` on edits, assigns the creator from the authenticated account on inserts, and leaves RLS unchanged. Older clients omitting a manager on insert retain the signed-in profile fallback.

### Existing database migration

For an existing Supabase project, run `supabase-visit-fields-migration.sql` once in the SQL Editor before using the expanded daily register. Do not rerun `supabase-schema.sql` against a database that already contains customer data.

## Verification

With the local server running, Chrome and Playwright available:

```powershell
node tools/verify.cjs
node tools/verify-admin.cjs
node tools/capture.cjs
```

The tools use an installed Playwright package or the bundled Codex runtime. They are development tools, not production dependencies. Generated screenshots/reports are git-ignored.

Verified locally:

- Public routes and local links/images; layouts at 320, 375, 430, 768, 1024 and 1440px.
- Mobile menu/dropdown, gallery filtering, lightbox keyboard navigation, slideshow advance and reduced motion.
- Quotation message construction and visible fallback/feedback without sending a message.
- No public-page JavaScript exceptions.
- Isolated admin/manager tests: 501-record pagination, totals, rendering, create/edit payloads, search, filtered export mapping, customer actions, logout, unauthorized redirects, and six widths.
- An actual Excel download and workbook content round-trip using the production SheetJS 0.20.3 library with fixture data. The browser could not fetch the CDN directly in this environment, so verification used an independently downloaded copy of that exact CDN file. The production CDN link is unchanged.

**Live verification requires staff sign-in:** actual admin/manager authentication, deployed RLS/trigger behavior, saving a customer, reading existing records, and manager assignment. Staff tests use fake data and a mocked API; they do not prove deployed permissions or persistence. No customer record was created during this work.

No production deployment was performed. Field Core Web Vitals must be measured on the deployed site; local functional checks are not field performance measurements.
