import asyncio, json, subprocess, shutil
from pathlib import Path
import edge_tts

ROOT=Path(__file__).resolve().parents[1]
COURSE=json.loads((ROOT/"course.json").read_text(encoding="utf-8"))
OUT=ROOT/"audio"
TMP=ROOT/"audio_tmp"

VOICE=COURSE.get("voice","en-US-JennyNeural")
RATE=COURSE.get("rate","-5%")
MEANING_VOICE=COURSE.get("meaning_voice","zh-CN-XiaoxiaoNeural")
MEANING_RATE=COURSE.get("meaning_rate","+0%")
WORD_PAUSE=COURSE.get("pause_after_word_ms",2000)/1000
SENT_GAP=COURSE.get("gap_after_sentence_ms",700)/1000

SEM=asyncio.Semaphore(12)

async def tts(text, path, voice=VOICE, rate=RATE):
    if not text:
        return
    async with SEM:
        await edge_tts.Communicate(text, voice, rate=rate).save(str(path))

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def duration(path):
    r=subprocess.run(
        ["ffprobe","-v","error","-show_entries","format=duration",
         "-of","default=noprint_wrappers=1:nokey=1",str(path)],
        check=True,text=True,stdout=subprocess.PIPE
    )
    return float(r.stdout.strip())

async def main():
    if TMP.exists():
        shutil.rmtree(TMP)
    TMP.mkdir(parents=True)

    word_dir=OUT/"word"
    sentence_dir=OUT/"sentence"
    meaning_dir=OUT/"meaning"
    for d in (word_dir,sentence_dir,meaning_dir):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)

    jobs=[]
    for c in COURSE["cards"]:
        cid=c["id"]
        jobs.append(tts(c.get("audioWord",c["word"]),TMP/(cid+"_word.mp3"),VOICE,RATE))
        jobs.append(tts(c["sentence"],TMP/(cid+"_sentence.mp3"),VOICE,RATE))
        jobs.append(tts(c.get("meaning",""),TMP/(cid+"_meaning.mp3"),MEANING_VOICE,MEANING_RATE))
    await asyncio.gather(*jobs)

    # Copy each clip to an ID-addressable file.
    # Practice mode uses these individual files so a browser seek can never
    # accidentally land on another word.
    manifest=[]
    for c in COURSE["cards"]:
        cid=c["id"]
        wp=TMP/(cid+"_word.mp3")
        sp=TMP/(cid+"_sentence.mp3")
        mp=TMP/(cid+"_meaning.mp3")
        shutil.copy2(wp,word_dir/(cid+".mp3"))
        shutil.copy2(sp,sentence_dir/(cid+".mp3"))
        shutil.copy2(mp,meaning_dir/(cid+".mp3"))
        manifest.append({
            "id":cid,
            "word":c["word"],
            "word_file":f"word/{cid}.mp3",
            "sentence_file":f"sentence/{cid}.mp3",
            "meaning_file":f"meaning/{cid}.mp3"
        })

    silence_word=TMP/"silence_word.wav"
    silence_gap=TMP/"silence_gap.wav"
    run(["ffmpeg","-y","-f","lavfi","-i",
         f"anullsrc=r=24000:cl=mono:d={WORD_PAUSE}","-q:a","9",str(silence_word)])
    run(["ffmpeg","-y","-f","lavfi","-i",
         f"anullsrc=r=24000:cl=mono:d={SENT_GAP}","-q:a","9",str(silence_gap)])

    # Preserve the existing hands-free driver track:
    # word -> 2s recall pause -> sentence -> 0.7s gap.
    lesson_segments=[]
    for c in COURSE["cards"]:
        cid=c["id"]
        lesson=TMP/(cid+"_lesson.mp3")
        concat=TMP/(cid+"_concat.txt")
        concat.write_text(
            "\n".join([
                f"file '{(TMP/(cid+'_word.mp3')).as_posix()}'",
                f"file '{silence_word.as_posix()}'",
                f"file '{(TMP/(cid+'_sentence.mp3')).as_posix()}'",
                f"file '{silence_gap.as_posix()}'",
            ])+"\n",
            encoding="utf-8"
        )
        run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(concat),
             "-c:a","libmp3lame","-b:a","96k",str(lesson)])
        lesson_segments.append(lesson)

    course_list=TMP/"course_concat.txt"
    course_list.write_text(
        "\n".join(f"file '{p.as_posix()}'" for p in lesson_segments)+"\n",
        encoding="utf-8"
    )
    course_mp3=OUT/"course.mp3"
    run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(course_list),
         "-c","copy",str(course_mp3)])

    # Metadata is kept for the continuous driver track plus an explicit
    # ID-based practice manifest.
    starts=[]
    t=0.0
    for p in lesson_segments:
        d=duration(p)
        starts.append(round(t,3))
        t += d

    meta={
        "voice":VOICE,
        "rate":RATE,
        "meaning_voice":MEANING_VOICE,
        "meaning_rate":MEANING_RATE,
        "starts":starts,
        "duration":round(t,3),
        "practice_manifest":manifest,
        "generated_at":"github-actions"
    }
    (OUT/"course.meta.json").write_text(
        json.dumps(meta,ensure_ascii=False,indent=2),
        encoding="utf-8"
    )
    shutil.rmtree(TMP)

if __name__=="__main__":
    asyncio.run(main())
