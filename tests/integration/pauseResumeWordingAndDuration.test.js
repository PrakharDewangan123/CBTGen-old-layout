import fs from 'node:fs'
import assert from 'node:assert/strict'

const resumePage = fs.readFileSync('src/features/questionPapers/pages/QuestionPapers.jsx', 'utf8')
const examPage = fs.readFileSync('src/features/exam/pages/Examination.jsx', 'utf8')
const importService = fs.readFileSync('src/features/questionPapers/services/questionPaperImportService.js', 'utf8')
const api = fs.readFileSync('src/lib/api/cbtgenApi.js', 'utf8')

assert.match(resumePage, /pause opportunities/)
assert.doesNotMatch(resumePage, /of 5 resumes/)
assert.match(examPage, /One resume is available for this paused attempt/)
assert.match(examPage, /does not consume another pause opportunity/)
assert.match(examPage, /pause opportunities for this attempt/)
assert.match(importService, /durationMinutes.*> 0/s)
assert.match(importService, /: null,/)
assert.match(api, /questionPaper\.duration \?\? existing\.duration \?\? null/)
assert.match(api, /duration: questionPaper\.duration \?\? null/)

console.log('Pause/resume wording and unknown-duration contract test passed.')
