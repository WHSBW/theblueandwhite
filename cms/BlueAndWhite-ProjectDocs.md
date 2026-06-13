# The Blue & White — Project Reference
**Paul R. Wharton High School Student Newspaper**
*For Laura Novello (adviser) and future Claude instances picking up this project*

---

## Quick Facts

| Thing | Value |
|---|---|
| Live site | https://blueandwhitewhs.com |
| GitHub repo | https://github.com/WHSBW/theblueandwhite |
| Hosting | GitHub Pages (free, public repo) |
| Domain registrar | Namecheap (CNAME points to GitHub Pages) |
| Backend database | Supabase (project ID: `cybjclqcdmrjhoaoiund`) |
| Auth gateway + publish proxy | Cloudflare Worker (`morning-field-8e58.lauranovello0214.workers.dev`) — **v4.2** |
| CMS URL | https://blueandwhitewhs.com/cms/ |
| Deployment | Local OneDrive git clone → GitHub Desktop commit/push; Pages builds in ~1 min, CDN up to ~10 min |
| Stack | Vanilla HTML / CSS / JavaScript — no frameworks |

---

## Architecture (v4.2 — June 13, 2026)

```
Reporter/Editor (browser)
        │  login → Worker checks credentials, issues 12-hour session token
        │  EVERY data operation: POST {action, token, ...}
        ▼
Cloudflare Worker  ◄── secrets: GITHUB_TOKEN, SUPABASE_SERVICE_KEY
   │         │      ◄── Cron Trigger 0 9 * * * (nightly sweep, 4–5 AM Tampa)
   │         └── Supabase REST (service role) — ALL reads & writes for the CMS
   │  PUT/DELETE files via GitHub Contents API
   ▼
GitHub repo → GitHub Pages → blueandwhitewhs.com
        ▲
        └── public site JS (feed.js / home.js) reads Supabase with the
            publishable key — RLS limits it to SELECT on published articles ONLY
```

**The headline for District IT:** the CMS file contains **zero database
credentials**. Every read and write goes through the Worker with a server-
verified session token. The public key can read published articles and do
nothing else — no drafts, no notes, no extensions, no writes. All site-file
changes are authenticated and version-controlled in git.

---

## Security Model (Phase 2 complete; extended June 13, 2026)

| Surface | State |
|---|---|
| GitHub token, Supabase service key | Encrypted Worker secrets only |
| Site files (GitHub Pages) | Change requires valid editor/adviser session |
| users + sessions tables | RLS enabled, no policies — Worker-only access; student passwords not publicly readable |
| articles table | RLS enabled; anon policy = SELECT where status='published' ONLY; no anon writes (homepage defacement via DB closed) |
| assignments table | RLS enabled, no policies — Worker-only |
| **extensions table** | **RLS enabled, NO policies — Worker-only. Holds student extension reasons + adviser notes (possible health/IEP info), deliberately kept OFF the articles table so it can never be read through the public published-article policy.** |
| Sessions | 12-hour expiry, purged nightly, killed instantly on staff removal |
| Reporter isolation | Server-enforced: reporters can only read/write their OWN articles (incl. extension requests + reads) |
| Note content | HTML-escaped on render (student-editor XSS closed) |

**Why extensions live in their own table:** anon can SELECT *all columns* of
any `status='published'` article. A student's "I had the flu" reason or your
"IEP accommodation" note would therefore leak the moment the article published
if stored on the article row. The separate `extensions` table (RLS on, no anon
policy) is unreadable by the public key entirely. Worker (service role) only.

**Remaining (wishlist-tier, not holes):** passwords stored plain-text behind
RLS (proper hashing = future Worker-side upgrade); Worker has no rate limiting.

### Permission matrix
- **Reporter:** own articles only (write/edit/autosave/submit), see applicable
  assignments + own progress, **request more time on own articles**, change own
  password.
- **Editor:** + read everything, review queue, publish/return/archive/recycle/
  restore/delete-forever, analytics, create/edit/delete assignments. (Editors
  do NOT see the extension-requests inbox and cannot grant/deny extensions.)
- **Adviser:** + Staff Manager, staff page publishing, add/remove logins;
  **sole authority to grant/deny extensions**; unremovable via API.

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
{by, at, text, **done?, done_by?, done_at?**}; legacy plain text auto-wrapped) ·
word_count + analytics columns · created/submitted/published_at

*(No new article columns since v4: note done-flags live inside the existing
editor_notes JSON; late status is derived, not stored; extensions are a
separate table.)*

### users
id · name · student_number · password_hash (plain text, RLS-locked) · role ·
section · title · grade · bio · beats · page_section · show_on_page · photo_url

