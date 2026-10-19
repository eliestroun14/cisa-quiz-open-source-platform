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

Both the input PDFs and the generated file are ignored by git: only use this tool on
material you have the right to use, and keep the result for personal use.

Note: regenerating the file after the PDFs change may shift the ids, which loses progress
tracking for the affected questions.
