# Plate folders

`assets/plates/<character>/<beat>/` — one folder per beat: `idle`, `tease`, `give`, `stop`, `presence`.

Rules enforced by `plate-engine.js` (browser) and checked by `test_plate_engine.js`:

- A beat with no file is **off**. The engine never invents it live.
- Default action is play a plate. Generation only happens when the specific plate (beat + variant)
  does not exist and the session cap allows it; the result is saved to the folder and is a plate next time.
- Caps per session: 15 min → 2 new cuts, 30 → 3, 45 → 4, under 60 → 5, 60–75 → 6. At the cap: plates only.
- Same file never plays twice in a row. Same give file never plays twice within two minutes.
- Every decision is logged; the admin Plate Engine tab flags any file played 3× in a minute.

To add a plate: put the file in the beat folder and list its URL (e.g. `assets/plates/chloe/give/give_01.mp4`)
under that beat in `manifest.json`. Chloe and Bailey must have all five beats populated before a paid show
can be started from the admin Show Manager.
