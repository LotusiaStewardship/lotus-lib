# Taproot Addresses in lotus-lib

**Date**: October 28, 2025  
**Status**: ✅ Implemented

---

## Overview

Taproot addresses are now fully supported in lotus-lib using both Legacy and XAddress encoding formats.

---

## Address Types

Lotus supports three address types:

1. **PayToPublicKeyHash** (P2PKH) - type: `'pubkeyhash'`
2. **PayToScriptHash** (P2SH) - type: `'scripthash'`
3. **PayToTaproot** (P2TR) - type: `'taproot'` ✨ NEW

---

## Creating Taproot Addresses

### Method 1: From Tweaked Commitment

```typescript
import { Address, tweakPublicKey } from 'lotus-lib'

const privateKey = new PrivateKey()
const internalPubKey = privateKey.publicKey

// Tweak the public key (for key-path only, merkle root is all zeros)
const commitment = tweakPublicKey(internalPubKey, Buffer.alloc(32))

// Create Taproot address
const taprootAddress = Address.fromTaprootCommitment(commitment, 'livenet')

console.log('Taproot address:', taprootAddress.toString())
console.log('Type:', taprootAddress.type) // 'taproot'
console.log('Is Taproot:', taprootAddress.isTaproot()) // true
```

### Method 2: From Taproot Script

```typescript
import { Address, Script, buildKeyPathTaproot } from 'lotus-lib'

const taprootScript = buildKeyPathTaproot(publicKey)
const taprootAddress = taprootScript.toAddress('livenet')

console.log('Taproot address:', taprootAddress.toString())
```

### Method 3: From Script with Script Tree

```typescript
import { buildScriptPathTaproot } from 'lotus-lib'

const tree = {
  type: 'branch',
  left: { type: 'leaf', script: script1 },
  right: { type: 'leaf', script: script2 },
}

const { script } = buildScriptPathTaproot(publicKey, tree)
const address = script.toAddress('livenet')

console.log('Taproot address:', address.toString())
```

---

## Using Taproot Addresses

### Send to Taproot Address

```typescript
import { Transaction } from 'lotus-lib'

const tx = new Transaction()
  .from(utxo)
  .to(taprootAddress, 100000) // Send to Taproot address
  .sign(privateKey)
```

### Convert Address to Script

```typescript
import { Script, Address } from 'lotus-lib'

const script = Script.fromAddress(taprootAddress)

console.log('Script:', script.toString())
console.log('Is P2TR:', script.isPayToTaproot()) // true
```

---

## XAddress Format for Taproot

### Encoding

Taproot addresses use XAddress format with type byte **2**:

```
Format: <prefix><network_char><type_byte><payload><checksum>

- prefix: "lotus" (default)
- network_char: "_" (mainnet), "t" (testnet), "r" (regtest)
- type_byte: 2 (for Taproot)
- payload: 33-byte commitment public key
- checksum: 4-byte hash checksum
```

### Example XAddress

```typescript
import { XAddress, tweakPublicKey } from 'lotus-lib'

const commitment = tweakPublicKey(publicKey, Buffer.alloc(32))

// Create XAddress for Taproot
const xaddr = new XAddress(commitment.toBuffer(), 'livenet', 'taproot', 'lotus')

console.log('XAddress:', xaddr.toString())
// Output: lotus_<base32_encoded_commitment_and_checksum>
```

---

## Address Type Detection

### Check Address Type

```typescript
const address = Address.fromString(addressString)

if (address.isTaproot()) {
  console.log('This is a Taproot address')
  console.log('Commitment:', address.hashBuffer.toString('hex'))
}

if (address.isPayToPublicKeyHash()) {
  console.log('This is a P2PKH address')
}

if (address.isPayToScriptHash()) {
  console.log('This is a P2SH address')
}
```

---

## Type Byte Mapping

| Address Type | Type String  | Type Byte (XAddress) |
| ------------ | ------------ | -------------------- |
| P2PKH        | 'pubkeyhash' | 0                    |
| P2SH         | 'scripthash' | 0 (same as P2PKH)    |
| P2TR         | 'taproot'    | 2                    |

---

## Complete Example

