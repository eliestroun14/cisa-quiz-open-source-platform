# CISA Quiz — free, open-source practice tool

An open-source web app to practise multiple-choice questions for the CISA certification:
randomized sets, timed exam mode, progress tracking and targeted review of your mistakes.
No installation, no account, no data sent anywhere: everything runs in your browser.

> **Independent project, not affiliated with ISACA.** See [Disclaimer](#disclaimer).

## Features

- Randomized sets of 10 to 150 questions, filterable by source and by domain
- **Practice mode** (answer and explanation after each question) or **exam mode**
  (results at the end, optional timer at the official pace of 1 min 36 s per question)
- Smart selection: unseen first, mistakes only, weak spots
- Multiple-answer questions, optional answer shuffling, bookmarks
- Per-domain results, detailed review, one-click "retry my mistakes"
- Progress and in-progress session saved in the browser
- Import your own question banks (simple JSON format) — they stay on your machine
- Keyboard shortcuts, light / dark theme, mobile friendly

## Getting started

Online: _(GitHub Pages link once published)_

Locally:

```sh
git clone <repository-url>
cd <repository>/quiz
python -m http.server 8000      # or start.bat (Windows) / ./start.sh
```

then open <http://localhost:8000/>. A local server is required because browsers block
reading JSON files when a page is opened directly from disk.

## Layout

```
quiz/                     the app (plain HTML/CSS/JS, no dependencies, no build step)
  index.html  css/  js/app.js
  data/                   question banks (JSON) — format: data/FORMAT.md
parser/                   one-off PDF -> JSON conversion tool
scripts/validate_data.py  question bank validator (run in CI on every pull request)
```

## Adding questions

The format is documented in [`quiz/data/FORMAT.md`](quiz/data/FORMAT.md). Three options:

- **Just for you**: the "Import a JSON file" button in the app, or a file listed in
  `quiz/data/index.local.json` (ignored by git).
- **For everyone**: add your questions to `quiz/data/community.json` and open a pull
  request — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

- **Code** (app, parser, scripts): [MIT](LICENSE)
- **Question banks** published in `quiz/data/`: [CC BY-SA 4.0](quiz/data/LICENSE)

## Disclaimer

- This is an **independent** project. It is not affiliated with, endorsed by or sponsored
  by ISACA. CISA® and ISACA® are registered trademarks of ISACA, mentioned only to
  describe what this tool is for.
- This repository **does not contain or distribute** official exam questions or "dumps".
  Published questions are written by contributors.
- Questions and explanations may contain mistakes. They are no substitute for official
  study resources, and passing the exam is in no way guaranteed.
- The software is provided "as is", without warranty of any kind (see the MIT license).
- If you believe any content in this repository infringes your rights, please open an
  issue and it will be removed promptly.
