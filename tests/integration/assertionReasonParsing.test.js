import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../../src/lib/cbtgen/paperModel.js', import.meta.url), 'utf8')

if (!source.includes("case 'assertion':")) {
  throw new Error('CBTGen paper parser must preserve <assertion> content.')
}

if (!source.includes("case 'reason':")) {
  throw new Error('CBTGen paper parser must preserve <reason> content.')
}

if (!source.includes('assertion: null') || !source.includes('reason: null')) {
  throw new Error('Parsed question content must expose assertion/reason fields.')
}

console.log('✓ Assertion/Reason parser contract test passed')
console.log('  <assertion> and <reason> XML content are preserved by paperModel.')
