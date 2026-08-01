# ShiftFlow

A shift-scheduling app for businesses, churches, hospitals, schools, hotels,
restaurants, security companies and volunteer teams — with duty rotation,
shift swaps, attendance, team chat, and a small backend that saves everything
to disk.

## Running it for real (with the backend)

No `npm install` needed — the server uses only Node's built-in modules.

```
node server.js
```

Then open **http://localhost:3000** in your browser.

Every action — adding a worker, approving a swap, setting a duty, clocking
in, sending a chat message — is saved to `data.json` in this folder. Stop
and restart the server and everything is still there.

## Running it without the backend

Just open `index.html` directly in a browser (or use `shiftflow-preview.html`,
which has the CSS and JS inlined into one file). The app still works fully —
it just keeps its data in memory for that browser session instead of on disk.
`api.js` automatically detects whether a backend is reachable and falls back
silently if not.

## Files

| File | Purpose |
|---|---|
| `index.html` | App structure — sidebar, gate, all sections |
| `style.css` | All styling, fully responsive |
| `script.js` | App logic — navigation, schedule, duties, swaps, chat, etc. |
| `api.js` | Talks to the backend; falls back to local data if none is running |
| `server.js` | Dependency-free Node backend + static file server |
| `data.json` | Where the backend persists everything |
| `shiftflow-preview.html` | Everything inlined into one file, for quick previewing |

## Admin dashboard (manage & deploy from a browser)

The `admin/` folder is a separate, self-contained page for managing this
repo over time without touching a terminal. Open `admin/index.html` (or,
once deployed, `https://wealth140.github.io/shiftflow/admin/`) and it lets
you:

- **Browse and edit any file** in the repo, including nested folders
- **Commit changes directly to GitHub**, with a commit message per change
- **Create new files** or **delete existing ones**
- **See recent commit history**
- **Enable GitHub Pages** with one click, and jump straight to the live site

### Connecting it

You'll need a GitHub personal access token scoped to this repo:

1. Go to `github.com/settings/tokens?type=beta` → **Generate new token** (fine-grained).
2. Under **Repository access**, choose **Only select repositories** → `wealth140/shiftflow`.
3. Under **Permissions**, set **Contents** to **Read and write**, and **Pages** to **Read and write** if you want the panel to enable Pages for you.
4. Generate it, and paste it into the admin panel when prompted.

The token is kept only in memory for that browser tab — it's never written
to disk, localStorage, or sent anywhere except `api.github.com`. Closing or
reloading the page clears it, so you'll re-enter it each session. Treat it
like a password regardless — anyone with it can push to your repo.

## The organization-type picker
(Business, Church, Hospital, School, Hotel, Restaurant, Security Company, or
Volunteer/NGO). It doesn't just relabel things — the schedule's actual
*structure* changes:

- **Church** gets a **Sunday Services** grid: ministry duties (Usher, Greeter,
  Choir, Media & Sound, Parking Team, Children's Ministry, Security) as rows,
  services (First Service, Second Service, Youth Service, Midweek Service) as
  columns. Each cell assigns one team member to that duty for that service.
- **Everyone else** gets a weekly grid: workers as rows, days as columns
  (School is Mon–Fri only; everything else is a full week), with a duty
  dropdown per day so the same person can be Front Desk on Monday and Kitchen
  on Wednesday.

You can change your organization type anytime from "Switch organization
type" at the bottom of the sidebar.

## Adding workers

The Team tab's "Add worker" form takes a name, a role, an optional email,
and their current on/off-shift status. The **role you pick here is what
drives auto-assign** (below) — pick whichever of your organization's duty
options actually matches what this person does.

## Auto-assign

On the Schedule tab, **"Auto-assign open shifts"** (or "Auto-assign services"
for a church) fills in every open slot by matching each worker's role to the
duty needed — a Kitchen worker only ever gets assigned to Kitchen, an Usher
only to Usher duty, and so on. When more than one person qualifies for the
same slot, it rotates fairly so no one gets stacked with every shift while
someone else gets none. It only ever fills gaps — anything you've already
assigned by hand is left untouched, and any slot nobody's qualified for is
left open for you to sort out manually.

## How workers get into ShiftFlow

There's no separate app to install — workers use the same URL you do. Every
visit now starts by asking **"How are you using ShiftFlow?"**: Admin, or
"I'm a worker."

- **Admin** goes straight into the full dashboard (everything described
  above).
- **Worker** picks their name from a list and enters a **4-digit PIN**.
  That PIN is generated automatically the moment you add them on the Team
  tab — it's shown right on their team card (with a "New PIN" link if it
  ever needs regenerating), so you just read it off and share it with them.

