# NFT Implementation for Lotus

**Status**: ✅ FULLY IMPLEMENTED  
**Date**: October 28, 2025

---

## Overview

Complete NFT (Non-Fungible Token) implementation for Lotus using Taproot's 32-byte state parameter. NFTs on Lotus are created using Pay-To-Taproot outputs where the state parameter contains a SHA256 hash commitment to off-chain metadata.

**Key Features**:

- ✅ **Compact storage**: 69 bytes per NFT on-chain
- ✅ **Provable metadata**: SHA256 hash commitments
- ✅ **Privacy**: Key path transfers hide trading mechanisms
- ✅ **Flexible**: Script trees enable trading, escrow, royalties
- ✅ **Collections**: Support for NFT collections with shared attributes
- ✅ **Standards**: Compatible with OpenSea metadata schema

---

## Architecture

### On-Chain Structure

**Taproot Script Format** (69 bytes):

```
OP_SCRIPTTYPE OP_1 <33-byte commitment> <32-byte metadata hash>
```

**Components**:

- `OP_SCRIPTTYPE` (1 byte): Taproot indicator
- `OP_1` (1 byte): Taproot version
- Commitment (33 bytes): Tweaked public key
- State (32 bytes): SHA256 hash of metadata

### Off-Chain Storage

Metadata stored on decentralized storage (IPFS, Arweave, etc.):

```typescript
interface NFTMetadata {
  name: string
  description: string
  image: string // IPFS CID or URL
  attributes?: NFTAttribute[]
  collection?: string
  creator?: string
}
```

**Metadata Hash**:

```typescript
const metadataJSON = JSON.stringify(metadata)
const metadataHash = SHA256(metadataJSON)
```

---

## Technical Details

### State Parameter Mechanics

The Taproot state parameter is a 32-byte field that can optionally be included in Pay-To-Taproot outputs. For NFTs, this state parameter serves as a commitment to the NFT's metadata.

**How It Works**:

1. **Metadata Preparation**: The NFT metadata (name, description, image URI, attributes) is serialized to JSON
2. **Hash Computation**: A SHA256 hash of the JSON string is computed, producing a 32-byte digest
3. **On-Chain Commitment**: This hash is included as the state parameter in the Taproot output script
4. **Verification**: Anyone can verify an NFT by fetching the metadata, computing its hash, and comparing it to the on-chain state

**Script Structure**:

```
Bytes 0-2:   OP_SCRIPTTYPE OP_1 0x21         (3 bytes: Taproot header)
Bytes 3-35:  <33-byte commitment pubkey>      (33 bytes: Tweaked public key)
Byte 36:     0x20                             (1 byte: Push 32 bytes)
Bytes 37-68: <32-byte metadata hash>          (32 bytes: State parameter)
Total: 69 bytes
```

### Provenance Chain

The provenance chain is the complete history of an NFT from its initial minting through all subsequent transfers. Because the metadata hash is embedded in the state parameter of every NFT output, it provides a cryptographic proof of authenticity and continuity.

#### How Provenance Works

**1. Minting (Genesis)**:

```typescript
// Creator mints NFT with metadata
const metadata = { name: 'Art #1', image: 'ipfs://Qm...' }
const metadataHash = SHA256(JSON.stringify(metadata))

// Create Taproot output with state
const nftScript = buildPayToTaproot(creatorPubKey, metadataHash)
```

**Transaction Structure**:

```
Mint TX:
  Inputs:  [Creator's UTXO]
  Outputs: [NFT Output (69 bytes, metadataHash in state)]
```

**2. First Transfer**:

```typescript
// Transfer preserves the EXACT same metadataHash
const transferTx = new Transaction()
  .addInput(nftInput) // Spend NFT with metadataHash: 0xabc123...
  .addOutput(
    buildPayToTaproot(buyer1PubKey, metadataHash), // Same hash!
  )
```

**Transaction Structure**:

