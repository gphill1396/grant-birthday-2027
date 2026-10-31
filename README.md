# Shuffle Up And Sing

Party site for Grant's 31st birthday, Friday, January 15, 2027: live band karaoke, Magic and board games, and a Dirty Diet Coke bar.

- `index.html` is the whole site. GitHub Pages serves it as is, with no build step.
- `apps-script/Code.gs` is the backend. It saves RSVPs, song requests and musician sign-ups to the "Birthday Band Arrangements" Google Sheet and returns the public lists the site shows (songs requested, who's playing, headcount). Names never leave the sheet; the site shows no names or initials.

## Turn on the forms (one time, about 5 minutes)

1. Open the Birthday Band Arrangements sheet.
2. Extensions > Apps Script. Delete the starter code and paste in `apps-script/Code.gs`. Save.
3. Deploy > New deployment. Gear icon > Web app.
   - Execute as: Me
   - Who has access: Anyone
4. Deploy, then approve the permissions prompt. It asks to edit this sheet and to send email as you (for the sign-up notifications).
5. Copy the Web app URL. Paste it into `SCRIPT_URL` near the bottom of `index.html` and commit.

After you change `Code.gs` later, use Deploy > Manage deployments > Edit > New version, so the URL stays the same.

## Settings in index.html

- `SCRIPT_URL`: the Apps Script web app URL.
- `SONG_DEADLINE`: song requests close at the end of November 30, Eastern. The same date is in `Code.gs`.
- `DRINKS`: the Dirty Diet Coke bar cards.
- `EVENT`: the calendar details (6 to 11 PM Eastern).

## Setting in Code.gs

- `NOTIFY_EMAIL`: where sign-up emails go. Blank sends them to the account that owns the script.
