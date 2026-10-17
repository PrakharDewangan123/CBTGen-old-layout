import fs from 'node:fs'

const examination = fs.readFileSync('apps/web/src/features/exam/pages/Examination.jsx', 'utf8')
const css = fs.readFileSync('apps/web/src/features/exam/styles/Examination.css', 'utf8')

if (examination.includes('className="pause-counter"')) {
  throw new Error('Pause counter must not be rendered in the examination header.')
}
if (examination.includes('Pauses left: {pauseState.pausesRemaining}')) {
  throw new Error('Pause remaining count must not be rendered in the examination header.')
}
if (css.includes('.pause-counter')) {
  throw new Error('Pause counter CSS should be removed when the header counter is removed.')
}
if (!examination.includes('className="header-pause"')) {
  throw new Error('Pause Exam button must remain in the examination header.')
}

console.log('Pause header visibility contract test passed.')
