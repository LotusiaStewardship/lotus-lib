# SIGHASH_LOTUS: Complete Technical Analysis

**Date**: October 28, 2025  
**Status**: Historical Analysis (Feature Phased Out December 2022)

---

## Executive Summary

SIGHASH_LOTUS was an advanced signature hash algorithm implemented in Lotus that used merkle trees instead of simple hashes for transaction commitments. It was designed to enable more efficient validation and future optimizations, particularly for Taproot support. However, it was phased out along with Taproot in the Numbers upgrade (December 21, 2022) and is no longer supported in consensus.

---

## Implementation Overview

### Algorithm Location

**File**: `lotusd/src/script/interpreter.cpp` lines 1782-1846

### Core Function Signature

```cpp
template <class T>
bool SignatureHashLotus(
    uint256 &hash_out,
    const std::optional<ScriptExecutionData> &execdata,
    const T &tx_to,
    uint32_t in_pos,
    SigHashType sig_hash_type,
    const PrecomputedTransactionData &cache
)
```

### Requirements

1. **Must use SIGHASH_FORKID**: LOTUS flag (0x60) must be combined with FORKID
2. **Requires PrecomputedTransactionData**: Contains merkle roots computed ahead of time
3. **Spent outputs required**: All spent outputs must be available in the cache
4. **Base type required**: Must include ALL, NONE, or SINGLE base type

---

## Serialization Format

The SIGHASH_LOTUS algorithm hashes the following data in order:

### 1. Hash Type (4 bytes LE)

```cpp
ss << hash_type;  // SIGHASH_ALL | SIGHASH_LOTUS = 0x61
```

### 2. Input Hash (32 bytes)

```cpp
{
    const uint8_t spend_type = bool(execdata) << 1;
    CHashWriter input_hash(SER_GETHASH, 0);
    input_hash << spend_type;                    // 1 byte: 0 or 2
    input_hash << tx_to.vin[in_pos].prevout;     // 36 bytes: txid + index
    input_hash << tx_to.vin[in_pos].nSequence;   // 4 bytes
    input_hash << cache.m_spent_outputs[in_pos]; // var: spent output
    ss << input_hash.GetHash();                  // 32 bytes: hash of above
}
```

### 3. Execdata (if present)

```cpp
if (execdata) {
    ss << execdata->m_codeseparator_pos;     // 4 bytes LE
    ss << execdata->m_executed_script_hash;  // 32 bytes
}
```

### 4. Input Commitments (if not ANYONECANPAY)

```cpp
if (!sig_hash_type.hasAnyoneCanPay()) {
    ss << in_pos;                                   // 4 bytes LE: input index
    ss << cache.m_inputs_spent_outputs_merkle_root; // 32 bytes: merkle root
    ss << (cache.m_amount_inputs_sum / SATOSHI);    // 8 bytes LE: total input amount
}
```

### 5. Output Amount (if ALL)

```cpp
if (sig_hash_type.getBaseType() == BaseSigHashType::ALL) {
    ss << (cache.m_amount_outputs_sum / SATOSHI);  // 8 bytes LE
}
```

### 6. Version

```cpp
ss << tx_to.nVersion;  // 4 bytes LE
```

### 7. Inputs Merkle Commitment (if not ANYONECANPAY)

```cpp
if (!sig_hash_type.hasAnyoneCanPay()) {
    ss << cache.m_inputs_merkle_root;    // 32 bytes
    ss << uint8_t(cache.m_inputs_merkle_height);  // 1 byte
}
```

### 8. Output Commitment (based on type)

```cpp
if (sig_hash_type.getBaseType() == BaseSigHashType::SINGLE) {
    if (in_pos >= tx_to.vout.size()) {
        return false;
    }
    ss << SerializeHash(tx_to.vout[in_pos]);  // 32 bytes: single output hash
}

if (sig_hash_type.getBaseType() == BaseSigHashType::ALL) {
    ss << cache.m_outputs_merkle_root;    // 32 bytes
    ss << uint8_t(cache.m_outputs_merkle_height);  // 1 byte
}
```

### 9. Locktime

