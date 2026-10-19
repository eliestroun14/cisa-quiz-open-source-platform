# Contributing

Thanks for helping! Two kinds of contributions are welcome: **questions** and **code**.

## Submitting questions

1. Add your questions to `quiz/data/community.json` following
   [`quiz/data/FORMAT.md`](quiz/data/FORMAT.md). Use a new `id` (`comm-0007`,
   `comm-0008`, …) and never change the `id` of an existing question.
2. Validate: `python scripts/validate_data.py`
3. Try them in the app (`cd quiz && python -m http.server 8000`).
4. Open a pull request. Validation runs again automatically.

### Content rules

- **Write every question and explanation yourself.** Do not copy questions from books,
  official question databases, paid courses or "dumps", even lightly reworded. Pull
  requests containing such material will be rejected.
- An explanation should say **why** the correct answer is correct, and ideally why the
  other options are not.
- Set the domain in `section` (e.g. `IS AUDIT PROCESS`, `PROTECTION OF INFORMATION ASSETS`).
- To report a wrong answer, open an issue or a pull request with a source.

By submitting questions, you agree that they are published under
[CC BY-SA 4.0](quiz/data/LICENSE) and you confirm that you have the right to do so.

## Contributing code

- The app is plain HTML/CSS/JavaScript with no dependencies and no build step — let's keep
  it that way.
- User data stays in the user's browser: no requests to external services.
- Describe what you tested in the pull request.

By contributing code, you agree that it is published under the [MIT](LICENSE) license.
