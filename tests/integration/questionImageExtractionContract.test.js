import fs from 'node:fs'
import assert from 'node:assert/strict'

const prompt = fs.readFileSync('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', 'utf8')

// The current master prompt expresses the same contract through the canonical
// visual-asset decision, ownership, and source-page fallback sections.
assert.match(prompt, /Create an image asset only when the source contains meaningful visual information/)
assert.match(prompt, /Every question-specific asset must have exactly one intended owner/)
assert.match(prompt, /A source-page fallback is permitted ONLY when the complete required visual genuinely cannot be segmented safely/)
assert.match(prompt, /source-page fallback MUST be rejected/)
assert.match(prompt, /Re-open the final asset pixels after recropping/)
assert.match(prompt, /The crop must contain ONLY the intended visual/)
assert.match(prompt, /reject and recrop/i)

console.log('Question-specific image extraction contract test passed.')
