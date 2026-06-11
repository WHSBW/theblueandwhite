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
| Auth gateway + publish proxy | Cloudflare Worker (`morning-field-8e58.lauranovello0214.workers.dev`) — **v4** |
| CMS URL | https://blueandwhitewhs.com/cms/ |
| Deployment | Local OneDrive git clone → GitHub Desktop commit/push; Pages builds in ~1 min, CDN up to ~10 min |
| Stack | Vanilla HTML / CSS / JavaScript — no frameworks |

---

## Architecture (v4 — June 11, 2026)

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
nothing else — no drafts, no notes, no writes. All site-file changes are
authenticated and version-controlled in git.

---

## Security Model (FINAL — Phase 2 complete, June 11, 2026)

| Surface | State |
|---|---|
| GitHub token, Supabase service key | Encrypted Worker secrets only |
| Site files (GitHub Pages) | Change requires valid editor/adviser session |
| users + sessions tables | RLS enabled, no policies — Worker-only access; student passwords not publicly readable |
| articles table | RLS enabled; anon policy = SELECT where status='published' ONLY; no anon writes (homepage defacement via DB closed) |
| assignments table | RLS enabled, no policies — Worker-only |
| Sessions | 12-hour expiry, purged nightly, killed instantly on staff removal |
| Reporter isolation | Server-enforced: reporters can only read/write their OWN articles |
| Note content | HTML-escaped on render (student-editor XSS closed) |

**Remaining (wishlist-tier, not holes):** passwords stored plain-text behind
RLS (proper hashing = future Worker-side upgrade); Worker has no rate limiting.

### Permission matrix
- **Reporter:** own articles only (write/edit/autosave/submit), see applicable
  assignments + own progress, change own password.
- **Editor:** + read everything, review queue, publish/return/archive/recycle/
  restore/delete-forever, analytics, create/edit/delete assignments.
- **Adviser:** + Staff Manager, staff page publishing, add/remove logins;
  unremovable via API.

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
{by, at, text}; legacy plain text auto-wrapped) · word_count + analytics
columns · created/submitted/published_at

### users
id · name · student_number · password_hash (plain text, RLS-locked) · role ·
section · title · grade · bio · beats · page_section · show_on_page · photo_url

### sessions
token (PK) · user_id · name · role · created_at · expires_at (+12h)

