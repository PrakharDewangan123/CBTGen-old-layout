import assert from 'node:assert/strict'
import fs from 'node:fs'

const prompt = fs.readFileSync('docs/xml/CBTGen-AI-Conversion-Prompt-v1.0.md', 'utf8')
const validator = fs.readFileSync('apps/web/src/lib/cbtgen/semanticValidator.js', 'utf8')

assert.match(prompt, /21A\. MACHINE-CHECKABLE VISUAL OWNERSHIP GATE — HARD REQUIREMENT/)
assert.match(prompt, /One normal visual asset MUST have exactly one semantic owner/)
assert.match(prompt, /The declared asset scope MUST match the XML reference context/)
assert.match(prompt, /An option-owned asset MUST NOT be attached at question level/)
assert.match(prompt, /A question-owned asset MUST NOT be attached to an option/)
assert.match(prompt, /If the same asset appears to serve two semantic owners, STOP conversion/)
assert.match(prompt, /owner exists;/)
assert.match(prompt, /crop contains no neighboring semantic content/)

assert.match(validator, /function collectVisualAssetUsages\(questions\)/)
assert.match(validator, /function validateVisualAssetOwnership\(/)
assert.match(validator, /VISUAL_ASSET_MULTIPLE_QUESTION_OWNERS/)
assert.match(validator, /VISUAL_ASSET_MULTIPLE_SEMANTIC_OWNERS/)
assert.match(validator, /VISUAL_ASSET_SCOPE_CONTEXT_MISMATCH/)
assert.match(validator, /SOURCE_PAGE_ASSET_NORMAL_REFERENCE/)
assert.match(validator, /VISUAL_ASSET_SCOPE_MISSING/)
assert.match(validator, /validateVisualAssetOwnership\(/)

console.log('Visual asset ownership gate contract passed.')
console.log('  Normal visual assets must have one semantic owner and a scope matching their XML attachment context.')
console.log('  Pixel-level contamination remains a source/render preflight responsibility; the validator does not guess from binary pixels.')
