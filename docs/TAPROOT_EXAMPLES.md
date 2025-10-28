# Taproot Usage Examples for Lotus

Complete examples for using Pay-To-Taproot in lotus-lib.

---

## Basic Key Path Spending

### Create and Spend Taproot Output

```typescript
import {
  Transaction,
  PrivateKey,
  Signature,
  buildKeyPathTaproot,
} from 'lotus-lib'

// 1. Create Taproot output
const privateKey = new PrivateKey()
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)

// 2. Fund the Taproot output (simplified)
const fundingTx = new Transaction()
  .from(someUtxo)
  .addOutput(
    new Output({
      script: taprootScript,
      satoshis: 100000,
    }),
  )
  .sign(fundingPrivateKey)

// 3. Spend the Taproot output
const spendingTx = new Transaction()
  .from({
    txId: fundingTx.id,
    outputIndex: 0,
    script: taprootScript,
    satoshis: 100000,
  })
  .to('lotus:qz...recipient', 95000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

console.log('Taproot transaction created!')
console.log('TX:', spendingTx.serialize())
```

---

## Taproot with Alternative Scripts

### 2-of-2 Multisig with Timelock Fallback

```typescript
import {
  PrivateKey,
  Script,
  Opcode,
  buildScriptPathTaproot,
  TapNode,
} from 'lotus-lib'

const alice = new PrivateKey()
const bob = new PrivateKey()
const alicePub = alice.publicKey
const bobPub = bob.publicKey

// Script 1: 2-of-2 multisig (cooperative close)
const multisigScript = new Script()
  .add(alicePub.toBuffer())
  .add(Opcode.OP_CHECKSIGVERIFY)
  .add(bobPub.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 2: Alice can spend after 144 blocks (~1 day)
const aliceTimelockScript = new Script()
  .add(144)
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(alicePub.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 3: Bob can spend after 288 blocks (~2 days)
const bobTimelockScript = new Script()
  .add(288)
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(bobPub.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build tree
const tree: TapNode = {
  type: 'branch',
  left: { type: 'leaf', script: multisigScript },
  right: {
    type: 'branch',
    left: { type: 'leaf', script: aliceTimelockScript },
    right: { type: 'leaf', script: bobTimelockScript },
  },
}

// Create Taproot output
const { script, treeInfo } = buildScriptPathTaproot(
  alicePub, // Internal key (could be MuSig aggregated key)
  tree,
)

console.log('Created Taproot with 3 spending paths:')
console.log('- Cooperative 2-of-2')
console.log('- Alice after 1 day')
console.log('- Bob after 2 days')
console.log('Merkle root:', treeInfo.merkleRoot.toString('hex'))
```

---

## Lightning-Style Channel

### HTLCs with Taproot

```typescript
import { Script, Opcode, buildScriptPathTaproot, Hash } from 'lotus-lib'

const alice = new PrivateKey()
const bob = new PrivateKey()
const paymentHash = Hash.sha256(preimage) // HTLC payment hash

// Script 1: Alice reveals preimage (forward payment)
const htlcSuccessScript = new Script()
  .add(Opcode.OP_SIZE)
  .add(32)
  .add(Opcode.OP_EQUALVERIFY)
  .add(Opcode.OP_HASH256)
  .add(paymentHash)
  .add(Opcode.OP_EQUALVERIFY)
  .add(alice.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Script 2: Bob refunds after timeout
const htlcTimeoutScript = new Script()
  .add(144) // CSV timeout
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(bob.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const tree: TapNode = {
  type: 'branch',
  left: { type: 'leaf', script: htlcSuccessScript },
  right: { type: 'leaf', script: htlcTimeoutScript },
}

const { script: htlcScript } = buildScriptPathTaproot(
  alice.publicKey, // Or MuSig(alice, bob)
  tree,
)

console.log('HTLC Taproot created')
```

---

## Atomic Swap

### Cross-Chain Atomic Swap with Taproot

