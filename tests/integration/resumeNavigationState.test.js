import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const viewModel = fs.readFileSync(path.join(root, 'apps/web/src/features/exam/hooks/useExamViewModel.js'), 'utf8')
const examination = fs.readFileSync(path.join(root, 'apps/web/src/features/exam/pages/Examination.jsx'), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  viewModel.includes(
    "const currentSectionId = current ? getSectionIdForQuestion(current) : ''",
  ) && viewModel.includes(
    'const effectiveActiveSection = currentSectionId || activeSection',
  ),
  'View model must derive the visible section from the restored current question.',
)
assert(
  examination.includes('curIndex,') && examination.includes('visited: [...visited]'),
  'Examination runtime must persist the current question index and visited state for resume.',
)
assert(
  examination.includes('setCurIndex(restoredIndex)'),
  'Examination must restore the saved question index when resuming.',
)

console.log('Resume navigation state contract test passed.')
