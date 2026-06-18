# The Blue & White — Project Reference
**Paul R. Wharton High School Student Newspaper**
*For Laura Novello (adviser) and future Claude instances picking up this project*

> **Version note (June 18, 2026):** This is the **v4.3** doc, rewritten after the
> "classroom-reality sprint." It was reconstructed from session memory, not from
> a live read of the Worker/CMS code, so items marked **⚠️ verify** should be
> checked against the actual source before being trusted. Laura's corrections are
> authoritative — fix anything wrong and re-save.
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
| Auth gateway + publish proxy | Cloudflare Worker (`morning-field-8e58.lauranovello0214.workers.dev`) — **v4.3** |
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
verified session token. The public key can read published articles and nothing
else — no drafts, no notes, no extensions, no edit-locks, no writes. All
site-file changes are authenticated and version-controlled in git.

---

## Security Model (v4.3)

| Surface | State |
|---|---|
| GitHub token, Supabase service key | Encrypted Worker secrets only |
| Site files (GitHub Pages) | Change requires valid editor/adviser session |
| users + sessions tables | RLS enabled, no policies — Worker-only access |
| articles table | RLS enabled; anon policy = SELECT where status='published' ONLY; no anon writes |
| assignments table | RLS enabled, no policies — Worker-only |
| extensions table | RLS enabled, **no anon policies** — Worker-only. Holds student-written reasons + adviser decisions (treated as sensitive personal info) |
| edit-lock table ⚠️ verify name | RLS enabled, no anon policies — Worker-only. Holds who-opened-what-when |
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

**Remaining (wishlist-tier, not holes):** passwords stored plain-text behind
RLS (proper hashing = next sprint candidate); Worker has no rate limiting.

### Permission matrix
- **Reporter:** own articles only (write/edit/autosave/submit), see applicable
  assignments + own progress, request extensions, change own password.
- **Editor:** + read everything, review queue, publish/return/archive/recycle/
  restore/delete-forever, analytics, create/edit/delete assignments.
- **Adviser:** + Staff Manager, staff page publishing, add/remove logins;
  grant/deny extensions; unremovable via API.

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
{by, at, text, **done** ⚠️ verify field name}; legacy plain text auto-wrapped) ·
word_count + analytics columns · created/submitted/published_at

### users
id · name · student_number · password_hash (plain text, RLS-locked) · role ·
section · title · grade · bio · beats · page_section · show_on_page · photo_url

### sessions
token (PK) · user_id · name · role · created_at · expires_at (+12h)

### assignments
id · title · due_date · assigned_to ('all' or section) · min_words ·
instructions · created_by

### extensions ⚠️ verify exact columns
id · article_id (or assignment_id + student) · student_number · requested_at ·
reason (student-written) · status (pending/granted/denied) · new_due_date ·
decided_by · decided_at. **Private — no anon policies.**

### edit-lock ⚠️ verify table + columns
Tracks which user last opened a given draft and when, to power the soft
"X opened this N min ago" warn-only banner. **Private — no anon policies.**

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

-- v4.3 additions ⚠️ verify against what was actually run
-- extensions table (private, RLS on, NO anon policy)
-- edit-lock table  (private, RLS on, NO anon policy)
-- editor_notes 'done' flag is stored INSIDE the existing JSON array, so no
--   schema change was needed for note checkboxes.

-- Emergency rollback pattern: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
```

---

## Cloudflare Worker (v4.3)

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
| ext_request ⚠️ verify name | reporter | student submits an extension request (reason + target) |
| ext_list ⚠️ verify name | any | list extension requests (adviser sees all; reporter sees own) |
| ext_decide ⚠️ verify name | adviser | grant/deny → sets new_due_date, decided_by/at |

**Note-done toggle:** ⚠️ verify whether this is a dedicated action or folded
into `art_admin`/`art_save`. Design intent was a narrow action that flips the
`done` flag on one note inside the editor_notes JSON array.

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
- **Highlighting:** blue-highlight system with a reporter-facing **HL** button
  for marking text during drafting/review. Highlights are **stripped at publish
  time** so they never reach the live site.
- **Assignments:** adviser/editor creates AND EDITS (✎ Edit fills the form,
  Save Changes / Cancel Edit). **Smart reporter dashboard cards** show per-kid
  progress on each assignment — Write (none yet) / Open + "Draft in progress" /
  "Submitted ✓" / "Returned — see notes" / "Published ✓". Clicking an
  assignment with an existing article opens THAT article (no duplicates).
- **Late policy:** school-day-aware late flags using the official HCPS 2026–27
  calendar. Penalty configurable in `assets/js/late-policy-settings.js`
  (default **10% per school day**). **3-day lockout applies to INITIAL
  submissions only** (not resubmissions). Effective due dates recompute when an
  extension is granted.
- **Extensions:** reporter requests an extension (with a reason); adviser
  grants/denies. Adviser can also proactively override a due date from the
  review pane. Granting recomputes the effective due date for that student.
- **Review (mandatory 4-step student review chain ⚠️ verify exact steps):**
  before publish, an article moves through a required multi-step student review
  sequence. Notes are a persistent, timestamped, XSS-escaped thread (author +
  time), shown to the reporter in full and carried across rounds. **Per-note
  done-checkboxes** let notes be toggled resolved. Return sweeps any text left
  in the note box into the thread; requires ≥1 note. Editors can Review ANY
  status from All Articles, including drafts.
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

---

## Workflow Notes for Future Claude

- Download current files before patching (repo for CMS; ask Laura to paste the
  Worker from the Cloudflare editor). **Never patch from memory.**
- **Strict deploy order:** SQL → Worker → CMS → verify → **RLS last** (with a
  rollback line provided). This order has caught real bugs.
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
- Running joke conventions: crustacean test accounts (Fable Jones, Clawford
  Daniels) and test articles (Local Shrimp Wins Big Race, Flobster).

---

## Pre-Launch Checklist (August, before students)

- [ ] Recycle/purge all test articles (the Flobster Cinematic Universe)
- [ ] Remove/repurpose test accounts; create real roster (Staff Manager)
- [ ] Fill staff profiles; ⌂ Publish Staff Page
- [ ] Confirm token expiry date still future (June 1, 2027 ✓)
- [ ] Confirm late-policy settings + HCPS calendar dates for the live year
- [ ] Walk one real student through write→submit→return→resubmit→publish
- [ ] Walk one extension request through request→grant→recomputed due date
- [ ] District IT submission: this doc's Security Model + permission matrix

---

## Backlog / Next Sprint Arc

**Next arc (discussed, not yet built):**
- **Assignment Reports** with CSV export
- **Interview proof uploads** — requires Supabase Storage
- **Rubric grading** — rubric table + review-pane scoring; Claude API called
  from the Worker; adviser confirms before exporting to Canvas. Ties into the
  separate OCR/Fujitsu grading-pipeline project.
- **Password hashing** (Worker-side)

**Platform polish:**
- Photo/asset upload to Supabase Storage (replaces paste-a-URL everywhere)
- Editor's pick / featured homepage flag
- More Stories on article pages; live headline ticker; Wharton Brief episodes

**Mountains (acknowledged, not scheduled):**
- True real-time collaborative editing (CRDT/Yjs + Supabase Realtime — a
  different class of problem; soft locks cover 80% at 1% of the cost)

**Separate projects:** participation tracker; OCR/Fujitsu grading pipeline;
*Vexed* timeline tool (interactive HTML; shipped June 2026).

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

---

*Updated June 18, 2026 — v4.3, reconstructed from session memory. Items marked
⚠️ verify need a code check. The next entry should be written by someone who has
seen Noah Kahan.*
