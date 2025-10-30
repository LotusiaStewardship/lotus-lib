# Taproot Quick Start

Fast introduction to using Taproot in lotus-lib.

---

## What is Taproot?

Taproot allows you to:

- ✅ Spend with a single signature (key path - most private)
- ✅ OR reveal and execute alternative scripts (script path)
- ✅ Hide alternative spending conditions until used
- ✅ Save space with Schnorr signatures

---

## Installation

```bash
npm install lotus-lib
```

---

## 30-Second Example

```typescript
import {
  Transaction,
  PrivateKey,
  Signature,
  buildKeyPathTaproot,
} from 'lotus-lib'

const privateKey = new PrivateKey()

// 1. Create Taproot output
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)

// 2. Spend Taproot output
const tx = new Transaction()
  .from({
    txId: 'previous_tx',
    outputIndex: 0,
    script: taprootScript,
    satoshis: 100000,
  })
  .to('lotus:qz...recipient', 95000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, // Required!
    'schnorr', // Required!
  )

console.log('Done! TX:', tx.serialize())
```

---

## Requirements

### For Taproot Key Path Spending

1. ✅ **SIGHASH_LOTUS**: Must use `Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS`
2. ✅ **Schnorr**: Must use `'schnorr'` as third parameter
3. ✅ **Full output info**: Must use `.from(utxo)` with complete UTXO

---

## Common Patterns

### Pattern 1: Simple Taproot

```typescript
const script = buildKeyPathTaproot(publicKey)
```

### Pattern 2: Spend Taproot

```typescript
tx.from(taprootUtxo)
  .to(address, amount)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

### Pattern 3: Taproot with Alternative Scripts

```typescript
import { buildScriptPathTaproot } from 'lotus-lib'

const tree = {
  type: 'branch',
  left: { type: 'leaf', script: script1 },
  right: { type: 'leaf', script: script2 },
}

const { script } = buildScriptPathTaproot(publicKey, tree)
```

---

## Common Mistakes

### ❌ Wrong: Using SIGHASH_FORKID

```typescript
// This fails for Taproot!
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID)
```

### ✅ Right: Using SIGHASH_LOTUS

```typescript
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

### ❌ Wrong: Using ECDSA

```typescript
// This fails for Taproot!
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'ecdsa')
```

### ✅ Right: Using Schnorr

```typescript
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

---

## Complete Example

```typescript
import {
  Transaction,
  PrivateKey,
  Signature,
  Output,
  buildKeyPathTaproot,
} from 'lotus-lib'

// Setup
const privateKey = new PrivateKey()
const recipientAddress = 'lotus:qz...recipient'

// Create Taproot output
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)

// Simulate funding transaction
const fundingTx = new Transaction()
  .from(someUtxo)
  .addOutput(
    new Output({
      script: taprootScript,
      satoshis: 100000,
    }),
  )
  .sign(fundingKey)

// Spend Taproot output
const spendingTx = new Transaction()
  .from({
    txId: fundingTx.id,
    outputIndex: 0,
    script: taprootScript,
    satoshis: 100000,
  })
  .to(recipientAddress, 95000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

// Verify and broadcast
const isValid = spendingTx.verify()
console.log('Valid:', isValid)

if (isValid === true) {
  const txHex = spendingTx.serialize()
  console.log('Ready to broadcast:', txHex)
}
```

---

## Key Sighash Flags

```typescript
// For Taproot key path (REQUIRED):
Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS // = 0x61

// Other combinations (for script path):
Signature.SIGHASH_SINGLE | Signature.SIGHASH_LOTUS // = 0x63
;Signature.SIGHASH_ALL |
  Signature.SIGHASH_LOTUS |
  Signature.SIGHASH_ANYONECANPAY // = 0xE1
```

---

## Next Steps

- **Learn more**: See `TAPROOT_IMPLEMENTATION.md`
- **Examples**: See `TAPROOT_EXAMPLES.md`
- **Test**: Write tests against lotusd

---

**Status**: ✅ Ready to Use  
**Requirement**: Taproot must be enabled in consensus  
**Date**: October 28, 2025
