/**
 * P2P Utilities
 */

import { peerIdFromString, peerIdFromPrivateKey } from '@libp2p/peer-id'
import { generateKeyPair } from '@libp2p/crypto/keys'
import type { PeerId } from '@libp2p/interface-peer-id'
import { PrivateKey } from '../bitcore/privatekey.js'

/**
 * Create libp2p PeerId from Lotus PrivateKey
 *
 * Note: This creates a random PeerId for now.
 * In production, you may want deterministic PeerId generation from private key
 */
export async function createPeerIdFromPrivateKey(privateKey: PrivateKey) {
  // For now, create random Ed25519 PeerId
  // TODO: Implement deterministic derivation from private key if needed
  const keyPair = await generateKeyPair('Ed25519')
  return peerIdFromPrivateKey(keyPair)
}

/**
 * Create random PeerId
 */
export async function createRandomPeerId() {
  const keyPair = await generateKeyPair('Ed25519')
  return peerIdFromPrivateKey(keyPair)
}

/**
 * Parse PeerId from string
 */
export function parsePeerId(peerIdStr: string) {
  return peerIdFromString(peerIdStr)
}

/**
 * Serialize PeerId to string
 */
export function serializePeerId(peerId: PeerId): string {
  return peerId.toString()
}

/**
 * Convert multiaddr string to array
 */
export function parseMultiaddrs(addrs: string | string[]): string[] {
  if (typeof addrs === 'string') {
    return [addrs]
  }
  return addrs
}

/**
 * Wait for an event to fire on an EventEmitter
 * Useful for async coordination in protocols
 */
export function waitForEvent<T = unknown>(
  emitter: { once: (event: string, listener: (data: T) => void) => void },
  event: string,
  timeoutMs: number = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`))
    }, timeoutMs)

    emitter.once(event, (data: T) => {
      clearTimeout(timeout)
      resolve(data)
    })
  })
}
