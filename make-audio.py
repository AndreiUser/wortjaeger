"""Make one German audio file per word for Wortkette (zuma.html): audio/<id>.mp3.

Needs edge-tts (pip install edge-tts) and internet while it runs; the game then plays the files offline.
Files that already exist are skipped, so it can be run again after adding words.
audio/index.json remembers the German each file says: a word edited in the Register gets a new file.

  python3 make-audio.py            # every word in words-b1.json
  python3 make-audio.py --limit 10 # only the first 10, to test
  python3 make-audio.py ~/Downloads/wortjaeger-2026-10-20.json
                                   # the words in your browser: Register → Export JSON, then pass that file
"""
import argparse, asyncio, json, pathlib
import edge_tts

HERE = pathlib.Path(__file__).parent
VOICE = "de-DE-KatjaNeural"

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", nargs="?", default=str(HERE / "words-b1.json"), help="words-b1.json or a Register export")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--voice", default=VOICE)
    args = ap.parse_args()
    words = json.loads(pathlib.Path(args.source).expanduser().read_text(encoding="utf-8"))["words"]
    if args.limit:
        words = words[: args.limit]
    out = HERE / "audio"
    out.mkdir(exist_ok=True)
    made = out / "index.json"
    said = json.loads(made.read_text(encoding="utf-8")) if made.exists() else {}
    for w in words:
        f = out / f"{w['id']}.mp3"
        if f.exists() and said.get(w["id"], w["de"]) == w["de"]:
            said[w["id"]] = w["de"]
            continue
        await edge_tts.Communicate(w["de"], args.voice, rate="-10%").save(str(f))
        said[w["id"]] = w["de"]
        made.write_text(json.dumps(said, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{w['id']}  {w['de']}")

    made.write_text(json.dumps(said, ensure_ascii=False, indent=1), encoding="utf-8")

asyncio.run(main())
