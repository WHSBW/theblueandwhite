# The Blue & White — Project Reference
**Paul R. Wharton High School Student Newspaper**
*For Laura Novello (adviser) and future Claude instances picking up this project*

> **Version note (June 30, 2026):** This is the **v4.10** doc. v4.10 cleared one
> of the two open items and added a hygiene feature. Two arcs landed: (1) **Editor
> dashboard cards** — editors are both editors AND reporters (they write too), but
> only the *reporter* dashboard surfaced assignment cards/progress. The editor
> dashboard now has a **tab toggle: Review Queue ↔ My Assignments**. Review Queue
> is the existing editing-duties view (stats + pending queue + ext inbox); My
> Assignments mirrors the reporter dashboard for the editor's OWN articles (same
> five states, same cards, same "click opens the existing article" behavior). Built
> by extracting the reporter dashboard's card logic into a shared
> `renderMyAssignmentsPanel(assignListElId, myListElId)` so the two views can't
> drift — `loadReporterDash` and the new `loadEditorMyAssignments` both call it
> with their own element ids. `switchEditorDashTab` toggles the panels; `showView`
> resets to the queue tab on entry. (Also fixed: `requestExtension` hardcoded a
> refresh to `loadReporterDash`, which would silently refresh the wrong hidden
> panel for an editor — now role-aware.) CMS-only. (2) **Stale draft roll-off** —
> kids learning the page leave heaps of abandoned "dgdkjg" drafts. A new nightly
> sweep step (#6) trashes any `draft` untouched for **45 days** (role-blind:
> reporter/editor/adviser alike) → it lands in the **Recycle Bin**, NOT hard-
> deleted, so it rides the existing 30-day purge (**75 days total** worst case,
> with a restore window). Clock is a NEW `updated_at` column on `articles`, stamped
> by `art_save` on every write (so a draft someone's actively revising across weeks
> is NOT swept — last-touch, not first-created). Deploy was **SQL → Worker**: one
> `ALTER TABLE articles ADD COLUMN updated_at` + a backfill `UPDATE ... = created_at`
> (without the backfill, pre-existing drafts have null `updated_at` and dodge the
> sweep forever). **New Dragon, exposed by this feature:** trashed articles were
> showing on the dashboard's "My Submissions" list with a TRASHED badge instead of
> being hidden — drafts rarely got trashed before, so nobody noticed; the roll-off
> changes that. Fixed by filtering `status !== 'trashed'` in
> `renderMyAssignmentsPanel` (so it lands on BOTH the reporter and editor views).
> Verified live end-to-end: backdated a test draft's `updated_at` to 46 days, the
> sweep filter caught it, it trashed → vanished from the student dashboard → sat
> restorable in the adviser's Recycle Bin. **Still open (NOT done):** the harmless
> `favicon.ico` 404 in console (cosmetic) — now the ONLY remaining backlog item.
> Laura's corrections are authoritative.
>
> **Version note (June 29, 2026):** This was the **v4.9** doc. v4.9 completed the
> **rubric-grading arc** — it turned the v4.7 engine into a full, usable loop and
> closed the question v4.7/v4.8 left open ("what does the student ever see?").
> Three things landed: (1) **storage** — a new private `rubric_grades` table; the
> adviser-confirmed scorecard is now saved, **append-on-save** so every confirm is
> a new version (full regrade history; latest row = the grade); 30-day roll-off
> keyed to **confirmation**, not publish. (2) **The scorecard UI** — a Canvas-style
> side-by-side in the Reports view: pick an assignment, tick gradable articles
> (pending/returned/published only), **Grade selected** runs the AI batch, then a
> two-pane overlay (article left, editable scorecard right — tier dropdowns +
> live-computed points + editable justifications + overall + the ⚑ injection
> banner + running total). **Confirm & save** is the ONLY path to a stored grade;
> it auto-advances through the batch. An adviser-only **history strip** shows prior
> versions (read-only), and a **view / edit** link reopens any saved grade for
> further tweaking **with no new AI call** (loads your saved tiers/comments, not a
> fresh draft; Confirm appends the next version). (3) **Student feedback** — after
> the adviser confirms, the writer sees their rubric feedback in their own CMS
> write view (same real estate as editor notes), filtered by a per-version
> **release mode**: `full` (rubric + comments), `rubric` (tiers/points/total, no
> comments), or `comments` (feedback only, **no score shown** — the practice-round
> mode). Every student view carries the italic line *"Final grade of record
> resides in the HCPS Canvas gradebook."* **Canvas stays the grade of record (the
> adviser hand-keys the number — district contract); the CMS is the "why."** The
> **entire API-grading surface is adviser-only** (trigger, view, save, student
> feedback is reporter-own-scoped server-side) — no student editor can run a draft,
> see a grade, or read another student's feedback. Privacy/SQL posture: the
> `rubric_grades` table is RLS-on-at-creation, no anon policy; `release_mode` rides
> inside the existing `confirmed_grade` jsonb so storage needed **one CREATE TABLE
> and zero migrations**. Verified live across the full gauntlet (release-mode
> filtering, reporter/editor lockout, injection flag, history, reopen-to-edit).
> See Build History for the v4.8 → v4.9.2 sub-steps and their hard-won bug
> lessons. **Still open (NOT done):** editors don't yet get assignment dashboard
> cards / deadline cues like reporters do (they write too) — own sprint; and a
> harmless `favicon.ico` 404 in console (cosmetic). Laura's corrections are
> authoritative.
>
> **Version note (June 29, 2026):** This was the **v4.7** doc. v4.7 added the
> **rubric-grading ENGINE** — one Worker action `rubric_grade` (editor/adviser
> only) that calls Claude for an **AI second-opinion draft** the adviser
> confirms; it is **never autonomous.** The model picks one of five tiers per
> criterion plus a short justification; the **Worker maps tier → points from a
> hardcoded table and does ALL arithmetic** (zero hallucinated scores). Privacy:
> only article type + anonymous article text leave the Worker — no name, no
> student number. Prompt caching on (cache_control on the rubric). Bounded retry
> (2 attempts, then flag — no infinite loop). Injection handling is **flag only,
> never auto-penalty:** the model returns an `injection_flag` and grades the
> real text on its merits regardless. **This is the first feature that sends data
> off-platform.** Needs a new Worker secret `ANTHROPIC_KEY`. **Worker-code +
> secret only — no SQL, no RLS, no CMS change.** Verified live via console
> (no UI yet) across the full injection matrix — see Build History. **Still
> ahead:** the scorecard UI (the confirm-before-it-counts screen that retires
> console testing), then storage + CSV for Canvas. Laura's corrections are
> authoritative.
>
> **Version note (June 28, 2026):** This was the **v4.6** doc. v4.6 added
> **public photo uploads with an in-browser cropper.** New PUBLIC Storage bucket
> `media`; one Worker action `image_upload` (bucket-aware `sbStorageUpload` +
> `sbPatchRow` stamp `photo_url`); CMS upload buttons beside the existing
> paste-a-URL fields for BOTH article lead photos (full colour) and staff
> headshots (auto black-&-white). A drag-and-zoom **cropper** (cover-locked,
> 16:9 for articles / 1:1 for staff, rule-of-thirds guides, fixed output sizes
> 1600×900 / 800×800) frames every upload so "what you crop is what shows"
> everywhere — retiring the manual pre-crop chore. Also: live photo preview in
> the writer + review panes, and the article hero now centre-crops uniformly
> with the homepage (removed a stray inline style that defeated `object-fit`).
> All CMS-only except the bucket — no SQL, no RLS table, no Worker secret change.
> Gauntlet-passed live (upload, crop framing held on homepage + article, B&W
> staff, replace-in-place no orphans, cover-lock, cancel/Esc/backdrop). Laura's
> corrections are authoritative.
>
> **Version note (June 18, 2026):** This was the **v4.5** doc. v4.5 added
> interview-proof uploads (private Supabase Storage bucket `proofs` + private
> `proofs` table; four Worker actions; roll-off in the nightly sweep; CMS upload
> UI, review viewer, and a Reports/CSV column) — all written from the code we
> shipped and Laura gauntlet-tested live (upload, view via signed URL, delete,
> reporter own-scoping, Reports↔CSV match). v4.4 (password hashing) and the
> v4.3 sections below were verified against the actual Worker + `cms/index.html`
> on June 18 and remain code-accurate. Laura's corrections are authoritative.
>
> **How this file stays current:** there are TWO copies — the local one at
> `OneDrive/GitHub/theblueandwhite/cms/BlueAndWhite-ProjectDocs.md`, and the one
> uploaded into the Claude Project's knowledge. They do NOT sync. Saving locally
> (or pushing to GitHub) does nothing to the Project copy. To update what future
> Claude sees, you must **delete the old file in the Project and re-upload this
> one.** Do both whenever the doc changes.