```cpp
ss << tx_to.nLockTime;  // 4 bytes LE
```

### 10. Final Hash

```cpp
hash_out = ss.GetHash();  // SHA256D of entire buffer
```

---

## Merkle Tree Implementation

### Merkle Root Computation

**File**: `lotusd/src/consensus/merkle.cpp` lines 8-23

```cpp
uint256 ComputeMerkleRoot(std::vector<uint256> hashes, size_t &num_layers) {
    if (hashes.size() == 0) {
        num_layers = 0;
        return uint256();  // NULL hash (all zeros)
    }
    num_layers = 1;
    while (hashes.size() > 1) {
        num_layers++;
        if (hashes.size() & 1) {
            hashes.push_back(uint256());  // Pad with null hash if odd
        }
        SHA256D64(hashes[0].begin(), hashes[0].begin(), hashes.size() / 2);
        hashes.resize(hashes.size() / 2);
    }
    return hashes[0];
}
```

### Inputs Merkle Root

**File**: `lotusd/src/consensus/merkle.cpp` lines 38-48

```cpp
uint256 TxInputsMerkleRoot(const std::vector<CTxIn> &vin, size_t &num_layers) {
    std::vector<uint256> leaves;
    leaves.resize(vin.size());
    for (size_t i = 0; i < vin.size(); i++) {
        CHashWriter leaf_hash(SER_GETHASH, 0);
        leaf_hash << vin[i].prevout;     // prevout = txid + output_index
        leaf_hash << vin[i].nSequence;   // sequence number
        leaves[i] = leaf_hash.GetHash();
    }
    return ComputeMerkleRoot(std::move(leaves), num_layers);
}
```

**Each leaf**: `hash256(prevout || nSequence)`

### Outputs Merkle Root

**File**: `lotusd/src/consensus/merkle.cpp` lines 50-58

```cpp
uint256 TxOutputsMerkleRoot(const std::vector<CTxOut> &vout, size_t &num_layers) {
    std::vector<uint256> leaves;
    leaves.resize(vout.size());
    for (size_t i = 0; i < vout.size(); i++) {
        leaves[i] = SerializeHash(vout[i]);  // hash of serialized output
    }
    return ComputeMerkleRoot(std::move(leaves), num_layers);
}
```

**Each leaf**: `hash256(value || script)`

### Spent Outputs Merkle Root

Similar to outputs, but for the outputs being spent:

```cpp
// Each leaf is hash of the spent output
for (auto& spent_output : spent_outputs) {
    leaves.push_back(SerializeHash(spent_output));
}
```

---

## PrecomputedTransactionData

**File**: `lotusd/src/primitives/transaction.h` lines 332-362

```cpp
struct PrecomputedTransactionData {
    // BIP143 (FORKID) data
    uint256 hashPrevouts, hashSequence, hashOutputs;

    // LOTUS-specific data
    std::vector<CTxOut> m_spent_outputs;           // All spent outputs
    uint256 m_inputs_merkle_root;                  // Merkle root of inputs
    uint256 m_inputs_spent_outputs_merkle_root;    // Merkle root of spent outputs
    size_t m_inputs_merkle_height;                 // Height of inputs tree
    uint256 m_outputs_merkle_root;                 // Merkle root of outputs
    size_t m_outputs_merkle_height;                // Height of outputs tree
    Amount m_amount_inputs_sum;                    // Total input value
    Amount m_amount_outputs_sum;                   // Total output value
};
```

This structure caches all the merkle computations to avoid recalculating them for each signature verification.

---

## Benefits of SIGHASH_LOTUS

### 1. Merkle Proof Support

**Problem with BIP143**: Uses simple hashes of all data

```cpp
hashPrevouts = hash256(all prevouts concatenated)
hashOutputs = hash256(all outputs concatenated)
```

**LOTUS Solution**: Uses merkle trees

```cpp
inputsMerkleRoot = merkle_root(hash256(prevout || sequence) for each input)
outputsMerkleRoot = merkle_root(hash256(output) for each output)
```

**Benefit**: Can provide merkle proofs to verify inclusion without full data.

