import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const examinationPath = path.join(projectRoot, 'apps/web/src/features/exam/pages/Examination.jsx')
const source = fs.readFileSync(examinationPath, 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  !source.includes("if (questions.length && !visited.size) setVisited(new Set([questions[0].sourceQuestionId]))"),
  'The old pre-hydration initial-visit effect must not remain because runtime hydration can overwrite it.',
)

assert(
  source.includes("const restoredVisited = new Set(runtime?.visited || [])"),
  'Runtime visited state must be restored before applying the initial visit.',
)

assert(
  source.includes("const initialQuestion = questions[restoredIndex] || questions[0]"),
  'The currently restored/displayed question must be resolved generically from the restored index.',
)

assert(
  source.includes("restoredVisited.add(initialQuestion.sourceQuestionId)"),
  'The first displayed question must be marked visited after runtime hydration.',
)

assert(
  source.includes('setVisited(restoredVisited)'),
  'The corrected visited set must be committed after hydration.',
)

console.log('Initial question visit contract test passed.')