```
Transfer TX:
  Inputs:  [NFT from Creator (state: 0xabc123...)]
  Outputs: [NFT to Buyer1 (state: 0xabc123...)]  ← MUST be identical
```

**3. Subsequent Transfers**:

Every subsequent transfer MUST preserve the same metadata hash:

```
Transfer Chain:
  Mint    → state: 0xabc123...def456...
  Transfer 1 → state: 0xabc123...def456...  ✅ Valid
  Transfer 2 → state: 0xabc123...def456...  ✅ Valid
  Transfer 3 → state: 0xdef999...xyz000...  ❌ INVALID! Different NFT
```

#### Provenance Verification Algorithm

```typescript
function verifyProvenanceChain(transfers: NFTTransfer[]): boolean {
  if (transfers.length === 0) return false

  // Extract the original metadata hash from mint
  const originalHash = transfers[0].metadataHash

  // Verify every transfer maintains the same hash
  for (const transfer of transfers) {
    if (transfer.metadataHash !== originalHash) {
      // Hash changed - provenance broken!
      return false
    }
  }

  return true // Provenance is valid
}
```

#### Provenance Data Structure

```typescript
interface NFTTransfer {
  txid: string // Transaction ID
  from: string | null // Sender (null for mint)
  to: string // Recipient address
  metadataHash: string // MUST be constant across all transfers
  timestamp: number // Transfer time
  blockHeight?: number // Block height
}

// Example provenance chain
const provenance = [
  {
    txid: '0xmint...',
    from: null,
    to: 'lotus_16PSJCreator...',
    metadataHash: '0xabc123...',
    timestamp: 1730000000,
    blockHeight: 100000,
  },
  {
    txid: '0xtransfer1...',
    from: 'lotus_16PSJCreator...',
    to: 'lotus_16PSJBuyer1...',
    metadataHash: '0xabc123...', // Same!
    timestamp: 1730100000,
    blockHeight: 100100,
  },
]
```

### Metadata Hash Immutability

**Why Immutability Matters**:

The metadata hash acts as a unique identifier for the NFT. If the hash changes, it's a different NFT entirely.

```typescript
// Scenario 1: Valid Transfer
const nft1 = buildPayToTaproot(owner1Key, hash_A)
const nft2 = buildPayToTaproot(owner2Key, hash_A) // ✅ Same NFT, new owner

// Scenario 2: Invalid - Different NFT
const nft1 = buildPayToTaproot(owner1Key, hash_A)
const nft3 = buildPayToTaproot(owner2Key, hash_B) // ❌ Different NFT!
```

**Verification Example**:

```typescript
// Validate that a transfer preserves the NFT identity
function validateTransfer(inputScript: Script, outputScript: Script): boolean {
  const inputHash = extractTaprootState(inputScript)
  const outputHash = extractTaprootState(outputScript)

  if (!inputHash || !outputHash) {
    return false // Not valid NFT scripts
  }

  return inputHash.equals(outputHash) // Must be identical
}
```

### Transaction Anatomy

#### Mint Transaction

```
Version: 2
Inputs:
  [0] Previous UTXO (funding)
      - prevTxId: <funding transaction>
      - outputIndex: 0
      - scriptSig: <signature>

Outputs:
  [0] NFT Output
      - satoshis: 1000 (0.001 XPI)
      - script: 62 51 21 <33-byte commitment> 20 <32-byte metadata hash>
      - Size: 69 bytes
  [1] Change Output (optional)
      - satoshis: <remaining>
      - script: <change address script>

LockTime: 0
```

#### Transfer Transaction

```
Version: 2
Inputs:
  [0] NFT Input
      - prevTxId: <previous NFT transaction>
      - outputIndex: 0
      - scriptSig: <65-byte Schnorr signature>  (key path spend)

Outputs:
  [0] NFT Output (to new owner)
      - satoshis: 1000
      - script: 62 51 21 <new commitment> 20 <SAME metadata hash>

LockTime: 0
```

**Key Observations**:

