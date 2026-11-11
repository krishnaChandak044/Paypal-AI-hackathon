from pathlib import Path
import re
import wave

root = Path(__file__).resolve().parent
voice = root / "voice"
files = sorted(voice.glob("[0-9][0-9].txt"))

def seconds(path):
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / wav.getframerate()

def stamp(t):
    ms = round(t * 1000)
    return f"{ms//3600000:02}:{(ms%3600000)//60000:02}:{(ms%60000)//1000:02},{ms%1000:03}"

def caption_lines(text, limit=46):
    words = text.split()
    lines, line = [], ""
    for word in words:
        candidate = (line + " " + word).strip()
        if len(candidate) <= limit:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    # Keep each caption to two lines; if needed create successive cards.
    return ["\n".join(lines[i:i+2]) for i in range(0, len(lines), 2)]

entries = []
cursor = 0.0
for text_file in files:
    index = int(text_file.stem)
    text = text_file.read_text().strip()
    audio_len = seconds(voice / f"{index:02}.wav")
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    weights = [max(1, len(s.split())) for s in sentences]
    total_words = sum(weights)
    sentence_start = cursor
    for sentence, weight in zip(sentences, weights):
        sentence_len = audio_len * weight / total_words
        cards = caption_lines(sentence)
        # Split long multi-line captions across their sentence interval.
        card_len = sentence_len / len(cards)
        for card in cards:
            entries.append((sentence_start, sentence_start + card_len, card))
            sentence_start += card_len
    cursor += audio_len + 0.4

out = []
for i, (start, end, caption) in enumerate(entries, 1):
    out.extend([str(i), f"{stamp(start)} --> {stamp(end)}", caption, ""])
(root / "captions.srt").write_text("\n".join(out))

transcript = ["# ReliefRail demo voiceover\n"]
for i, path in enumerate(files, 1):
    transcript += [f"## Scene {i:02}\n", path.read_text().strip(), ""]
(root / "voiceover.md").write_text("\n".join(transcript))
