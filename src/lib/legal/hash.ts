import { createHash } from 'crypto';

/**
 * Computes a SHA-256 hash of a PDF buffer.
 *
 * DETERMINISTIC: Same input always produces same output.
 * Used for tamper-evident legal documents in arbitration.
 *
 * The hash is:
 * - Stored in `legal_documents.sha256_hash`
 * - Printed in the PDF footer (monospace, small)
 * - Verifiable via public endpoint: GET /api/legal/verify?hash=[hash]
 */
export function computeHash(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validates that a string looks like a valid SHA-256 hash.
 * Does NOT verify against the database — use verifyHash() for that.
 */
export function isValidHashFormat(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}
