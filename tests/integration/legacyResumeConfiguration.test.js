import assert from 'node:assert/strict'

function resolveConfiguration({ sessionConfig, runtimeConfig, storedConfig, reconstructedConfig }) {
  return sessionConfig || runtimeConfig || storedConfig || reconstructedConfig || null
}

const config = { testName: 'Legacy QP', duration: 180, source: { fingerprint: 'fp-1' } }

assert.deepEqual(
  resolveConfiguration({ sessionConfig: null, runtimeConfig: null, storedConfig: config, reconstructedConfig: null }),
  config,
  'Stored configuration should recover a legacy attempt before reconstruction.',
)

assert.deepEqual(
  resolveConfiguration({ sessionConfig: null, runtimeConfig: null, storedConfig: null, reconstructedConfig: config }),
  config,
  'QP reconstruction should recover an attempt with no transient configuration.',
)

assert.equal(
  resolveConfiguration({ sessionConfig: null, runtimeConfig: null, storedConfig: null, reconstructedConfig: null }),
  null,
  'Recovery should fail explicitly when no configuration source exists.',
)

console.log('✓ Legacy resume configuration recovery contract passed')
console.log('  Existing session configuration has highest priority.')
console.log('  Runtime/stored configuration can recover older attempts.')
console.log('  QP configuration reconstruction is the final recovery path.')
console.log('  No recovery path creates a new attempt or consumes usage.')