Once signed in, a worker gets a small, focused view — not the full admin
dashboard:
- **My Shifts** — their own assignments for the week (or this Sunday's
  services, for a church), plus their own clock in/out.
- **Request Swap** — pick one of their own shifts and optionally a specific
  coworker, and it lands in your **Shift Swaps** tab as a pending request
  for you to approve or decline. They can't approve their own or anyone
  else's.
- **Team Chat** and **Announcements** — same shared chat as the admin view,
  read-only announcements.

One important caveat, worth being upfront about: the PIN check happens in
the browser against data the app already has loaded — it's a lightweight
way to keep casual over-reach out (so a worker isn't staring at the full
admin dashboard by accident), not real security. Anyone with access to the
backend's data can see every PIN. If you need this to hold up against
someone actually trying to get in, treat that as a follow-up project, not
something this build claims to solve.

**Getting workers there in practice:** since the whole thing is one URL,
put ShiftFlow behind real hosting (see the admin dashboard section above
for GitHub Pages + a backend host) and text or email that link to your
team. On a phone, "Add to Home Screen" from the browser share menu makes it
open like an app icon without any install step.

## The floating assistant can actually do things

The chat bubble in the bottom-right isn't just Q&A — it executes real
actions, scoped to whether an admin or a worker is signed in. It's a
rule-based command parser (this is a static app with no server-side model
to call), so it recognizes specific phrasings and runs the same functions
the buttons in the UI use. Type "help" in it any time to see what it
currently understands for your role.

**Admin can say things like:**
- "add worker Sam as Usher"
- "remove worker Sam"
- "approve swap 3" or "approve Sam's swap"
- "auto-assign open shifts"
- "announce: Title — message"
- "who's on shift"

**A signed-in worker can say things like:**
- "clock me in" / "clock me out"
- "request a swap"
- "my shifts" / "my role"

A worker's assistant session only has access to worker-level commands —
asking it to remove someone from the roster, for instance, simply won't do
anything, the same way the Team tab isn't in their view at all. When it
doesn't recognize a command, it says so directly instead of guessing at
what you meant.

## Hosting the frontend and backend separately

If you host the static files on GitHub Pages but run `server.js` somewhere
that can actually execute Node (Render, Railway, Fly.io, a VPS — GitHub
Pages itself can't run a backend), set the backend's URL before `api.js`
loads. In `index.html`, uncomment and edit the line already sitting there
for this:

```html
<script>window.SHIFTFLOW_API_URL = "https://your-backend.example.com/api";</script>
```

The backend already sends the CORS headers needed for this to work across
origins — you don't need to configure anything else. Do the same in
`admin/index.html` if you want the admin panel to point at a specific
backend too (though the admin panel talks to GitHub's API directly, not
this backend, so it doesn't strictly need it).

## Light and dark mode

There's a toggle (the sun/moon icon, top-right corner) on every screen —
gates, the admin dashboard, and the worker view. It remembers your choice
via `localStorage` and matches your system preference the first time, with
no flash of the wrong theme on load. If storage is blocked (some restricted
preview environments do this), the toggle still works for that session —
it just won't remember your choice on the next visit. The admin repo
manager (`admin/`) has the same toggle, independent of the main app's.

## Inviting a worker

Once you've added someone on the Team tab, their card has two buttons:

- **Copy invite** — copies a ready-to-send message (the app's link, their
  name, and their PIN) to the clipboard. Paste it into a text, WhatsApp,
  Slack — whatever you actually use to reach them.
- **Email invite** — only shows up if you gave them an email address;
  opens your mail client with the same message pre-filled.

There's no account creation step for them beyond that — they open the
link, tap "I'm a worker," pick their name, and enter the PIN you sent.
