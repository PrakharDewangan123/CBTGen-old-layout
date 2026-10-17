import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const client = readFileSync(new URL('../../src/features/questionPapers/services/documentProcessingApi.js', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../services/document_processing/api.py', import.meta.url), 'utf8')
assert.match(client, /credentials:\s*'include'/)
assert.match(client, /10_000_000/)
assert.match(client, /body\.append\('file', file, file\.name\)/)
assert.doesNotMatch(client, /ownerId\s*:/)
assert.match(api, /def get_authenticated_owner\(/)
assert.match(api, /raise HTTPException\(status_code=401/)
assert.match(api, /MAX_SOURCE_BYTES \+ 1/)
assert.match(api, /10 MB upload limit/)
assert.match(api, /Depends\(get_authenticated_owner\)/)
console.log('PASS document processing API client/auth-boundary contract')