```typescript
import { Script, Opcode, buildScriptPathTaproot } from 'lotus-lib'

const seller = new PrivateKey()
const buyer = new PrivateKey()
const secretHash = Hash.sha256(secret)

// Seller's script: Buyer reveals secret
const swapScript = new Script()
  .add(Opcode.OP_SIZE)
  .add(32)
  .add(Opcode.OP_EQUALVERIFY)
  .add(Opcode.OP_HASH256)
  .add(secretHash)
  .add(Opcode.OP_EQUALVERIFY)
  .add(buyer.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Refund script: Seller gets refund after timeout
const refundScript = new Script()
  .add(1440) // 10 days
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(seller.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const tree: TapNode = {
  type: 'branch',
  left: { type: 'leaf', script: swapScript },
  right: { type: 'leaf', script: refundScript },
}

const { script: atomicSwapScript } = buildScriptPathTaproot(
  seller.publicKey,
  tree,
)

console.log('Atomic swap Taproot created')
```

---

## Vault Implementation

### Time-Delayed Vault

```typescript
import { Script, Opcode, buildScriptPathTaproot } from 'lotus-lib'

const owner = new PrivateKey()
const recovery = new PrivateKey()

// Hot wallet: immediate spend
const hotScript = new Script()
  .add(owner.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Warm wallet: 1 day delay
const warmScript = new Script()
  .add(144)
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(owner.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Cold wallet: 7 day delay
const coldScript = new Script()
  .add(1008)
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(owner.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Recovery: 30 days delay
const recoveryScript = new Script()
  .add(4320)
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(recovery.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const tree: TapNode = {
  type: 'branch',
  left: {
    type: 'branch',
    left: { type: 'leaf', script: hotScript },
    right: { type: 'leaf', script: warmScript },
  },
  right: {
    type: 'branch',
    left: { type: 'leaf', script: coldScript },
    right: { type: 'leaf', script: recoveryScript },
  },
}

const { script: vaultScript, treeInfo } = buildScriptPathTaproot(
  owner.publicKey,
  tree,
)

console.log('Vault with 4 spending tiers created')
console.log('Merkle height:', treeInfo.leaves[0].merklePath.length + 1)
```

---

## Key Aggregation (MuSig)

### 2-of-2 with Key Path Privacy

```typescript
import { PublicKey, tweakPublicKey, buildKeyPathTaproot } from 'lotus-lib'

// Placeholder - MuSig not yet implemented
// This shows the intended usage pattern

const alice = new PrivateKey()
const bob = new PrivateKey()

// In actual MuSig implementation:
// const aggregatedPubKey = musigAggregate([alice.publicKey, bob.publicKey])

// For now, use single key as placeholder
const aggregatedPubKey = alice.publicKey

// Create Taproot with aggregated key
const taprootScript = buildKeyPathTaproot(aggregatedPubKey)

console.log('MuSig Taproot (placeholder):', taprootScript.toString())
// When spent via key path, looks like single-sig (privacy!)
```

---

## Testing Taproot

### Verify Taproot Script Creation

```typescript
import {
  PrivateKey,
  buildKeyPathTaproot,
  isPayToTaproot,
  extractTaprootCommitment,
  tweakPublicKey,
} from 'lotus-lib'

const privateKey = new PrivateKey()
const internalPubKey = privateKey.publicKey

// Build Taproot script
const taprootScript = buildKeyPathTaproot(internalPubKey)

// Verify it's valid Taproot
console.assert(taprootScript.isPayToTaproot(), 'Should be P2TR')

// Extract commitment
const commitment = extractTaprootCommitment(taprootScript)

// Verify commitment is correct
const expectedCommitment = tweakPublicKey(internalPubKey, Buffer.alloc(32))
console.assert(
  commitment.toString() === expectedCommitment.toString(),
  'Commitment should match',
)

console.log('✓ Taproot script valid')
```

---

## Debugging

### Inspect Taproot Components