---

## Quick Facts

| Thing | Value |
|---|---|
| Live site | https://blueandwhitewhs.com |
| GitHub repo | https://github.com/WHSBW/theblueandwhite |
| Hosting | GitHub Pages (free, public repo) |
| Domain registrar | Namecheap (CNAME points to GitHub Pages) |
| Backend database | Supabase (project ID: `cybjclqcdmrjhoaoiund`) |
| Auth gateway + publish proxy | Cloudflare Worker (`morning-field-8e58.lauranovello0214.workers.dev`) — **v4.10** |
| File storage | Supabase Storage — private bucket `proofs` (interview proofs; signed-URL only) **and** PUBLIC bucket `media` (article lead photos + staff headshots; public-read, Worker-only writes) |
| AI grading | Anthropic API (`claude-sonnet-4-6`), called from the Worker via the `ANTHROPIC_KEY` secret. **Adviser-only**, second opinion only; adviser confirms. Confirmed scores stored in `rubric_grades` (append/history); students see released feedback in-CMS; **Canvas is the grade of record (hand-keyed)** |
| CMS URL | https://blueandwhitewhs.com/cms/ |
| Late policy config | `assets/js/late-policy-settings.js` (10% / school day) |
| Deployment | Local OneDrive git clone → GitHub Desktop commit/push; Pages builds in ~1 min, CDN up to ~10 min |
| Stack | Vanilla HTML / CSS / JavaScript — no frameworks |
| HCPS 2026–27 school year | August 10, 2026 – May 28, 2027 |

---

## Architecture (v4.3)

```
Reporter/Editor (browser)
        │  login → Worker checks credentials, issues 12-hour session token
        │  EVERY data operation: POST {action, token, ...}
        ▼
Cloudflare Worker (v4.10) ◄── secrets: GITHUB_TOKEN, SUPABASE_SERVICE_KEY, ANTHROPIC_KEY
   │         │      ◄── Cron Trigger 0 9 * * * (nightly sweep, 4–5 AM Tampa)
   │         └── Supabase REST (service role) — ALL reads & writes for the CMS
   │  PUT/DELETE files via GitHub Contents API
   │  POST api.anthropic.com — rubric grading draft (v4.7, adviser-only)
   │  confirmed grades stored in Supabase rubric_grades (v4.8/4.9, append)
   ▼
GitHub repo → GitHub Pages → blueandwhitewhs.com
        ▲
        └── public site JS (feed.js / home.js) reads Supabase with the
            publishable key — RLS limits it to SELECT on published articles ONLY
```

**The headline for District IT:** the CMS file contains **zero database
credentials**. Every read and write goes through the Worker with a server-
verified session token. The public key can read published articles and nothing
else — no drafts, no notes, no extensions, no edit-locks, no writes. All
site-file changes are authenticated and version-controlled in git.

**On the AI grader (v4.7–v4.9):** the only data that leaves the platform is the
rubric + an article's **anonymous** plain text + its type ("news"/"editorial").
No student name, no student number, no metadata — the Worker re-attaches
identity locally. The API key lives only as a Worker secret, never in the
browser. Grading is **manual and adviser-only** (v4.9 tightened the whole
surface — trigger/view/save — to adviser), never automatic. v4.9 added grade
STORAGE (the confirmed scorecard is saved to `rubric_grades`, append-on-save for
history) and STUDENT FEEDBACK (the writer sees the released parts of their latest
confirmed grade in-CMS). **Canvas remains the grade of record — the adviser
hand-keys the number per district contract; the CMS hosts the "why" (rubric +
comments).** Nothing on the platform talks to Canvas.

---

## Security Model (v4.3)

| Surface | State |
|---|---|
| GitHub token, Supabase service key, Anthropic key | Encrypted Worker secrets only |
| Site files (GitHub Pages) | Change requires valid editor/adviser session |
| users + sessions tables | RLS enabled, no policies — Worker-only access |
| articles table | RLS enabled; anon policy = SELECT where status='published' ONLY; no anon writes |
| assignments table | RLS enabled, no policies — Worker-only |
| extensions table | RLS enabled, **no anon policies** — Worker-only. Holds student-written reasons + adviser decisions (treated as sensitive personal info) |
| edit_locks table | RLS enabled, no anon policies — Worker-only. Holds who-opened-what-when |
| proofs table | RLS enabled, **no anon policies** — Worker-only. Interview-proof file pointers (path + filename + uploader); FK to articles ON DELETE CASCADE |
| proofs Storage bucket | **PRIVATE** (no public policy). Files reachable only via short-lived (5-min) Worker-signed view URLs; never linked publicly. Protects egress + student privacy |
| media Storage bucket (v4.6) | **PUBLIC-read** (anyone can GET) — these images appear on the live site. **No anon writes**: the Worker (service role) is the only writer. Deliberate, documented departure from the proofs privacy model — do NOT lock this bucket or every site photo breaks. Holds article lead photos + staff headshots only; no student-private data |
| AI grading payload (v4.7) | Only rubric + **anonymous** article text + type leave the Worker. No name/number/metadata. **Adviser-only** (v4.9); the draft action itself saves nothing |
| rubric_grades table (v4.8/4.9) | RLS enabled, **no anon policies** — Worker-only. Holds confirmed grades + AI/adviser justifications + release mode = **sensitive student data**. RLS-on-at-creation (no exposed window). Reads gated: `grade_list` adviser-only; `grade_feedback` reporter-own-scoped and returns ONLY the released parts of the latest confirmed version (never the AI draft, never an unreleased number, never history) |
| Sessions | 12-hour expiry, purged nightly, killed instantly on staff removal |
| Reporter isolation | Server-enforced: reporters can only read/write their OWN articles |
| Note content | HTML-escaped on render (student-editor XSS closed) |

**Privacy-by-design principle:** extensions and edit-lock data live in
RLS-locked private tables with **no anonymous policies** from the start —
because student reasons and adviser notes can contain sensitive personal
information. This is intentional, not retrofitted.

**Note on testing public read access:** Laura's authenticated Supabase session
(and the Supabase MCP) BYPASS RLS, so they can't verify what the anonymous
public can actually read. To test public access for real, hit the REST API
directly with the **anon/publishable key** — not the service role, not an
authenticated session.

**Passwords (v4.4):** stored as **salted PBKDF2-SHA-256 hashes** (Web Crypto,
no library), format `pbkdf2$<iterations>$<salt>$<key>`, default **100,000
iterations** (tunable constant `PBKDF2_ITERATIONS`). Legacy plain-text rows are
**transparently re-hashed on next successful login** — no migration script, no
lockouts; accounts that haven't logged in since the v4.4 deploy stay plain text
until they do. New accounts (`staff_add`) and password changes
(`change_password`) are hashed on write. `staff_update` can no longer write
`password_hash` at all.

**Remaining (wishlist-tier, not holes):** Worker has no rate limiting.

### Permission matrix
- **Reporter:** own articles only (write/edit/autosave/submit), see applicable
  assignments + own progress, request extensions, change own password.
- **Editor:** + read everything, review queue, publish/return/archive/recycle/
  restore/delete-forever, analytics, create/edit/delete assignments. **(v4.9: AI
  rubric grading is NO LONGER editor-accessible — adviser-only.)**
- **Adviser:** + Staff Manager, staff page publishing, add/remove logins;
  grant/deny extensions; unremovable via API. **Owns the ENTIRE AI-grading
  surface (adviser-only): run drafts (`rubric_grade`), confirm/save
  (`grade_save` — the only path to a stored score), view grades + history
  (`grade_list`), set per-version release mode. Students see released feedback
  via `grade_feedback` (own-scoped).**

---

## Supabase

**URL:** `https://cybjclqcdmrjhoaoiund.supabase.co`
**Publishable key** (public-safe, only in feed.js/home.js): `sb_publishable_G-U4_7cECYwC3c1Sa2MqWQ_9NHN-7_g`
**Service role key:** Worker secret `SUPABASE_SERVICE_KEY` only.

