import asyncio, json, subprocess, shutil
from pathlib import Path
import edge_tts

ROOT=Path(__file__).resolve().parents[1]
COURSE=json.loads((ROOT/"course.json").read_text(encoding="utf-8"))
OUT=ROOT/"audio"
TMP=ROOT/"audio_tmp"
OUT.mkdir(exist_ok=True)
if TMP.exists():
    shutil.rmtree(TMP)
TMP.mkdir()

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
    # Generate reusable word, sentence, and Chinese meaning clips.
    jobs=[]
    for c in COURSE["cards"]:
        wd=TMP/(c["id"]+"_word.mp3")
        sd=TMP/(c["id"]+"_sentence.mp3")
        md=TMP/(c["id"]+"_meaning.mp3")
        jobs.append(tts(c["word"],wd,VOICE,RATE))
        jobs.append(tts(c["sentence"],sd,VOICE,RATE))
        jobs.append(tts(c.get("meaning",""),md,MEANING_VOICE,MEANING_RATE))
    await asyncio.gather(*jobs)

    silence_word=TMP/"silence_word.wav"
    silence_gap=TMP/"silence_gap.wav"
    run(["ffmpeg","-y","-f","lavfi","-i",
         f"anullsrc=r=24000:cl=mono:d={WORD_PAUSE}","-q:a","9",str(silence_word)])
    run(["ffmpeg","-y","-f","lavfi","-i",
         f"anullsrc=r=24000:cl=mono:d={SENT_GAP}","-q:a","9",str(silence_gap)])

    # Build the existing continuous driver track:
    # word -> 2s recall pause -> sentence -> 0.7s gap.
    lesson_segments=[]
    for c in COURSE["cards"]:
        lesson=TMP/(c["id"]+"_lesson.mp3")
        concat=TMP/(c["id"]+"_concat.txt")
        concat.write_text(
            f"file '{(TMP/(c['id']+'_word.mp3')).as_posix()}'
"
            f"file '{silence_word.as_posix()}'
"
            f"file '{(TMP/(c['id']+'_sentence.mp3')).as_posix()}'
"
            f"file '{silence_gap.as_posix()}'
",
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

    # Build separate tracks for deliberate-memory mode and Chinese playback.
    def concat_track(items, output, gap_path):
        concat_file=TMP/(output.stem+"_concat.txt")
        lines=[]
        for p in items:
            lines.append(f"file '{p.as_posix()}'")
            lines.append(f"file '{gap_path.as_posix()}'")
        concat_file.write_text("\n".join(lines)+"\n",encoding="utf-8")
        run(["ffmpeg","-y","-f","concat","-safe","0","-i",str(concat_file),
             "-c:a","libmp3lame","-b:a","96k",str(output)])
        starts=[]
        t=0.0
        gap_d=duration(gap_path)
        for p in items:
            starts.append(round(t,3))
            t += duration(p)+gap_d
        return starts,round(t,3)

    words=[TMP/(c["id"]+"_word.mp3") for c in COURSE["cards"]]
    sentences=[TMP/(c["id"]+"_sentence.mp3") for c in COURSE["cards"]]
    meanings=[TMP/(c["id"]+"_meaning.mp3") for c in COURSE["cards"]]

    word_starts,word_duration=concat_track(words,OUT/"course.words.mp3",silence_gap)
    sentence_starts,sentence_duration=concat_track(sentences,OUT/"course.sentences.mp3",silence_gap)
    meaning_starts,meaning_duration=concat_track(meanings,OUT/"course.meanings.mp3",silence_gap)

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
        "word_starts":word_starts,
        "word_duration":word_duration,
        "sentence_starts":sentence_starts,
        "sentence_duration":sentence_duration,
        "meaning_starts":meaning_starts,
        "meaning_duration":meaning_duration,
        "generated_at":"github-actions"
    }
    (OUT/"course.meta.json").write_text(
        json.dumps(meta,ensure_ascii=False,indent=2),
        encoding="utf-8"
    )
    shutil.rmtree(TMP)

if __name__=="__main__":
    asyncio.run(main())