- Input script contains old owner's commitment
- Output script contains new owner's commitment
- Metadata hash (state parameter) is IDENTICAL in both
- Schnorr signature + SIGHASH_LOTUS required for key path spend

### Counterfeit Prevention

The immutable metadata hash provides strong counterfeit prevention:

**Attack Scenario 1: Fake Metadata**

```typescript
// Attacker tries to claim their NFT is a valuable original
const fakeMetadata = {
  name: 'Original Art #1',
  image: 'ipfs://QmRealArt...', // Using real artist's image
}

// Compute hash
const fakeHash = SHA256(JSON.stringify(fakeMetadata))

// Create counterfeit NFT
const counterfeit = buildPayToTaproot(attackerKey, fakeHash)

// ❌ DETECTION: The on-chain hash won't match the real NFT's hash
// Real NFT hash: 0xabc123...
// Fake NFT hash: 0xdef456...  (Different!)
```

**Attack Scenario 2: Metadata Substitution**

```typescript
// Attacker tries to use a legitimate NFT hash with different metadata
const stolenHash = Buffer.from('abc123...', 'hex') // From real NFT
const fakeMetadata = { name: 'Fake', image: 'ipfs://QmFake...' }

// ❌ VERIFICATION FAILS:
const computedHash = SHA256(JSON.stringify(fakeMetadata))
console.log(computedHash.equals(stolenHash)) // false

// The hash doesn't match, so the metadata is proven fake
```

**Protection Mechanism**:

1. Metadata hash is computed deterministically
2. Hash is immutably stored on-chain
3. Anyone can verify by recomputing the hash
4. Changing even one character in metadata produces a completely different hash

### Collection Mechanics

Collections use a hierarchical hash structure:

```typescript
// Step 1: Hash the collection metadata
const collectionInfo = {
  name: 'Lotus Legends',
  totalSupply: 100,
  creator: 'lotus_16PSJ...',
}
const collectionHash = SHA256(JSON.stringify(collectionInfo))

// Step 2: Combine collection hash with individual NFT metadata
const nftMetadata = {
  name: 'Lotus Legend #42',
  tokenId: 42,
  attributes: [{ trait_type: 'Power', value: 95 }],
}

const combinedData = {
  collection: collectionHash.toString('hex'),
  nft: nftMetadata,
}

// Step 3: Hash the combined data
const nftHash = SHA256(JSON.stringify(combinedData))

// Step 4: Create NFT with the combined hash
const collectionNFT = buildPayToTaproot(ownerKey, nftHash)
```

**Verification**:

```typescript
// To verify an NFT belongs to a collection:
1. Fetch the claimed collection metadata
2. Compute collectionHash = SHA256(collectionMetadata)
3. Fetch the NFT's individual metadata
4. Compute combinedHash = SHA256({ collection: collectionHash, nft: nftMetadata })
5. Compare combinedHash with the on-chain state parameter
```

### Script Path vs Key Path

NFTs can use either spending path:

**Key Path (Simple)**:

```
Input scriptSig: <65-byte Schnorr signature>
Output script: OP_SCRIPTTYPE OP_1 <commitment> <state>
Result: Private, efficient (65 bytes signature)
```

**Script Path (Advanced)**:

```
Input scriptSig: <witness data> <script> <control block>
Output script: OP_SCRIPTTYPE OP_1 <commitment> <state>
Result: Reveals specific script from tree, enables complex conditions
```

**Example with Trading**:

```typescript
const tradingTree = {
  left: { script: buyerSellerMultisig },
  right: {
    left: { script: escrowResolution },
    right: { script: timeoutRefund },
  },
}

const nft = createScriptPathNFT(seller.publicKey, metadata, tradingTree)

// Cooperative sale (key path): 65 bytes
// Escrow resolution (script path): ~150 bytes + control block
// Timeout refund (script path): ~150 bytes + control block
```

### State Parameter Extraction

