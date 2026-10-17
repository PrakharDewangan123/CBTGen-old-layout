import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const packageFormat = await readFile(new URL('src/lib/cbtgen/packageFormat.js', root), 'utf8')
const importUi = await readFile(new URL('src/features/questionPapers/components/ImportQuestionPaper.jsx', root), 'utf8')

// The internal canonical package contract remains unchanged behind the UI.
assert.match(packageFormat, /new Set\(\['\.xml', '\.zip', '\.cbtgen'\]\)/)
assert.match(packageFormat, /extension === '\.cbtgen'\) return 'CBTGEN_PACKAGE'/)
assert.match(packageFormat, /format === 'XML'/)
assert.match(packageFormat, /root-level paper\.xml file/)

// User-facing import is source-first; it must not route selected documents to the old XML validator.
assert.match(importUi, /\.pdf,\.docx,application\/pdf/)
assert.match(importUi, /Extract document/)
assert.match(importUi, /extractSourceDocument\(file/)
assert.match(importUi, /does not save a paper to your library/i)
assert.doesNotMatch(importUi, /Choose CBTGen Paper|Validate Paper/)

console.log('✓ Source-first import UI and internal package contract passed')
console.log('  The user-facing picker accepts PDF/DOCX and calls the processing API client.')
console.log('  The internal canonical package contract remains available behind the UI.')
console.log('  The interface clearly states that persistence and final paper generation are not yet connected.')
