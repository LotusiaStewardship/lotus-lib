# SIGHASH_LOTUS Correct Usage

**Date**: October 28, 2025  
**Status**: ✅ Documented and Tested

---

## TL;DR - Quick Fix

### ❌ Wrong (Missing Base Type)

```typescript
tx.sign(privateKey, Signature.SIGHASH_LOTUS, 'schnorr')
// Error: Invalid sighash type for SIGHASH_LOTUS
```

### ✅ Correct (With Base Type)

```typescript
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
// Works! Value = 0x61
```

---

## Why You Need SIGHASH_ALL

### The Problem

SIGHASH_LOTUS is not a complete signature type by itself—it's an **algorithm selector**.

You must specify BOTH:

1. **What to sign** (base type): `SIGHASH_ALL`, `SIGHASH_SINGLE`, or `SIGHASH_NONE`
2. **How to compute the hash** (algorithm): `SIGHASH_LOTUS`

### Bit Layout

```
Sighash Type = 1 byte

Bits:   7       6    5    4 3 2    1 0
      ┌────┬──────────┬──────────┬──────┐
      │ 80 │  60      │   1C     │  03  │
      └────┴──────────┴──────────┴──────┘
        │       │          │         │
        │       │          │         └─ Base Type (REQUIRED)
        │       │          └─────────── Unused (must be 0)
        │       └────────────────────── Algorithm
        └────────────────────────────── Modifier (optional)
```

### Why SIGHASH_LOTUS Alone Fails

```typescript
SIGHASH_LOTUS = 0x60 = 0110 0000

baseType = 0x60 & 0x03 = 0x00  ❌ INVALID!
```

The validation requires `baseType !== 0`, so you must set bits 0-1.

---

## Correct Usage Patterns

### Pattern 1: SIGHASH_ALL | SIGHASH_LOTUS (Most Common)

```typescript
const tx = new Transaction()
  .from(utxo)
  .to(recipientAddress, amount)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS)

// Value: 0x01 | 0x60 = 0x61
```

**Commits to**: All inputs and all outputs (most secure)

### Pattern 2: SIGHASH_ALL | SIGHASH_LOTUS (Explicit with FORKID)

```typescript
tx.sign(
  privateKey,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
)

// Value: 0x01 | 0x60 | 0x40 = 0x61 (same as above!)
```

**Note**: Adding `SIGHASH_FORKID` is redundant because LOTUS already includes it.

### Pattern 3: SIGHASH_SINGLE | SIGHASH_LOTUS

```typescript
tx.sign(privateKey, Signature.SIGHASH_SINGLE | Signature.SIGHASH_LOTUS)

// Value: 0x03 | 0x60 = 0x63
```

**Commits to**: All inputs and one corresponding output

### Pattern 4: SIGHASH_ALL | SIGHASH_LOTUS | SIGHASH_ANYONECANPAY

```typescript
tx.sign(
  privateKey,
  Signature.SIGHASH_ALL |
    Signature.SIGHASH_LOTUS |
    Signature.SIGHASH_ANYONECANPAY,
)

// Value: 0x01 | 0x60 | 0x80 = 0xE1
```

**Commits to**: One input and all outputs (crowdfunding pattern)

---

## Why SIGHASH_FORKID is Already Included

### Bit Analysis

```
SIGHASH_FORKID = 0x40 = 0100 0000  (bit 6)
SIGHASH_LOTUS  = 0x60 = 0110 0000  (bits 5 and 6)

0x60 & 0x40 = 0x40  ✓
```

SIGHASH_LOTUS (0x60) has bit 6 set, which is the same bit used for SIGHASH_FORKID.

Therefore: **SIGHASH_LOTUS automatically includes SIGHASH_FORKID**.

### Proof

```typescript
// These produce the SAME value:
0x01 | 0x60           = 0x61
0x01 | 0x60 | 0x40    = 0x61  (FORKID is redundant)
```

---

## Complete Examples

### Example 1: Single Input, Single Output

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()
const utxo = {
  txId: 'a'.repeat(64),
  outputIndex: 0,
  address: privateKey.toAddress().toString(),
  script: privateKey.toAddress().toScript(),
  satoshis: 100000,
}

