import assert from 'node:assert/strict'
import { buildCbtgenPackage } from '../../apps/web/src/lib/cbtgen/packageBuilder.js'

const xml = '<cbtgen version="1.0"><assets><asset id="diagram-1" src="assets/diagram-1.png" mimeType="image/png"/></assets><question assetRef="diagram-1">What is shown?</question></cbtgen>'
const blob = await buildCbtgenPackage({ xmlText: xml, assets: [{ id: 'diagram-1', packagePath: 'assets/diagram-1.png', bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]) }] })
const bytes = new Uint8Array(await blob.arrayBuffer())
assert.equal(blob.type, 'application/zip')
assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'ZIP local file header signature')
assert.ok(new TextDecoder().decode(bytes).includes('paper.xml'))
assert.ok(new TextDecoder().decode(bytes).includes('assets/diagram-1.png'))
assert.ok(new TextDecoder().decode(bytes).includes('diagram-1'))
await assert.rejects(buildCbtgenPackage({ xmlText: xml, assets: [{ id: 'diagram-1', packagePath: '../diagram.png', bytes: new Uint8Array([1]) }] }), /Unsafe CBTGen package path/)
await assert.rejects(buildCbtgenPackage({ xmlText: xml, assets: [] }), /missing binary content/)
await assert.rejects(buildCbtgenPackage({ xmlText: xml.replace('diagram-1', 'missing-id'), assets: [{ id: 'missing-id', packagePath: 'assets/diagram-1.png', bytes: new Uint8Array([1]) }] }), /path does not match|not declared|missing package asset/)
console.log('✓ Phase 11 package generation contract passed (ZIP structure, asset manifest, missing assets, unsafe paths).')
