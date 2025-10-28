# SIGHASH_LOTUS Quick Start Guide

Fast-track guide to using SIGHASH_LOTUS in lotus-lib.

---

## What is SIGHASH_LOTUS?

SIGHASH_LOTUS is Lotus's advanced signature hash algorithm that uses merkle trees for more efficient validation. It provides:

- ✅ **Better scaling** - Merkle trees enable efficient batch validation
- ✅ **Future optimizations** - Proof of inclusion without full data
- ✅ **Taproot ready** - Supports advanced script features
- ✅ **Same security** - Based on proven cryptographic principles

---

## Installation

```bash
npm install lotus-lib
# or
yarn add lotus-lib
```

---

## Basic Usage

### 1. Import Required Classes

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'
```

### 2. Create and Sign Transaction

```typescript
const privateKey = new PrivateKey()

const tx = new Transaction()
  .from(utxo) // ← Automatically tracks spent output
  .to('lotus:qz...recipient', 90000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )

console.log('Signed with SIGHASH_LOTUS!')
console.log(tx.serialize())
```

That's it! 🎉

---

## UTXO Format

```typescript
const utxo = {
  txId: 'previous_transaction_id', // Transaction ID
  outputIndex: 0, // Output index in previous tx
  address: 'lotus:qz...address', // Your address
  script: Script.buildPublicKeyHashOut(address), // Locking script
  satoshis: 100000, // Amount in satoshis
}
```

---

## Common Patterns

### Pattern 1: Single Input Transaction

```typescript
const tx = new Transaction()
  .from(utxo)
  .to(recipientAddress, amount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )
```

### Pattern 2: Multiple Inputs

```typescript
const tx = new Transaction()
  .from([utxo1, utxo2, utxo3]) // Array of UTXOs
  .to(recipientAddress, totalAmount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )
```

### Pattern 3: With Change Address

```typescript
const tx = new Transaction()
  .from(utxo)
  .to(recipientAddress, sendAmount)
  .change(myAddress) // Change comes back here
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )
```

### Pattern 4: Schnorr Signatures (Smaller)

```typescript
const tx = new Transaction()
  .from(utxo)
  .to(recipientAddress, amount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
    'schnorr', // ← Use Schnorr (64 bytes vs ~72 for ECDSA)
  )
```

---

## Sighash Type Combinations

### ALL (Default)

Signs all inputs and outputs.

```typescript
;Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID
```

### SINGLE

Signs input and corresponding output only.

```typescript
;Signature.SIGHASH_SINGLE | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID
```

### ANYONECANPAY

Signs only one input, allows others to add more.

```typescript
;Signature.SIGHASH_ANYONECANPAY |
  Signature.SIGHASH_ALL |
  Signature.SIGHASH_LOTUS |
  Signature.SIGHASH_FORKID
```

---

## Common Mistakes

### ❌ Don't: Add inputs manually

```typescript
// ❌ BAD - No output information attached
const tx = new Transaction()
tx.addInput(new Input({ prevTxId, outputIndex }))
tx.addOutput(new Output({ satoshis: 90000, script }))
tx.sign(privateKey, SIGHASH_LOTUS) // ← FAILS!
```

### ✅ Do: Use .from() method

```typescript
// ✅ GOOD - Output info automatically attached
const tx = new Transaction()
  .from(utxo) // ← Attaches output info
  .to(address, 90000)
  .sign(privateKey, SIGHASH_LOTUS) // ← Works!
```

---

## Checking Spent Outputs

```typescript
const tx = new Transaction().from(utxo1).from(utxo2)

// Check if all outputs are tracked
if (tx.spentOutputs) {
  console.log(`✓ All ${tx.spentOutputs.length} outputs tracked`)
} else {
  console.log('✗ Missing output information')
}
```

---

## Error Handling

```typescript
import { Transaction, Signature } from 'lotus-lib'

try {
  tx.sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )
} catch (error) {
  if (error.message.includes('SIGHASH_LOTUS requires spent outputs')) {
    console.error('Missing output info - use .from(utxo)')
  } else {
    throw error
  }
}
```

---

## Migration from SIGHASH_FORKID

### Before (SIGHASH_FORKID)

```typescript
const tx = new Transaction().from(utxo).to(address, amount).sign(privateKey) // Default: SIGHASH_FORKID
```

### After (SIGHASH_LOTUS)

```typescript
const tx = new Transaction()
  .from(utxo) // ← Same method
  .to(address, amount) // ← Same method
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  ) // ← Just add SIGHASH_LOTUS flag
```

**That's the only change needed!** Everything else works the same.

---

## Complete Example

```typescript
import { Transaction, PrivateKey, Signature, Address, Script } from 'lotus-lib'