### sessions
token (PK) · user_id · name · role · created_at · expires_at (+12h)

### assignments
id · title · due_date · assigned_to ('all' or section) · min_words ·
instructions · created_by

### extensions  *(NEW v4.2 — private, Worker-only)*
article_id (PK) · status ('requested'/'granted'/'denied') · new_due
(timestamptz; the granted new due date) · reason (student's, private) · note
(adviser's, private) · decided_by · decided_at. One row per article; upserted.

### Cumulative SQL run (for rebuild reference)
```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS photo_url TEXT;            -- 6/5
ALTER TABLE articles ADD COLUMN IF NOT EXISTS trashed_at timestamptz;    -- 6/10
ALTER TABLE articles ADD COLUMN IF NOT EXISTS takedown_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title text;                   -- 6/11
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
-- 6/13 — private extensions table (RLS on, NO policies = Worker-only):
CREATE TABLE IF NOT EXISTS extensions (
  article_id text PRIMARY KEY, status text, new_due timestamptz,
  reason text, note text, decided_by text, decided_at timestamptz DEFAULT now());
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;
-- Emergency rollback pattern: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
```

---

## Cloudflare Worker (v4.2)

Secrets (type Secret): `GITHUB_TOKEN`, `SUPABASE_SERVICE_KEY`.
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
| art_save | any | insert/update with reporter field+status whitelist; author stamped from session |
| art_admin | editor+ | full-field updates incl. any status |
| art_destroy | editor+ | permanent row delete |
| assign_list | any | all assignments (client filters by section) |
| assign_add/update/destroy | editor+ | assignment management |
| **note_toggle** *(v4.1)* | any | flips done/done_by/done_at on one editor note (by index); reporters scoped to own; note text untouchable |
| **ext_request** *(v4.2)* | any | reporter (own article) requests more time → extensions row {status:'requested', reason} |
| **ext_resolve** *(v4.2)* | **adviser** | grant/deny → {status, new_due, note}; preserves student reason |
| **ext_list** *(v4.2)* | any | editors/adviser get all extensions; reporters get only their own articles' |

### Nightly sweep
1. Auto-takedowns (published + takedown_at passed → GitHub file removed →
   archived; GitHub failure = retry tomorrow)
2. Recycle Bin purge (trashed > 30 days → gone)
3. Expired session cleanup

---

## The CMS (cms/index.html)

No supabase-js, no keys. `workerCall()` attaches the session token to every
request; `artRead()` wraps reads. Session persists across refresh via
sessionStorage (`bw_session`). Loads `/assets/js/late-policy-settings.js`
(school calendar + penalty knobs) before the main script.

### Newsroom flows
- **Write:** draft → autosave (3s after typing; requires headline; REFUSES to
  save an empty body over an existing article) → submit. Articles may be tied
  to an assignment via the writer dropdown (saved to assignment_id).
- **The chain (mandatory review round):** an article CANNOT be published until
  it has been returned with ≥1 editor note at least once. The Publish button
  blocks otherwise ("hasn't been through a review round yet"). Even a flawless
  first draft gets one round-trip. A 4-step stepper (Rough Draft → Editor
  Review → Revisions → Published) + italic, status-aware guidance shows the
  reporter exactly what to do next — cuts down "is it up yet?" questions.
- **Note checkboxes:** every editor note shows "Mark as done" to the reporter;
  checking stamps ✓ Done by [name] · [date], dims + strikes it; unchecking
  works. Editors see the same badges in the review thread (read-only there;
  thread is a local snapshot — reopen to refresh). Stored in editor_notes JSON.
- **Blue highlights:** HL button (#CFE8FF) in BOTH toolbars — editors mark live
  edits for the reporter; reporters mark placeholders ("INSERT INTERVIEW
  HERE"). HL✕ wipes all highlights. Publish auto-strips every highlight/
  background-color, so the live site never shows blue (also nukes Google-Docs
  paste backgrounds). DB copy the reporter sees keeps them.
- **Assignments:** adviser/editor creates AND EDITS. Reporter dashboard cards
  show per-kid progress (Write / Draft in progress / Submitted ✓ / Returned —
  see notes / Published ✓), the due/late status, and extension status/Request.
  Clicking an assignment with an existing article opens THAT article.
- **Late flags (school-day aware):** for assignment-linked articles, badges show
  how many SCHOOL days late + penalty (e.g. "⏰ 2 school days late · −20%"),
  red "⚠ Past deadline" past the window. Skips weekends AND every HCPS
  no-school day from `late-policy-settings.js`. Free-writes/on-time = no badge.
  Penalty is informational for now (grade application waits for rubric sprint).
  Knobs (10%/day, 3-day lock, the holiday list) all live in that one settings
  file — edit it, both the CMS and any future consumer pick it up.
- **Late lockout:** a reporter cannot submit a BRAND-NEW article more than 3
  school days past due ("talk to Ms. Novello"). Applies to INITIAL submissions
  only — resubmissions of already-returned work are NEVER blocked (finish the
  loop). Advisers/editors are never locked (that's the override). Enforced
  client-side (fine for non-adversarial students; could harden in Worker later).
- **Extensions (request + override):** reporter clicks "Request more time"
  (dashboard card or write view), types a reason → adviser-only "Extension
  Requests" inbox on the editor dashboard (student, assignment, reason, Grant/
  Deny). Grant asks a new due date (pre-filled +3 days) + optional private note;
  Deny asks a note the student sees. Adviser can also "Grant Extension" straight
  from the review pane ("you have a day"). A granted extension becomes the
  article's effective due date, so late math + lockout recompute automatically
  (badge flips to "✓ extended"). Reasons/notes stored privately (extensions
  table) for the future weekly report.
- **Review:** notes are a persistent thread (author + timestamp), shown to
  reporter in full and carried across rounds; Return sweeps any text in the note
  box into the thread; requires ≥1 note. Editors can Review ANY status from All
  Articles — note: simultaneous editing is last-save-wins.
- **Publish:** review pane (optional auto-takedown date, +30 days button) →
  Worker → GitHub → live (~1–10 min CDN). Highlights stripped on publish.
- **Lifecycle:** Archive (off site, re-publishable) → Recycle (30-day bin,
  Restore / Delete Forever) → nightly purge. Every status has actions in All
  Articles; nothing can be stranded.
- **Staff page:** profiles → ⌂ Publish Staff Page regenerates staff.html between
  its BW: markers (keep those markers!). Removing a student severs access
  instantly; bylines survive.

### Known dragons slain — for future debugging context
- **(v4.1) Worker action position:** new action blocks must sit in the MAIN
  if-chain of handleRequest. note_toggle was once pasted INSIDE art_save's
  if(body.id) branch → every toggle returned "Unknown action" while art_save
  still worked. Add new actions just above `return json({error:'Unknown
  action'}...)`. Full-file replace beats surgical paste for non-coders.
- **(v4.2) Carousel split-in-half (public site):** `.carousel-slide` used
  `min-width:100%` — a *floor*, not a ceiling — so a slide with a long headline
  sized to its content (one unwrapped line), blew past the column, and the
  translateX(idx*100%) stepping drifted → titles clipped, slides half-shown.
  Fix: `flex:0 0 100%; max-width:100%; min-width:0` on `.carousel-slide` +
  `.brief-slide`, and `min-width:0` on `.carousel-wrap` (grid items default to
  min-width:auto and blow out their fr column). In `assets/css/style.css`.
- **(v4.2) Resubmit trapped by lockout:** the first late-lockout blocked ALL
  submissions, so a returned article past the window couldn't be resubmitted.
  Fixed: lockout only fires for initial submissions (status new/draft); returned
  work always resubmits. Tracked via `currentArticleStatus`.
- **(v4.2) Extension privacy:** see Security Model — reasons/notes must NOT live
  on the articles table (anon reads published rows). Separate RLS-locked table.
- populate-then-wipe: showView('write') runs initWriteView; ANY function that
  fills the write form must call showView FIRST.
- initWriteView must clear every field (once skipped w-photo → "ghost lobster").
- GitHub Pages CDN caches ~10 min AND negative-caches 404s — never debug a
  "missing" change before the window passes; cache-bust with ?v=N. (A stale CMS
  cache also masks freshly deployed logic — hard-refresh after a push.)
- Old code swallowed failed reads silently → looked like data loss; reads now
  alert on failure.

---

## Workflow Notes for Future Claude

- Download current files before patching (repo for CMS via codeload tarball or
  raw.githubusercontent.com; ask Laura to paste Worker from Cloudflare, OR build
  a full-file replacement on the last known-good Worker source and flag the
  assumption). Never patch from fuzzy memory.
- Multi-layer deploys: **SQL → Worker → CMS → verify** (RLS/new tables first).
  Each layer degrades gracefully if the next isn't up yet (CMS catches unknown-
  action errors). Hard-refresh after CMS pushes.
- The Worker commits to GitHub directly (publish, auto-takedown), so Laura's
  local clone falls behind origin. Habit: **Fetch/Pull in GitHub Desktop BEFORE
  editing.** LF/CRLF warnings are cosmetic line-ending differences — ignore.
- Policy knobs (late %, lock window, no-school days) live ONLY in
  `assets/js/late-policy-settings.js`. Change there; don't hardcode.
- GitHub API rate limits on shared IPs: use codeload tarball or raw.
- supabase.co is NOT reachable from the Claude container; have Laura run SQL.
  Can't verify anon-visible columns from the container either — reason from the
  RLS policies.
- Tokens are disposable; regenerate rather than investigate.
- Laura runs a full role gauntlet (adviser + a test reporter — Fable Jones, with
  cameos from editor "Clawford Daniels") after changes — support it; it has
  caught real bugs. Plain English first; her corrections are authoritative.

---

## Pre-Launch Checklist (August, before students)

- [ ] Recycle/purge all test articles (the Flobster Cinematic Universe; the
      Lobster Casino extension request; the Noah Kahan shrimp)
- [ ] Clear test extension rows
- [ ] Remove/repurpose test accounts; create real roster (Staff Manager)
- [ ] Fill staff profiles; ⌂ Publish Staff Page
- [ ] Confirm token expiry date in this doc still future (June 1, 2027 ✓)
- [ ] Confirm `late-policy-settings.js` matches the FINAL board calendar
- [ ] Walk one real student through write→submit→return→resubmit→publish, plus
      a late/extension case
- [ ] District IT submission: this doc's Security Model + permission matrix

---

## Backlog / Wishlist (none blocking)

**Education features (next arc):**
- **Soft edit-lock** — "X opened this draft N min ago" warning (last unbuilt
  piece of the classroom-reality sprint; cheap, useful).
- **Assignment Reports + CSV export** — one row per student per assignment
  (on time / N days late / penalty / status), Export-to-Excel button for Canvas;
  pulls in extension notes; natural pairing with rubric grading (add AI-score
  column there). Data already flows; mostly assembly.
- **Interview proof** — block final submit without proof (screenshot/audio),
  except Editorials. Needs file upload → **Supabase Storage** (private bucket;
  these are kids' text logs, NOT for the public repo). Unlocks photo upload too.
- **Rubric grading** — rubric table + review-pane scoring panel; AI drafts the
  score (Claude API from the Worker) with per-line reasoning, **Laura confirms**
  before it exports (teacher = grader of record). Ties into the separate
  OCR/Fujitsu grading-pipeline project.

**Platform polish:**
- Hide trashed articles from reporter dashboard list
- Photo upload to Supabase Storage (replaces paste-a-URL everywhere)
- Password hashing (Worker-side)
- Editor's pick / featured homepage flag
- More Stories on article pages; live headline ticker; Wharton Brief episodes
- Optional: harden the late lockout server-side (Worker checks due date)

**Mountains (acknowledged, not scheduled):**
- True real-time collaborative editing (CRDT/Yjs + Supabase Realtime — soft
  locks cover 80% at 1% of the cost).

**Separate projects:** participation tracker; grading pipeline; *Vexed*
timeline tool (v1 shipped June 2026).

**Shipped (removed from backlog):** note resolution checkboxes ✓ (v4.1);
due-date/late flags ✓ (v4.2); per-article extension/override ✓ (v4.2, exceeded
original "late flags" scope).

---

## Build History

| Date | What happened |
|---|---|
| ~April 2026 | Original build: site, CMS, Supabase, Worker, Pages, domain |
| June 1–5 | Token security audit; fine-grained PAT via Worker secret |
| June 5 | Section pages, homepage engines, photos, autosave, image tools |
| June 10 | Token rotated (exp 6/1/27); secrets encrypted; Recycle Bin + auto-takedown; nightly cron |
| June 11 AM | Worker v3: server-side login, 12h sessions; staff profiles + generated staff page; users/sessions RLS |
| June 11 PM | **Worker v4: CMS fully credential-free** — session-authenticated data ops, reporters server-scoped; articles+assignments RLS sealed; persistent timestamped note threads; assignment↔article linkage + progress cards; assignment editing; review for all statuses |
| June 12 | **v4.1:** note done-checkboxes (note_toggle) + blue highlight system w/ publish-time stripping; reporter HL button same day |
| June 13 | **The chain** (mandatory review round before publish + student stepper/guidance); **late flags** (school-day-aware badges + 3-day lockout, settings file w/ HCPS 26–27 calendar); **carousel fix** (style.css slide-width blowout); resubmit-lockout bug fixed; **v4.2 extensions** — private table, student "request more time" + adviser-only grant/deny + review-pane override, effective-due recompute |

---

*Updated June 13, 2026 — v4.2. Local Shrimp has now attended a Noah Kahan
concert, so the prophecy of the last footer is fulfilled. The next entry should
be written by someone who has visited the Lobster Casino (responsibly). 🦞*
