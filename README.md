# CBTGen — Computer-Based Test Generator

CBTGen is a React-based computer-based testing application and question-paper processing project. It includes exam simulation, question-paper management, content validation, CBTGen XML/package utilities, automated tests, and a Python document-processing service.

> **Development status:** CBTGen is under development. Automated tests cover substantial functionality, but the document-processing service is not yet a complete, production-ready universal conversion pipeline.

## Features

- Exam configuration, instructions, navigation, timers, submission, scoring, and analysis.
- Question types including MCQ, MSQ, NAT, match, and assertion-reason.
- Question-paper import, content normalization, validation, extraction review, and visual assets.
- Question fingerprinting, paper lifecycle checks, ownership isolation, and reattempt rules.
- CBTGen XML/package utilities and asset handling.
- Python document extraction, segmentation, and crop-proposal components.

Feature completeness varies. Consult the implementation, tests, and documentation before relying on a feature in production.

## Technology stack

- React, JavaScript, JSX, and Vite
- Node.js, npm, and ESLint
- Python and FastAPI for document processing

## Requirements

- Node.js and npm compatible with the installed Vite version
- Python 3.12 for the documented Python test environment
- Tesseract OCR for OCR-dependent workflows

Check installed tools:

```bash
node --version
npm --version
python3 --version
tesseract --version
```

## Run the frontend locally

From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Build and lint:

```bash
npm run build
npm run lint
```

Preview a production build:

```bash
npm run build
npm run preview
```

Check `apps/web/vite.config.js` for the document-processing proxy configuration.

## Local mock account

A dedicated mock student account is available for local testing of the no-pack student path:

| Field | Value |
|---|---|
| Email | `demo.tester@cbtgen.local` |
| Password | `testdemo123` |
| Pack | None |
| Developer/unlimited flag | None |

This is a local development account, not a production identity. Mock authentication is not secure server-side authentication. Browser-local data is not automatically shared between browsers or devices.

Other development accounts and their behavior are maintained in `apps/web/src/lib/api/cbtgenApi.js`. Review that file before changing account initialization or local data.

## Python document-processing service

The service is located at `packages/document_processing/`.

Create and activate its virtual environment:

```bash
python3 -m venv packages/document_processing/.venv
source packages/document_processing/.venv/bin/activate
python -m pip install -r packages/document_processing/requirements.txt
python -m pip install -r apps/api/requirements-api.txt
```

The API entry point is `apps/api/api.py`. From the repository root, start it with `uvicorn apps.api.api:app --host 127.0.0.1 --port 8000` after installing both requirements files. Keep it bound to loopback for local development, and review `packages/document_processing/README.md` for processing limitations and OCR prerequisites.

The service is not yet a complete end-to-end conversion pipeline for every source format. Review its README for current capabilities and limitations. Do not expose a development server publicly.

## Tests and quality checks

Run frontend checks:

```bash
npm run lint
npm run build
```

Examples of integration tests defined in `package.json`:

```bash
npm run test:isolation
npm run test:fingerprint
npm run test:question-types
npm run test:practice-authorization
npm run test:pause-resume
npm run test:qp-lifecycle
npm run test:qp-removal
npm run test:extraction-manifest
npm run test:document-processing-client
npm run test:finalization-gate
```

List available scripts:

```bash
npm run
```

Run Python tests using the project virtual environment:

```bash
packages/document_processing/.venv/bin/python -m unittest discover -s tests/python -v
```

Install Python dependencies first. A passing test suite does not by itself prove production security or perfect extraction fidelity.

## CBTGen XML and packages

- `docs/xml/` contains XML schema, semantic-validation, and conversion-prompt documentation.
- `docs/cbtgen-xml/` contains XML examples and fixtures.
- `apps/web/src/lib/cbtgen/` contains content models, normalization, validation, fingerprinting, and package utilities.
- `tests/` contains automated regression and integration checks.

Preserve source content faithfully and flag uncertain extraction results for review rather than silently inventing missing information. Distribute source papers and extracted assets only when you have the necessary rights or permission.

## Project structure

The repository is organized by application, API, reusable processing
code, tests, documentation, and development scripts.

```text
CBTGen/
├── apps/
│   ├── web/                    # React frontend and Vite configuration
│   └── api/                    # FastAPI entry point and API requirements
├── packages/
│   └── document_processing/    # PDF/DOCX extraction, OCR and crop engine
├── tests/                      # Browser, integration and Python tests
├── docs/                       # Product, architecture and project notes
├── scripts/                    # Maintenance and test utilities
├── package.json                # Frontend commands and test orchestration
├── package-lock.json
├── eslint.config.js
└── README.md
```

Keep historical notes, backups, generated assets, and local processing data
intact during restructuring. Review their purpose and Git tracking status
before deciding whether to archive or publish them.


## Security and data handling

Before deploying or publishing additional files:

- Replace mock authentication with a properly implemented server-side authentication and authorization system.
- Protect user data with server-side ownership checks.
- Never commit real secrets, private tokens, production credentials, or private user records.
- Review upload validation, file-size limits, path containment, and generated output handling.
- Keep virtual environments, build output, private handoff material, local processing outputs, and unreviewed exam packages out of public Git history.
- Verify redistribution rights for question papers, diagrams, and extracted assets.
- Treat OCR and extraction results as untrusted until validated.

Ignoring a file in `.gitignore` does not remove it from Git if it was already tracked. Review the Git index before publishing.

## Current limitations

Do not assume every PDF, scan, photograph, DOCX, or other input converts perfectly. Question boundaries, diagrams, crops, and answer associations may require human review. The optional API is not ready for unrestricted public deployment, and browser-local mock data does not provide secure multi-device persistence.