### 2. Efficient Batch Validation

With merkle trees, validators can:

- Verify a subset of transactions efficiently
- Use merkle proofs for partial validation
- Skip validation of known-good subtrees

**Use Case**: Light clients, SPV proofs, fraud proofs

### 3. Better Scaling

For large transactions with many inputs/outputs:

- **BIP143**: Must rehash all data for each signature check
- **LOTUS**: Merkle roots cached, heights stored, efficient verification

**Example**: Transaction with 100 inputs

- BIP143: Hashes 3.6KB of input data per signature
- LOTUS: Uses 32-byte cached merkle root + 1-byte height

### 4. Taproot/Tapscript Support

```cpp
if (execdata) {
    ss << execdata->m_codeseparator_pos;
    ss << execdata->m_executed_script_hash;
}
```

**Benefit**: Native support for:

- OP_CODESEPARATOR position tracking
- Executed script hash (for tapscript validation)
- Spend type differentiation (key path vs script path)

### 5. Amount Commitments

```cpp
ss << (cache.m_amount_inputs_sum / SATOSHI);   // Total input amount
ss << (cache.m_amount_outputs_sum / SATOSHI);  // Total output amount
```

**Benefit**:

- Explicit commitment to total amounts
- Prevents amount-related attacks
- Makes fee explicit in signature

### 6. Future-Proof Design

The merkle tree structure enables future optimizations:

- Pruning of validated subtrees
- Parallel validation paths
- Cross-chain proofs
- Advanced covenant constructions

---

## Drawbacks of SIGHASH_LOTUS

### 1. Complexity

**Code Complexity**:

- Requires merkle tree implementation
- Multiple cached data structures
- More complex serialization format
- Additional validation logic

**Mental Model**:

- Developers must understand merkle trees
- More moving parts than simple hashing
- Harder to implement correctly

### 2. Computation Overhead

**Initial Setup Cost**:

```cpp
PrecomputedTransactionData txdata(tx, spent_outputs);
// Must compute:
// - 3 merkle roots (inputs, outputs, spent outputs)
// - 2 merkle heights
// - Sum all input amounts
// - Sum all output amounts
```

**Overhead**: For simple transactions, the merkle computation overhead exceeds savings.

### 3. Memory Requirements

```cpp
struct PrecomputedTransactionData {
    uint256 hashPrevouts, hashSequence, hashOutputs;  // 96 bytes (BIP143)
    std::vector<CTxOut> m_spent_outputs;              // Variable (all outputs)
    uint256 m_inputs_merkle_root;                     // 32 bytes
    uint256 m_inputs_spent_outputs_merkle_root;       // 32 bytes
    size_t m_inputs_merkle_height;                    // 8 bytes
    uint256 m_outputs_merkle_root;                    // 32 bytes
    size_t m_outputs_merkle_height;                   // 8 bytes
    Amount m_amount_inputs_sum;                       // 8 bytes
    Amount m_amount_outputs_sum;                      // 8 bytes
};
```

**Total**: ~224 bytes + full spent outputs storage

**vs BIP143**: ~96 bytes + no spent outputs storage

### 4. Spent Outputs Requirement

**Critical Requirement**: Must have ALL spent outputs available

```cpp
Preconditions.checkArgument(
    spentOutputs.length === transaction.inputs.length,
    'Must provide spent output for each input'
)
```

**Problem**:

- Wallets must track all spent outputs
- Cannot sign without full UTXO data
- Increases data requirements

### 5. Backwards Compatibility

- Not compatible with existing wallets/software
- Requires network-wide support
- Cannot be used incrementally

### 6. No Immediate Benefit for Simple Cases

For typical transactions (1-3 inputs, 1-2 outputs):

- Merkle tree overhead > simple hashing
- Cached data > simple data
- No practical benefit over BIP143

### 7. Interdependence with Taproot

SIGHASH_LOTUS was designed for Taproot:

```cpp
const uint8_t spend_type = bool(execdata) << 1;
```

When Taproot was phased out, SIGHASH_LOTUS lost its primary use case.

---

## Why It Was Phased Out