### articles
id (uuid) · author_id (nulled when author removed; byline survives via
author_name) · author_name · headline · dek · body (HTML) · section ·
photo_url/caption/credit · status (draft/pending/returned/published/archived/
trashed) · github_path · **assignment_id** (links to assignments; '' = free
write) · trashed_at · takedown_at · editor_notes (**JSON array** of
{by, at, text, **done, done_by, done_at**}; the done trio is written by
`note_toggle`; legacy plain text auto-wrapped) ·
word_count + analytics columns · created/submitted/published_at · **updated_at**
(v4.10 — last-touch timestamp; stamped by `art_save` on every reporter write;
drives the 45-day stale-draft roll-off; backfilled from `created_at` on existing rows)

### users
id · name · student_number · password_hash (salted PBKDF2 hash as of v4.4; legacy plain-text rows upgrade on next login; RLS-locked) · role ·
section · title · grade · bio · beats · page_section · show_on_page · photo_url

### sessions
token (PK) · user_id · name · role · created_at · expires_at (+12h)

### assignments
id · title · due_date · assigned_to ('all' or section) · min_words ·
instructions · created_by

### extensions (verified against Worker)
**One row per article**, PK = `article_id` (each write is an upsert, so a new
request overwrites the prior row for that article). Columns:
`article_id` · `status` (requested/granted/denied) · `new_due` (set only on
grant) · `reason` (student-written, capped 1000 chars) · `note` (adviser note,
capped 1000 chars) · `decided_by` · `decided_at`. **Private — no anon policies.**
(Quirk: `ext_request` stamps `decided_by`/`decided_at` with the requester at
request time, then `ext_resolve` overwrites them with the adviser on decision.)

### edit_locks (verified against Worker)
PK = `article_id`. Columns: `article_id` · `editor_id` · `editor_name` ·
`opened_at`. Powers the soft "X opened this N min ago" warn-only banner; the
"actively editing" window is **10 minutes**. **Private — no anon policies.**

### proofs (v4.5, verified against Worker)
One row per uploaded interview-proof image. Columns: `id` (uuid PK,
`gen_random_uuid()`) · `article_id` (uuid, **FK → articles(id) ON DELETE
CASCADE**) · `path` (object path in the `proofs` bucket) · `filename` (original
name) · `uploaded_by` (name) · `uploaded_at`. Index on `article_id`. **Private —
RLS on, no anon policies.** The actual image bytes live in the private Storage
bucket `proofs`; this table only holds pointers. Multiple proofs per article.

### (no new tables in v4.7)
`rubric_grade` **saves nothing** — it only returns a draft scorecard to the
browser. (Storage arrived in v4.8/4.9 — see `rubric_grades` below.)

### rubric_grades (v4.8/4.9, verified against Worker)
**One row per CONFIRMED grade — append-on-save, so this is a full version
history.** The latest `version` for an article IS the grade; older rows are the
audit/improvement trail (the history strip + reopen-to-edit read them). Columns:
`id` (uuid PK, `gen_random_uuid()`) · `article_id` (uuid, **FK → articles(id) ON
DELETE CASCADE**) · `version` (int, 1,2,3… per article; the Worker stamps the
next number) · `article_type` (`news`/`editorial` — what it was graded as) ·
`ai_draft` (jsonb — the model's ORIGINAL draft: tiers + justifications + overall
+ injection_flag + its computed total, for the audit trail) · `ai_total`
(numeric) · `ai_injection_flag` (boolean, broken out for easy "show flagged") ·
`confirmed_grade` (jsonb — the adviser-edited tiers + justifications + overall,
**plus `release_mode`** = `full`/`rubric`/`comments`, tucked in the JSON so no
extra column was needed) · `confirmed_total` (numeric — **Worker-RECOMPUTED**
from the confirmed tiers at save; never trusts a browser number) · `confirmed_by`
(adviser name) · `confirmed_at` (timestamptz). Indexes on `article_id` and
`confirmed_at`. **Private — RLS ON at creation, NO anon policies** (holds grades
+ justifications = sensitive). Per-criterion *points* are NOT stored — only the
tier — and points are derived from the shared `RUBRIC_POINTS` table wherever
needed (CSV, student view), so the tier is the single source of truth and there
is zero drift. Roll-off: the nightly sweep deletes rows older than 30 days
**measured from `confirmed_at`** (not publish — a returned-but-graded article
keeps its grade through the revision cycle).

### Cumulative SQL (v4 baseline + v4.3 additions)
```sql
-- v4 baseline (already run)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS trashed_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS takedown_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS beats text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS page_section text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_on_page boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url text;
CREATE TABLE IF NOT EXISTS sessions (token text PRIMARY KEY, user_id text,
  name text, role text, created_at timestamptz DEFAULT now(), expires_at timestamptz);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS assignment_id text;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published" ON articles
  FOR SELECT TO anon USING (status = 'published');
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- v4.1–v4.3 additions (shapes verified against the Worker; exact CREATE TABLE
--   text not in hand — these match what the Worker reads/writes)
-- extensions:  PK article_id (text) · status text · new_due · reason text ·
--              note text · decided_by text · decided_at timestamptz.
--              RLS on, NO anon policy. Upserted on article_id.
-- edit_locks:  PK article_id (text) · editor_id text · editor_name text ·
--              opened_at timestamptz. RLS on, NO anon policy. Upserted.
-- editor_notes 'done'/'done_by'/'done_at' live INSIDE the existing JSON array,
--   so note checkboxes needed no schema change.

-- v4.7 (rubric grading ENGINE): NO SQL — the draft action saves nothing.

-- v4.8 (rubric grade STORAGE): one new table, RLS on at creation, no anon policy.
--   release_mode (v4.9) rides inside confirmed_grade jsonb — no migration needed.
CREATE TABLE IF NOT EXISTS rubric_grades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id         uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version            int  NOT NULL DEFAULT 1,
  article_type       text NOT NULL,
  ai_draft           jsonb NOT NULL,
  ai_total           numeric NOT NULL,
  ai_injection_flag  boolean NOT NULL DEFAULT false,
  confirmed_grade    jsonb NOT NULL,   -- includes release_mode (full/rubric/comments)
  confirmed_total    numeric NOT NULL,
  confirmed_by       text NOT NULL,
  confirmed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rubric_grades_article_id_idx   ON rubric_grades(article_id);
CREATE INDEX IF NOT EXISTS rubric_grades_confirmed_at_idx ON rubric_grades(confirmed_at);
ALTER TABLE rubric_grades ENABLE ROW LEVEL SECURITY;
-- NO anon policy by design (Worker service role bypasses RLS).
-- Emergency rollback: ALTER TABLE rubric_grades DISABLE ROW LEVEL SECURITY;

-- v4.9 (student feedback + reopen-edit): NO SQL — all Worker code + CMS.

-- v4.10 (stale-draft roll-off): one column + a one-time backfill. The backfill
--   is NOT optional — without it, every draft created before this column existed
--   has a null updated_at and would dodge the 45-day sweep forever.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE articles SET updated_at = created_at WHERE updated_at IS NULL;
-- Emergency rollback: ALTER TABLE articles DROP COLUMN updated_at;

-- Emergency rollback pattern: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
```

---

## Cloudflare Worker (v4.10)

Secrets (type Secret): `GITHUB_TOKEN`, `SUPABASE_SERVICE_KEY`, **`ANTHROPIC_KEY`** (v4.7). (v4.8/4.9 added no new secrets.)
Cron: `0 9 * * *` → nightly sweep.

### ⚠️ Token expiry — ACTION REQUIRED by June 1, 2027
Fine-grained PAT `newspaper-worker-2027`, WHSBW/theblueandwhite only,
Contents read/write, expires **June 1, 2027**. Symptom when expired:
"GitHub error: Requires authentication" on publish. Fix: regenerate on
GitHub → paste into Worker secret → deploy → delete old → update this date.
Don't investigate dead tokens; re-mint.

