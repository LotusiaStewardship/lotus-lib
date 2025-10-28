# SIGHASH_LOTUS Usage Examples

Complete examples demonstrating how to use SIGHASH_LOTUS in lotus-lib.

---

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Multiple Inputs](#multiple-inputs)
3. [Different Sighash Types](#different-sighash-types)
4. [Schnorr Signatures](#schnorr-signatures)
5. [Verification](#verification)
6. [Error Handling](#error-handling)
7. [Migration from SIGHASH_FORKID](#migration-from-sighash_forkid)

---

## Basic Usage

### Simple P2PKH Transaction with SIGHASH_LOTUS

```typescript
import { Transaction, PrivateKey, Signature, Address } from 'lotus-lib'

// Create private key and address
const privateKey = new PrivateKey()
const address = privateKey.toAddress()

// Create UTXO to spend
const utxo = {
  txId: 'previous_transaction_id',
  outputIndex: 0,
  address: address.toString(),
  script: address.toScript(),
  satoshis: 100000,
}

// Create and sign transaction with SIGHASH_LOTUS
const tx = new Transaction()
  .from(utxo) // Automatically attaches output info
  .to('lotus:qz...recipient', 90000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )

console.log('Transaction signed with SIGHASH_LOTUS!')
console.log('Serialized:', tx.serialize())
console.log('Spent outputs:', tx.spentOutputs)
```

---

## Multiple Inputs

### Transaction with Multiple UTXOs

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

// Multiple UTXOs
const utxos = [
  {
    txId: 'tx1',
    outputIndex: 0,
    address: privateKey.toAddress().toString(),
    script: privateKey.toAddress().toScript(),
    satoshis: 50000,
  },
  {
    txId: 'tx2',
    outputIndex: 1,
    address: privateKey.toAddress().toString(),
    script: privateKey.toAddress().toScript(),
    satoshis: 75000,
  },
  {
    txId: 'tx3',
    outputIndex: 0,
    address: privateKey.toAddress().toString(),
    script: privateKey.toAddress().toScript(),
    satoshis: 100000,
  },
]

// Create transaction with all UTXOs
const tx = new Transaction()
  .from(utxos) // Array of UTXOs - all outputs automatically tracked
  .to('lotus:qz...recipient', 200000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )

// Verify all spent outputs are tracked
console.log(`Signing ${tx.inputs.length} inputs`)
console.log(`Spent outputs tracked: ${tx.spentOutputs?.length}`)
console.log('Transaction size:', tx.toBuffer().length, 'bytes')
```

---

## Different Sighash Types

### SIGHASH_SINGLE | SIGHASH_LOTUS

Signs only the input and corresponding output at the same index.

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

const tx = new Transaction()
  .from(utxo)
  .to('lotus:qz...recipient1', 40000)
  .to('lotus:qz...recipient2', 40000)
  .sign(
    privateKey,
    Signature.SIGHASH_SINGLE |
      Signature.SIGHASH_LOTUS |
      Signature.SIGHASH_FORKID,
  )

console.log('Signed with SIGHASH_SINGLE | SIGHASH_LOTUS')
console.log('Only input 0 and output 0 are committed')
```

### SIGHASH_ANYONECANPAY | SIGHASH_LOTUS

Signs only one input, allows others to add more inputs.

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

const tx = new Transaction()
  .from(utxo1)
  .from(utxo2)
  .to('lotus:qz...recipient', 150000)
  .sign(
    privateKey,
    Signature.SIGHASH_ANYONECANPAY |
      Signature.SIGHASH_ALL |
      Signature.SIGHASH_LOTUS |
      Signature.SIGHASH_FORKID,
  )

console.log('Signed with ANYONECANPAY | ALL | LOTUS')
console.log('Others can add more inputs to this transaction')
```

---

## Schnorr Signatures

### Using Schnorr with SIGHASH_LOTUS

Schnorr signatures are smaller and more efficient than ECDSA.

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

// Sign with Schnorr algorithm
const tx = new Transaction()
  .from(utxo)
  .to('lotus:qz...recipient', 90000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
    'schnorr', // ← Specify Schnorr signing
  )

console.log('Transaction signed with Schnorr + SIGHASH_LOTUS')
console.log('Signature is 64 bytes (vs ~72 for ECDSA)')

// Get the signature from the first input
const sig = tx.inputs[0].script!.chunks[0].buf!
console.log('Signature length:', sig.length, 'bytes')
```

### Multiple Keys with Schnorr

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey1 = new PrivateKey()
const privateKey2 = new PrivateKey()

const utxos = [
  {
    txId: 'tx1',
    outputIndex: 0,
    address: privateKey1.toAddress().toString(),
    script: privateKey1.toAddress().toScript(),
    satoshis: 50000,
  },
  {
    txId: 'tx2',
    outputIndex: 0,
    address: privateKey2.toAddress().toString(),
    script: privateKey2.toAddress().toScript(),
    satoshis: 50000,
  },
]

// Create transaction and sign with multiple keys
const tx = new Transaction().from(utxos).to('lotus:qz...recipient', 90000)

// Sign with first key (Schnorr)
tx.sign(
  privateKey1,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  'schnorr',
)

// Sign with second key (Schnorr)
tx.sign(
  privateKey2,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  'schnorr',
)

console.log('All inputs signed with Schnorr + SIGHASH_LOTUS')
```

---

## Verification

### Verify SIGHASH_LOTUS Signatures

```typescript
import { Transaction, verify } from 'lotus-lib'

// Parse a signed transaction
const tx = Transaction.fromString(signedTxHex)

// Verify each signature
for (let i = 0; i < tx.inputs.length; i++) {
  const input = tx.inputs[i]

  if (!input.script || !input.output) {
    console.log(`Input ${i}: Missing script or output info`)
    continue
  }

  // Extract signature and public key from input script
  const sig = input.script.chunks[0].buf
  const pubkey = input.script.chunks[1].buf

  // Verify the signature
  const isValid = verify(
    tx as any,
    Signature.fromTxFormat(sig!),
    PublicKey.fromBuffer(pubkey!),
    i,
    input.output.script,
    new BN(input.output.satoshis),
    Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID,
    sig!.length === 64 ? 'schnorr' : 'ecdsa',
  )

  console.log(`Input ${i}: ${isValid ? 'Valid ✓' : 'Invalid ✗'}`)
}
```

---

## Error Handling

### Missing Output Information

SIGHASH_LOTUS requires output information for all inputs.

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

// Create transaction without using .from() - no output info attached
const tx = new Transaction()
tx.addInput(
  new Input({
    prevTxId: Buffer.from('tx1', 'hex'),
    outputIndex: 0,
    script: Script.empty(),
    // Missing: output property!
  }),
)
tx.addOutput(new Output({ satoshis: 90000, script: recipientScript }))

try {
  // This will fail - no spent outputs available
  tx.sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )
} catch (error) {
  console.error('Error:', error.message)
  // Error: SIGHASH_LOTUS requires spent outputs for all inputs
  // (ensure all inputs have output information)
}
```

### Solution: Use .from() Method

```typescript
// ✓ Correct way - use .from() to attach output info
const tx = new Transaction()
  .from({
    txId: 'tx1',
    outputIndex: 0,
    address: privateKey.toAddress().toString(),
    script: privateKey.toAddress().toScript(),
    satoshis: 100000,
  })
  .to('lotus:qz...recipient', 90000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )

console.log('Success! All outputs tracked:', tx.spentOutputs?.length)
```

---

## Migration from SIGHASH_FORKID

### Before (SIGHASH_FORKID)

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

// Standard SIGHASH_FORKID transaction
const tx = new Transaction()
  .from(utxo)
  .to('lotus:qz...recipient', 90000)
  .sign(privateKey) // Default: SIGHASH_ALL | SIGHASH_FORKID

console.log('Uses BIP143 sighash algorithm')
```

### After (SIGHASH_LOTUS)

```typescript
import { Transaction, PrivateKey, Signature } from 'lotus-lib'

const privateKey = new PrivateKey()

// SIGHASH_LOTUS transaction - everything else is the same!
const tx = new Transaction()
  .from(utxo) // Still use .from() to track outputs
  .to('lotus:qz...recipient', 90000)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )

console.log('Uses Lotus merkle tree sighash algorithm')
console.log('Better scaling and validation efficiency')
```

### Key Differences

| Aspect                | SIGHASH_FORKID             | SIGHASH_LOTUS                       |
| --------------------- | -------------------------- | ----------------------------------- |
| Algorithm             | BIP143 (simple hashing)    | Merkle tree commitments             |
| Input commitment      | hashPrevouts (single hash) | Merkle root + height                |
| Output commitment     | hashOutputs (single hash)  | Merkle root + height                |
| Spent output tracking | Only current input         | All spent outputs (merkle root)     |
| Validation efficiency | Standard                   | More efficient for batch validation |
| Transaction size      | Same                       | Same                                |
| Usage                 | `.sign(privateKey)`        | `.sign(privateKey, SIGHASH_LOTUS)`  |
| Backward compatible   | Yes                        | Yes (FORKID still works)            |

---

## Advanced: Inspecting Spent Outputs

### View Spent Output Details

```typescript
import { Transaction } from 'lotus-lib'

const tx = new Transaction()
  .from(utxo1)
  .from(utxo2)
  .from(utxo3)
  .to('lotus:qz...recipient', 250000)

// Check if transaction has spent outputs
if (tx.spentOutputs) {
  console.log(`Transaction has ${tx.spentOutputs.length} spent outputs:`)

  tx.spentOutputs.forEach((output, i) => {
    console.log(`  Input ${i}:`)
    console.log(`    Amount: ${output.satoshis} satoshis`)
    console.log(`    Script: ${output.script.toString()}`)
    console.log(`    Script type: ${output.script.classify()}`)
  })

  // Calculate total input amount
  const totalInput = tx.spentOutputs.reduce((sum, out) => sum + out.satoshis, 0)
  console.log(`  Total input: ${totalInput} satoshis`)
} else {
  console.log('Warning: No spent outputs available')
  console.log('Use .from() to add inputs with output information')
}
```

---

## Best Practices

### 1. Always Use `.from()` for SIGHASH_LOTUS

```typescript
// ✓ Good
const tx = new Transaction()
  .from(utxo) // Automatically tracks output
  .to(address, amount)
  .sign(privateKey, SIGHASH_LOTUS)

// ✗ Bad - manual input addition doesn't track outputs
const tx = new Transaction()
tx.addInput(new Input({ prevTxId, outputIndex })) // No output info!
```

### 2. Verify Spent Outputs Before Signing

```typescript
const tx = new Transaction().from(utxo1).from(utxo2).to(address, amount)

// Check before signing
if (!tx.spentOutputs || tx.spentOutputs.length !== tx.inputs.length) {
  throw new Error('Not all inputs have output information')
}

// Now safe to sign with SIGHASH_LOTUS
tx.sign(
  privateKey,
  Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
)
```

### 3. Use Schnorr for Smaller Transactions

```typescript
// Schnorr signatures are ~64 bytes vs ~72 for ECDSA
const tx = new Transaction()
  .from(utxo)
  .to(address, amount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
    'schnorr', // Smaller, more efficient
  )
```

### 4. Handle Errors Gracefully

```typescript
import { Transaction, Signature } from 'lotus-lib'

function signWithLotus(tx: Transaction, privateKey: PrivateKey): Transaction {
  try {
    return tx.sign(
      privateKey,
      Signature.SIGHASH_ALL |
        Signature.SIGHASH_LOTUS |
        Signature.SIGHASH_FORKID,
    )
  } catch (error) {
    if (error.message.includes('SIGHASH_LOTUS requires spent outputs')) {
      console.error('Missing output information for inputs')
      console.error('Use .from(utxo) to add inputs with output info')
    }
    throw error
  }
}
```

---

## Complete Working Example

```typescript
import {
  Transaction,
  PrivateKey,
  Signature,
  Address,
  Script,
  UnspentOutput,
} from 'lotus-lib'

// Setup
const privateKey = new PrivateKey()
const address = privateKey.toAddress()
const recipientAddress = Address.fromString('lotus:qz...recipient')

// Create UTXOs (normally from blockchain query)
const utxos: UnspentOutput[] = [
  {
    txId: 'a'.repeat(64),
    outputIndex: 0,
    address: address.toString(),
    script: Script.buildPublicKeyHashOut(address),
    satoshis: 100000,
  },
  {
    txId: 'b'.repeat(64),
    outputIndex: 1,
    address: address.toString(),
    script: Script.buildPublicKeyHashOut(address),
    satoshis: 150000,
  },
]

// Create and sign transaction
const tx = new Transaction()
  .from(utxos) // Add all UTXOs
  .to(recipientAddress, 200000) // Send 200,000 satoshis
  .fee(1000) // Set fee
  .change(address) // Change back to our address
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
    'schnorr', // Use Schnorr signatures
  )

// Verify transaction
console.log('✓ Transaction created and signed')
console.log(`  Inputs: ${tx.inputs.length}`)
console.log(`  Outputs: ${tx.outputs.length}`)
console.log(`  Spent outputs tracked: ${tx.spentOutputs?.length}`)
console.log(`  Transaction size: ${tx.toBuffer().length} bytes`)
console.log(`  Transaction ID: ${tx.id}`)
console.log(`  Serialized: ${tx.serialize()}`)

// Verify it's valid
const isValid = tx.verify()
console.log(`  Valid: ${isValid === true ? '✓' : '✗ ' + isValid}`)
```

---

## Summary

SIGHASH_LOTUS is now fully integrated into lotus-lib:

- ✅ Use `Transaction.sign()` with `SIGHASH_LOTUS` flag
- ✅ Automatically tracks spent outputs via `.from()`
- ✅ Works with both ECDSA and Schnorr signatures
- ✅ Supports all sighash type combinations
- ✅ 100% backward compatible with existing code
- ✅ Clean, intuitive API

**Quick Reference:**

```typescript
// Standard SIGHASH_FORKID (default)
tx.from(utxo).to(address, amount).sign(privateKey)

// SIGHASH_LOTUS (merkle tree algorithm)
tx.from(utxo)
  .to(address, amount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
  )

// SIGHASH_LOTUS with Schnorr
tx.from(utxo)
  .to(address, amount)
  .sign(
    privateKey,
    Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS | Signature.SIGHASH_FORKID,
    'schnorr',
  )
```

For more details, see `SIGHASH_LOTUS_IMPLEMENTATION.md`.
