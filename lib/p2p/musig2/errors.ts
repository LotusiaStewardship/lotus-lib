/**
 * Copyright 2025 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */

/**
 * MuSig2 P2P Error Classes
 *
 * Custom error types for distinguishing between different failure modes
 */

/**
 * Base class for all MuSig2 P2P errors
 */
export class MuSig2P2PError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MuSig2P2PError'
  }
}

/**
 * Deserialization errors - indicates malformed data from peer
 * These should trigger peer reputation penalties
 */
export class DeserializationError extends MuSig2P2PError {
  constructor(
    message: string,
    public readonly fieldName: string,
    public readonly receivedValue?: unknown,
  ) {
    super(`Deserialization failed for ${fieldName}: ${message}`)
    this.name = 'DeserializationError'
  }
}

/**
 * Validation errors - indicates data that's well-formed but invalid
 * These should also trigger peer reputation penalties
 */
export class ValidationError extends MuSig2P2PError {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(`Validation failed: ${message}`)
    this.name = 'ValidationError'
  }
}

/**
 * Protocol errors - indicates incorrect protocol usage
 */
export class ProtocolError extends MuSig2P2PError {
  constructor(message: string) {
    super(message)
    this.name = 'ProtocolError'
  }
}
