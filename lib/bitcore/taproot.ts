/**
 * Copyright 2025 The Lotusia Stewardship
 * Github: https://github.com/LotusiaStewardship
 * License: MIT
 */
/**
 * Taproot Implementation for Lotus
 *
 * Implements Pay-To-Taproot (P2TR) support based on lotusd implementation.
 *
 * Key Differences from BIP341:
 * - Uses 33-byte compressed public keys (not x-only 32-byte)
 * - Internal key parity encoded in control block first bit
 * - Requires SIGHASH_LOTUS for key path spending
 * - Requires Schnorr signatures for key path spending
 *
 * Script Format:
 * - Without state: OP_SCRIPTTYPE OP_1 <33-byte commitment>
 * - With state: OP_SCRIPTTYPE OP_1 <33-byte commitment> <32-byte state>
 *
 * Reference: lotusd/src/script/taproot.cpp
 *
 * @module Taproot
 */

import { Hash } from './crypto/hash.js'
import { PublicKey } from './publickey.js'
import { PrivateKey } from './privatekey.js'
import { Script } from './script.js'
import { Opcode } from './opcode.js'
import { BN } from './crypto/bn.js'
import { BufferWriter } from './encoding/bufferwriter.js'
import { Signature } from './crypto/signature.js'

/**
 * Taproot Leaf Node
 *
 * Represents a leaf node in the Taproot script tree, holding a script and an optional leaf version.
 *
 * @property script - The script for this leaf node. Can be a Script object or a Buffer.
 * @property [leafVersion] - Optional leaf version byte (defaults to 0xc0 for tapscript if not provided).
 */
export interface TapLeafNode {
  /** Script for this leaf (Script object or Buffer) */
  script: Script | Buffer
  /** Optional leaf version (defaults to 0xc0 for tapscript) */
  leafVersion?: number
}

/**
 * Taproot Script Tree Branch Node
 *
 * Represents a branch node in the Taproot Merkle tree, consisting of two children.
 * Each child can itself be either a leaf node ({@link TapLeafNode}) or another branch node.
 *
 * @example
 * // Branch node combining two leaves
 * const branch: TapBranchNode = {
 *   left: { script: script1 },
 *   right: { script: script2 }
 * }
 *
 * // Branch node combining a branch and a leaf
 * const nestedBranch: TapBranchNode = {
 *   left: {
 *     left: { script: script1 },
 *     right: { script: script2 }
 *   },
 *   right: { script: script3 }
 * }
 */
export interface TapBranchNode {
  /** Left child node (can be leaf or branch) */
  left: TapNode
  /** Right child node (can be leaf or branch) */
  right: TapNode
}

/**
 * Union type for Taproot script tree nodes
 *
 * Can be either a leaf node ({@link TapLeafNode}) or a branch node ({@link TapBranchNode})
 */
export type TapNode = TapLeafNode | TapBranchNode

/**
 * Individual leaf in the Taproot tree with its Merkle path
 */
export interface TapLeaf {
  script: Script
  leafVersion: number
  leafHash: Buffer
  merklePath: Buffer[]
}

/**
 * Result of building a Taproot tree
 */
export interface TapTreeBuildResult {
  /** Merkle root of the tree */
  merkleRoot: Buffer
  /** Array of leaf scripts with their merkle paths */
  leaves: TapLeaf[]
}

// Taproot Constants
export const TAPROOT_LEAF_MASK = 0xfe
export const TAPROOT_LEAF_TAPSCRIPT = 0xc0
export const TAPROOT_CONTROL_BASE_SIZE = 33
export const TAPROOT_CONTROL_NODE_SIZE = 32
export const TAPROOT_CONTROL_MAX_NODE_COUNT = 128
export const TAPROOT_CONTROL_MAX_SIZE =
  TAPROOT_CONTROL_BASE_SIZE +
  TAPROOT_CONTROL_NODE_SIZE * TAPROOT_CONTROL_MAX_NODE_COUNT

export const TAPROOT_SCRIPTTYPE = Opcode.OP_1
export const TAPROOT_INTRO_SIZE = 3 // OP_SCRIPTTYPE + OP_1 + push length
export const TAPROOT_SIZE_WITHOUT_STATE = TAPROOT_INTRO_SIZE + 33 // 36 bytes
export const TAPROOT_SIZE_WITH_STATE = TAPROOT_INTRO_SIZE + 33 + 33 // 69 bytes

/** SIGHASH_ALL | SIGHASH_LOTUS */
export const TAPROOT_SIGHASH_TYPE =
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS

export const TAPROOT_ANNEX_TAG = 0x50

/**
 * Tagged hash for Taproot
 *
 * Implements BIP340-style tagged hashing:
 * tag_hash = SHA256(tag)
 * tagged_hash = SHA256(tag_hash || tag_hash || data)
 *
 * @param tag - Tag string (e.g., "TapTweak", "TapLeaf", "TapBranch")
 * @param data - Data to hash
 * @returns 32-byte hash
 */
export function taggedHash(tag: string, data: Buffer): Buffer {
  const tagHash = Hash.sha256(Buffer.from(tag, 'utf8'))
  const combined = Buffer.concat([tagHash, tagHash, data])
  return Hash.sha256(combined)
}

/**
 * Calculate TapTweak hash
 *
 * tweak = SHA256_Tag("TapTweak", internal_pubkey || merkle_root)
 *
 * @param internalPubKey - 33-byte internal public key
 * @param merkleRoot - 32-byte merkle root (or empty buffer for key-only)
 * @returns 32-byte tweak hash
 */
export function calculateTapTweak(
  internalPubKey: PublicKey,
  merkleRoot: Buffer = Buffer.alloc(32),
): Buffer {
  const pubKeyBytes = internalPubKey.toBuffer()
  const data = Buffer.concat([pubKeyBytes, merkleRoot])
  return taggedHash('TapTweak', data)
}

/**
 * Calculate TapLeaf hash
 *
 * tapleaf_hash = SHA256_Tag("TapLeaf", leaf_version || compact_size(script) || script)
 *
 * @param script - Tapscript
 * @param leafVersion - Leaf version (default: 0xc0 for tapscript)
 * @returns 32-byte tapleaf hash
 */
export function calculateTapLeaf(
  script: Script | Buffer,
  leafVersion: number = TAPROOT_LEAF_TAPSCRIPT,
): Buffer {
  const scriptBuf = Buffer.isBuffer(script) ? script : script.toBuffer()
  const writer = new BufferWriter()

  writer.writeUInt8(leafVersion)
  writer.writeVarintNum(scriptBuf.length)
  writer.write(scriptBuf)

  return taggedHash('TapLeaf', writer.toBuffer())
}

/**
 * Calculate TapBranch hash
 *
 * tapbranch_hash = SHA256_Tag("TapBranch", left || right)
 * where left and right are ordered lexicographically
 *
 * @param left - Left branch hash
 * @param right - Right branch hash
 * @returns 32-byte tapbranch hash
 */
export function calculateTapBranch(left: Buffer, right: Buffer): Buffer {
  // Order lexicographically
  const ordered =
    Buffer.compare(left, right) < 0
      ? Buffer.concat([left, right])
      : Buffer.concat([right, left])

  return taggedHash('TapBranch', ordered)
}

/**
 * Tweak a public key for Taproot
 *
 * tweaked_pubkey = internal_pubkey + tweak * G
 *
 * @param internalPubKey - Internal public key
 * @param merkleRoot - Merkle root of script tree (or empty for key-only)
 * @returns Tweaked public key
 */
export function tweakPublicKey(
  internalPubKey: PublicKey,
  merkleRoot: Buffer = Buffer.alloc(32),
): PublicKey {
  const tweak = calculateTapTweak(internalPubKey, merkleRoot)
  return internalPubKey.addScalar(tweak)
}

/**
 * Tweak a private key for Taproot
 *
 * tweaked_privkey = (internal_privkey + tweak) mod n
 *
 * @param internalPrivKey - Internal private key
 * @param merkleRoot - Merkle root of script tree (or empty for key-only)
 * @returns Tweaked private key
 */
export function tweakPrivateKey(
  internalPrivKey: PrivateKey,
  merkleRoot: Buffer = Buffer.alloc(32),
): PrivateKey {
  const internalPubKey = internalPrivKey.publicKey
  const tweak = calculateTapTweak(internalPubKey, merkleRoot)

  // Add tweak to private key (mod n)
  const tweakBN = new BN(tweak)
  const privKeyBN = internalPrivKey.bn
  const tweakedBN = privKeyBN.add(tweakBN).umod(PublicKey.getN())

  return new PrivateKey(tweakedBN)
}

/**
 * Type guard to check if a node is a leaf
 */
export function isTapLeafNode(node: TapNode): node is TapLeafNode {
  return 'script' in node
}

/**
 * Type guard to check if a node is a branch
 */
