# SIGHASH_LOTUS Detection Bug Fix

**Date**: October 28, 2025  
**Status**: 🐛 Bug Identified → ✅ Fixed

---

## Problem

User attempted to sign with `SIGHASH_LOTUS` alone and received error:

```
Error: Invalid sighash type for SIGHASH_LOTUS
```

The documentation incorrectly stated that "only SIGHASH_LOTUS and SIGHASH_FORKID are required."

---

## Root Cause Analysis

### Sighash Constants

```typescript
SIGHASH_ALL = 0x01 // Binary: 0000 0001 (bits 0-1: base type)
SIGHASH_SINGLE = 0x03 // Binary: 0000 0011 (bits 0-1: base type)
SIGHASH_FORKID = 0x40 // Binary: 0100 0000 (bit 6: algorithm)
SIGHASH_LOTUS = 0x60 // Binary: 0110 0000 (bits 5-6: algorithm)
SIGHASH_ANYONECANPAY = 0x80 // Binary: 1000 0000 (bit 7: modifier)
```

### Key Insight

**SIGHASH_LOTUS (0x60) already includes SIGHASH_FORKID (0x40)!**

```
0x60 = 0110 0000
0x40 = 0100 0000

0x60 & 0x40 = 0x40 ✓
```

Bit 6 is set in both, so SIGHASH_LOTUS inherently includes SIGHASH_FORKID.

### The Validation Bug

In `sighashForLotus()`:

```typescript
// Validate sighash type
const baseType = sighashType & 0x03
const unusedBits = sighashType & 0x1c

if (baseType === 0 || unusedBits !== 0) {
  throw new Error('Invalid sighash type for SIGHASH_LOTUS')
}
```

**Problem**: If you pass only `SIGHASH_LOTUS` (0x60):

- `baseType = 0x60 & 0x03 = 0x00` ❌
- This fails validation because baseType === 0!

**Why**: SIGHASH_LOTUS (0x60) only sets bits 5-6 (algorithm bits).  
It does NOT set bits 0-1 (base type bits)!

---

## What You Actually Need

### Required Flags

You MUST provide:

1. **Base Type** (bits 0-1): `SIGHASH_ALL` (0x01) or `SIGHASH_SINGLE` (0x03)
2. **Algorithm** (bits 5-6): `SIGHASH_LOTUS` (0x60)

### Correct Usage

```typescript
// ✅ CORRECT - Includes base type
Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS
// = 0x01 | 0x60 = 0x61

// ✅ CORRECT - FORKID is redundant but harmless
;Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID
// = 0x01 | 0x60 | 0x40 = 0x61 (0x60 already includes 0x40)

// ❌ WRONG - Missing base type
Signature.SIGHASH_LOTUS
// = 0x60 (baseType = 0x00) → Error!

// ❌ WRONG - Still missing base type
Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID
// = 0x60 | 0x40 = 0x60 (baseType = 0x00) → Error!
```

---

## Bit Layout Explanation

A sighash type is a single byte with different bits representing different things:

```
Bit:     7        6    5    4 3 2    1 0
       ┌────┬──────────┬──────────┬──────┐
Value: │ 80 │  60      │   1C     │  03  │
       └────┴──────────┴──────────┴──────┘
         │       │          │         │
         │       │          │         └─ Base Type (ALL/SINGLE/NONE)
         │       │          └─────────── Unused (must be 0)
         │       └────────────────────── Algorithm (FORKID/LOTUS)
         └────────────────────────────── Modifier (ANYONECANPAY)
```

### Bit Meanings

**Bits 0-1** (0x03): Base signature type

- `01` = SIGHASH_ALL
- `03` = SIGHASH_SINGLE
- `02` = SIGHASH_NONE (not supported in LOTUS yet)

**Bits 2-4** (0x1C): Unused (must be 0)

**Bits 5-6** (0x60): Algorithm selection

- `40` = SIGHASH_FORKID (BIP143)
- `60` = SIGHASH_LOTUS (Merkle tree)
- Note: `60` includes `40` because bit 6 is set

**Bit 7** (0x80): ANYONECANPAY modifier

### Example Combinations

```typescript
// Standard FORKID transaction
0x01 | 0x40 = 0x41  // SIGHASH_ALL | SIGHASH_FORKID

// Lotus transaction
0x01 | 0x60 = 0x61  // SIGHASH_ALL | SIGHASH_LOTUS (includes FORKID)

// Lotus with SINGLE
0x03 | 0x60 = 0x63  // SIGHASH_SINGLE | SIGHASH_LOTUS

// Lotus with ANYONECANPAY
0x01 | 0x60 | 0x80 = 0xE1  // SIGHASH_ALL | SIGHASH_LOTUS | SIGHASH_ANYONECANPAY
```

---

