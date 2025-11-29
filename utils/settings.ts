/**
 * Copyright 2025 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 *
 * Browser-compatible settings module.
 * In browser environments, uses defaults. In Node.js, loads from .env file.
 */
import { RNKC_MIN_DATA_LENGTH, RNKC_MIN_FEE_RATE } from '../utils/constants.js'

// Browser-compatible environment detection
const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

// Environment variables - populated from .env in Node.js, empty in browser
let parsed: Record<string, string | undefined> = {}

// Only attempt to load dotenv in Node.js environment
if (!isBrowser && typeof process !== 'undefined' && process.versions?.node) {
  try {
    // Use createRequire for ESM compatibility in Node.js
    const { createRequire } = await import('node:module')
    const require = createRequire(import.meta.url)
    const dotenv = require('dotenv')
    parsed = dotenv.config({ path: '.env' }).parsed || {}
  } catch {
    // dotenv not available or failed to load - use defaults
  }
}

export const RPC = {
  user: parsed.NODE_RPC_USER,
  password: parsed.NODE_RPC_PASS,
  address: parsed.NODE_RPC_HOST,
  port: parsed.NODE_RPC_PORT,
}

export const RNKC = {
  minFeeRate: Number(parsed.RNKC_MIN_FEE_RATE) || RNKC_MIN_FEE_RATE,
  minDataLength: Number(parsed.RNKC_MIN_DATA_LENGTH) || RNKC_MIN_DATA_LENGTH,
}

/**
 * P2P Network Configuration
 *
 * These limits apply to general P2P network connections (DHT, GossipSub, discovery).
 * MuSig2 session-specific connections are managed separately and are not counted
 * against these limits.
 *
 * Sane Defaults:
 * - maxConnections: 50 (adequate for most client nodes)
 * - minConnections: 10 (maintains network health)
 *
 * Recommended Ranges:
 * - Client nodes: 20-100 max, 5-20 min
 * - Bootstrap nodes: 100-500 max, 20-50 min
 *
 * Environment Variables:
 * - P2P_MAX_CONNECTIONS: Maximum general P2P connections (default: 50)
 * - P2P_MIN_CONNECTIONS: Minimum connections to maintain (default: 10)
 */
export const P2P = {
  /**
   * Maximum number of general P2P connections
   * This is separate from MuSig2 session-specific connections
   */
  maxConnections: Number(parsed?.P2P_MAX_CONNECTIONS) || 50,

  /**
   * Minimum number of P2P connections to maintain
   * libp2p will try to keep at least this many connections
   */
  minConnections: Number(parsed?.P2P_MIN_CONNECTIONS) || 10,
}
