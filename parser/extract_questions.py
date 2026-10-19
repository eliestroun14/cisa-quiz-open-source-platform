"""One-off extraction of multiple-choice questions from PDFs into a JSON bank (format: quiz/data/FORMAT.md).

Usage: python -I parser/extract_questions.py [pdf_folder] [output.json]
Defaults: parser/source_pdfs -> quiz/data/cisa_dumps.json
"""
import json
import re
import sys
from pathlib import Path

import pypdf

BULLET = "•●▪"
Q_SPLIT = re.compile(r"^\s*QUESTION\s+(\d+)\s*:?\s*$", re.M | re.I)
LETTERED = re.compile(r"^([A-H])[\)\.]\s+(.*)$")
INLINE_MARK = re.compile(r"\s*\((?:Correct(?:\s+Answer)?)\)\s*", re.I)
ANSWER = re.compile(r"^(?:Correct\s+)?Answer\s*:\s*(.*)$", re.I)
ANSWER_LETTERS = re.compile(r"^([A-F](?:\s*(?:,|&|and)\s*[A-F])*)\s*[\.\)]?(?:\s*\(.*\))?$")
SPLIT_MARK = re.compile(r"\(Correct\s*\n\s*Answer\)", re.I)
EXPL = re.compile(r"^(?:Explanation|Additional Clarification)\s*:?\s*(.*)$", re.I)
SECTION = re.compile(r"^(?:Section|Topic|Domain)\s*:\s*(.+)$", re.I)
NOISE = re.compile(r"^(Exam\s+[A-Z]|Options\s*:|Page\s+\d+.*)$", re.I)


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def parse_block(num, body, source):
    stem, opts, marked, answer, answer_text, expl, section = [], [], [], None, [], [], ""
    state = "stem"
    for raw in SPLIT_MARK.sub("(Correct Answer)", body).splitlines():
        line = raw.strip()
        if not line or NOISE.match(line):
            continue
        if m := ANSWER.match(line):
            if lm := ANSWER_LETTERS.match(m.group(1).strip()):
                answer = re.findall(r"[A-F]", lm.group(1).upper())
                state = "after"
            else:
                # Answer given as text: matched against the options below
                answer_text = [m.group(1)]
                state = "anstext"
            continue
        if m := SECTION.match(line):
            section = clean(m.group(1))
            continue
        if m := EXPL.match(line):
            expl.append(m.group(1))
            state = "expl"
            continue

        is_bullet = line[0] in BULLET
        text = line.lstrip(BULLET).strip() if is_bullet else line
        lm = LETTERED.match(text)
        expected = chr(ord("A") + len(opts))
        new_option = state in ("stem", "opts") and (
            is_bullet or (lm and lm.group(1) == expected)
        )
        if new_option:
            if lm and lm.group(1) == expected:
                text = lm.group(2)
            if INLINE_MARK.search(text):
                marked.append(expected)
                text = INLINE_MARK.sub(" ", text)
            opts.append([text])
            state = "opts"
        elif state == "stem":
            stem.append(line)
        elif state == "opts":
            if INLINE_MARK.search(line):
                marked.append(chr(ord("A") + len(opts) - 1))
                line = INLINE_MARK.sub(" ", line)
            opts[-1].append(line)
        elif state == "expl":
            expl.append(line)
        elif state == "anstext":
            answer_text.append(line)

    question = re.sub(r"^Question\s*:\s*", "", clean(" ".join(stem)), flags=re.I)
    opts = [clean(" ".join(o)) for o in opts]
    # Case-study questions: a bulleted scenario ending with ":" or "?" precedes the real options
    scenario_end = max((i for i, o in enumerate(opts[:-2]) if o.endswith((":", "?"))), default=-1)
    if scenario_end >= 0 and not marked:
        question += "".join("\n• " + o for o in opts[: scenario_end + 1])
        opts = opts[scenario_end + 1 :]
    options = {chr(ord("A") + i): o for i, o in enumerate(opts)}
    if not options and re.search(r"true\s+or\s+false", question, re.I):
        options = {"A": "True", "B": "False"}
    if answer_text and not answer:
        norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
        wanted = norm(" ".join(answer_text))
        answer = [k for k, v in options.items() if norm(v) == wanted]
    answer = sorted(set(answer or marked))
    problems = []
    if len(options) < 2:
        problems.append("options")
    if not answer or any(a not in options for a in answer):
        problems.append("answer")
    if not question:
        problems.append("question")
    return {
        "source": source.replace(" CISA dumps.pdf", "").replace(" to ", "-") + " (PDF)",
        "number": num,
        "section": section,
        "question": question,
        "options": options,
        "answer": answer,
        "explanation": clean(" ".join(expl)),
    }, problems


def main(pdf_dir, out_file):
    questions, issues = [], []
    pdfs = sorted(Path(pdf_dir).glob("*.pdf"), key=lambda p: int(p.name.split()[0]))
    for pdf in pdfs:
        text = "\n".join(page.extract_text() or "" for page in pypdf.PdfReader(pdf).pages)
        parts = Q_SPLIT.split(text)
        for i in range(1, len(parts), 2):
            q, problems = parse_block(int(parts[i]), parts[i + 1], pdf.name)
            if problems:
                issues.append((pdf.name, q["number"], problems, parts[i + 1][:300]))
            else:
                questions.append(q)

    # De-duplicate on question text + options
    seen, unique = set(), []
    for q in questions:
        key = (q["question"].lower(), tuple(sorted(v.lower() for v in q["options"].values())))
        if key not in seen:
            seen.add(key)
            unique.append(q)
    unique = [{"id": f"cisa-{n:04d}", **q} for n, q in enumerate(unique, 1)]

    data = {"title": "CISA dumps (PDF AyemunHossain)", "questions": unique}
    Path(out_file).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(questions)} valid questions, {len(unique)} unique, {len(issues)} skipped -> {out_file}")
    for name, num, problems, snippet in issues:
        print(f"--- skipped: {name} Q{num} -> {problems}\n{snippet}")


if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    main(
        sys.argv[1] if len(sys.argv) > 1 else here / "source_pdfs",
        sys.argv[2] if len(sys.argv) > 2 else here.parent / "quiz" / "data" / "cisa_dumps.json",
    )
