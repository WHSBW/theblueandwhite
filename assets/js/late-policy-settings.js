// ── LATE POLICY SETTINGS ─────────────────────────────────────────────
// Edit these numbers/dates anytime; nothing else needs to change.
// Source: HCPS 2026-27 Student Academic Calendar, Board approved 6/17/2025.

const LATE_POLICY = {
  percentPerDay: 10,   // grade deduction per SCHOOL day late
  maxLateDays: 3,      // school days after due date before submission locks
};

// Days school is NOT in session (weekends are skipped automatically).
// If a hurricane make-up day converts one of these into a school day,
// just delete that line. Tentative make-up days: Oct 12, Nov 11,
// Nov 23-25, Jan 4.
const NO_SCHOOL_DAYS = [
  '2026-09-07',                               // Labor Day
  '2026-10-12',                               // Non-Student Day
  '2026-11-11',                               // Veterans Day
  '2026-11-23', '2026-11-24', '2026-11-25',   // Fall Break
  '2026-11-26', '2026-11-27',                 //   "
  '2026-12-21', '2026-12-22', '2026-12-23',   // Winter Break
  '2026-12-24', '2026-12-25', '2026-12-28',   //   "
  '2026-12-29', '2026-12-30', '2026-12-31',   //   "
  '2027-01-01',                               //   "
  '2027-01-04',                               // Non-Student Day
  '2027-01-18',                               // MLK Day
  '2027-02-12',                               // Florida State Fair
  '2027-02-15',                               // Presidents' Day
  '2027-03-08',                               // Strawberry Festival 🍓 (moved from 3/1)
  '2027-03-22', '2027-03-23', '2027-03-24',   // Spring Break
  '2027-03-25', '2027-03-26',                 //   "
  '2027-03-29',                               // Non-Student Day
  '2027-04-16',                               // Non-Student Day
];

// First/last day of school, for sanity checks (articles can't be "late"
// over the summer).
const SCHOOL_YEAR = { start: '2026-08-10', end: '2027-05-28' };
