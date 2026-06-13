# Paste-in updates for BlueAndWhite-ProjectDocs.md (June 12, 2026 — v4.1)

## 1. Add to the Worker actions table:
| note_toggle | any | flips done/done_by/done_at on one editor note (by index); reporters scoped to own articles; note text untouchable |

## 2. Add to "The CMS" → Review section (new bullets):
- **Note checkboxes:** every editor note shows "Mark as done" to the reporter.
  Checking stamps ✓ Done by [name] · [date], dims + strikes the note; uncheck
  works (kid realizes work remains). Editors see the same badges in the review
  thread (read-only there; the thread is a local snapshot — reopen the article
  to see fresh checkmarks). Done-flag lives inside the existing editor_notes
  JSON ({by, at, text, done?, done_by?, done_at?}) — no schema change.
- **Blue highlights:** HL button (light blue #CFE8FF) in BOTH toolbars —
  editors mark live edits for the reporter; reporters mark placeholders
  ("INSERT INTERVIEW HERE"). HL✕ wipes all highlights (confirm prompt).
  Publish strips every highlight/background-color automatically — the live
  site can never show robin's-egg blue; the DB copy the reporter sees keeps
  them. Bonus: the stripper also removes background colors pasted in from
  Google Docs.

## 3. Add to "Known dragons slain":
- Worker action blocks must sit in the MAIN if-chain of handleRequest. The
  note_toggle block was once pasted inside art_save's if(body.id) branch —
  every toggle returned "Unknown action" while art_save kept working fine.
  When adding actions: just above `return json({ error: 'Unknown action' }...)`
  is always safe. Full-file replace beats surgical paste for non-coders.

## 4. Add to "Workflow Notes for Future Claude":
- The Worker commits to GitHub directly (publish, auto-takedown), so Laura's
  local clone falls behind origin. Habit: Fetch/Pull in GitHub Desktop BEFORE
  editing. LF/CRLF warnings are cosmetic line-ending differences — ignore.

## 5. Build History row:
| June 12 | v4.1: note done-checkboxes (note_toggle action) + blue highlight system w/ publish-time stripping; reporter HL button added same day |

## 6. Backlog: delete the "Note resolution checkboxes" line (shipped).