```typescript
import {
  Transaction,
  PrivateKey,
  Signature,
  Address,
  Script,
  buildKeyPathTaproot,
  tweakPublicKey,
} from 'lotus-lib'

// Step 1: Create Taproot address
const privateKey = new PrivateKey()
const commitment = tweakPublicKey(privateKey.publicKey, Buffer.alloc(32))
const taprootAddress = Address.fromTaprootCommitment(commitment, 'livenet')

console.log('Created Taproot address:', taprootAddress.toString())
console.log('Type:', taprootAddress.type) // 'taproot'

// Step 2: Get XAddress format
const xaddress = taprootAddress.toXAddress()
console.log('XAddress:', xaddress)

// Step 3: Send funds to Taproot address
const fundingTx = new Transaction()
  .from(utxo)
  .to(taprootAddress, 100000)
  .sign(fundingPrivateKey)

// Step 4: Spend from Taproot address
const taprootScript = buildKeyPathTaproot(privateKey.publicKey)
const spendingTx = new Transaction()
  .from({
    txId: fundingTx.id,
    outputIndex: 0,
    script: taprootScript,
    satoshis: 100000,
  })
  .to(recipientAddress, 95000)
  .sign(privateKey, Signature.SIGHASH_ALL | Signature.SIGHASH_LOTUS, 'schnorr')

console.log('Taproot transaction:', spendingTx.serialize())
```

---

## Address Conversion

### Script → Address → Script

```typescript
// Create Taproot script
const taprootScript = buildKeyPathTaproot(publicKey)

// Convert to address
const address = taprootScript.toAddress('livenet')

// Convert back to script
const reconstructedScript = Script.fromAddress(address)

// Verify they match
console.log(
  'Match:',
  taprootScript.toBuffer().equals(reconstructedScript.toBuffer()),
)
```

---

## API Reference

### Address Methods

```typescript
// Static methods
Address.fromTaprootCommitment(commitment: PublicKey | Buffer, network?: Network | string): Address

// Instance methods
address.isTaproot(): boolean
```

### XAddress Methods

```typescript
// Instance methods
xaddress.isTaproot(): boolean
xaddress.isPayToPublicKeyHash(): boolean
xaddress.isPayToScriptHash(): boolean
```

### Script Methods

```typescript
// For Taproot scripts
script.isPayToTaproot(): boolean
script.toAddress(network?: Network | string): Address | null

// Static methods
Script.fromAddress(address: Address | string): Script
Script.buildPayToTaproot(commitment: PublicKey | Buffer, state?: Buffer): Script
```

---

## Important Notes

### hashBuffer Semantics

For different address types, `hashBuffer` has different meanings:

- **P2PKH**: 20-byte hash160 of public key
- **P2SH**: 20-byte hash160 of script
- **P2TR**: **33-byte commitment public key** (NOT a hash!)

This is intentional - Taproot uses the full commitment key, not a hash.

### Address String Format

- **Legacy**: Base58Check encoding with version byte
- **XAddress**: Custom base32 encoding with type byte

Both formats support Taproot with type byte 2.

---

## Testing

### Test Address Creation

```typescript
import { Address, buildKeyPathTaproot, tweakPublicKey } from 'lotus-lib'

const privateKey = new PrivateKey()
const commitment = tweakPublicKey(privateKey.publicKey, Buffer.alloc(32))

// Create address
const address = Address.fromTaprootCommitment(commitment, 'livenet')

// Validate
console.assert(address.isTaproot(), 'Should be Taproot')
console.assert(
  address.hashBuffer.length === 33,
  'Should have 33-byte commitment',
)
console.assert(address.type === 'taproot', 'Type should be taproot')

// Round-trip test
const script = Script.fromAddress(address)
console.assert(script.isPayToTaproot(), 'Script should be P2TR')

const reconstructedAddress = script.toAddress('livenet')
console.assert(
  reconstructedAddress.hashBuffer.equals(address.hashBuffer),
  'Should match original',
)

console.log('✓ All tests passed')
```

---

## Summary

✅ **Taproot addresses fully implemented**:

- Create from commitment public key
- Convert to/from scripts
- XAddress encoding support
- Type detection methods
- Full integration with Transaction class

**Usage**:

```typescript
const address = Address.fromTaprootCommitment(commitment, 'livenet')
tx.to(address, amount)
```

---

**Status**: Production Ready  
**Encoding**: Legacy + XAddress  
**Type Byte**: 2 (XAddress format)  
**Size**: 33 bytes (commitment key)
