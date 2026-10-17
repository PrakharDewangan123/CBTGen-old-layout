import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const score = fs.readFileSync(path.join(root, 'apps/web/src/features/exam/components/ExamUi.jsx'), 'utf8')
const examination = fs.readFileSync(path.join(root, 'apps/web/src/features/exam/pages/Examination.jsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'apps/web/src/features/exam/styles/Examination.css'), 'utf8')

assert.match(score, /export function SubmissionScreen\(\{ questionCount, qpId \}\)/)
assert.match(score, /navigate\(qpId \? `\/question-papers\/\$\{qpId\}\/score` : '\/exam-result'\)/)
assert.match(examination, /<SubmissionScreen questionCount=\{questions\.length\} qpId=\{activeSession\?\.qpId \|\| questionPaperMeta\?\.id \|\| paper\?\.id \|\| ''\} \/>/)

for (const state of ['hover', 'focus-visible', 'active', 'disabled']) {
  const re = new RegExp(`\\.header-pause:${state}[^}]*transform:translateY\\(-50%\\)`)
  assert.match(css, re, `Pause button must retain its vertical geometry on ${state}`)
}

console.log('Score QP scoping and pause-button geometry contract test passed.')
