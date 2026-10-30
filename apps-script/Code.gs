/**
 * Shuffle Up And Sing: backend for the party site.
 *
 * Lives in the "Birthday Band Arrangements" Google Sheet
 * (Extensions > Apps Script). Writes RSVPs, song requests and musician
 * sign-ups to their tabs, and returns the public lists the site shows.
 * Names never leave the sheet: the public lists show initials only.
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Then paste the web app URL into SCRIPT_URL in index.html.
 */

const TABS = {
  rsvp: "RSVPs",
  song: "Song Requests",
  musician: "Musician Signups",
};

// Song requests close at the end of November 30, Eastern time.
const SONG_DEADLINE = new Date("2026-12-01T05:00:00Z");

const MAX_LEN = 500;

// Where sign-up emails go. Leave blank to send them to the account that owns this script.
const NOTIFY_EMAIL = "";

function doGet() {
  return json({ ok: true, ...publicData() });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "That form didn't send properly." });
  }

  // Bots fill in the hidden "website" field; people never see it.
  if (data.website) return json({ ok: true, data: publicData() });

  const name = clean(data.name, 80);
  if (!name) return json({ ok: false, error: "Add your name." });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json({ ok: false, error: "Lots of people are signing up right now. Try again in a minute." });
  try {
    const now = new Date();
    if (data.type === "rsvp") {
      const attending = oneOf(data.attending, ["Yes", "Maybe", "No"]);
      if (!attending) return json({ ok: false, error: "Choose whether you're coming." });
      const people = Math.min(Math.max(parseInt(data.count, 10) || 1, 1), 6);
      const guests = people > 1 ? clean(data.guests, 200) : "";
      const bringing = clean(data.bringing, 120);
      sheet("rsvp").appendRow([now, name, attending, people, guests, bringing, clean(data.notes)]);
      notify(`RSVP: ${name} (${attending}${people > 1 ? ", " + people + " people" : ""})`,
        [`Coming: ${attending}`, `People: ${people}`, guests && `With: ${guests}`, bringing && `Bringing: ${bringing}`, data.notes && `Notes: ${clean(data.notes)}`]);
    } else if (data.type === "song") {
      if (now >= SONG_DEADLINE) return json({ ok: false, error: "Song requests closed November 30." });
      const song = clean(data.song, 120);
      const artist = clean(data.artist, 120);
      if (!song || !artist) return json({ ok: false, error: "Add the song and the artist." });
      const singing = oneOf(data.singing, ["Yes", "Maybe", "No"]) || "Maybe";
      sheet("song").appendRow([now, name, song, artist, singing, clean(data.notes)]);
      notify(`Song request: ${song} by ${artist}`,
        [`From: ${name}`, `Will sing: ${singing}`, data.notes && `Notes: ${clean(data.notes)}`]);
    } else if (data.type === "musician") {
      const instruments = [clean(data.instruments, 200), clean(data.other, 120)].filter(String).join(", ");
      if (!instruments) return json({ ok: false, error: "Pick at least one instrument." });
      const level = oneOf(data.level, ["Just starting", "Comfortable", "Play out regularly"]);
      sheet("musician").appendRow([now, name, instruments, level, clean(data.songs)]);
      notify(`Musician sign-up: ${name}`,
        [`Plays: ${instruments}`, level && `Comfort: ${level}`, data.songs && `Songs: ${clean(data.songs)}`]);
    } else {
      return json({ ok: false, error: "Unknown form." });
    }
  } finally {
    lock.releaseLock();
  }

  return json({ ok: true, data: publicData() });
}

/** What the site is allowed to show: songs, who's playing, and a headcount. */
function publicData() {
  // Songs: group duplicates, keep requester names private.
  const songMap = {};
  rows("song").forEach(r => {
    const song = String(r[2]).trim();
    const artist = String(r[3]).trim();
    if (!song) return;
    const key = (song + "|" + artist).toLowerCase();
    if (!songMap[key]) songMap[key] = { song, artist, count: 0, by: [] };
    songMap[key].count++;
    const who = initials(r[1]);
    if (who && songMap[key].by.indexOf(who) < 0) songMap[key].by.push(who);
  });
  const songs = Object.values(songMap).sort((a, b) => b.count - a.count || a.song.localeCompare(b.song));

  // Musicians: latest sign-up per person wins. Only initials leave the sheet.
  const musMap = {};
  rows("musician").forEach(r => {
    const name = String(r[1]).trim();
    if (name) musMap[name.toLowerCase()] = { name: initials(name), instruments: String(r[2]) };
  });
  const musicians = Object.values(musMap).sort((a, b) => a.name.localeCompare(b.name));

  // Headcount: latest RSVP per person, counting only "Yes".
  const rsvpMap = {};
  rows("rsvp").forEach(r => {
    const name = String(r[1]).trim().toLowerCase();
    if (name) rsvpMap[name] = { coming: r[2], people: Number(r[3]) || 1 };
  });
  const attending = Object.values(rsvpMap).reduce((n, r) => n + (r.coming === "Yes" ? r.people : 0), 0);

  return { songs, musicians, attending };
}

/** Emails a short note about each new sign-up. A failed email never blocks the sign-up. */
function notify(subject, lines) {
  try {
    const to = NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
    const body = lines.filter(Boolean).join("\n") + "\n\nFull list: " + SpreadsheetApp.getActiveSpreadsheet().getUrl();
    MailApp.sendEmail(to, "Shuffle Up And Sing: " + subject, body);
  } catch (err) {
    console.error("Email failed: " + err);
  }
}

/** "Josh Roberts" -> "J.R.", "Val" -> "V." */
function initials(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean).map(w => w.replace(/^[^A-Za-z0-9]+/, "").charAt(0).toUpperCase()).filter(Boolean).join(".") + (String(name || "").trim() ? "." : "");
}

function sheet(type) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS[type]);
}

function rows(type) {
  const s = sheet(type);
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, s.getLastColumn()).getValues();
}

function clean(value, max) {
  let s = String(value == null ? "" : value).trim().slice(0, max || MAX_LEN);
  // Keep the sheet from treating input as a formula.
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function oneOf(value, allowed) {
  return allowed.indexOf(value) >= 0 ? value : "";
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
