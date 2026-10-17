import assert from 'node:assert/strict'
import fs from 'node:fs'

const prompt = fs.readFileSync('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', 'utf8')

{
  assert.match(prompt, /A rendered page is NOT a question asset\./)
  assert.match(prompt, /Never do:\n\nQ1 -> page-01\nQ2 -> page-01\nQ3 -> page-01/s)
  assert.match(prompt, /source-page.*fallback/s)
  assert.match(prompt, /Only the exact visual belonging to the question may be referenced/i)
  assert.match(prompt, /Every visual asset MUST be cropped to the tightest complete semantic boundary/i)
  assert.match(prompt, /REJECT the crop and recrop/i)
  assert.match(prompt, /Use structured <math> content whenever reliable structure can be recovered/i)
  assert.match(prompt, /TIGHT image crop containing ONLY the exact mathematical expression/i)
  assert.match(prompt, /ASSET OWNERSHIP MAP/i)
}

console.log('Strict cut-to-cut conversion contract passed.')
console.log('  Page images cannot substitute for question assets; exact semantic ownership, crop bounds, and structured math are mandatory.')
