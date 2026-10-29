# VSS Check (PWA)
Phone-GPS screening of an obstacle position against the Visual Segment Surface (VSS) and visual-segment OCS, ICAO Doc 8168 Vol II, Part I, Sec 4, Ch 5, para 5.4.6. Static site, no backend; works offline once opened.

## Run on GitHub Pages
1. Create a repo, push these files to `main`. 2. Settings > Pages > Source: **GitHub Actions**. 3. Open the Pages URL (HTTPS, needed for GPS) in Safari > Share > **Add to Home Screen**.
Local test: `python3 -m http.server` then open http://localhost:8000. Maths tests: `node tests/calc.test.mjs`.

## Data: `data/aerodromes.json`
Edit thresholds (DDMMSS.ssN / DDDMMSS.ssE or decimal), elevation, runway width, strip width, Annex 14 inner width. The app checks each runway designator against the bearing to the opposite threshold and blocks the calculation if they disagree.

## Assumptions to verify (not settled by the extract)
- VSS slope starts at the 60 m point at threshold elevation (toggle in Advanced). OCH is taken as height above threshold.
- Strip and inner widths are taken from the CSV and not verified by me.
- PA: OCS slope is not given in the extract, enter it manually. Offset final approach tracks (Figs I-4-5-7/8/10/11) are not implemented.
- 15 m disregard rule is shown as information, not applied automatically.
- Ground elevation is entered by the user; phone altitude is never used. Position uses a local flat-earth approximation (fine at a few km).