### Analysis of Phase-Out

**File**: `lotusd/src/validation.cpp` lines 1598-1600, 1734-1737

```cpp
if (IsNumbersEnabled(params, pindex)) {
    flags |= SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS;
}

// Before the Numbers upgrade, we don't deny Taproot or SIGHASH_LOTUS
if (!IsNumbersEnabled(consensusParams, pindex->pprev)) {
    extraFlags &= ~SCRIPT_DISABLE_TAPROOT_SIGHASH_LOTUS;
}
```

### Likely Reasons

#### 1. **Taproot Phase-Out**

SIGHASH_LOTUS was designed primarily for Taproot. When Taproot was phased out:

```cpp
// Taproot is phased out after the Numbers update
if (IsNumbersEnabled(consensusParams, pindex->pprev)) {
    if (TxHasPayToTaproot(tx)) {
        return state.Invalid(BlockValidationResult::BLOCK_CONSENSUS,
                             "bad-taproot-phased-out");
    }
}
```

**Conclusion**: No Taproot → No need for SIGHASH_LOTUS

#### 2. **Limited Adoption**

The functional tests show extensive testing but:

- No real-world usage examples found
- No wallet integration evidence
- Short support window (likely June-December 2022)

**Conclusion**: Feature not adopted by ecosystem

#### 3. **Complexity vs Benefit**

For typical Lotus transactions:

- Extra complexity not justified
- BIP143 (SIGHASH_FORKID) sufficient
- Merkle overhead > benefits for small txs

**Conclusion**: Cost > benefit for typical use cases

#### 4. **Strategic Decision**

Lotus may have decided to:

- Focus on simpler, proven approaches
- Reduce consensus complexity
- Remove features with limited adoption
- Defer advanced features to future upgrades

---

## Real-World Usage

### Test Cases (from functional tests)

The extensive test suite shows various combinations:

```python
# Basic transaction with SIGHASH_LOTUS
dict(outputs=1, sig_hash_types=[SIGHASH_ALL | SIGHASH_LOTUS])

# With Schnorr signatures
dict(outputs=1, sig_hash_types=[SIGHASH_ALL | SIGHASH_LOTUS], schnorr=True)

# Multiple outputs
dict(outputs=10, sig_hash_types=[SIGHASH_ALL | SIGHASH_LOTUS])

# ANYONECANPAY modifier
dict(outputs=2, sig_hash_types=[SIGHASH_ALL | SIGHASH_LOTUS | SIGHASH_ANYONECANPAY])

# SINGLE base type
dict(outputs=5, sig_hash_types=[SIGHASH_SINGLE | SIGHASH_LOTUS])

# With OP_CODESEPARATOR
dict(outputs=3, sig_hash_types=[SIGHASH_ALL | SIGHASH_LOTUS],
     codesep=300, opcodes=[OP_NOP]*300 + [OP_CODESEPARATOR])
```

### But NO Production Usage Found

- No examples in documentation
- No wallet implementations found
- No real transaction examples
- Only test cases exist

**Conclusion**: SIGHASH_LOTUS was implemented and tested but never saw production use before being phased out.

---

## Comparison Table

| Feature               | Legacy               | BIP143 (FORKID)    | SIGHASH_LOTUS              |
| --------------------- | -------------------- | ------------------ | -------------------------- |
| **Algorithm**         | Simple concatenation | Structured hashing | Merkle trees               |
| **Computation**       | Quadratic            | Linear             | Linear + merkle overhead   |
| **Memory**            | Minimal              | ~96 bytes cache    | ~224 bytes + outputs       |
| **Spent Outputs**     | Not required         | Only current input | All inputs required        |
| **Merkle Support**    | No                   | No                 | Yes (roots + heights)      |
| **Taproot Support**   | No                   | No                 | Yes (execdata)             |
| **Amount Commitment** | No                   | Current input only | Total input + output       |
| **Codeseparator**     | Basic                | Basic              | Advanced (position + hash) |
| **Batch Validation**  | No                   | No                 | Yes (via merkle proofs)    |
| **SPV Support**       | No                   | No                 | Yes (via merkle proofs)    |
| **Complexity**        | Low                  | Medium             | High                       |
| **Status**            | Deprecated           | ✅ Active          | ❌ Phased out              |

