import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const component = await readFile(new URL('../../apps/web/src/features/questionPapers/components/ImportQuestionPaper.jsx', import.meta.url), 'utf8')
const apiClient = await readFile(new URL('../../apps/web/src/features/questionPapers/services/documentProcessingApi.js', import.meta.url), 'utf8')
const viteConfig = await readFile(new URL('../../apps/web/vite.config.js', import.meta.url), 'utf8')

assert.match(component, /extractSourceDocument\(file/)
assert.match(component, /Extract document/)
assert.match(component, /report\.pages/)
assert.match(component, /report\?\.elements/)
assert.match(component, /isDocx \? "Not paginated" : pageCount/)
assert.match(component, /human-review panel are available/i)
assert.match(component, /final CBTGen package generation, final validation/i)
assert.match(component, /not yet a saved question paper/i)
assert.match(component, /pdf\|docx/)
assert.match(apiClient, /credentials:\s*'include'/)
assert.match(apiClient, /10_000_000/)
assert.match(component, /10 MB upload limit/)
assert.doesNotMatch(apiClient, /ownerId\s*:/)
assert.match(viteConfig, /\/api\/document-processing/)
assert.match(viteConfig, /127\.0\.0\.1:8000/)
console.log('Source-first processing flow contract: 9 assertions passed')
