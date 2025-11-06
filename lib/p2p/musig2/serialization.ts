/**
 * Copyright 2025 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */

/**
 * MuSig2 P2P Serialization Utilities
 *
 * Converts MuSig2 objects (Point, BN, PublicKey) to/from network-safe formats
 */

import { Point } from '../../bitcore/crypto/point.js'
import { BN } from '../../bitcore/crypto/bn.js'
import { PublicKey } from '../../bitcore/publickey.js'
import { DeserializationError } from './errors.js'

/**
 * Serialize a Point to compressed format (hex string)
 */
export function serializePoint(point: Point): string {
  const compressed = Point.pointToCompressed(point)
  return compressed.toString('hex')
}

/**
 * Deserialize a compressed Point from hex string
 * @throws {DeserializationError} If the input is malformed
 */
export function deserializePoint(hex: string): Point {
  try {
    // Validate hex string format
    if (typeof hex !== 'string') {
      throw new DeserializationError(
        'Input must be a string',
        'point',
        typeof hex,
      )
    }

    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new DeserializationError(
        'Invalid hex string format',
        'point',
        hex.substring(0, 20),
      )
    }

    const buffer = Buffer.from(hex, 'hex')
    if (buffer.length !== 33) {
      throw new DeserializationError(
        `Expected 33 bytes, got ${buffer.length}`,
        'point',
        buffer.length,
      )
    }

    const prefix = buffer[0]
    if (prefix !== 0x02 && prefix !== 0x03) {
      throw new DeserializationError(
        `Invalid prefix: expected 0x02 or 0x03, got 0x${prefix.toString(16)}`,
        'point',
        prefix,
      )
    }

    const odd = prefix === 0x03
    const x = new BN(buffer.slice(1), 'be')
    return Point.fromX(odd, x)
  } catch (error) {
    if (error instanceof DeserializationError) {
      throw error
    }
    // Wrap unexpected errors
    throw new DeserializationError(
      error instanceof Error ? error.message : String(error),
      'point',
      hex?.substring(0, 20),
    )
  }
}

/**
 * Serialize a public nonce [Point, Point] to compressed format
 */
export function serializePublicNonce(nonce: [Point, Point]): {
  R1: string
  R2: string
} {
  return {
    R1: serializePoint(nonce[0]),
    R2: serializePoint(nonce[1]),
  }
}

/**
 * Deserialize a public nonce from compressed format
 * @throws {DeserializationError} If the input is malformed
 */
export function deserializePublicNonce(data: {
  R1: string
  R2: string
}): [Point, Point] {
  try {
    // Validate input structure
    if (!data || typeof data !== 'object') {
      throw new DeserializationError(
        'Input must be an object',
        'publicNonce',
        typeof data,
      )
    }

    if (!data.R1 || !data.R2) {
      throw new DeserializationError('Missing R1 or R2 field', 'publicNonce', {
        hasR1: !!data.R1,
        hasR2: !!data.R2,
      })
    }

    return [deserializePoint(data.R1), deserializePoint(data.R2)]
  } catch (error) {
    if (error instanceof DeserializationError) {
      throw error
    }
    // Wrap unexpected errors
    throw new DeserializationError(
      error instanceof Error ? error.message : String(error),
      'publicNonce',
    )
  }
}

/**
 * Serialize a BN to hex string (32 bytes, big-endian)
 */
export function serializeBN(bn: BN): string {
  return bn.toBuffer({ endian: 'big', size: 32 }).toString('hex')
}

/**
 * Deserialize a BN from hex string
 * @throws {DeserializationError} If the input is malformed
 */
export function deserializeBN(hex: string): BN {
  try {
    // Validate hex string format
    if (typeof hex !== 'string') {
      throw new DeserializationError('Input must be a string', 'bn', typeof hex)
    }

    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new DeserializationError(
        'Invalid hex string format',
        'bn',
        hex.substring(0, 20),
      )
    }

    const buffer = Buffer.from(hex, 'hex')
    return new BN(buffer, 'be')
  } catch (error) {
    if (error instanceof DeserializationError) {
      throw error
    }
    // Wrap unexpected errors
    throw new DeserializationError(
      error instanceof Error ? error.message : String(error),
      'bn',
      hex?.substring(0, 20),
    )
  }
}

/**
 * Serialize a PublicKey to compressed format (hex string)
 */
export function serializePublicKey(publicKey: PublicKey): string {
  return publicKey.toBuffer().toString('hex')
}

/**
 * Deserialize a PublicKey from compressed format
 * @throws {DeserializationError} If the input is malformed
 */
export function deserializePublicKey(hex: string): PublicKey {
  try {
    // Validate hex string format
    if (typeof hex !== 'string') {
      throw new DeserializationError(
        'Input must be a string',
        'publicKey',
        typeof hex,
      )
    }

    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new DeserializationError(
        'Invalid hex string format',
        'publicKey',
        hex.substring(0, 20),
      )
    }

    const buffer = Buffer.from(hex, 'hex')

    // PublicKey should be 33 bytes (compressed) or 65 bytes (uncompressed)
    if (buffer.length !== 33 && buffer.length !== 65) {
      throw new DeserializationError(
        `Invalid public key length: expected 33 or 65 bytes, got ${buffer.length}`,
        'publicKey',
        buffer.length,
      )
    }

    return new PublicKey(buffer)
  } catch (error) {
    if (error instanceof DeserializationError) {
      throw error
    }
    // Wrap unexpected errors (e.g., from PublicKey constructor)
    throw new DeserializationError(
      error instanceof Error ? error.message : String(error),
      'publicKey',
      hex?.substring(0, 20),
    )
  }
}

/**
 * Serialize a message Buffer to hex string
 */
export function serializeMessage(message: Buffer): string {
  return message.toString('hex')
}

/**
 * Deserialize a message from hex string
 * @throws {DeserializationError} If the input is malformed
 */
export function deserializeMessage(hex: string): Buffer {
  try {
    // Validate hex string format
    if (typeof hex !== 'string') {
      throw new DeserializationError(
        'Input must be a string',
        'message',
        typeof hex,
      )
    }

    if (!/^[0-9a-fA-F]*$/.test(hex)) {
      throw new DeserializationError(
        'Invalid hex string format',
        'message',
        hex.substring(0, 20),
      )
    }

    return Buffer.from(hex, 'hex')
  } catch (error) {
    if (error instanceof DeserializationError) {
      throw error
    }
    // Wrap unexpected errors
    throw new DeserializationError(
      error instanceof Error ? error.message : String(error),
      'message',
      hex?.substring(0, 20),
    )
  }
}
