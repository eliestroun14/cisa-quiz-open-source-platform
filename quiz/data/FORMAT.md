# Question bank format

Each `.json` file in this folder holds a question bank. The app loads:

1. the files listed in `index.json` — banks **published** with the app;
2. the files listed in `index.local.json`, if it exists — **personal** banks; this file is
   ignored by git, so nothing in it gets published;
3. the files imported with the "Import a JSON file" button — stored only in your browser.

```json
{ "files": ["community.json"] }
```

To **contribute** questions, extend `community.json` (or create a file and add it to
`index.json`), then open a pull request — see `CONTRIBUTING.md`. Questions must be written
by you: do not copy questions from books, official databases or "dumps". Contributions are
published under CC BY-SA 4.0 (see `data/LICENSE`).

## File structure

```json
{
  "title": "Bank name",
  "questions": [
    {
      "id": "comm-0001",
      "source": "Community",
      "section": "IS AUDIT PROCESS",
      "question": "Question text?",
      "options": { "A": "Answer A", "B": "Answer B", "C": "Answer C", "D": "Answer D" },
      "answer": ["A"],
      "explanation": "Why A is the correct answer."
    }
  ]
}
```

| Field         | Required | Description |
|---------------|----------|-------------|
| `id`          | yes | **Unique, stable** identifier (used to track progress). Never change it once used. Prefix it per file (`comm-`, `my-`, …) to avoid collisions. |
| `question`    | yes | Question text. Line breaks (`\n`) are displayed. |
| `options`     | yes | At least 2 answers, keys `A` to `H` in order. |
| `answer`      | yes | List of correct letters. Several letters = multiple-answer question. |
| `explanation` | no  | Shown after the question is graded. |
| `section`     | no  | CISA domain, used as a filter (domains with fewer than 5 questions are grouped under "Uncategorized"). |
| `source`      | no  | Origin, used as a filter. Defaults to the file's `title`. |
| `number`      | no  | Original question number, shown for reference. |

Invalid questions (missing or duplicate id, fewer than 2 options, answer not among the
options) are skipped and reported on the home page. Run `python scripts/validate_data.py`
to check files before committing.