```typescript
// Extract metadata hash from a Taproot script
function extractMetadataHash(script: Script): Buffer | null {
  const buf = script.toBuffer()

  // Check if script is correct size (69 bytes with state)
  if (buf.length !== 69) {
    return null
  }

  // Verify Taproot header
  if (buf[0] !== OP_SCRIPTTYPE || buf[1] !== OP_1) {
    return null
  }

  // Verify commitment push (33 bytes)
  if (buf[2] !== 33) {
    return null
  }

  // Verify state push (32 bytes)
  if (buf[36] !== 32) {
    return null
  }

  // Extract state (bytes 37-68)
  return buf.subarray(37, 69)
}
```

---

## Usage

### Two Approaches

Lotus NFTs can be created using either:

1. **NFT Class** (object-oriented, stateful)
2. **NFTUtil** (functional, stateless utilities)

### Basic NFT Creation (Using NFT Class)

```typescript
import { PrivateKey, NFT } from 'lotus-lib'

// Create owner key
const ownerKey = new PrivateKey()

// Define metadata
const metadata = {
  name: 'Lotus NFT #1',
  description: 'A unique digital collectible',
  image: 'ipfs://Qm...',
  attributes: [
    { trait_type: 'Rarity', value: 'Legendary' },
    { trait_type: 'Color', value: 'Gold' },
  ],
}

// Create NFT using class constructor
const nft = new NFT({
  metadata,
  ownerKey: ownerKey.publicKey,
  satoshis: 1000, // 0.001 XPI
})

console.log('NFT address:', nft.address.toString())
console.log('Metadata hash:', nft.metadataHash.toString('hex'))

// Verify metadata
console.log('Valid:', nft.verifyMetadata())
```

### Basic NFT Creation (Using NFTUtil)

```typescript
import { PrivateKey, NFTUtil } from 'lotus-lib'

const ownerKey = new PrivateKey()

// Create NFT using utility function (returns plain object)
const nftData = NFTUtil.createKeyPathNFT(
  ownerKey.publicKey,
  metadata,
  1000, // 0.001 XPI
)

console.log('NFT address:', nftData.address.toString())
console.log('Metadata hash:', nftData.metadataHash.toString('hex'))
```

### Minting NFT

```typescript
// Create mint transaction
const mintTx = NFTUtil.mintNFT({
  ownerKey,
  metadata,
  satoshis: 1000,
})

// Add funding and change
mintTx.from(fundingUtxo)
mintTx.change(changeAddress)
mintTx.sign(ownerKey)

// Broadcast
await broadcast(mintTx.serialize())
```

### Transferring NFT (Using NFT Class)

```typescript
// Load NFT from UTXO
const nft = new NFT({
  metadata,
  ownerKey: ownerKey.publicKey,
  satoshis: 1000,
  txid: 'abc123...',
  outputIndex: 0,
})

// Transfer to new owner
const newOwner = new PrivateKey()
const transferTx = nft.transfer(newOwner.publicKey, ownerKey)

// Broadcast
await broadcast(transferTx.serialize())
```

### Transferring NFT (Using NFTUtil)

```typescript
const newOwner = new PrivateKey()

const transferTx = NFTUtil.transferNFT({
  currentOwnerKey: ownerKey,
  newOwnerKey: newOwner.publicKey,
  nftUtxo: {
    txid: 'abc123...',
    outputIndex: 0,
    script: nftData.script,
    satoshis: 1000,
  },
  metadataHash: nftData.metadataHash,
})

// Broadcast
await broadcast(transferTx.serialize())
```

### Creating Collections

```typescript
// Define collection
const collectionInfo = {
  name: 'Lotus Legends',
  description: '100 unique legendary items',
  totalSupply: 100,
  creator: ownerKey.toAddress().toString(),
  royalty: 5, // 5% royalty
}

// Generate NFTs
const nftList = []
for (let i = 1; i <= 100; i++) {
  nftList.push({
    name: `Lotus Legend #${i}`,
    description: `Legendary item #${i}`,
    image: `ipfs://Qm.../${i}.png`,
    attributes: [
      { trait_type: 'Edition', value: `${i}/100` },
      { trait_type: 'Power', value: 100 - i },
    ],
  })
}

