import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../..')
const sourcePath = path.join(projectRoot, 'src/features/questionPapers/pages/QuestionPapers.jsx')
const source = fs.readFileSync(sourcePath, 'utf8')

assert.match(source, /useRef\s*\(\s*null\s*\)/)
assert.match(source, /const\s+importSectionRef\s*=\s*useRef/)
assert.match(source, /if\s*\(!showImport\s*\|\|\s*!importSectionRef\.current\)\s*return/)
assert.match(source, /scrollIntoView\(\{[\s\S]*behavior:\s*'smooth'/)
assert.match(source, /block:\s*'start'/)
assert.match(source, /ref=\{importSectionRef\}/)
assert.match(source, /scroll-mt-24/)

console.log('Import panel auto-scroll contract test passed.')