### Actions (POST {action, token, ...})
| Action | Roles | Purpose |
|---|---|---|
| login / logout | — / any | credential check → 12h token; session delete |
| publish / delete | editor+ | article file to/from GitHub (articles/*.html only) |
| publish_page | adviser | whitelisted pages (staff.html) |
| staff_list/add/update/remove | adviser | roster; remove detaches articles (byline survives), kills sessions; advisers unremovable |
| change_password | any | verifies current first |
| art_read | any | reporters force-scoped to own; filters: id/status/neq_status/author_id_self; whitelisted order columns |
| art_save | any | insert/update with reporter field+status whitelist; author stamped from session. **v4.10: stamps `updated_at = now()` on every write** (the last-touch clock for the stale-draft sweep) |
| art_admin | editor+ | full-field updates incl. any status |
| art_destroy | editor+ | permanent row delete |
| assign_list | any | all assignments (client filters by section) |
| assign_add/update/destroy | editor+ | assignment management |
| ext_request | any (reporter own-scoped) | submit/overwrite an extension request on an article (reason); upserts extensions row |
| ext_list | any (reporter sees own) | list extension rows; reporters filtered to their own articles |
| ext_resolve | adviser | grant/deny → sets status, new_due (on grant), note, decided_by/at |
| lock_touch | any | record opener + time on an article; returns a warn if someone else opened it < 10 min ago |
| note_toggle | any (reporter own-scoped) | flip done/done_by/done_at on ONE note inside editor_notes JSON; note text untouchable |
| proof_upload | any (reporter own-scoped) | validates image type + 8 MB cap, base64 → bytes, stores in private `proofs` bucket, records a `proofs` row; cleans up the file if the row insert fails |
| proof_list | any (reporter sees own) | with an article id: that article's proofs; without an id: editors/adviser get ALL (powers the Reports column), reporters get own |
| proof_view_url | any (reporter own-scoped) | mints a 5-minute signed view URL for one proof |
| proof_delete | any (reporter own; editors/adviser any) | deletes the Storage file + the `proofs` row |
| image_upload (v4.6) | any (reporter own article; staff target = adviser only) | stores a pre-cropped JPEG (base64) in the PUBLIC `media` bucket at a stable, extension-less path (`articles/<id>-lead` or `staff/<id>`), then stamps `photo_url` on the row via `sbPatchRow`. Returns the public URL + `?v=` cache-buster. Upsert = replace-in-place, no orphans. Validates JPG/PNG/WEBP + 8 MB cap |
| **rubric_grade (v4.7; adviser-only as of v4.9)** | **adviser** | **AI rubric draft — a SECOND OPINION the adviser confirms, never autonomous. Accepts a LIST of article ids (`ids`) — the checkbox batch; a single grade is a one-element list (also accepts a bare `id`). Per article: strips HTML to paragraph-preserving plain text, refuses if < 50 words, reads type from `section` (Editorial → editorial, all else → news), calls Claude (`claude-sonnet-4-6`) with the cached rubric system prompt, validates the JSON, maps tier → points from a fixed table (Worker does ALL arithmetic), bounded retry (2 attempts then flag). Returns per-article `{id, ok, type, grade}` or `{id, ok:false, error}`. SAVES NOTHING — only returns the draft scorecard. Needs the `ANTHROPIC_KEY` secret. **v4.9: role tightened from editor+ to adviser-only — no student editor can send article text off-platform.** |
| **grade_save (v4.8)** | **adviser** | The ONLY path to a stored grade. Validates the confirmed tiers, **RECOMPUTES `confirmed_total` from them** (never trusts a browser number), stamps the next `version`, and **APPENDS** a row to `rubric_grades`. Stores both the AI draft (audit) and the adviser-confirmed grade incl. `release_mode`. Returns `{id, version, confirmed_total}` |
| **grade_list (v4.8)** | **adviser** | Read confirmed grades. With `article_id`: that article's full version history (oldest first) — powers the history strip, reopen-to-edit, and the CSV grade columns. Without: every row (CMS reduces to latest-per-article). Adviser-only — no student ever sees a grade through this |
| **grade_feedback (v4.9)** | any (reporter own-scoped) | The STUDENT read path. Returns ONLY the **latest confirmed version**, filtered by its `release_mode` — never the AI draft, never an unreleased number, never history. Reporters are server-scoped to their OWN article (others → null). `rubric` mode nulls the justifications/overall; `comments` mode nulls the tiers/points/total |

**Note-done toggle:** dedicated `note_toggle` action (tagged v4.1 in the Worker).
It flips `done`/`done_by`/`done_at` on one note inside the editor_notes JSON
array; note text cannot be altered by it. Reporters are scoped to their own
articles.

### Password hashing (v4.4)
`login` verifies via `verifyPassword()` (handles both legacy plain text and
PBKDF2 hashes) and re-hashes legacy rows on success. `staff_add` and
`change_password` call `hashPassword()` before writing. Helpers: `hashPassword`,
`verifyPassword`, `pbkdf2Derive`, `isHashed`, `constantTimeEqual`. Iteration
count is baked into each stored hash, so raising `PBKDF2_ITERATIONS` later won't
break old hashes — they verify at their original count and drift upward on next
password change. **Worker-only change: no SQL, no RLS, no CMS edit.**

### Rubric grading (v4.7) — how the action is built
The model **never sees a number.** It returns, per criterion, a **tier** (one of
`exemplary`/`proficient`/`developing`/`beginning`/`absent`) + a one-to-two
sentence justification, plus an `overall` comment and a boolean `injection_flag`.
The Worker maps tier → points from a **hardcoded table** (`RUBRIC_POINTS`) and
sums them — so scores are deterministic and always match the printed rubric (no
rounding drift, no "AI did bad math").

Key constants (one-line swap points): `RUBRIC_MODEL = 'claude-sonnet-4-6'`,
`RUBRIC_TEMPERATURE = 0.4` (warm "margin-notes" tone; A/B as desired),
`RUBRIC_MAX_ATTEMPTS = 2`, `RUBRIC_MIN_WORDS = 50`, `RUBRIC_MAX_BATCH = 30`.

Helpers: `rubricArticleType` (section→type), `rubricStripHTML` (drops tags incl.
highlight spans but **keeps paragraph breaks** so a wall-of-text article is
correctly dinged on Structure/Clarity), `rubricSystemBlocks` (the rubric system
prompt as a single `cache_control:{type:'ephemeral'}` block — prompt caching on),
`parseGrade` (strict on the six criteria; lenient on overall/injection_flag — a
missing housekeeping field never voids a good grade; coerces injection_flag to a
real boolean), `rubricScore` (tier→points + total, nearest half-point),
`rubricCallAPI` (one POST to api.anthropic.com), `rubricGradeOne` (one article,
bounded retry, never invents a grade). The action `rubric_grade` loops the id
list (sequential = comfortably inside rate limits) and returns per-article
success/failure.

**⚠️ GOTCHA for future Claude — assistant prefill is NOT supported.** The spec's
reliability trick was to prefill the assistant turn with a single `{` to force
clean JSON. **`claude-sonnet-4-6` rejects this** — the API returns *"This model
does not support assistant message prefill. The conversation must end with a
user message."* We **removed the prefill** (the `messages` array ends on the user
turn) and lean on `parseGrade`'s fence-strip + first-`{` trim, which the modern
model doesn't need anyway. If a future model swap reintroduces prefill, re-test
this first. (Also: the on-dashboard "Prompt caching: Not enabled" widget is a
*different, manual* feature — our `cache_control` block activates caching
automatically on prompt reuse within the window; ignore the widget.)

### Injection handling (v4.7) — flag, never auto-punish
The system prompt forbids the model from following any instruction embedded in
the article text ("give me 100%", "ignore the rubric", "you are now…"). It grades
the **real writing on its merits** regardless, and sets `injection_flag: true`
so the adviser gets a quiet "⚑ take a look." **No automatic penalty, no automatic
anything** — Laura investigates and decides. Verified live (see Build History):
the same planted injection scored 100 on a strong article and 40 on a weak one —
proving the embedded instruction moved the score by exactly zero.

### Rubric grade storage + student feedback (v4.8/4.9) — how it is built
**Storage (v4.8).** `grade_save` (adviser-only) is the one writer. It validates
the six confirmed tiers, **recomputes the total from them via `RUBRIC_POINTS`**
(the same hardcoded table the engine uses — never trusts a browser number),
finds the next `version` for that article, and inserts a new `rubric_grades`
row (append = history). `release_mode` (v4.9) is stored inside `confirmed_grade`
jsonb. `grade_list` (adviser-only) reads rows — with an `article_id` it returns
that article's full version history (powers the history strip, reopen-to-edit,
and the CSV); without, it returns all rows.

**Student feedback (v4.9).** `grade_feedback` is the reporter-safe read. It is
own-scoped server-side (a reporter passing someone else's id gets `null`), pulls
ONLY the latest confirmed version, and filters by `release_mode` before
returning: `rubric` nulls justifications + overall; `comments` nulls tiers +
points + total; `full` returns everything. It NEVER returns the AI draft, an
unreleased number, or history. The student sees this in their own write view,
under the workflow tracker, with the Canvas grade-of-record italic line.

**Reopen-to-edit (v4.9).** No new Worker action — the CMS reads the latest
confirmed version via `grade_list?article_id=` and seeds the editable overlay
from the SAVED tiers/comments (not a fresh AI pass, no API call). Confirm & save
appends the next version (append-on-save). Release mode is preserved across the
round-trip and across re-grades.

### Nightly sweep
1. Auto-takedowns (published + takedown_at passed → GitHub file removed →
   archived; GitHub failure = retry tomorrow)
2. Recycle Bin purge (trashed > 30 days → gone). **v4.5:** before an article row
   is deleted, its proof FILES are removed from Storage; the proof ROWS
   cascade-delete with the article via the FK.
3. Expired session cleanup
4. **Proof roll-off (v4.5):** delete proofs whose article `published_at` is more
   than `PROOF_ROLLOFF_DAYS` (30) ago — "published + 30 days," plus the trash
   backstop in step 2.
5. **Rubric-grade roll-off (v4.8):** delete `rubric_grades` rows older than
   `GRADE_ROLLOFF_DAYS` (30) measured from **`confirmed_at`** (not publish — a
   returned-but-graded article keeps its grade through revisions). District-IT
   hygiene; the adviser exports to CSV well inside the window.
6. **Stale-draft roll-off (v4.10):** any `status='draft'` whose `updated_at` is
   more than `DRAFT_ROLLOFF_DAYS` (45) ago is moved to `trashed` (sets
   `trashed_at = now()`) — NOT hard-deleted, so it rides the 30-day Recycle Bin
   purge in step 2 (75 days total, with a restore window). Role-blind. The clock
   is `updated_at` (stamped by `art_save`), so a draft someone keeps revising
   across weeks is protected from premature sweep. Catches the abandoned-
   "dgdkjg" drafts kids leave while learning the page.

---

## The CMS (cms/index.html)

No supabase-js, no keys. `workerCall()` attaches the session token to every
request; `artRead()` wraps reads. Session persists across refresh via
sessionStorage (`bw_session`).

> **Helper signature note (confirmed live v4.7):** `workerCall` takes **ONE
> argument — a single payload object** — and auto-attaches the token:
> `workerCall({ action: 'art_read', where: {} })`. The `action` goes *inside*
> the object. (Do NOT call it as `workerCall('action', {...})`.) Useful for
> console smoke tests.

### Newsroom flows
- **Write:** draft → autosave (3s after typing; requires headline; REFUSES to
  save an empty body over an existing article) → submit. Articles may be tied
  to an assignment via the writer dropdown (saved to assignment_id).
- **Highlighting:** blue-highlight system with a reporter-facing **HL** button
  for marking text during drafting/review. Highlights are **stripped at publish
  time** so they never reach the live site.
- **Interview proof uploads (v4.5):** in the WRITER view, an "Interview proof"
  section — reporters pick an image (instant upload on pick; loud "Uploaded ✓"
  toast), shown as 120px thumbnails with a delete ×. Images only (≤8 MB),
  private. In the REVIEW pane, editors/adviser see the same thumbnails under
  Writing Analytics; clicking opens the full image via a 5-minute signed URL;
  delete available. Reporters are own-scoped on every proof action (UI gives no
  path to others' articles AND the Worker re-checks ownership server-side).
  Functions: `uploadProof`, `loadProofs`, `deleteProof`, `_fileToB64`,
  `clearProofThumbs`. Proofs save independently of Save Draft / Submit.
- **Photo uploads + cropper (v4.6):** beside the existing paste-a-URL field
  (paste still works — used for already-hosted/wire photos), an **Upload** button
  on BOTH the writer's lead photo and each staff profile. Picking a file opens a
  **cropper modal**: the whole image shows with everything outside a fixed-shape
  bright frame dimmed; drag to reposition, slider/scroll-wheel to zoom,
  rule-of-thirds guides. **Cover-locked** (the frame is always full — no gaps).
  Frame is **16:9 for article lead** photos, **1:1 (square) for staff**.
  "Use this crop" renders exactly the framed region to a canvas at a fixed size
  (**1600×900** article / **800×800** staff), staff gets **grayscale** folded
  into the same pass, then the base64 goes to `image_upload`. Because the stored
  file is already the final shape, it looks identical everywhere (homepage,
  article, cards) with zero CSS — and it retires the "pre-crop elsewhere" chore.
  **Stable path per target → replace upserts in place (no orphans).** Reporters
  own-scoped on article photos (UI + server); staff target is adviser-only.
  **Live preview** under the photo field in the writer AND review panes (shows
  uploaded OR pasted URLs, so graininess is visible before publish). Allowed:
  JPG/PNG/WEBP; **HEIC + AVIF rejected** (won't render publicly / can't decode
  on Chromebooks). Cancel / Esc / click-backdrop all back out cleanly.
  Functions: `openCropper`, `cropConfirm`, `closeCropper`, `_cropDraw`,
  `_cropClampPan`, `_cropZoom`, `_cropPointer*`, `_cropWheel`, `_doImageUpload`,
  `_refreshPhotoPreview`, `_mediaPrecheck`. **Article hero fix:** removed a stray
  inline `height:auto` in `generateArticleHTML` that overrode the stylesheet's
  16:9 `object-fit:cover` — article heroes now centre-crop uniformly with the
  homepage (existing articles need a re-publish to pick it up; new ones are
  automatic). All CMS-only — no Worker/SQL/RLS touched beyond the bucket.
- **AI rubric grading (v4.7 engine + v4.8/4.9 UI — SHIPPED, adviser-only):**
  lives in the **Reports view**. Pick an assignment → the report table renders →
  below it an **AI Rubric Grading** panel lists the gradable articles
  (pending/returned/published only; drafts/trashed never appear) with a checkbox
  each. Tick the ready ones → **⚖ Grade selected** fires `rubric_grade` (one
  AI call per article, sequential) → a **Canvas-style side-by-side overlay** opens:
  the article (read-only) on the LEFT, the editable scorecard on the RIGHT — six
  rows (tier dropdown showing each tier's points + live-computed points + editable
  justification), an editable overall comment, the **⚑ injection banner** if the
  model flagged the text, a **Release-to-student** selector (full / rubric only /
  comments only), and a running total. **Confirm & save** (`grade_save`) is the
  ONLY path to a stored grade and **auto-advances** to the next ungraded article
  in the batch. An adviser-only **history strip** at the top of the overlay lists
  prior saved versions (read-only snapshots). Any already-graded student shows a
  **view / edit** link that **reopens the latest saved grade with no AI call**
  (loads your saved tiers/comments, fully editable; Confirm appends the next
  version). Red Pen Novello in code: the model proposes, the adviser edits and
  confirms, nothing un-reviewed reaches a student — and **no student editor can
  touch any of it** (the whole surface is adviser-only). Key functions:
  `gradeSyncFromReport`, `gradeRenderControls`, `gradeRunSelected`,
  `gradeOpenOverlay`/`gradeRenderOverlay`, `gradeSetTier/Just/Overall/Mode`,
  `gradeConfirmSave`, `gradeRenderHistory`/`gradeShowVersion`, `gradeOpenSaved`,
  `loadGradeFeedback` (student side), `_loadGradeMap`/`downloadReportCSVWithGrades`
  (CSV).
- **Student rubric feedback (v4.9):** in the reporter's WRITE view, under the
  workflow tracker, a **"Your Rubric Feedback"** panel appears once the adviser
  confirms — showing only the released parts of the latest confirmed version
  (`grade_feedback`, reporter-own-scoped). `full` = tiers + points + total +
  comments; `rubric` = tiers/points/total, no prose; `comments` = feedback only,
  **no score shown** (the practice-round mode — comment now, grade when they say
  they're ready). Always carries the italic line *"Final grade of record resides
  in the HCPS Canvas gradebook."* Never shows the AI draft, an unreleased number,
  or history.
- **Assignments:** adviser/editor creates AND EDITS (✎ Edit fills the form,
  Save Changes / Cancel Edit). **Smart reporter dashboard cards** show per-kid
  progress on each assignment — Write (none yet) / Open + "Draft in progress" /
  "Submitted ✓" / "Returned — see notes" / "Published ✓". Clicking an
  assignment with an existing article opens THAT article (no duplicates).
- **Late policy (client-side only):** the Worker has NO late logic — late flags
  and the 10%/school-day penalty live entirely in `assets/js/late-policy-settings.js`
  using the official HCPS 2026–27 calendar. The only server-side piece is
  `new_due` on the extensions row. **3-day lockout applies to INITIAL
  submissions only** (not resubmissions). Effective due dates recompute when an
  extension is granted.
- **Extensions:** reporter requests an extension (with a reason); adviser
  grants/denies. Adviser can also proactively override a due date from the
  review pane. Granting recomputes the effective due date for that student.
- **Assignment Reports (adviser only, client-side):** a `reports` view. Pick an
  assignment -> one row per reporter who linked an article to it (submitters
  only; trashed excluded). Columns: Reporter, Student #, Status, Words (vs. min,
  amber if short), Submitted, Late, Extension, Published, plus a summary line
  (N reporters / submitted / late / published). Reuses the existing late +
  extension engine (`lateInfoFor`, `getExtensionMap`, `getAssignmentMap`,
  `lateBadgeHTML`, `extStatusHTML`) so badges match the dashboards exactly.
  Student # comes from `staff_list` (adviser-scoped); a removed author shows by
  byline with a blank number. **Download CSV** builds the file in-browser (BOM
  for Excel, RFC-4180 quoting) -- no Worker/SQL/RLS touched. Functions:
  `loadReports`, `runReport`, `_renderReportTable`, `downloadReportCSV`.
  **v4.5:** an **Interview Proof** column (Yes/No) on-screen + in CSV, and a
  "N with proof" count in the summary line — fed by `proof_list` (no id) so the
  adviser can grade the interview component straight down the CSV into Canvas.
  **v4.8/4.9 (SHIPPED):** the CSV now also carries **AI Total, Confirmed Total,
  Confirmed?**, and the six criteria points (derived from the saved tiers), pulled
  via `grade_list` (latest version per article), name-sorted. The adviser opens
  the CSV beside Canvas and hand-keys the numbers — the page never talks to Canvas
  (district won't allow it). `downloadReportCSVWithGrades` loads grades first, then
  `downloadReportCSV` builds the file.
- **Review (4-step progress tracker, client-side):** the reporter sees a visual
  4-stage tracker driven by article status — **Rough Draft** (draft) → **Editor
  Review** (pending) → **Revisions** (returned) → **Published** (published) —
  with friendly per-stage guide text. This is wayfinding UX. The actual
  enforcement is **client-side in the CMS**: `publishArticle()` blocks publish
  with `if (!reviewNotes.length)` — an article with zero editor notes cannot be
  published through the UI, so **every article must go through at least one
  "Return with Notes" round first**. (The Worker itself does not independently
  require notes on `publish`/`art_admin`; the guard lives in the browser. Real-
  world bulletproof since only editors/advisers can authenticate a publish at
  all.) Reporters can only set draft/pending via `art_save`, and **Return also
  requires ≥1 note**. Notes are a persistent, timestamped, XSS-escaped thread
  (author + time), shown to the reporter in full and carried across rounds.
  **Per-note done-checkboxes** (`note_toggle`) let notes be toggled resolved.
  Return sweeps any text left in the note box into the thread. Editors can
  Review ANY status from All Articles, including drafts. The reporter's tracker
  also surfaces extension status (requested/granted/denied) inline.
- **Soft edit-lock:** warn-only banner ("X opened this draft N min ago") shown
  in BOTH the writer and the review pane. It warns; it does not block.
  Simultaneous editing remains last-save-wins.
- **Publish:** review pane (optional auto-takedown date, +30 days button) →
  Worker → GitHub → live (~1–10 min CDN). Edit/republish supported.
- **Lifecycle:** Archive (off site, re-publishable) → Recycle (30-day bin,
  Restore / Delete Forever) → nightly purge. Trashed articles are hidden from
  the reporter dashboard list. Nothing can be stranded.
- **Staff page:** profiles (title/grade/bio/beats/photo/section incl.
  Leadership/visibility) → ⌂ Publish Staff Page regenerates staff.html between
  its BW: markers (keep those markers!). Removing a student severs access
  instantly; bylines survive.

### Public site
- Carousel bug fixed (flex slide-width blowout).
- Seven section landing pages.
- Dynamic magazine homepage: carousel + hero grid + section columns, on a
  shared feed engine.

### Known dragons slain — for future debugging context
- **showView before form population:** ANY function that fills the write form
  must call `showView('write')` FIRST (it runs initWriteView, which clears
  fields). Calling it after = populate-then-wipe. Recurring; watch for it.
- initWriteView must clear EVERY field — once skipped w-photo ("ghost lobster"
  stale data).
- GitHub Pages CDN caches ~10 min AND negative-caches 404s — never debug a
  "missing" change before the window passes; cache-bust with `?v=N`.
- Reads alert on failure (old code swallowed failed reads → looked like data
  loss).
- **Assistant prefill is unsupported on `claude-sonnet-4-6`** (v4.7) — see the
  Worker section. Removed; don't re-add without re-testing.
- **Scope DOM selectors to a container in multi-render UIs** (v4.9.1) — the
  grading overlay read `document.querySelectorAll('.grade-pick:checked')`
  document-wide, and stale checkbox state seeded the wrong article into the batch
  ("everyone opens the same student's article"). Fix: read within the controls
  host (`host.querySelectorAll`), clear transient input state (checkboxes) after
  batch actions, and guard async renders (bail if the user moved during an await).
  Diagnose state bugs with a console probe of the actual state vars, not guesses.
- **Filter `status='trashed'` out of EVERY reporter/editor-facing article list**
  (v4.10) — the dashboard "My Submissions" list (`renderMyAssignmentsPanel`)
  showed trashed articles with a TRASHED badge instead of hiding them. It went
  unnoticed for a long time because drafts almost never got trashed — until the
  45-day stale-draft roll-off started trashing them routinely, which exposed it.
  A trashed article belongs in the Recycle Bin view only; everywhere else it
  should vanish. Fix: `.filter(a => a.status !== 'trashed')` before render. Lesson:
  a new feature that changes how often a state occurs can surface a latent bug in
  code that handles that state — when adding a roll-off/auto-status-change, audit
  every place that lists the affected rows.
- **favicon.ico 404 in console** — cosmetic, harmless, ignorable. The page has no
  favicon; the browser logs a 404 and moves on. Not a bug; don't chase it. (Could
  add one for polish someday.)

---

## Workflow Notes for Future Claude

- Download current files before patching (repo for CMS; ask Laura to paste the
  Worker from the Cloudflare editor). **Never patch from memory.**
- **Strict deploy order:** SQL → Worker → CMS → verify → **RLS last** (with a
  rollback line provided). This order has caught real bugs. (v4.7 needed none of
  the SQL/RLS steps — Worker secret + code only.)
- **Whole-block pastes at clear seams**, not surgical line edits — Laura pastes
  directly into the Cloudflare browser editor. Give her the seam ("paste between
  this `}` and that comment"), not line numbers. **Before pasting, copy the whole
  current Worker into a scratch file** as a rollback — the Cloudflare editor has
  no trustworthy undo across a bad paste.
- **Assume a paste error is YOUR code first, user error second.** At least twice
  a "paste mistake" was actually a Claude bug — the `\\'` apostrophe escape that
  closed a string early (v4.7) and an earlier one. Sidestep apostrophes in
  string literals entirely ("could not" not "couldn't") when handing over paste
  blocks.
- **Role gauntlet after every deploy:** Laura runs a full multi-role test
  (adviser + test reporter "Fable Jones", student #0000004) after each change.
  Support it — it has caught launch-day bugs (populate-then-wipe ordering, ghost
  stale-data, silent read failures).
- GitHub API rate-limits on shared container IPs: use the codeload tarball
  (`https://codeload.github.com/WHSBW/theblueandwhite/tar.gz/main`) or
  `raw.githubusercontent.com` for individual files.
- supabase.co is NOT reachable from the Claude container; have Laura run SQL,
  or reason from the publishable key's minimal view. **The MCP/authenticated
  session bypasses RLS** — to test true public read access, hit REST with the
  anon key.
- Tokens are disposable; regenerate rather than investigate.
- Plain English first; depth on request. Laura calls out jargon directly and
  her corrections are authoritative — don't over-explain or get defensive.
- **AI grading framing:** any AI-assisted grading is ALWAYS a *second opinion
  Laura personally confirms* before anything leaves the system — never
  autonomous. This is a professional/pedagogical principle, not a preference.
  The injection flag is advisory only — never an automatic penalty.
- **Cleaner injection test (noted v4.7):** a planted-injection article that
  *legitimately* scores 100 is a noisy test (you can't tell "ignored the
  injection" from "obeyed it" when the honest grade is also 100). Plant the
  injection in a deliberately **mediocre** article — a low score + raised flag
  proves the instruction was ignored beyond doubt. (Done live: same injection,
  100 on the good piece, 40 on the bad one.)
- Running joke conventions: crustacean test accounts (Fable Jones, Clawford
  Daniels) and test articles (Local Shrimp Wins Big Race, Flobster, the Crow
  Problem).

---

## Pre-Launch Checklist (August, before students)

- [ ] Recycle/purge all test articles (the Flobster Cinematic Universe + the crows)
- [ ] Remove/repurpose test accounts; create real roster (Staff Manager)
- [ ] Fill staff profiles; ⌂ Publish Staff Page
- [ ] Confirm token expiry date still future (June 1, 2027 ✓)
- [ ] Confirm late-policy settings + HCPS calendar dates for the live year
- [ ] Walk one real student through write→submit→return→resubmit→publish
- [ ] Walk one extension request through request→grant→recomputed due date
- [ ] District IT submission: this doc's Security Model + permission matrix (now incl. PBKDF2 password hashing + the AI grading privacy posture)
- [ ] Confirm the AI grader spend cap is set ($20/mo; real spend ≈ $5/yr)

---

## Backlog / Next Sprint Arc

**Rubric grading arc — COMPLETE (v4.7 → v4.9.2):**
- ~~Engine (`rubric_grade`)~~ **DONE v4.7.** ~~Storage (`rubric_grades`, append
  history, roll-off)~~ **DONE v4.8.** ~~Scorecard UI (side-by-side, confirm &
  save, history strip)~~ **DONE v4.9.** ~~Student feedback + release modes
  (full/rubric/comments)~~ **DONE v4.9.** ~~CSV grade columns~~ **DONE v4.8/4.9.**
  ~~Reopen-to-edit saved grades~~ **DONE v4.9.2.** ~~Full role gauntlet~~ **PASSED**
  (Fable/reporter + Clawford/editor both locked out; injection keystone; release
  filtering; reopen/history). Canvas stays grade-of-record (hand-keyed); CMS hosts
  the "why."

**Open items (NOT done — next up):**
- ~~**Editor assignment notifications / dashboard cards.**~~ **DONE v4.10** —
  editor dashboard now has a Review Queue ↔ My Assignments tab toggle; My
  Assignments mirrors the reporter dashboard for the editor's own articles via
  the shared `renderMyAssignmentsPanel`.
- **favicon.ico** — add one to kill the harmless console 404 (cosmetic polish).
  **The only remaining backlog item.**

**Platform polish:**
- ~~Photo/asset upload to Supabase Storage (replaces paste-a-URL everywhere)~~
  **— DONE v4.6** (article lead + staff headshots, with cropper). Paste-a-URL
  deliberately retained alongside upload for wire/already-hosted photos.
- Editor's pick / featured homepage flag
- More Stories on article pages; live headline ticker; Wharton Brief episodes

**Mountains (acknowledged, not scheduled):**
- True real-time collaborative editing (CRDT/Yjs + Supabase Realtime — a
  different class of problem; soft locks cover 80% at 1% of the cost)

**Separate projects:** participation tracker; OCR/Fujitsu grading pipeline
(ties into rubric grading); *Vexed* timeline tool (interactive HTML; shipped
June 2026).

---

## Build History

| Date | What happened |
|---|---|
| ~April 2026 | Original build: site, CMS, Supabase, Worker, Pages, domain |
| June 1–5 | Token security audit; fine-grained PAT via Worker secret |
| June 5 | Section pages, homepage engines, photos, autosave, image tools |
| June 10 | Token rotated (exp 6/1/27); secrets encrypted; Recycle Bin + auto-takedown; nightly cron |
| June 11 AM | Worker v3: server-side login, 12h sessions; staff profiles + generated staff page; users/sessions RLS |
| June 11 PM | **Worker v4: CMS fully credential-free** — all data ops session-authenticated; reporters server-scoped; articles+assignments RLS sealed; persistent timestamped note threads (XSS-escaped); assignment↔article linkage + progress cards + duplicate prevention; assignment editing; review for all statuses |
| Classroom-reality sprint | **Worker v4.3** — mandatory 4-step student review chain; per-note done-checkboxes; soft edit-lock warn-only banner (writer + review pane); school-day-aware late policy (HCPS calendar, 10%/day, 3-day lockout on initial submissions, configurable); extensions system (private RLS table, student request → adviser grant/deny, review-pane override, due-date recompute); smart reporter dashboard cards; public carousel fix; magazine homepage (carousel + hero grid + section columns, shared feed engine); blue highlight system w/ publish-time stripping + HL button; trashed articles hidden from reporter dashboard |
| June 18 | **Worker v4.4 — password hashing.** Salted PBKDF2-SHA-256 (Web Crypto, 100k iterations); transparent upgrade-on-login for legacy plain-text rows (no migration, no lockouts); `staff_add` + `change_password` hash on write; `password_hash` removed from `staff_update` allowed fields. Verified live: old password rejected, new accepted, stored value confirmed as `pbkdf2$…` hash. Last Security Model item closed. |
| June 18 | **CMS — Assignment Reports + CSV** (adviser-only, client-side; no Worker/SQL/RLS). Per-assignment, submitters-only report table reusing the late/extension engine; in-browser CSV export (Excel BOM, proper quoting). Full role-gauntlet pass: draft→pending→returned→published tracked correctly, late flag + CSV stayed in sync after a retroactive due-date change, editors correctly see no Reports menu item. |
| June 18 | **Interview proof uploads (v4.5) — full sprint, spec to ship.** New private `proofs` table (FK→articles, CASCADE) + private Storage bucket `proofs`. Worker: `proof_upload`/`proof_list`/`proof_view_url`/`proof_delete` (reporters own-scoped server-side; images only, 8 MB cap) + roll-off in the nightly sweep ("published + 30 days" + trash backstop). CMS: writer upload control w/ thumbnails + "Uploaded ✓" toast, review-pane viewer (signed-URL open), reporter delete/replace, and an Interview Proof column in Reports + CSV. Gauntlet: upload (incl. wrong-cat-photo → delete → re-upload), adviser + editor view/expand/delete, reporter own-scoping confirmed (UI + server), Reports↔CSV match. Deploy order honored: SQL+bucket → Worker → CMS → verify → bucket confirmed PRIVATE. |
| June 28 | **Public photo uploads + cropper (v4.6) — full sprint, spec to ship.** New PUBLIC Storage bucket `media` (public-read, Worker-only writes — deliberate departure from the proofs privacy model). Worker: one action `image_upload` (reporters own-scoped on article photos, staff = adviser-only; JPG/PNG/WEBP + 8 MB; stores at stable extension-less path, stamps `photo_url`, returns public URL + `?v=`); bucket-aware `sbStorageUpload`; new `sbPatchRow`. CMS: Upload buttons beside paste-a-URL on lead photos (colour) + staff headshots (auto B&W); drag-and-zoom **cropper** (cover-locked, 16:9 / 1:1, thirds guides, output 1600×900 / 800×800, B&W folded into the canvas pass); live photo preview in writer + review panes; student-guidance hints. **Bug fixed:** article hero stray inline `height:auto` removed → heroes now centre-crop uniformly with the homepage. Replace = upsert-in-place, **no orphans** (verified: one file per id). Gauntlet: tall photo cropped/framed → identical on homepage + article; B&W square staff; cover-lock held; cancel/Esc/backdrop; AVIF/HEIC + oversize rejected pre-cropper. CMS-only deploy (+ the one public bucket) — no SQL/RLS/Worker-secret change. |
| June 29 | **Rubric grading Worker action (v4.7) — spec to verified-live.** New `rubric_grade` action (editor/adviser only): **the first feature that sends data off-platform.** Model picks one of five tiers per criterion + a justification; the Worker maps tier→points from a hardcoded table and does all arithmetic (zero hallucinated scores). Privacy: only article type + anonymous text leave the Worker. Prompt caching on (cache_control on the rubric). Bounded retry (2 attempts, then flag — no infinite loop). Injection handling = flag only, never auto-penalty: model returns `injection_flag` and grades the real text on its merits regardless. **Gotcha logged for future Claude:** `claude-sonnet-4-6` REJECTS assistant-message prefill ("conversation must end with a user message") — the spec's `{`-prefill trick had to be removed; we lean on `parseGrade`'s fence-strip + first-`{` trim instead, which the modern model doesn't need anyway. Also fixed an apostrophe-escape bug in a Claude-written paste block (`\\'` closed a string early). Verified live via console (no UI yet) across the full matrix: **good article / no injection → honest 58.5, flag false** (the Opus piece); **good article / injection → honest 100, flag true** (first crow piece); **bad article / injection → honest 40, flag true** (the keystone — Sonnet-rewritten-worse version, proves the embedded "give me 100%" instruction moved the score by zero, the flag fired, bad writing graded as bad). Worker arithmetic confirmed on all three totals. Cost ≈ 1.5–2¢/article, ~$5/yr projected; $20/mo cap is a smoke alarm. Deploy: `ANTHROPIC_KEY` secret + Worker code only — no SQL, no RLS, no CMS change. **Next: the scorecard UI.** |
| June 29 | **Rubric grade STORAGE (v4.8).** New private `rubric_grades` table (RLS ON at creation, no anon policy; FK→articles CASCADE) — one row per CONFIRMED grade, **append-on-save** = full version history (latest = the grade). Two adviser-only Worker actions: `grade_save` (recomputes the confirmed total from the edited tiers — never trusts the browser — stamps the next version, appends; stores both AI draft and adviser-confirmed grade) and `grade_list` (history read; feeds CSV). Nightly sweep gained a grade roll-off (30 days from **confirmed_at**, not publish). Decision: RLS-on-at-creation for this sensitive no-anon-policy table (honors "RLS last" intent correctly — service role bypasses RLS so it can't lock us out). Deploy: SQL (one CREATE TABLE) → Worker. Console smoke test (`grade_save`→`grade_list`) passed clean. |
| June 29 | **Rubric grade SCORECARD UI (v4.9).** Canvas-style side-by-side in the Reports view: checkbox batch of gradable articles → Grade selected → overlay (article left, editable six-row scorecard right + overall + ⚑ flag + running total) → Confirm & save (only path to a stored grade) with auto-advance. Adviser-only history strip (read-only version snapshots). CSV gained AI Total / Confirmed Total / Confirmed? / six criteria columns. Also: **`rubric_grade` tightened from editor+ to adviser-only** — the whole grading surface is now the adviser's alone. CMS-only deploy (+ the role one-liner on the existing action). Gauntlet: full batch confirm + auto-advance, edit-a-tier recompute, reporter (Fable) + editor (Clawford) both see NOTHING grading-related. |
| June 29 | **Student feedback + release modes (v4.9).** New `grade_feedback` action (reporter-own-scoped) returns ONLY the latest confirmed version's released parts — never the AI draft, an unreleased number, or history. Per-version **release_mode** (`full`/`rubric`/`comments`) stored inside `confirmed_grade` jsonb (no SQL). Student sees a "Your Rubric Feedback" panel in their write view (same real estate as editor notes) with the Canvas grade-of-record italic line. **Comments-only** = feedback with no score shown (the practice-round workflow). Canvas stays the grade of record (hand-keyed per district contract); the CMS hosts the "why." Verified live: comments-only hides the number for the student; rubric-only hides comments; full shows all; reporter can't read another's feedback. |
| June 29 | **Batch-stepping bug fixes (v4.9.1).** Three live-found bugs in the grading overlay, all fixed CMS-only: (1) **wrong-article-opens** — checkbox reads were document-wide and stale checks bled into the next batch; fixed by scoping the `.grade-pick` read to the controls host AND clearing all checks after each grade run. (2) **release-mode reset on re-grade** — a fresh AI pass reseeded `releaseMode:'full'`; fixed by preserving the prior mode. (3) Added a **stale-render guard** in the async overlay (bail if the user advanced/closed during the `art_read` await). **Lesson for future Claude (now a Dragon):** scope DOM selectors to a container, never the whole document, in a multi-render UI; clear transient input state after batch actions; guard async renders against the user moving mid-await. Diagnosed via console probes (`_gradeBatch`/`_gradeIdx` vs. what's checked) rather than guessing. |
| June 29 | **Reopen-to-edit saved grades (v4.9.2).** A **view / edit** link on any already-graded student (detected via `grade_list`, so it shows even for grades from a prior session) reopens the latest saved confirmed version into the editable overlay — **no AI call, no fresh draft** (loads your saved tiers/comments). Edits + Confirm & save **append** the next version (append-on-save), release mode preserved across the round-trip. Closes the gap where the only way back into a confirmed grade was to re-grade (which burned a call and reverted to a fresh AI draft). CMS-only. Verified live: reopen shows the saved edits, tweak persists as a new version, release mode survives. |
| June 30 | **Editor dashboard cards + stale-draft roll-off (v4.10) — two arcs, one session.** (1) **Editor dashboard cards (CMS-only):** the editor/adviser dashboard gained a **Review Queue ↔ My Assignments** tab toggle. Review Queue = the existing editing-duties view; My Assignments mirrors the reporter dashboard for the editor's OWN articles (editors write too). Built by extracting the reporter card logic into a shared `renderMyAssignmentsPanel(assignListElId, myListElId)` (called by `loadReporterDash` and the new `loadEditorMyAssignments`); `switchEditorDashTab` toggles panels; `showView` resets to queue on entry. Fixed `requestExtension`'s hardcoded `loadReporterDash` refresh → now role-aware. (2) **Stale-draft roll-off (SQL → Worker):** new `updated_at` column on `articles` (`ALTER TABLE` + backfill `= created_at`), stamped by `art_save` on every write; nightly sweep step 6 trashes `draft` rows untouched 45 days → Recycle Bin → existing 30-day purge (75 days total, restore window). Role-blind; `updated_at` clock protects actively-revised drafts. **New Dragon, exposed by this:** trashed articles were showing on the dashboard "My Submissions" list with a TRASHED badge instead of being hidden — latent for ages because drafts rarely got trashed; the roll-off surfaced it. Fixed with a `status !== 'trashed'` filter in `renderMyAssignmentsPanel` (lands on both reporter + editor views). Deploy: SQL (forgot it first pass — Save Draft threw "Save failed" until the column existed; clean reminder that SQL precedes Worker), then Worker, then CMS. Verified live end-to-end: backdated a test draft to `updated_at` − 46 days, sweep filter caught it, it trashed → vanished from Fable's dashboard → sat restorable in the adviser's Recycle Bin. Editor dashboard cards item crossed off; only the cosmetic favicon 404 remains on the backlog. |

---

*Updated June 30, 2026 — v4.10. Two arcs this session: (1) **editor dashboard
cards** — editors finally get a Review Queue ↔ My Assignments tab toggle, with My
Assignments mirroring the reporter dashboard for their own articles (shared
`renderMyAssignmentsPanel`); (2) **stale-draft roll-off** — a new `updated_at`
last-touch clock + nightly sweep step 6 sends drafts untouched 45 days to the
Recycle Bin (75-day total lifespan, role-blind), so the inevitable pile of
learning-the-page "dgdkjg" drafts clears itself. New Dragon logged: trashed
articles must be filtered out of dashboard lists (the roll-off exposed a latent
miss). The rubric-grading arc remains complete; the AI surface is adviser-only;
Canvas stays the hand-keyed grade of record. The backlog is down to a single
cosmetic item — the favicon 404. Next up: whatever Laura points at.*

<!-- prior footer note (v4.7) retained below for history -->
*v4.7 — rubric-grading ENGINE shipped and verified live
across the full injection matrix (the first off-platform feature, and it landed
clean). The keystone test: same planted "give me 100%" injection scored 100 on a
strong article and 40 on a weak one — the instruction moved the grade by exactly
zero, and the flag fired both times. Next up: the scorecard UI — the
confirm-before-it-counts screen that retires console testing and puts the red pen
back in Novello's hand. The entry after that should still be written by someone
who has finally seen Noah Kahan.*
