# The Blue & White — Project Reference
**Paul R. Wharton High School Student Newspaper**
*For Laura Novello (adviser) and future Claude instances picking up this project*

> **Version note (June 28, 2026):** This is the **v4.6** doc. v4.6 added
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
| Auth gateway + publish proxy | Cloudflare Worker (`morning-field-8e58.lauranovello0214.workers.dev`) — **v4.5** |
| File storage | Supabase Storage — private bucket `proofs` (interview proofs; signed-URL only) **and** PUBLIC bucket `media` (article lead photos + staff headshots; public-read, Worker-only writes) |
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
| edit_locks table | RLS enabled, no anon policies — Worker-only. Holds who-opened-what-when |
| proofs table | RLS enabled, **no anon policies** — Worker-only. Interview-proof file pointers (path + filename + uploader); FK to articles ON DELETE CASCADE |
| proofs Storage bucket | **PRIVATE** (no public policy). Files reachable only via short-lived (5-min) Worker-signed view URLs; never linked publicly. Protects egress + student privacy |
| media Storage bucket (v4.6) | **PUBLIC-read** (anyone can GET) — these images appear on the live site. **No anon writes**: the Worker (service role) is the only writer. Deliberate, documented departure from the proofs privacy model — do NOT lock this bucket or every site photo breaks. Holds article lead photos + staff headshots only; no student-private data |
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
{by, at, text, **done, done_by, done_at**}; the done trio is written by
`note_toggle`; legacy plain text auto-wrapped) ·
word_count + analytics columns · created/submitted/published_at

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

-- Emergency rollback pattern: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
```

---

## Cloudflare Worker (v4.5)

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
- [ ] District IT submission: this doc's Security Model + permission matrix (now incl. PBKDF2 password hashing)

---

## Backlog / Next Sprint Arc

**Next arc (discussed, not yet built):**
- **Rubric grading** — rubric table + review-pane scoring; Claude API called
  from the Worker; adviser confirms before exporting to Canvas. Ties into the
  separate OCR/Fujitsu grading-pipeline project.

**Platform polish:**
- ~~Photo/asset upload to Supabase Storage (replaces paste-a-URL everywhere)~~
  **— DONE v4.6** (article lead + staff headshots, with cropper). Paste-a-URL
  deliberately retained alongside upload for wire/already-hosted photos.
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
| June 18 | **Worker v4.4 — password hashing.** Salted PBKDF2-SHA-256 (Web Crypto, 100k iterations); transparent upgrade-on-login for legacy plain-text rows (no migration, no lockouts); `staff_add` + `change_password` hash on write; `password_hash` removed from `staff_update` allowed fields. Verified live: old password rejected, new accepted, stored value confirmed as `pbkdf2$…` hash. Last Security Model item closed. |
| June 18 | **CMS — Assignment Reports + CSV** (adviser-only, client-side; no Worker/SQL/RLS). Per-assignment, submitters-only report table reusing the late/extension engine; in-browser CSV export (Excel BOM, proper quoting). Full role-gauntlet pass: draft→pending→returned→published tracked correctly, late flag + CSV stayed in sync after a retroactive due-date change, editors correctly see no Reports menu item. |
| June 18 | **Interview proof uploads (v4.5) — full sprint, spec to ship.** New private `proofs` table (FK→articles, CASCADE) + private Storage bucket `proofs`. Worker: `proof_upload`/`proof_list`/`proof_view_url`/`proof_delete` (reporters own-scoped server-side; images only, 8 MB cap) + roll-off in the nightly sweep ("published + 30 days" + trash backstop). CMS: writer upload control w/ thumbnails + "Uploaded ✓" toast, review-pane viewer (signed-URL open), reporter delete/replace, and an Interview Proof column in Reports + CSV. Gauntlet: upload (incl. wrong-cat-photo → delete → re-upload), adviser + editor view/expand/delete, reporter own-scoping confirmed (UI + server), Reports↔CSV match. Deploy order honored: SQL+bucket → Worker → CMS → verify → bucket confirmed PRIVATE. |
| June 28 | **Public photo uploads + cropper (v4.6) — full sprint, spec to ship.** New PUBLIC Storage bucket `media` (public-read, Worker-only writes — deliberate departure from the proofs privacy model). Worker: one action `image_upload` (reporters own-scoped on article photos, staff = adviser-only; JPG/PNG/WEBP + 8 MB; stores at stable extension-less path, stamps `photo_url`, returns public URL + `?v=`); bucket-aware `sbStorageUpload`; new `sbPatchRow`. CMS: Upload buttons beside paste-a-URL on lead photos (colour) + staff headshots (auto B&W); drag-and-zoom **cropper** (cover-locked, 16:9 / 1:1, thirds guides, output 1600×900 / 800×800, B&W folded into the canvas pass); live photo preview in writer + review panes; student-guidance hints. **Bug fixed:** article hero stray inline `height:auto` removed → heroes now centre-crop uniformly with the homepage. Replace = upsert-in-place, **no orphans** (verified: one file per id). Gauntlet: tall photo cropped/framed → identical on homepage + article; B&W square staff; cover-lock held; cancel/Esc/backdrop; AVIF/HEIC + oversize rejected pre-cropper. CMS-only deploy (+ the one public bucket) — no SQL/RLS/Worker-secret change. |

---

*Updated June 28, 2026 — v4.6, public photo uploads + in-browser cropper shipped
and verified live (a black cat named, presumably, after some lobster, framed
ears-in on the homepage). Next up: the rubric-grading API mountain — the first
feature that sends data off-platform, so spec carefully. The entry after that
should be written by someone who has finally seen Noah Kahan.*