// Mint collection
const batchTx = NFTUtil.mintCollection(
  ownerKey,
  collectionInfo,
  nftList,
  1000, // 0.001 XPI per NFT
)

// Add funding and sign
batchTx.from(fundingUtxo)
batchTx.change(changeAddress)
batchTx.sign(ownerKey)
```

---

## Advanced Features

### NFT with Trading Script Tree

```typescript
import { Script, Opcode, TapNode } from 'lotus-lib'

const seller = new PrivateKey()
const buyer = new PrivateKey()
const escrow = new PrivateKey()

// Cooperative sale script
const saleScript = new Script()
  .add(Opcode.OP_2)
  .add(seller.publicKey.toBuffer())
  .add(buyer.publicKey.toBuffer())
  .add(Opcode.OP_2)
  .add(Opcode.OP_CHECKMULTISIG)

// Escrow resolution
const escrowScript = new Script()
  .add(escrow.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Refund after timeout
const refundScript = new Script()
  .add(1440) // ~48 hours
  .add(Opcode.OP_CHECKLOCKTIMEVERIFY)
  .add(Opcode.OP_DROP)
  .add(seller.publicKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build tree
const tradingTree: TapNode = {
  left: { script: saleScript },
  right: {
    left: { script: escrowScript },
    right: { script: refundScript },
  },
}

// Create NFT with trading capabilities
const tradingNFT = NFTUtil.createScriptPathNFT(
  seller.publicKey,
  metadata,
  tradingTree,
  10000, // 0.01 XPI
)
```

### Metadata Verification

```typescript
// Extract metadata hash from NFT script
const metadataHash = NFTUtil.extractMetadataHash(nft.script)

// Fetch metadata from off-chain storage
const metadata = await fetchFromIPFS(metadataURI)

// Verify authenticity
const isValid = NFTUtil.verifyMetadata(metadata, metadataHash)

if (isValid) {
  console.log('✅ NFT is authentic')
  console.log('Name:', metadata.name)
  console.log('Description:', metadata.description)
} else {
  console.error('❌ NFT metadata does not match hash - possible counterfeit!')
}
```

### Provenance Tracking

```typescript
// Track NFT transfer history
const transfers = [
  {
    txid: 'mint_tx_id...',
    from: null, // Minted
    to: 'lotus:qz1234...',
    metadataHash: '0xabc123...',
    timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
  {
    txid: 'transfer1_tx_id...',
    from: 'lotus:qz1234...',
    to: 'lotus:qz5678...',
    metadataHash: '0xabc123...', // Same hash!
    timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
  },
]

// Verify provenance chain
const provenanceValid = NFTUtil.verifyProvenance(transfers)
console.log('Provenance verified:', provenanceValid)
```

---

## API Reference

### NFT Class (Object-Oriented)

See **NFT Class** section above for detailed documentation of the NFT class, including:

- Constructor
- Static methods (`fromScript`, `fromUTXO`)
- Instance methods (`transfer`, `verifyMetadata`, `getInfo`, etc.)
- Properties (getters)
- Utility methods (`hasScriptTree`, `isCollectionNFT`)

### NFTUtil Class (Functional Utilities)

#### Metadata Functions

**`hashMetadata(metadata: NFTMetadata): Buffer`**

Creates SHA256 hash of NFT metadata.

```typescript
const hash = NFTUtil.hashMetadata(metadata)
```

**`hashCollection(collectionInfo: NFTCollectionMetadata): Buffer`**

Creates SHA256 hash of collection metadata.

**`hashCollectionNFT(collectionHash: Buffer, nftMetadata: NFTMetadata): Buffer`**

Creates combined hash for collection NFT.

**`verifyMetadata(metadata: NFTMetadata, hash: Buffer): boolean`**

Verifies metadata matches claimed hash.

**`verifyCollectionNFT(collectionHash: Buffer, nftMetadata: NFTMetadata, hash: Buffer): boolean`**

Verifies collection NFT metadata.

#### Creation Functions

**`createKeyPathNFT(ownerKey: PublicKey, metadata: NFTMetadata, satoshis?: number, network?: Network): NFT`**

Creates simple key-path-only NFT.

**`createScriptPathNFT(ownerKey: PublicKey, metadata: NFTMetadata, scriptTree: TapNode, satoshis?: number, network?: Network): NFTWithScriptPath`**

Creates NFT with script tree for trading/escrow. Returns extended NFT interface with script tree information.

**`createCollectionNFT(ownerKey: PublicKey, collectionHash: Buffer, nftMetadata: NFTMetadata, satoshis?: number, network?: Network): NFTWithCollection`**

Creates NFT belonging to a collection. Returns extended NFT interface with collection hash.

#### Minting Functions

**`mintNFT(config: NFTMintConfig): Transaction`**

Creates mint transaction for single NFT.

**`mintBatch(ownerKey: PrivateKey, nftMetadataList: NFTMetadata[], satoshisPerNFT?: number, network?: Network): Transaction`**

Batch mint multiple NFTs.

**`mintCollection(ownerKey: PrivateKey, collectionInfo: NFTCollectionMetadata, nftMetadataList: NFTMetadata[], satoshisPerNFT?: number, network?: Network): Transaction`**

Mint entire collection.

#### Transfer Functions

**`transferNFT(config: NFTTransferConfig): Transaction`**

Creates signed transfer transaction.

**`validateTransfer(inputScript: Script, outputScript: Script): boolean`**

Validates transfer preserves metadata.

#### Verification Functions

**`extractMetadataHash(script: Script): Buffer | null`**

Extracts metadata hash from NFT script.

**`verifyProvenance(transfers: NFTTransfer[]): boolean`**

Verifies provenance chain authenticity.

**`isNFT(script: Script): boolean`**

Checks if script is an NFT.

**`getNFTInfo(script: Script): NFTInfo`**

Gets comprehensive NFT information from a Taproot script.

---

## Data Structures

### NFTMetadata

```typescript
interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes?: NFTAttribute[]
  collection?: string
  creator?: string
  external_url?: string
  animation_url?: string
  background_color?: string
}
```

### NFTAttribute

```typescript
interface NFTAttribute {
  trait_type: string
  value: string | number
  display_type?: 'number' | 'boost_percentage' | 'boost_number' | 'date'
}
```

### NFTCollectionMetadata

```typescript
interface NFTCollectionMetadata {
  name: string
  description: string
  totalSupply: number
  creator: string
  royalty?: number
  image?: string
  external_url?: string
}
```

### NFT

```typescript
interface NFT {
  script: Script
  address: Address
  metadataHash: Buffer
  metadata: NFTMetadata
  satoshis: number
  txid?: string
  outputIndex?: number
}
```

### NFTWithScriptPath

```typescript
interface NFTWithScriptPath extends NFT {
  commitment: PublicKey
  merkleRoot: Buffer
  leaves: TapLeaf[]
}
```

### NFTWithCollection

```typescript
interface NFTWithCollection extends NFT {
  collectionHash: Buffer
}
```

### NFTInfo

```typescript
interface NFTInfo {
  commitment: PublicKey
  metadataHash: Buffer
  address: Address
}
```

### NFTUtxo

```typescript
interface NFTUtxo {
  txid: string
  outputIndex: number
  script: Script
  satoshis: number
}
```

### NFTConstructorConfig

```typescript
interface NFTConstructorConfig {
  metadata: NFTMetadata
  ownerKey: PublicKey
  satoshis?: number
  network?: Network
  scriptTree?: TapNode
  collectionHash?: Buffer
  txid?: string
  outputIndex?: number
}
```

---

## NFT Class

The `NFT` class provides an object-oriented interface for working with NFTs.

### Constructor

```typescript
const nft = new NFT({
  metadata: { name: '...', description: '...', image: 'ipfs://...' },
  ownerKey: publicKey,
  satoshis: 1000,
  network: Networks.livenet,
})
```

### Static Methods

**`NFT.fromScript(script: Script, metadata: NFTMetadata, satoshis: number, txid?: string, outputIndex?: number): NFT`**

Create NFT instance from existing Taproot script.

**`NFT.fromUTXO(utxo: UnspentOutput | NFTUtxo | UnspentOutputData, metadata: NFTMetadata): NFT`**

Create NFT instance from UTXO information.

### Instance Methods

**`transfer(newOwnerKey: PublicKey, currentOwnerKey: PrivateKey, fee?: number): Transaction`**

Transfer NFT to new owner.

**`verifyMetadata(): boolean`**

Verify metadata matches on-chain hash.

**`getInfo(): NFTInfo`**

Get NFT information.

**`toOutput(): Output`**

Convert to Output object.

**`toUnspentOutput(): UnspentOutput`**

Convert to UnspentOutput object.

**`getUtxo(): NFTUtxo`**

Get UTXO information.

**`updateUTXO(txid: string, outputIndex: number): void`**

Update UTXO after mint/transfer.

**`toJSON(): object`**

Serialize to JSON.

**`toObject(): NFTData`**

Convert to plain NFTData object.

**`toString(): string`**

Get string representation.

### Properties (Getters)

- `script: Script` - Taproot script
- `address: Address` - NFT address
- `metadataHash: Buffer` - 32-byte metadata hash
- `metadata: NFTMetadata` - Full metadata
- `satoshis: number` - NFT value
- `txid?: string` - Transaction ID
- `outputIndex?: number` - Output index
- `commitment?: PublicKey` - Commitment key (if script path)
- `merkleRoot?: Buffer` - Merkle root (if script path)
- `leaves?: TapLeaf[]` - Script tree leaves (if script path)
- `collectionHash?: Buffer` - Collection hash (if collection NFT)

### Utility Methods

**`hasScriptTree(): boolean`**

Check if NFT has script tree.

**`isCollectionNFT(): boolean`**

Check if NFT belongs to a collection.

---

## Security Considerations

### Metadata Storage

**DO**:

- ✅ Store metadata on decentralized storage (IPFS, Arweave)
- ✅ Include metadata hash in state parameter
- ✅ Verify hash before trusting metadata
- ✅ Keep backup of metadata JSON

**DON'T**:

- ❌ Store metadata only on centralized servers
- ❌ Change metadata after minting (breaks hash)
- ❌ Use mutable URLs
- ❌ Forget to validate metadata hash

### Transfer Validation

**Critical**: When transferring NFT, the state MUST remain identical:

```typescript
// ✅ CORRECT: Same state in new output
const newNFT = buildKeyPathTaproot(newOwnerKey, originalStateHash)

// ❌ WRONG: Different state (creates different NFT!)
const wrongNFT = buildKeyPathTaproot(newOwnerKey, differentHash)
```

### Counterfeit Prevention

```typescript
function verifyNFTAuthenticity(
  txid: string,
  outputIndex: number,
): Promise<boolean> {
  // 1. Fetch transaction
  const tx = await getTransaction(txid)
  const output = tx.outputs[outputIndex]

  // 2. Extract state
  const state = NFTUtil.extractMetadataHash(output.script)
  if (!state) return false

  // 3. Fetch metadata
  const metadata = await fetchMetadata(metadataURL)

  // 4. Verify hash
  const computedHash = NFTUtil.hashMetadata(metadata)
  if (!state.equals(computedHash)) return false

  // 5. Trace provenance to original mint
  const provenance = await traceNFTHistory(txid, outputIndex)
  return NFTUtil.verifyProvenance(provenance)
}
```

---

## Size and Cost Analysis

### Single NFT

| Component | Size      | Cost           |
| --------- | --------- | -------------- |
| Script    | 69 bytes  | ~1,000 sat     |
| Metadata  | Off-chain | ~0 sat         |
| **Total** | **69 B**  | **~0.001 XPI** |

### Collection (100 NFTs)

| Component       | Size        | Cost              |
| --------------- | ----------- | ----------------- |
| Scripts         | 6,900 bytes | ~100,000 sat      |
| Collection hash | 32 bytes    | 0 sat (off-chain) |
| **Total**       | **~7 KB**   | **~0.1 XPI**      |

### Comparison with Alternatives

| Method            | On-Chain Size | Cost per NFT   |
| ----------------- | ------------- | -------------- |
| **Taproot State** | **69 bytes**  | **~1,000 sat** |
| OP_RETURN         | 223+ bytes    | ~2,000+ sat    |
| Multiple outputs  | 500+ bytes    | ~5,000+ sat    |

**Advantage**: Taproot NFTs are **3-5x smaller and cheaper** than alternatives.

---

## Best Practices

### Metadata Design

**DO**:

- ✅ Use standard metadata schemas (OpenSea-compatible)
- ✅ Store images on IPFS/Arweave
- ✅ Include creator attribution
- ✅ Version your metadata schema

**DON'T**:

- ❌ Use centralized image hosting
- ❌ Exceed reasonable JSON sizes (keep < 10KB)
- ❌ Include sensitive/private data
- ❌ Use non-deterministic fields (timestamps in hash)

### Collection Management

```typescript
// ✅ GOOD: Deterministic collection ID
const collectionId = Hash.sha256(Buffer.from('LotusLegends'))

// ✅ GOOD: Consistent metadata structure
const nftMetadata = {
  name: `Item #${tokenId}`,
  collection: collectionId.toString('hex'),
  tokenId,
  ...standardFields,
}

// ❌ BAD: Non-deterministic
const badMetadata = {
  name: 'NFT',
  timestamp: Date.now(), // Changes every time!
}
```

---

## Use Cases

### Digital Art

- High-resolution artwork on IPFS
- Provable authenticity via hash
- Royalty enforcement
- Privacy via key path transfers

### Gaming Items

- In-game items with on-chain ownership
- Tradable between players
- Verifiable rarity/attributes
- Cross-game compatibility

### Membership Cards

- DAO membership tokens
- VIP passes and access control
- Expiring memberships (via script tree)
- Transferable or non-transferable

### Event Tickets

- Concert/conference tickets
- Verifiable authenticity
- Prevent counterfeiting
- Resale with royalties

---

## Examples

See `examples/nft-examples.ts` for comprehensive examples including:

1. ✅ Simple NFT creation
2. ✅ NFT minting transaction
3. ✅ NFT transfer
4. ✅ Batch collection minting
5. ✅ NFT with trading script tree
6. ✅ Provenance tracking
7. ✅ NFT verification
8. ✅ Marketplace listing
9. ✅ Collection statistics
10. ✅ Royalty payment handling

---

## Testing

```bash
# Run NFT examples
npm run build
node examples/nft-examples.js

# Run tests
npm test -- nft
```

---

## References

- [Lotus Taproot Specification](https://lotusia.org/docs/specs/script/taproot)
- [Taproot NFT Examples](https://lotusia.org/docs/specs/script/examples/taproot-nfts)
- [lotus-lib Taproot Implementation](./TAPROOT_IMPLEMENTATION.md)
- [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)

---

## Related Documentation

- [Taproot Overview](./TAPROOT_IMPLEMENTATION.md) - Technical fundamentals
- [Taproot Examples](./TAPROOT_EXAMPLES.md) - Usage examples
- [Address Format](https://lotusia.org/docs/specs/address-format) - Lotus addressing

---

**Last Updated**: October 28, 2025  
**Implementation**: `lotus-lib/lib/bitcore/nft.ts`  
**Examples**: `lotus-lib/examples/nft-examples.ts`