// Setup
const privateKey = new PrivateKey('your_private_key_wif')
const myAddress = privateKey.toAddress()
const recipientAddress = Address.fromString('lotus:qz...recipient')

// UTXO from blockchain
const utxo = {
  txId: 'a1b2c3...previous_tx_id',
  outputIndex: 0,
  address: myAddress.toString(),
  script: Script.buildPublicKeyHashOut(myAddress),
  satoshis: 100000,
}

// Create, sign, and broadcast
const tx = new Transaction()
  .from(utxo)
  .to(recipientAddress, 95000)
  .change(myAddress)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
    'schnorr', // Optional: use Schnorr
  )

// Verify before broadcasting
const isValid = tx.verify()
if (isValid !== true) {
  throw new Error('Transaction validation failed: ' + isValid)
}

// Get serialized hex for broadcasting
const txHex = tx.serialize()
console.log('Transaction ready to broadcast:', txHex)

// Broadcast to network
// await broadcastTransaction(txHex)
```

---

## Comparison: FORKID vs LOTUS

| Feature              | SIGHASH_FORKID | SIGHASH_LOTUS   |
| -------------------- | -------------- | --------------- |
| **Algorithm**        | BIP143 hashing | Merkle trees    |
| **Validation Speed** | Standard       | Faster (batch)  |
| **Transaction Size** | Same           | Same            |
| **Usage**            | Default        | Opt-in via flag |
| **API Change**       | -              | None (same API) |
| **Backward Compat**  | -              | Yes             |

**When to use SIGHASH_LOTUS:**

- ✅ New applications
- ✅ High-throughput scenarios
- ✅ When future optimizations matter
- ✅ Taproot/advanced features

**When to use SIGHASH_FORKID:**

- ✅ Legacy compatibility
- ✅ Simple transactions
- ✅ Default choice (works everywhere)

---

## Key Sighash Flags

```typescript
// Flag values (from lotusd/src/script/sighashtype.h)
Signature.SIGHASH_ALL = 0x01 // Sign all outputs
Signature.SIGHASH_SINGLE = 0x03 // Sign one output
Signature.SIGHASH_ANYONECANPAY = 0x80 // Sign one input
Signature.SIGHASH_FORKID = 0x40 // Bitcoin Cash fork
Signature.SIGHASH_LOTUS = 0x60 // Lotus merkle tree

// Typical combinations
SIGHASH_ALL | SIGHASH_FORKID // Standard (default)
;SIGHASH_ALL | SIGHASH_LOTUS | SIGHASH_FORKID // Lotus standard
;SIGHASH_SINGLE | SIGHASH_LOTUS | SIGHASH_FORKID // Lotus single
```

---

## Testing

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

describe('SIGHASH_LOTUS', () => {
  it('should sign transaction with LOTUS', () => {
    const privateKey = new PrivateKey()
    const utxo = {
      /* ... */
    }

    const tx = new Transaction()
      .from(utxo)
      .to('lotus:qz...', 90000)
      .sign(
        privateKey,
        Signature.SIGHASH_ALL |
          Signature.SIGHASH_LOTUS |
          Signature.SIGHASH_FORKID,
      )

    expect(tx.isFullySigned()).toBe(true)
    expect(tx.spentOutputs).toHaveLength(1)
    expect(tx.verify()).toBe(true)
  })
})
```

---

## Resources

- **Implementation Details**: `SIGHASH_LOTUS_IMPLEMENTATION.md`
- **Usage Examples**: `SIGHASH_LOTUS_EXAMPLES.md`
- **Lotus Reference**: lotusd/src/script/interpreter.cpp
- **Merkle Trees**: lotusd/src/consensus/merkle.cpp

---

## Need Help?

### Check Spent Outputs

```typescript
console.log('Spent outputs:', tx.spentOutputs?.length)
```

### Verify Transaction

```typescript
const result = tx.verify()
if (result !== true) {
  console.error('Invalid:', result)
}
```

### Common Errors

**"SIGHASH_LOTUS requires spent outputs"**
→ Use `.from(utxo)` instead of manual input addition

**"Input index out of range"**
→ Check that input index matches number of inputs

**"Transaction is not fully signed"**
→ Sign all inputs before broadcasting

---

## Summary

**3 Steps to Use SIGHASH_LOTUS:**

1. ✅ Use `.from(utxo)` to add inputs
2. ✅ Add `SIGHASH_LOTUS` flag when signing
3. ✅ Done!

```typescript
// That's all you need!
tx.from(utxo)
  .to(address, amount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )
```

---

**Implementation Status**: ✅ Production Ready  
**Date**: October 28, 2025  
**lotus-lib version**: Latest
