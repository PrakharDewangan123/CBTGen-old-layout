import { decodePaperContent } from './storage/losslessRecordCompression.js'

/** Decode a stored paper for review/exam use while enforcing the caller's owner scope. */
export async function loadOwnedPaperContent(record, authenticatedOwnerId) {
  const ownerId = String(authenticatedOwnerId || '').trim()
  if (!ownerId) throw new Error('An authenticated owner is required to load a paper.')
  if (!record || String(record.userId || '') !== ownerId) {
    throw new Error('The requested paper is not available to this user.')
  }
  const decoded = await decodePaperContent(record)
  if (String(decoded.userId || '') !== ownerId) throw new Error('Paper ownership changed during content loading.')
  if (typeof decoded.xmlText !== 'string' || !decoded.xmlText.trim() || !decoded.paper || typeof decoded.paper !== 'object') {
    throw new Error('The paper is not ready for review or examination.')
  }
  return decoded
}
