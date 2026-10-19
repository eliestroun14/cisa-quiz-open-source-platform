# PDF → JSON parser

One-off tool: converts question PDFs into a JSON file in the app's format (see
`../quiz/data/FORMAT.md`). The app itself never reads PDFs.

```sh
pip install -r requirements.txt
python -I extract_questions.py                       # source_pdfs/ -> ../quiz/data/cisa_dumps.json
python -I extract_questions.py <pdf_folder> <output.json>
```

The script handles the layout variants found in the PDFs (`A)`, `A.` or bulleted options,
answer given as a letter or as text, "(Correct Answer)" markers, case-study questions,
true/false…), removes duplicates and assigns stable ids (`cisa-0001`, …). Questions that
cannot be parsed are listed at the end of the run.

## Supported source

The parser was written for the PDF layout used in
[AyemunHossain/Isaca-CISA-Dump-Questions-Study-Material](https://github.com/AyemunHossain/Isaca-CISA-Dump-Questions-Study-Material).
Place the PDFs in `parser/source_pdfs/`, run the script, and the generated bank is picked
up by the app through `quiz/data/index.local.json`:

```json
{ "files": ["cisa_dumps.json"] }
```

This project is not affiliated with that repository and does not host, review or vouch for
its content: questions and answers may be inaccurate, and their copyright status is not
established. It is your responsibility to make sure you have the right to use any material
you convert.

Both the input PDFs and the generated file are ignored by git: they are never published
with this project. Keep the result for personal use.

Note: regenerating the file after the PDFs change may shift the ids, which loses progress
tracking for the affected questions.
