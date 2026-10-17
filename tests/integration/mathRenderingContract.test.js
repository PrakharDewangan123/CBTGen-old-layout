import assert from 'node:assert/strict'
import fs from 'node:fs'

const renderer = fs.readFileSync(
  'src/features/exam/components/ContentRenderer.jsx',
  'utf8'
)
const paperModel = fs.readFileSync(
  'src/lib/cbtgen/paperModel.js',
  'utf8'
)
const css = fs.readFileSync(
  'src/features/exam/styles/Examination.css',
  'utf8'
)
const prompt = fs.readFileSync(
  'docs/xml/CBTGen-AI-Conversion-Prompt-v1.1-CutToCut-Math.md',
  'utf8'
)

assert.match(paperModel, /case 'math':/)
assert.match(paperModel, /format:\s*child\.getAttribute\('format'\)\s*\|\|\s*'latex'/)
assert.match(renderer, /<mfrac/)
assert.match(renderer, /<msqrt/)
assert.match(renderer, /<msub/)
assert.match(renderer, /<msup/)
assert.match(renderer, /<msubsup/)
assert.match(renderer, /<mtable/)
assert.match(renderer, /env\.value === 'pmatrix'/)
assert.match(renderer, /format === 'mathml'/)
assert.match(renderer, /ensureMathJax\(/)
assert.match(renderer, /cdn\.jsdelivr\.net\/npm\/mathjax@3/)
assert.match(renderer, /question-math-source/)
assert.match(renderer, /display === 'inline'/)
assert.match(paperModel, /display: child\.getAttribute\('display'\) \|\| 'block'/)
assert.match(css, /\.question-math/)
assert.match(css, /overflow-x:auto/)
assert.match(prompt, /structured mathematics/i)
assert.match(prompt, /NEVER flatten structured mathematics/i)
assert.match(prompt, /fractions, roots, powers, subscripts, superscripts, integrals/i)
assert.match(prompt, /matrices, vectors, Greek symbols, inequalities/i)
assert.match(prompt, /format="latex" display="inline"/i)
assert.match(prompt, /actual LaTeX source/i)

console.log('Math rendering contract passed.')
console.log('  MathJax LaTeX, offline MathML fallback, inline/block display, fractions, roots, scripts, matrices and responsive layout are covered.')