```typescript
import {
  buildKeyPathTaproot,
  extractTaprootCommitment,
  extractTaprootState,
  calculateTapTweak,
  tweakPublicKey,
} from 'lotus-lib'

const privateKey = new PrivateKey()
const internalPubKey = privateKey.publicKey

// Create Taproot
const taprootScript = buildKeyPathTaproot(internalPubKey)

console.log('Taproot Script Analysis:')
console.log('=======================')
console.log('Script hex:', taprootScript.toBuffer().toString('hex'))
console.log('Script size:', taprootScript.toBuffer().length, 'bytes')
console.log('Is P2TR:', taprootScript.isPayToTaproot())
console.log('')

// Extract components
const commitment = extractTaprootCommitment(taprootScript)
const state = extractTaprootState(taprootScript)

console.log('Components:')
console.log('- Internal pubkey:', internalPubKey.toString())
console.log('- Commitment:', commitment.toString())
console.log('- State:', state ? state.toString('hex') : 'None')
console.log('')

// Calculate tweak
const merkleRoot = Buffer.alloc(32)
const tweak = calculateTapTweak(internalPubKey, merkleRoot)
console.log('Tweak:', tweak.toString('hex'))

// Verify tweaking
const manualCommitment = tweakPublicKey(internalPubKey, merkleRoot)
console.log('Manual commitment:', manualCommitment.toString())
console.log('Match:', commitment.toString() === manualCommitment.toString())
```

---

## Error Handling

### Handle Taproot-Specific Errors

```typescript
import { Transaction, Signature, buildKeyPathTaproot } from 'lotus-lib'

const privateKey = new PrivateKey()
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)

const utxo = {
  txId: 'previous_tx',
  outputIndex: 0,
  script: taprootScript,
  satoshis: 100000,
}

const tx = new Transaction().from(utxo).to(recipientAddress, 95000)

// ❌ This will fail - ECDSA not allowed for Taproot key path
try {
  tx.sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS,
    'ecdsa', // Wrong!
  )
} catch (error) {
  console.error('Error:', error.message)
  // "Taproot key spend signature must be Schnorr"
}

// ❌ This will fail - SIGHASH_FORKID not allowed for Taproot
try {
  tx.sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID, // Wrong!
    'schnorr',
  )
} catch (error) {
  console.error('Error:', error.message)
  // "Taproot key spend signatures must use SIGHASH_LOTUS"
}

// ✅ Correct usage
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
console.log('✓ Transaction signed successfully')
```

---

## Best Practices

### 1. Use Key Path for Privacy

```typescript
// Key path spending looks identical to any other single-sig
// Alternative scripts are hidden
const taprootScript = buildKeyPathTaproot(publicKey)

// When spent, observer cannot tell if there were alternative scripts
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

### 2. Put Most Likely Path as Key Path

```typescript
// If cooperative close is most likely (e.g., Lightning channel):
// - Key path = MuSig(alice, bob)
// - Script paths = timeout/dispute resolution

const cooperativeKey = musigAggregate([alice, bob]) // Placeholder
const taprootScript = buildKeyPathTaproot(cooperativeKey)

// 99% of closes use key path (cooperative)
// 1% reveal scripts (disputes)
```

### 3. Order Scripts by Likelihood

```typescript
// Put most likely scripts higher/earlier in tree
const tree: TapNode = {
  type: 'branch',
  left: { type: 'leaf', script: likelyScript }, // Shorter merkle path
  right: { type: 'leaf', script: unlikelyScript }, // Longer merkle path
}
```

### 4. Always Validate Before Broadcasting

```typescript
const tx = new Transaction()
  .from(taprootUtxo)
  .to(address, amount)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

// Verify before broadcasting
const isValid = tx.verify()
if (isValid !== true) {
  throw new Error('Invalid transaction: ' + isValid)
}

// Broadcast
await broadcastTransaction(tx.serialize())
```

---

## Summary

### Key Points

1. **Key path spending** is automatic via `Transaction.sign()`
2. **Must use SIGHASH_LOTUS** for Taproot
3. **Must use Schnorr** for key path
4. **Script trees** enable multiple spending conditions
5. **Privacy** - Alternative scripts hidden until spent

### Quick Reference

```typescript
// Create Taproot output
const script = buildKeyPathTaproot(publicKey)

// Spend Taproot output
tx.from(taprootUtxo)
  .to(address, amount)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

// With script tree
const { script } = buildScriptPathTaproot(publicKey, tree)
```

---

For more details, see `TAPROOT_IMPLEMENTATION.md`.
