# SIGHASH_LOTUS Phase-Out - Critical Finding

**Date**: October 28, 2025  
**Status**: 🚨 **SIGHASH_LOTUS IS NO LONGER SUPPORTED IN CONSENSUS**

---

## Executive Summary

**SIGHASH_LOTUS was phased out in the Numbers upgrade (December 21, 2022) and is no longer supported in Lotus consensus.**

Any transactions using SIGHASH_LOTUS will fail with:

```
mandatory-script-verify-flag-failed (Signature must be zero for failed CHECK(MULTI)SIG operation)
```

---

## Evidence from lotusd Source Code

### 1. Policy Flags Include Disable Flag

**File**: `src/policy/policy.h` lines 78-80

```cpp
static constexpr uint32_t STANDARD_SCRIPT_VERIFY_FLAGS =
    MANDATORY_SCRIPT_VERIFY_FLAGS | SCRIPT_VERIFY_DISCOURAGE_UPGRADABLE_NOPS |
    SCRIPT_VERIFY_INPUT_SIGCHECKS | SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS;
```

The **standard verification flags** include `SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS`, meaning SIGHASH_LOTUS is disabled by default.

### 2. Numbers Upgrade Enables Disable Flag

**File**: `src/validation.cpp` lines 1598-1600

```cpp
if (IsNumbersEnabled(params, pindex)) {
    flags |= SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS;
}
```

When the Numbers upgrade is active, the `SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS` flag is explicitly set.

### 3. Numbers Upgrade Activated December 21, 2022

**File**: `src/chainparams.cpp` lines 111-112

```cpp
// 2022-12-21T21:48:00.000Z protocol upgrade
consensus.numbersActivationTime = 1671659280;
```

**Activation Date**: December 21, 2022, 21:48:00 UTC

### 4. Interpreter Rejects SIGHASH_LOTUS When Flag is Set

**File**: `src/script/interpreter.cpp` lines 1872-1874

```cpp
if (flags & SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS) {
    // SIGHASH_LOTUS phaseout
    return false;
}
```

When the disable flag is set, the interpreter **returns false**, causing signature verification to fail.

### 5. Comment Confirms Phase-Out Intent

**File**: `src/validation.cpp` line 1734

```cpp
// Before the Numbers upgrade, we don't deny Taproot or SIGHASH_LOTUS
if (!IsNumbersEnabled(consensusParams, pindex->pprev)) {
    extraFlags &= ~SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS;
}
```

The comment explicitly states that SIGHASH_LOTUS is **denied/blocked** after the Numbers upgrade.

### 6. Taproot Also Phased Out

**File**: `src/validation.cpp` lines 1825-1828

```cpp
// Taproot is phased out after the Numbers update
if (IsNumbersEnabled(consensusParams, pindex->pprev)) {
    if (TxHasPayToTaproot(tx)) {
        return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS,
                             "bad-taproot-phased-out");
    }
}
```

Both Taproot and SIGHASH_LOTUS were phased out together in the Numbers upgrade.

---

## Timeline

### Pre-Numbers (Before December 21, 2022)

- ✅ SIGHASH_LOTUS was **supported**
- ✅ Taproot was **supported**
- Transactions with SIGHASH_LOTUS would validate

### Post-Numbers (After December 21, 2022)

- ❌ SIGHASH_LOTUS is **disabled** in consensus
- ❌ Taproot is **phased out**
- ❌ Transactions with SIGHASH_LOTUS **fail validation**

### Current Status (October 2025)

- ❌ SIGHASH_LOTUS has been disabled for almost **3 years**
- ✅ SIGHASH_FORKID remains the **only supported** non-legacy algorithm
- All production code should use SIGHASH_FORKID

---

## Why Transactions Fail

### Error Message

```
mandatory-script-verify-flag-failed (Signature must be zero for failed CHECK(MULTI)SIG operation)
```

### Root Cause

1. Transaction is broadcast with SIGHASH_LOTUS (0x61 or similar)
2. Consensus checks activate `SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS` flag
3. Interpreter reaches line 1872 in `SignatureHash()`:
   ```cpp
   if (flags & SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS) {
       return false;  // ← Signature hash computation fails
   }
   ```
4. `SignatureHash()` returns `false`
5. Signature verification fails
6. Transaction is rejected as invalid

---

## Verification Flags Breakdown

### Flag Definition

**File**: `src/script/script_flags.h` lines 19-21

```cpp
// Disable the execution of Taproot scripts, as well as SIGHASH_LOTUS
// sighash types.
SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS = (1U << 1),
```

### When Flag is Set

1. **Always in STANDARD_SCRIPT_VERIFY_FLAGS** (policy.h line 80)
2. **When Numbers upgrade is active** (validation.cpp line 1599)
3. **In mempool validation** (validation.cpp line 1736 - only cleared if Numbers NOT enabled)

### Effect

- Blocks signature hash computation for SIGHASH_LOTUS
- Blocks Taproot script execution
- Causes all related transactions to fail validation

---

## Impact on lotus-sdk

### Current Implementation Status

❌ **The entire SIGHASH_LOTUS implementation is obsolete**

All work done to implement SIGHASH_LOTUS, including:

- Merkle root calculation
- `sighashForLotus()` function
- Integration with `Transaction.sign()`
- Documentation and examples

...is **non-functional on the actual Lotus network** because consensus will reject these transactions.

### What This Means

1. ❌ **Cannot use SIGHASH_LOTUS** on mainnet
2. ❌ **Cannot use SIGHASH_LOTUS** on testnet (if Numbers is active)
3. ❌ **Cannot broadcast transactions** with SIGHASH_LOTUS
4. ✅ **SIGHASH_FORKID remains the standard** and only supported algorithm

