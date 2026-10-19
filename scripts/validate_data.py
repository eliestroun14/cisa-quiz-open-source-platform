"""Validates the question banks listed in quiz/data/index.json (same rules as the app).

Usage: python scripts/validate_data.py [file.json ...]
With no argument, validates every file in quiz/data/index.json. Exits with code 1 on error.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "quiz" / "data"
LETTERS = "ABCDEFGH"


def check_question(q, seen):
    if not isinstance(q, dict) or not isinstance(q.get("id"), str) or not q["id"]:
        return "missing id"
    if q["id"] in seen:
        return f"duplicate id (already used in {seen[q['id']]})"
    if not isinstance(q.get("question"), str) or not q["question"].strip():
        return "missing question text"
    options = q.get("options")
    keys = list(options) if isinstance(options, dict) else []
    if len(keys) < 2 or keys != list(LETTERS[: len(keys)]) or not all(isinstance(v, str) and v.strip() for v in options.values()):
        return "invalid options (at least 2, keys A, B, C… in order, non-empty text)"
    answer = q.get("answer")
    if not isinstance(answer, list) or not answer or any(a not in keys for a in answer) or len(set(answer)) != len(answer):
        return "answer must be a non-empty list of letters present in options"
    for field in ("explanation", "section", "source"):
        if field in q and not isinstance(q[field], str):
            return f"{field} must be a string"
    return None


def main(files):
    errors, seen, total = [], {}, 0
    for path in files:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as err:
            errors.append(f"{path.name}: unreadable ({err})")
            continue
        questions = data if isinstance(data, list) else data.get("questions") if isinstance(data, dict) else None
        if not isinstance(questions, list):
            errors.append(f"{path.name}: no \"questions\" list")
            continue
        for n, q in enumerate(questions, 1):
            if problem := check_question(q, seen):
                errors.append(f"{path.name} · question {n} ({q.get('id') if isinstance(q, dict) else '?'}): {problem}")
            else:
                seen[q["id"]] = path.name
                total += 1
    for e in errors:
        print("ERROR", e)
    print(f"{total} valid questions, {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) > 1:
        targets = [Path(p) for p in sys.argv[1:]]
    else:
        index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
        targets = [DATA / f for f in index["files"]]
    sys.exit(main(targets))