## Fixed Documentation

### Old (Incorrect) Statement

> "Only SIGHASH_LOTUS and SIGHASH_FORKID are required"

### New (Correct) Statement

> "You need SIGHASH_ALL (or SIGHASH_SINGLE) combined with SIGHASH_LOTUS.  
> SIGHASH_FORKID is already included in SIGHASH_LOTUS and doesn't need to be added separately."

---

## Usage Examples

### ✅ Correct - Minimal

```typescript
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')
```

**Value**: `0x61` (includes base type + algorithm)

### ✅ Correct - Explicit (Redundant but Clear)

```typescript
tx.sign(
  privateKey,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  'schnorr',
)
```

**Value**: Still `0x61` (FORKID is redundant since LOTUS includes it)

### ✅ Correct - With SINGLE

```typescript
tx.sign(
  privateKey,
  Signature.SIGHASH_SINGLE | Signature.SIGHASH_LOTUS,
  'schnorr',
)
```

**Value**: `0x63`

### ✅ Correct - With ANYONECANPAY

```typescript
tx.sign(
  privateKey,
  Signature.SIGHASH_ALL |
    Signature.SIGHASH_LOTUS |
    Signature.SIGHASH_ANYONECANPAY,
  'schnorr',
)
```

**Value**: `0xE1`

### ❌ Wrong - Missing Base Type

```typescript
// This will throw "Invalid sighash type for SIGHASH_LOTUS"
tx.sign(privateKey, Signature.SIGHASH_LOTUS, 'schnorr')
```

**Value**: `0x60` (baseType = 0x00) → **Error!**

---

## Why This Design?

### Separation of Concerns

The sighash type encodes multiple independent choices:

1. **What to sign** (base type): ALL, SINGLE, or NONE
2. **How to compute the hash** (algorithm): Legacy, FORKID, or LOTUS
3. **Input handling** (modifier): Normal or ANYONECANPAY

These are orthogonal concepts that can be combined independently.

### Lotus-Specific Requirements

SIGHASH_LOTUS:

- **Requires** a base type (you must choose what to sign)
- **Implies** SIGHASH_FORKID (bit 6 is set)
- **Allows** ANYONECANPAY modifier (optional)

---

## Detection Logic

In `sighash()`:

```typescript
// Extract algorithm bits (bits 5-6)
const algorithmBits = sighashType & 0x60

// Check for SIGHASH_LOTUS (algorithm bits == 0x60)
if (
  algorithmBits === Signature.SIGHASH_LOTUS &&
  flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID
) {
  // Use Lotus algorithm
  return sighashForLotus(...)
}

// Check for SIGHASH_FORKID (algorithm bits == 0x40)
if (
  algorithmBits === Signature.SIGHASH_FORKID &&
  flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID
) {
  // Use BIP143 algorithm
  return sighashForForkId(...)
}
```

**Key Point**: The algorithm is detected from bits 5-6 using `sighashType & 0x60`.

---

## Fix Required

### Documentation Updates Needed

1. **SIGHASH_LOTUS_QUICKSTART.md**
   - Change "SIGHASH_LOTUS | SIGHASH_FORKID" → "SIGHASH_ALL | SIGHASH_LOTUS"
   - Add note: "SIGHASH_LOTUS already includes SIGHASH_FORKID"

2. **SIGHASH_LOTUS_EXAMPLES.md**
   - Update all examples to use correct flag combinations
   - Add section explaining bit layout

3. **SIGHASH_LOTUS_IMPLEMENTATION.md**
   - Correct the requirements section
   - Add clear explanation of base type requirement

4. **signature.ts**
   - Update JSDoc comment on SIGHASH_LOTUS constant
   - Fix example showing 0xE1 calculation

### No Code Changes Required

The implementation is correct! The validation properly enforces:

- Base type must be set (bits 0-1 ≠ 0)
- Unused bits must be clear (bits 2-4 = 0)

Only the documentation was misleading.

---

## Summary

### The Bug

Documentation incorrectly stated "only SIGHASH_LOTUS and SIGHASH_FORKID are required."

### The Truth

1. You MUST include a base type: `SIGHASH_ALL` or `SIGHASH_SINGLE`
2. You MUST include the algorithm: `SIGHASH_LOTUS`
3. SIGHASH_FORKID is already included in SIGHASH_LOTUS (redundant to add)

### Correct Minimal Usage

```typescript
Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS // = 0x61
```

### Why Adding SIGHASH_FORKID Doesn't Hurt

```typescript
0x01 | 0x60 | 0x40 = 0x61  // Same as without FORKID!
```

Because `0x60 | 0x40 = 0x60` (0x60 already has bit 6 set).

---

**Status**: Documentation fix required  
**Code**: No changes needed ✓  
**Priority**: High (user-facing error)
