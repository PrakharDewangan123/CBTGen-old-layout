import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = readFileSync(
  new URL('../../src/features/questionPapers/services/documentProcessingApi.js', import.meta.url),
  'utf8',
)
const existingRegression = readFileSync(
  new URL('./documentProcessingApiClient.test.js', import.meta.url),
  'utf8',
)

const cropStart = client.indexOf('export async function cropPdfRegion(')
assert.notEqual(cropStart, -1, 'cropPdfRegion() must be exported')
const cropSource = client.slice(cropStart)

// Input validation.
assert.match(cropSource, /file instanceof File/, 'requires a File input')
assert.match(cropSource, /toLowerCase\(\) !== 'pdf'/, 'accepts PDF sources only')
assert.match(cropSource, /file\.size > 10_000_000/, 'enforces the 10 MB limit')
assert.match(cropSource, /sourceSha256[\s\S]*?64/, 'validates SHA-256 fingerprint shape')
assert.match(cropSource, /Number\.isInteger\(pageNumber\)/, 'requires an integer page number')
assert.match(cropSource, /validBounds\(regionBounds\)/, 'validates region bounds')
assert.match(cropSource, /validBounds\(contentBounds\)/, 'validates optional content bounds')
assert.match(cropSource, /question-content', 'option-content/, 'restricts crop roles')
assert.match(cropSource, /paddingPoints < 0 \|\| paddingPoints > 36/, 'bounds crop padding')
assert.match(cropSource, /dpi < 72 \|\| dpi > 300/, 'bounds crop resolution')

// Request and authentication boundary.
assert.match(cropSource, /body\.append\('file', file, file\.name\)/, 'sends the original PDF')
assert.match(cropSource, /body\.append\('source_sha256'/, 'sends the source fingerprint')
assert.match(cropSource, /body\.append\('page_number'/, 'sends the page number')
assert.match(cropSource, /body\.append\('region_bounds'/, 'sends crop bounds')
assert.match(cropSource, /body\.append\('role'/, 'sends the crop role')
assert.match(cropSource, /credentials:\s*'include'/, 'includes session credentials')
assert.doesNotMatch(cropSource, /body\.append\(['"]ownerId['"]/, 'must not send owner identity')
assert.match(cropSource, /\/v1\/crops/, 'calls the crop endpoint')
assert.match(cropSource, /response\.status === 401/, 'handles unauthorized requests')
assert.match(cropSource, /response\.ok/, 'checks HTTP success')
assert.match(cropSource, /response\.json\(\)\.catch\(\(\) => \(\{\}\)\)/, 'handles malformed JSON')

// Result validation and human-review requirement.
assert.match(cropSource, /data:image\/png;base64,/, 'requires a PNG data URL')
assert.match(cropSource, /typeof payload\.assetId !== 'string'/, 'rejects responses without a string asset ID')
assert.match(cropSource, /payload\.reviewStatus !== 'needs-review'/, 'requires human review')
assert.match(cropSource, /invalid or incomplete crop report/, 'rejects incomplete responses')

// Existing extraction/auth contract remains present.
assert.match(client, /export async function extractSourceDocument\(/, 'existing extraction helper remains present')
assert.match(client, /credentials:\s*'include'/, 'existing extraction helper retains credentials')
assert.match(existingRegression, /get_authenticated_owner/, 'existing regression still checks backend auth')

console.log('PASS document processing crop client source-contract tests')
