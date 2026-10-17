import fs from 'node:fs'
import assert from 'node:assert/strict'

const clientPath = 'src/features/questionPapers/services/documentProcessingApi.js'
const source = fs.readFileSync(clientPath, 'utf8')

assert.match(source, /export async function cropPdfRegions\s*\(/)
assert.match(source, /\/v1\/crops\/batch/)
assert.match(source, /body\.append\('source_sha256'/)
assert.match(source, /body\.append\('crops'/)
assert.match(source, /credentials:\s*'include'/)
assert.match(source, /reviewStatus !== 'needs-review'/)
assert.match(source, /requestIndex !== index/)
assert.match(source, /imageDataUrl\.startsWith\('data:image\/png;base64,'\)/)

console.log('PASS batch crop client contract tests')
