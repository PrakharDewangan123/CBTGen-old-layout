import assert from 'node:assert/strict'
import fs from 'node:fs'

const prompt = fs.readFileSync('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', 'utf8')

assert.match(prompt, /Mathematical expressions requiring structure MUST NOT be flattened into ordinary text/)
assert.match(prompt, /Do NOT use a flat <text> representation when doing so destroys mathematical structure/)
assert.match(prompt, /VISUAL COMPLETENESS AUDIT/)
assert.match(prompt, /- diagrams/); assert.match(prompt, /- graphs/); assert.match(prompt, /- circuits/); assert.match(prompt, /- geometry/); assert.match(prompt, /- chemical structures/); assert.match(prompt, /- reactions/); assert.match(prompt, /- tables/)
assert.match(prompt, /MATCH questions require item-level semantic separation/)
assert.match(prompt, /An extracted-but-unreferenced visual means conversion is incomplete/)
assert.match(prompt, /Use structured <math> content whenever reliable structure can be recovered/)

console.log('Conversion fidelity prompt contract passed.')
console.log('  Structured mathematics, question-specific asset attachment, and MATCH visual placement are mandatory.')