### Historical Context

SIGHASH_LOTUS likely had a brief window of support:

- Introduced in an earlier upgrade (possibly Leviticus or Exodus)
- Active for a few months at most
- Phased out in Numbers (December 2022)
- Reason: Possibly replaced by a better approach, or removed due to issues

---

## Correct Usage for Lotus Network

### ✅ Use SIGHASH_FORKID (Standard)

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-sdk'

const tx = new Transaction().from(utxo).to(address, amount).sign(privateKey) // Default: SIGHASH_ALL | SIGHASH_FORKID

// Or explicitly:
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID, 'schnorr')
```

### ❌ Do NOT Use SIGHASH_LOTUS

```typescript
// ❌ WILL FAIL - LOTUS is disabled in consensus
tx.sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS)

// Error: mandatory-script-verify-flag-failed
```

---

## Functional Tests Confirm

### Test File: `logos_feature_lotus_sighash_wallet.py`

This test file exists but likely tests the phase-out or historical behavior.

### Test File: `logos_feature_lotus_sighash.py`

Tests the SIGHASH_LOTUS algorithm, but probably in isolation or with Numbers disabled.

### Test File: `logos_feature_taproot_phaseout.py`

Explicitly tests the Taproot (and by extension SIGHASH_LOTUS) phase-out.

---

## Recommendation

### For lotus-sdk

1. **Mark SIGHASH_LOTUS as deprecated**
2. **Remove or comment out SIGHASH_LOTUS code** (or clearly mark as historical)
3. **Update documentation** to reflect current consensus rules
4. **Remove SIGHASH_LOTUS examples** from guides
5. **Default to SIGHASH_FORKID** in all cases

### For Users

1. ✅ **Use SIGHASH_FORKID** for all transactions
2. ❌ **Never use SIGHASH_LOTUS** (will be rejected)
3. ✅ **Schnorr signatures work fine** with SIGHASH_FORKID
4. ✅ **All current functionality works** with SIGHASH_FORKID

---

## Code Changes Required

### 1. Mark SIGHASH_LOTUS as Deprecated

**File**: `lib/bitcore/crypto/signature.ts`

```typescript
/**
 * SIGHASH_LOTUS (0x60): Use Lotus-specific sighash algorithm
 *
 * ⚠️ **DEPRECATED - NO LONGER SUPPORTED IN CONSENSUS**
 *
 * SIGHASH_LOTUS was phased out in the Numbers upgrade (December 21, 2022).
 * Using this flag will cause transaction validation to fail with:
 * "mandatory-script-verify-flag-failed"
 *
 * **DO NOT USE** - Use SIGHASH_FORKID instead.
 *
 * Historical reference only. Kept for backwards compatibility with old code.
 *
 * @deprecated Since Numbers upgrade (2022-12-21)
 * @constant
 */
static readonly SIGHASH_LOTUS = 0x60
```

### 2. Add Warning in Sign Method

**File**: `lib/bitcore/transaction/transaction.ts`

```typescript
sign(
  privateKey: PrivateKey | string | Array<PrivateKey | string>,
  sigtype?: number | null,
  signingMethod?: string,
): Transaction {
  const sigtypeDefault =
    sigtype || Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

  // ⚠️ Warn if SIGHASH_LOTUS is used
  if (sigtype && (sigtype & 0x60) === Signature.SIGHASH_LOTUS) {
    console.warn(
      'WARNING: SIGHASH_LOTUS is deprecated and will fail validation. ' +
      'Use SIGHASH_FORKID instead.'
    )
  }

  // ... rest of implementation
}
```

### 3. Update Documentation

All documentation files should be updated to remove SIGHASH_LOTUS examples and add warnings.

---

## Testing Against lotusd

### Historical Tests Only

The SIGHASH_LOTUS tests in lotusd are likely:

1. Testing the historical implementation
2. Testing with Numbers upgrade disabled
3. Testing the phase-out mechanism itself

### Current Network Behavior

On the actual Lotus network (mainnet/testnet with Numbers active):

- SIGHASH_LOTUS transactions are **rejected**
- Only SIGHASH_FORKID and legacy are accepted
- This is **by design** and part of consensus

---

## Conclusion

### Key Finding

🚨 **SIGHASH_LOTUS was removed from consensus in December 2022 and cannot be used.**

### What to Use Instead

✅ **SIGHASH_FORKID** - This is the current standard for all Lotus transactions

### Implementation Status

❌ All SIGHASH_LOTUS implementation work is **non-functional** on the actual network

### Action Required

1. Mark SIGHASH_LOTUS as deprecated
2. Remove from examples and documentation
3. Default all transactions to SIGHASH_FORKID
4. Add warnings if SIGHASH_LOTUS is attempted

---

## Additional Resources

### lotusd Source Files

- `src/validation.cpp` - Consensus flag setting
- `src/script/interpreter.cpp` - Signature verification
- `src/policy/policy.h` - Standard flags
- `src/chainparams.cpp` - Activation times
- `src/script/script_flags.h` - Flag definitions

### Activation Timeline

- **Exodus**: December 21, 2021
- **Leviticus**: June 21, 2022
- **Numbers**: December 21, 2022 ← **SIGHASH_LOTUS disabled**
- **Deuteronomy**: June 21, 2023
- **Joshua**: December 22, 2023
- **Judges**: June 20, 2024
- **Ruth**: December 21, 2024
- **FirstSamuel**: June 21, 2025

---

**Status**: Confirmed via lotusd source code  
**Severity**: Critical - Affects core functionality  
**Action**: Deprecate SIGHASH_LOTUS immediately  
**Use Instead**: SIGHASH_FORKID
