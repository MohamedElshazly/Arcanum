# Arcanum Music & SFX — Strudel Composition

All music and SFX in this project are composed in [strudel.cc](https://strudel.cc), a browser-based live coding environment.

## Workflow

1. Open <https://strudel.cc>.
2. Paste the contents of `_template.strudel` (or an existing track like `stone.strudel`) into the editor.
3. Iterate until you like the loop.
4. Click "Record" in Strudel's UI and let it play for one full loop length (60-90 seconds for music, 0.2-0.6 seconds for SFX).
5. Click "Stop" to end recording. Strudel saves a `.wav` file.
6. Convert to `.ogg` (smaller, web-friendly):

   For music (stereo, 96kbps, normalized):
   ```bash
   ffmpeg -i input.wav -c:a libvorbis -q:a 3 -af "loudnorm=I=-16:LRA=7:TP=-2" public/audio/music/<name>.ogg
   ```

   For SFX (stereo, 128kbps, no loudnorm — preserves transient):
   ```bash
   ffmpeg -i input.wav -c:a libvorbis -q:a 4 public/audio/sfx/<name>.ogg
   ```

7. Trim seamless loops if needed:
   ```bash
   ffmpeg -ss 0 -to 60 -i input.ogg -c copy looped.ogg
   ```

8. Save the Strudel source to `docs/audio/strudel/<name>.strudel` and commit alongside the `.ogg`.

## File checklist

Music (7 tracks): stone, fire, ice, lightning, arcane, void, boss
SFX (9 sounds): {fire,ice,lightning,arcane}_{cast,impact}, utility

See `_template.strudel` for biome palettes and BPM conventions.
