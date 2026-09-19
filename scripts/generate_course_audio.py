import asyncio, json, subprocess, tempfile, shutil
from pathlib import Path
import edge_tts

ROOT=Path(__file__).resolve().parents[1]
COURSE=json.loads((ROOT/"course.json").read_text(encoding="utf-8"))
OUT=ROOT/"audio"
TMP=ROOT/"audio_tmp"
OUT.mkdir(exist_ok=True)
if TMP.exists(): shutil.rmtree(TMP)
TMP.mkdir()

VOICE=COURSE.get("voice","en-US-JennyNeural")
RATE=COURSE.get("rate","-5%")
WORD_PAUSE=COURSE.get("pause_after_word_ms",2000)/1000
SENT_GAP=COURSE.get("gap_after_sentence_ms",700)/1000

SEM=asyncio.Semaphore(12)

async def tts(text, path):
    if not text:
        return
    async with SEM:
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

async def main():
    # Generate word + sentence audio in parallel.
    jobs=[]
    for c in COURSE["cards"]:
        wd=TMP/(c["id"]+"_word.mp3")
        sd=TMP/(c["id"]+"_sentence.mp3")
        jobs.append(tts(c["word"],wd))
        jobs.append(tts(c["sentence"],sd))
    await asyncio.gather(*jobs)

    silence_word=TMP/"silence_word.wav"
    silence_gap=TMP/"silence_gap.wav"
    run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=r=24000:cl=mono:d={WORD_PAUSE}","-q:a","9",str(silence_word)])
    run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=r=24000:cl=mono:d={SENT_GAP}","-q:a","9",str(silence_gap)])

    segments=[]
    for c in COURSE["cards"]:
        lesson=TMP/(c["id"]+"_lesson.mp3")
        concat=TMP/(c["id"]+"_concat.txt")
        concat.write_text(
            f"file '{(TMP/(c['id']+'_word.mp3')).as_posix()}'\n"
            f"file '{silence_word.as_posix()}'\n"
            f"file '{(TMP/(c['id']+'_sentence.mp3')).as_posix()}'\n"
            f"file '{silence_gap.as_posix()}'\n",
            encoding="utf-8"
        )
        run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(concat),"-c:a","libmp3lame","-b:a","96k",str(lesson)])
        segments.append(lesson)

    # Concatenate all lessons into one continuous course track.
    course_list=TMP/"course_concat.txt"
    course_list.write_text("\n".join(f"file '{p.as_posix()}'" for p in segments)+"\n",encoding="utf-8")
    course_mp3=OUT/"course.mp3"
    run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(course_list),"-c","copy",str(course_mp3)])

    # Get accurate start times from each lesson.
    starts=[]; t=0.0
    for p in segments:
        r=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",str(p)],check=True,text=True,stdout=subprocess.PIPE)
        d=float(r.stdout.strip()); starts.append(round(t,3)); t += d

    meta={"voice":VOICE,"rate":RATE,"starts":starts,"duration":round(t,3),"generated_at":"github-actions"}
    (OUT/"course.meta.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding="utf-8")
    shutil.rmtree(TMP)

if __name__=="__main__":
    asyncio.run(main())