const tx = new Transaction()
  .from(utxo)
  .to('lotus:qz...recipient', 95000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

console.log('Transaction ID:', tx.id)
console.log('Valid:', tx.verify())
```

### Example 2: Multiple Inputs

```typescript
const utxos = [utxo1, utxo2, utxo3]

const tx = new Transaction()
  .from(utxos)
  .to('lotus:qz...recipient', 280000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

### Example 3: With Change Address

```typescript
const tx = new Transaction()
  .from(utxo)
  .to('lotus:qz...recipient', 50000)
  .change(privateKey.toAddress())
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

### Example 4: ECDSA Signature

```typescript
const tx = new Transaction()
  .from(utxo)
  .to('lotus:qz...recipient', 95000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS,
    'ecdsa', // Default if not specified
  )
```

---

## Common Mistakes

### ❌ Mistake 1: Using SIGHASH_LOTUS Alone

```typescript
// WRONG - Missing base type
tx.sign(privateKey, Signature.SIGHASH_LOTUS)
// Error: Invalid sighash type for SIGHASH_LOTUS
```

**Fix**: Add `SIGHASH_ALL`

```typescript
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS)
```

### ❌ Mistake 2: Using SIGHASH_LOTUS + SIGHASH_FORKID Without Base Type

```typescript
// WRONG - Still missing base type
tx.sign(privateKey, Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID)
// Error: Invalid sighash type for SIGHASH_LOTUS
```

**Fix**: Add `SIGHASH_ALL`

```typescript
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS)
```

### ❌ Mistake 3: Not Providing Spent Outputs

```typescript
// WRONG - No output information
const tx = new Transaction()
tx.addInput(new Input({ prevTxId, outputIndex })) // Missing output!
tx.addOutput(new Output({ satoshis: 95000, script }))
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS)
// Error: SIGHASH_LOTUS requires spent outputs for all inputs
```

**Fix**: Use `.from()` to attach output info

```typescript
const tx = new Transaction()
  .from(utxo) // Automatically attaches output
  .to(address, 95000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS)
```

---

## Validation Rules

The implementation validates:

```typescript
const baseType = sighashType & 0x03
const unusedBits = sighashType & 0x1c

if (baseType === 0 || unusedBits !== 0) {
  throw new Error('Invalid sighash type for SIGHASH_LOTUS')
}
```

### Requirements

1. **Base type must be set** (bits 0-1 ≠ 0)
   - `0x01` = SIGHASH_ALL ✓
   - `0x02` = SIGHASH_NONE (not supported yet)
   - `0x03` = SIGHASH_SINGLE ✓
   - `0x00` = Invalid ❌

2. **Unused bits must be clear** (bits 2-4 = 0)
   - Ensures forward compatibility

3. **Spent outputs must be available**
   - All inputs must have `.output` property
   - Use `.from()` to automatically attach

---

## Flag Value Reference

```typescript
// Base types (bits 0-1)
SIGHASH_ALL    = 0x01  // Sign all outputs
SIGHASH_SINGLE = 0x03  // Sign one output

// Algorithm (bits 5-6)
SIGHASH_FORKID = 0x40  // BIP143 (standard)
SIGHASH_LOTUS  = 0x60  // Merkle tree (advanced)

// Modifier (bit 7)
SIGHASH_ANYONECANPAY = 0x80  // Sign only this input

// Common combinations
ALL + FORKID       = 0x41  // Standard Lotus transaction
ALL + LOTUS        = 0x61  // Lotus merkle tree
SINGLE + LOTUS     = 0x63  // Lotus with single output
ALL + LOTUS + ACP  = 0xE1  // Lotus crowdfunding
```

---

## Migration Checklist

If you're updating code that incorrectly used SIGHASH_LOTUS:

- [ ] Find all uses of `Signature.SIGHASH_LOTUS`
- [ ] Add `Signature.SIGHASH_ALL |` before SIGHASH_LOTUS
- [ ] Remove redundant `| Signature.SIGHASH_FORKID` (optional cleanup)
- [ ] Ensure using `.from()` to add inputs (not manual `addInput()`)
- [ ] Test transaction signing and verification
- [ ] Verify transaction serializes correctly

---

## Testing Your Implementation

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

// Create test transaction
const privateKey = new PrivateKey()
const utxo = {
  txId: 'a'.repeat(64),
  outputIndex: 0,
  address: privateKey.toAddress().toString(),
  script: privateKey.toAddress().toScript(),
  satoshis: 100000,
}

// Sign with SIGHASH_LOTUS
const tx = new Transaction()
  .from(utxo)
  .to(privateKey.toAddress(), 95000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

// Verify
console.log('Fully signed:', tx.isFullySigned())
console.log('Valid:', tx.verify())
console.log('Transaction ID:', tx.id)
console.log('Serialized:', tx.serialize())
console.log('Spent outputs:', tx.spentOutputs?.length)

// All should be true/success
```

---

## Summary

### What You Need to Remember

1. ✅ **Always combine with a base type**

   ```typescript
   Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS
   ```

2. ✅ **FORKID is already included** (redundant to add)

   ```typescript
   0x60 already includes 0x40
   ```

3. ✅ **Use `.from()` to attach outputs**

   ```typescript
   tx.from(utxo) // Not tx.addInput()
   ```

4. ✅ **LOTUS provides better scaling**
   - Merkle tree validation
   - Future optimizations
   - Taproot support

### Quick Reference

```typescript
// Minimal correct usage:
Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS // = 0x61

// Explicit (redundant but clear):
;Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID // = 0x61

// With Schnorr:
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

---

**Implementation**: Complete ✅  
**Documentation**: Fixed ✅  
**Testing**: Verified ✅  
**Status**: Production Ready 🎉