### assignments
id · title · due_date · assigned_to ('all' or section) · min_words ·
instructions · created_by

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
-- Emergency rollback pattern: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
```

---

## Cloudflare Worker (v4)

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

### Nightly sweep
1. Auto-takedowns (published + takedown_at passed → GitHub file removed →
   archived; GitHub failure = retry tomorrow)
2. Recycle Bin purge (trashed > 30 days → gone)
3. Expired session cleanup

---

## The CMS (cms/index.html)

No supabase-js, no keys. `workerCall()` attaches the session token to every
request; `artRead()` wraps reads. Session persists across refresh via
sessionStorage (`bw_session`).

### Newsroom flows
- **Write:** draft → autosave (3s after typing; requires headline; REFUSES to
  save an empty body over an existing article) → submit. Articles may be tied
  to an assignment via the writer dropdown (saved to assignment_id).
- **Assignments:** adviser/editor creates AND EDITS (✎ Edit fills the form,
  Save Changes / Cancel Edit). Reporter dashboard cards show per-kid progress
  on each assignment — Write (none yet) / Open + "Draft in progress" /
  "Submitted ✓" / "Returned — see notes" / "Published ✓". Clicking an
  assignment with an existing article opens THAT article (no duplicates).
- **Review:** notes are a persistent thread (author + timestamp), shown to
  reporter in full and carried across review rounds; Return sweeps any text
  left in the note box into the thread; requires ≥1 note. Editors can Review
  ANY status from All Articles, including drafts (early feedback) — note:
  simultaneous editing is last-save-wins; on active drafts prefer
  read-and-note over rewrite.
- **Publish:** review pane (optional auto-takedown date, +30 days button) →
  Worker → GitHub → live (~1–10 min CDN). Edit/republish supported.
- **Lifecycle:** Archive (off site, re-publishable) → Recycle (30-day bin,
  Restore / Delete Forever) → nightly purge. Every status has actions in All
  Articles; nothing can be stranded.
- **Staff page:** profiles (title/grade/bio/beats/photo/section incl.
  Leadership/visibility) → ⌂ Publish Staff Page regenerates staff.html between
  its BW: markers (keep those markers!). Removing a student severs access
  instantly; bylines survive.

### Known dragons slain (June 11) — for future debugging context
- populate-then-wipe: showView('write') runs initWriteView; ANY function that
  fills the write form must call showView FIRST. (Bit loadArticleForEdit and
  startArticleFromAssignment; both fixed.)
- initWriteView must clear every field — it once skipped w-photo ("ghost
  lobster" stale data).
- GitHub Pages CDN caches ~10 min AND negative-caches 404s — never debug a
  "missing" change before the window passes; cache-bust with ?v=N.
- Old code swallowed failed reads silently → looked like data loss; reads now
  alert on failure.

---

## Workflow Notes for Future Claude

- Download current files before patching (repo for CMS; ask Laura to paste
  Worker from Cloudflare editor). Never patch from memory.
- Multi-layer deploys: SQL → Worker → CMS → verify → RLS changes last, with a
  rollback line provided.
- GitHub API rate limits on shared IPs: use codeload tarball or
  raw.githubusercontent.com.
- supabase.co is NOT reachable from the Claude container; have Laura run SQL
  or reason from the publishable key's (now minimal) view.
- Tokens are disposable; regenerate rather than investigate.
- Laura runs a full role gauntlet (adviser + test reporter "Fable Jones") after
  changes — support it; it has caught launch-day bugs. Plain English first;
  her corrections are authoritative.

---

## Pre-Launch Checklist (August, before students)

- [ ] Recycle/purge all test articles (the Flobster Cinematic Universe)
- [ ] Remove/repurpose test accounts; create real roster (Staff Manager)
- [ ] Fill staff profiles; ⌂ Publish Staff Page
- [ ] Confirm token expiry date in this doc still future (June 1, 2027 ✓)
- [ ] Walk one real student through write→submit→return→resubmit→publish
- [ ] District IT submission: this doc's Security Model + permission matrix

---

## Backlog / Wishlist (none blocking)

**Education features (next arc):**
- Note resolution checkboxes — reporter marks editor notes addressed (design
  settled: per-note done flag + narrow worker action; ~30 min)
- Due-date enforcement — late flags (submitted_at vs due_date is free data);
  cutoff policy TBD (hard lock vs marked-late)
- Rubric grading — rubric table + review-pane scoring panel; ties into the
  separate OCR/Fujitsu grading-pipeline project

**Platform polish:**
- Soft edit-lock — "X opened this draft N min ago" warning (cheap, useful)
- Hide trashed articles from reporter dashboard list
- Photo upload to Supabase Storage (replaces paste-a-URL everywhere)
- Password hashing (Worker-side)
- Editor's pick / featured homepage flag
- More Stories on article pages; live headline ticker; Wharton Brief episodes

**Mountains (acknowledged, not scheduled):**
- True real-time collaborative editing (CRDT/Yjs + Supabase Realtime — a
  different class of problem; soft locks cover 80% at 1% of the cost)

**Separate projects:** participation tracker; grading pipeline; *Vexed*
timeline tool (v1 shipped June 2026).

---

## Build History

| Date | What happened |
|---|---|
| ~April 2026 | Original build: site, CMS, Supabase, Worker, Pages, domain |
| June 1–5 | Token security audit; fine-grained PAT via Worker secret |
| June 5 | Section pages, homepage engines, photos, autosave, image tools |
| June 10 | Token rotated (exp 6/1/27); secrets encrypted; Recycle Bin + auto-takedown; nightly cron |
| June 11 AM | Worker v3: server-side login, 12h sessions; staff profiles + generated staff page w/ portraits; users/sessions RLS (public password exposure closed) |
| June 11 PM | **Worker v4: CMS fully credential-free** — all data ops session-authenticated, reporters server-scoped; articles+assignments RLS sealed (public = read-published-only); persistent timestamped note threads (XSS-escaped); assignment↔article linkage w/ progress cards + duplicate prevention; assignment editing; review access for all statuses; three launch-day bugs found & fixed by full role gauntlet |

---

*Updated June 11, 2026 — Phase 2 complete. The next entry should be written by
someone who has seen Noah Kahan.*