---

## Technical Specifications

### Hash Algorithms

- **SHA256D**: Double SHA-256 (Bitcoin standard)
- **SHA256D64**: Optimized for hashing pairs of 32-byte hashes
- **SerializeHash**: SHA256D of serialized data

### Merkle Height Formula

```cpp
if (hashes.size() == 0) {
    height = 0
} else {
    height = 1
    while (hashes.size() > 1) {
        height++
        if (odd) pad with null hash
        hash pairs
        hashes.size() /= 2
    }
}
```

**Examples**:

- 0 items → height = 0
- 1 item → height = 1
- 2 items → height = 2
- 3-4 items → height = 3
- 5-8 items → height = 4
- Formula: height = ⌈log₂(n)⌉ + 1

### Null Hash

```cpp
uint256()  // All zeros: 0000...0000 (32 bytes)
```

Used for:

- Empty merkle roots
- Padding odd-numbered arrays

---

## Code Quality and Testing

### Implementation Quality

✅ **Well-implemented**:

- Clean, readable code
- Proper error handling
- Comprehensive validation
- Good separation of concerns

### Test Coverage

✅ **Extensively tested**:

- `logos_feature_lotus_sighash.py` - 400+ lines
- `logos_feature_lotus_sighash_wallet.py` - Wallet integration
- `sighash_lotus_tests.cpp` - Unit tests
- `taproot_tests.cpp` - Integration with Taproot

### Documentation

⚠️ **Limited documentation**:

- Implementation comments present
- No specification document found
- No user documentation
- Only test cases as examples

---

## Lessons Learned

### What Worked Well

1. **Clean Implementation**: Code is well-structured and maintainable
2. **Merkle Tree Algorithm**: Solid foundation for future use
3. **Test Coverage**: Comprehensive testing ensured correctness
4. **Forward Thinking**: Designed for future features (Taproot)

### What Didn't Work

1. **Timing**: Introduced too close to Taproot phase-out
2. **Adoption**: No ecosystem uptake before deprecation
3. **Complexity**: Benefits didn't justify added complexity
4. **Use Case**: Primary use case (Taproot) was phased out

### For Future Protocol Upgrades

1. **Validate Demand**: Ensure feature has clear demand before implementation
2. **Incremental Approach**: Add complexity only when benefits are proven
3. **Ecosystem Coordination**: Get wallet/software buy-in before activation
4. **Long-term Vision**: Consider multi-upgrade roadmap dependencies

---

## Conclusion

### Summary

SIGHASH_LOTUS was a well-designed, well-implemented feature that provided:

- ✅ Merkle tree-based commitments
- ✅ Efficient batch validation potential
- ✅ Taproot/Tapscript support
- ✅ Future-proof design

However, it was phased out because:

- ❌ Limited adoption during short support window
- ❌ Primary use case (Taproot) was phased out
- ❌ Added complexity without proven benefit
- ❌ BIP143 (SIGHASH_FORKID) was sufficient for most use cases

### Current Status

- **Implemented**: Yes (in lotusd source)
- **Tested**: Yes (comprehensive test suite)
- **Activated**: Was active June-December 2022 (estimated)
- **Status**: ❌ Phased out December 21, 2022
- **Support**: ❌ No longer supported in consensus

### Recommendation

**Do NOT use SIGHASH_LOTUS** in any production code:

- Will fail validation on current network
- Use **SIGHASH_FORKID** (BIP143) instead
- SIGHASH_FORKID is battle-tested and sufficient for all current use cases

### Historical Value

The SIGHASH_LOTUS implementation remains valuable as:

- Reference for merkle tree algorithms
- Example of advanced sighash design
- Potential template for future features
- Educational resource

---

**Analysis Date**: October 28, 2025  
**Analysis Based On**: lotusd source code  
**Status**: Historical analysis of phased-out feature  
**Primary Source**: `lotusd/src/script/interpreter.cpp`