export function isTapBranchNode(node: TapNode): node is TapBranchNode {
  return 'left' in node && 'right' in node
}

/**
 * Build a Taproot script tree
 *
 * @param tree - Tree structure (leaf or branch)
 * @returns Tree build result with merkle root and paths
 */
export function buildTapTree(tree: TapNode): TapTreeBuildResult {
  // Check if this is a leaf node (has script property)
  if (isTapLeafNode(tree)) {
    // Type narrowed to TapLeafNode
    const leafNode = tree
    const leafVersion = leafNode.leafVersion || TAPROOT_LEAF_TAPSCRIPT
    const scriptBuf = Buffer.isBuffer(leafNode.script)
      ? leafNode.script
      : leafNode.script.toBuffer()
    const leafHash = calculateTapLeaf(scriptBuf, leafVersion)

    return {
      merkleRoot: leafHash,
      leaves: [
        {
          script: Script.fromBuffer(scriptBuf),
          leafVersion,
          leafHash,
          merklePath: [],
        },
      ],
    }
  }

  // Branch node (has left and right properties)
  // Type is automatically narrowed to TapBranchNode
  const leftResult = buildTapTree(tree.left)
  const rightResult = buildTapTree(tree.right)

  const branchHash = calculateTapBranch(
    leftResult.merkleRoot,
    rightResult.merkleRoot,
  )

  // Add the right merkle root to left leaves' paths
  const leftLeaves = leftResult.leaves.map(leaf => ({
    ...leaf,
    merklePath: [...leaf.merklePath, rightResult.merkleRoot],
  }))

  // Add the left merkle root to right leaves' paths
  const rightLeaves = rightResult.leaves.map(leaf => ({
    ...leaf,
    merklePath: [...leaf.merklePath, leftResult.merkleRoot],
  }))

  return {
    merkleRoot: branchHash,
    leaves: [...leftLeaves, ...rightLeaves],
  }
}

/**
 * Create a Taproot control block
 *
 * Control block format:
 * - 1 byte: leaf_version | parity_bit
 * - 32 bytes: internal public key x-coordinate + parity byte
 * - 32*n bytes: merkle path
 *
 * Note: Lotus uses 33-byte keys, encoding parity in control block first bit
 *
 * @param internalPubKey - Internal public key
 * @param leafIndex - Index of the leaf being spent
 * @param tree - Taproot tree structure
 * @returns Control block buffer
 */
export function createControlBlock(
  internalPubKey: PublicKey,
  leafIndex: number,
  tree: TapNode,
): Buffer {
  const treeResult = buildTapTree(tree)

  if (leafIndex < 0 || leafIndex >= treeResult.leaves.length) {
    throw new Error(`Invalid leaf index: ${leafIndex}`)
  }

  const leaf = treeResult.leaves[leafIndex]
  const pubKeyBytes = internalPubKey.toBuffer()

  // First byte: leaf version with parity bit
  // Parity is 1 if y-coordinate is odd (pubkey byte is 0x03), 0 if even (0x02)
  const parity = pubKeyBytes[0] === 0x03 ? 1 : 0
  const controlByte = (leaf.leafVersion & TAPROOT_LEAF_MASK) | parity

  const writer = new BufferWriter()
  writer.writeUInt8(controlByte)

  // Next 32 bytes: x-coordinate + parity byte (but we store full 33-byte key)
  // Actually, for Lotus we need to encode it specially
  // From lotusd: we encode parity in first bit, then include the full pubkey
  writer.write(pubKeyBytes)

  // Merkle path
  for (const node of leaf.merklePath) {
    writer.write(node)
  }

  return writer.toBuffer()
}

/**
 * Verify a Taproot commitment
 *
 * Verifies that the commitment pubkey equals internal_pubkey + tweak*G
 * where tweak = tagged_hash("TapTweak", internal_pubkey || merkle_root)
 *
 * @param commitmentPubKey - The commitment public key (from script)
 * @param internalPubKey - The internal public key (from control block)
 * @param merkleRoot - The merkle root
 * @returns true if commitment is valid
 */
export function verifyTaprootCommitment(
  commitmentPubKey: PublicKey,
  internalPubKey: PublicKey,
  merkleRoot: Buffer,
): boolean {
  const expectedCommitment = tweakPublicKey(internalPubKey, merkleRoot)
  return commitmentPubKey.toString() === expectedCommitment.toString()
}

/**
 * Check if a script is Pay-To-Taproot
 *
 * Valid formats:
 * - OP_SCRIPTTYPE OP_1 0x21 <33-byte commitment>
 * - OP_SCRIPTTYPE OP_1 0x21 <33-byte commitment> 0x20 <32-byte state>
 *
 * @param script - Script to check
 * @returns true if script is P2TR
 */
export function isPayToTaproot(script: Script): boolean {
  const buf = script.toBuffer()

  if (buf.length < TAPROOT_SIZE_WITHOUT_STATE) {
    return false
  }

  // Must start with OP_SCRIPTTYPE OP_1
  if (buf[0] !== Opcode.OP_SCRIPTTYPE || buf[1] !== TAPROOT_SCRIPTTYPE) {
    return false
  }

  // Next byte must be 0x21 (33 bytes push)
  if (buf[2] !== 33) {
    return false
  }

  // If exactly 36 bytes, valid without state
  if (buf.length === TAPROOT_SIZE_WITHOUT_STATE) {
    return true
  }

  // If has state, must be exactly 69 bytes with 0x20 (32 bytes) state push
  return (
    buf.length === TAPROOT_SIZE_WITH_STATE &&
    buf[TAPROOT_SIZE_WITHOUT_STATE] === 32
  )
}

/**
 * Extract the commitment public key from a Taproot script
 *
 * @param script - P2TR script
 * @returns Commitment public key
 * @throws Error if not a valid P2TR script
 */
export function extractTaprootCommitment(script: Script): PublicKey {
  if (!isPayToTaproot(script)) {
    throw new Error('Not a valid Pay-To-Taproot script')
  }

  const buf = script.toBuffer()
  const commitmentBytes = buf.subarray(3, 3 + 33)

  return PublicKey.fromBuffer(commitmentBytes)
}

/**
 * Extract the state from a Taproot script (if present)
 *
 * @param script - P2TR script
 * @returns State buffer (32 bytes) or null if no state
 */
export function extractTaprootState(script: Script): Buffer | null {
  const buf = script.toBuffer()

  if (buf.length !== TAPROOT_SIZE_WITH_STATE) {
    return null
  }

  return buf.subarray(TAPROOT_SIZE_WITHOUT_STATE + 1, TAPROOT_SIZE_WITH_STATE)
}

/**
 * Build a Pay-To-Taproot script
 *
 * @param commitment - Commitment public key (tweaked)
 * @param state - Optional 32-byte state
 * @returns P2TR script
 */
export function buildPayToTaproot(
  commitment: PublicKey,
  state?: Buffer,
): Script {
  if (state && state.length !== 32) {
    throw new Error('Taproot state must be exactly 32 bytes')
  }

  const commitmentBytes = commitment.toBuffer()

  if (commitmentBytes.length !== 33) {
    throw new Error('Commitment must be 33-byte compressed public key')
  }

  if (state) {
    return new Script()
      .add(Opcode.OP_SCRIPTTYPE)
      .add(TAPROOT_SCRIPTTYPE)
      .add(commitmentBytes)
      .add(state)
  } else {
    return new Script()
      .add(Opcode.OP_SCRIPTTYPE)
      .add(TAPROOT_SCRIPTTYPE)
      .add(commitmentBytes)
  }
}

/**
 * Build a simple key-path-only Taproot output
 *
 * @param internalPubKey - Internal public key
 * @param state - Optional 32-byte state
 * @returns P2TR script
 */
export function buildKeyPathTaproot(
  internalPubKey: PublicKey,
  state?: Buffer,
): Script {
  // For key-path only, merkle root is all zeros
  const merkleRoot = Buffer.alloc(32)
  const commitment = tweakPublicKey(internalPubKey, merkleRoot)
  return buildPayToTaproot(commitment, state)
}

/**
 * Build a script-path Taproot output
 *
 * @param internalPubKey - Internal public key
 * @param tree - Taproot script tree
 * @param state - Optional 32-byte state
 * @returns P2TR script and tree info
 */
export function buildScriptPathTaproot(
  internalPubKey: PublicKey,
  tree: TapNode,
  state?: Buffer,
): {
  script: Script
  commitment: PublicKey
  merkleRoot: Buffer
  leaves: TapLeaf[]
} {
  const treeInfo = buildTapTree(tree)
  const commitment = tweakPublicKey(internalPubKey, treeInfo.merkleRoot)
  const script = buildPayToTaproot(commitment, state)

  return {
    script,
    commitment,
    merkleRoot: treeInfo.merkleRoot,
    leaves: treeInfo.leaves,
  }
}
