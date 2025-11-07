# lotus-lib

> **Central repository for integrating with and building for the Lotusia ecosystem**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js->=18-green)](https://nodejs.org/)

A comprehensive TypeScript library providing Bitcoin-like transaction primitives, advanced cryptographic protocols, and P2P networking infrastructure for the Lotus (XPI) blockchain ecosystem.

---

## Features

### 🔐 Cryptography & Signatures

- **Bitcore Modules** - Complete Bitcoin-like transaction primitives adapted for Lotus
  - Private/public key management
  - HD wallets (BIP32/BIP39)
  - Transaction building and signing
  - Address generation (P2PKH, P2SH, Taproot)
  - Script interpreter
- **MuSig2** - Multi-signature Schnorr signatures (BIP327)
  - Production-ready P2P coordination
  - 2-round non-interactive signing
  - Coordinator election with automatic failover
  - Privacy-preserving multisig (indistinguishable from single-sig)
- **Taproot** - Pay-to-Taproot address support
  - Script path spending
  - Key path spending
  - MuSig2 integration
  - RANK protocol integration

### 🌐 P2P Networking

- **libp2p Infrastructure** - Industrial-grade P2P networking
  - Kademlia DHT for distributed discovery
  - GossipSub for real-time messaging
  - Multiple transports (TCP, WebSocket)
  - NAT traversal (UPnP, AutoNAT, DCUTR)
  - Noise protocol encryption
- **Protocol Extension System** - Build custom P2P protocols
  - Clean `IProtocolHandler` interface
  - Event-driven architecture
  - Direct stream access

### 🔄 Privacy Protocols

- **SwapSig** - CoinJoin-equivalent privacy using MuSig2
  - Multi-party transaction coordination
  - Dynamic group sizing (2-of-2, 3-of-3, 5-of-5, 10-of-10)
  - XPI burn-based Sybil defense
  - Privacy-preserving coin mixing
  - Complete protocol state machine

### 📊 RANK Protocol

- **Social Ranking System** - On-chain reputation and content ranking
  - Positive/negative/neutral sentiment tracking
  - Multi-platform support (Twitter, Lotusia)
  - Comment system (RNKC)
  - Script builder and parser
  - Fee-based spam prevention

### 🔧 Utilities

- **RPC Client** - Full-featured lotusd RPC interface
  - Network information
  - Block and transaction queries
  - Mining information
  - Mempool management
- **Constants & Settings** - Lotus-specific network parameters
  - Network configurations
  - Protocol constants
  - Fee calculations
- **Encoding Utilities** - Base58, Base58Check, Base32, Varint

---

## Installation

```bash
npm install lotus-lib
```

### Requirements

- Node.js >= 18
- TypeScript >= 5.0 (for development)

---

## Quick Start

### Basic Transaction

```typescript
import { PrivateKey, Transaction, Address } from 'lotus-lib'

// Create key and address
const privateKey = new PrivateKey()
const address = privateKey.toAddress()

console.log('Address:', address.toString())

// Build transaction
const tx = new Transaction()
  .from(unspentOutput)
  .to(recipientAddress, 100_000_000) // 100 XPI
  .change(changeAddress)
  .sign(privateKey)

console.log('Transaction:', tx.serialize())
```

### HD Wallet (BIP32/BIP39)

```typescript
import { Mnemonic, HDPrivateKey } from 'lotus-lib'

// Generate mnemonic (default: 128 bits entropy = 12 words)
const mnemonic = new Mnemonic()
console.log('Mnemonic:', mnemonic.phrase)

// Convert to HD private key
const hdPrivateKey = mnemonic.toHDPrivateKey()

// Derive addresses (BIP44 path: m/44'/10605'/0'/0/0)
// Note: 10605 is Lotus (XPI) coin type
const account = hdPrivateKey.derive("m/44'/10605'/0'/0/0")
const address = account.privateKey.toAddress()

console.log('First address:', address.toString())

// Or derive from existing mnemonic
const existingMnemonic = new Mnemonic('your twelve word mnemonic phrase here')
const restoredHdKey = existingMnemonic.toHDPrivateKey()
```

### MuSig2 Multi-Signature

```typescript
import { MuSig2P2PCoordinator } from 'lotus-lib/lib/p2p/musig2'
import { PrivateKey } from 'lotus-lib'

// Create coordinator with P2P networking
const coordinator = new MuSig2P2PCoordinator(
  {
    listen: ['/ip4/0.0.0.0/tcp/4001'],
    enableDHT: true,
    bootstrapPeers: ['/dns4/bootstrap.lotusia.org/tcp/4001/p2p/...'],
  },
  {
    enableCoordinatorElection: true,
    electionMethod: 'lexicographic',
  },
)

await coordinator.start()

// Create signing session
const message = Buffer.from('Transaction sighash')
const sessionId = await coordinator.createSession(
  [alice.publicKey, bob.publicKey, charlie.publicKey],
  myPrivateKey,
  message,
)

// Listen for coordinator events
coordinator.on(
  'session:should-broadcast',
  async (sessionId, coordinatorIndex) => {
    if (coordinator.isCoordinator(sessionId)) {
      console.log('I am the coordinator, broadcasting transaction...')

      const signature = coordinator.getFinalSignature(sessionId)
      const tx = buildTransaction(signature)
      await broadcastTransaction(tx)

      coordinator.notifyBroadcastComplete(sessionId)
    }
  },
)

// Execute signing rounds (automatic)
await coordinator.startRound1(sessionId, myPrivateKey)
await coordinator.startRound2(sessionId, myPrivateKey)

// Get final signature
const signature = coordinator.getFinalSignature(sessionId)
console.log('Final signature:', signature.toString('hex'))

// Cleanup
await coordinator.cleanup()
```

> 💡 **See also:** [`examples/musig2-p2p-election-example.ts`](examples/musig2-p2p-election-example.ts) for a complete 5-party signing example

### SwapSig Privacy Protocol

```typescript
import { SwapSigCoordinator } from 'lotus-lib/lib/p2p/swapsig'
import { PrivateKey } from 'lotus-lib'

// Create coordinator (extends MuSig2P2PCoordinator)
const coordinator = new SwapSigCoordinator(
  myPrivateKey,
  {
    listen: ['/ip4/0.0.0.0/tcp/4001'],
    enableDHT: true,
  },
  {
    enableSessionDiscovery: true,
  },
  {
    minParticipants: 3,
    maxParticipants: 10,
    feeRate: 1,
  },
)

await coordinator.start()

// Create or join swap pool
const poolId = await coordinator.createPool({
  denomination: 1_000_000, // 1 XPI
  minParticipants: 5,
  maxParticipants: 10,
  burnPercentage: 0.001, // 0.1% XPI burn for Sybil defense
})

// Execute complete swap
const txId = await coordinator.executeSwap(poolId, myInputUtxo, myFinalAddress)

console.log('Swap complete, transaction:', txId)

// Cleanup
await coordinator.stop()
```

> 💡 **See also:** [`examples/swapsig-core.ts`](examples/swapsig-core.ts) for a complete 3-party swap example

### RANK Social Ranking

```typescript
import { toScriptRANK, toScriptRNKC, Transaction } from 'lotus-lib'

// Create positive RANK for a Twitter profile
const rankScript = toScriptRANK(
  'positive', // sentiment
  'twitter', // platform
  'elonmusk', // profileId
)

// Add RANK to transaction
const tx = new Transaction()
  .from(utxo)
  .addOutput(
    new Transaction.Output({
      script: rankScript,
      satoshis: 100_000, // 0.1 XPI burned
    }),
  )
  .change(changeAddress)
  .sign(privateKey)

// Create comment (RNKC)
const commentScripts = toScriptRNKC({
  platform: 'twitter',
  profileId: 'elonmusk',
  postId: '1234567890',
  comment: 'Great post!',
})

// RNKC requires multiple outputs
commentScripts.forEach(script => {
  tx.addOutput(
    new Transaction.Output({
      script: script,
      satoshis: 1_000, // Fee
    }),
  )
})

await tx.broadcastTo(rpcUrl) // Or use sendRPCRequest()
```

> 💡 **See also:** [RANK Protocol Documentation](https://lotusia.org/docs/rank) and [`examples/taproot-rank-multisig.ts`](examples/taproot-rank-multisig.ts)

### Taproot Addresses

```typescript
import {
  PrivateKey,
  Script,
  Opcode,
  buildKeyPathTaproot,
  buildScriptPathTaproot,
} from 'lotus-lib/lib/bitcore'

// Create simple Taproot address (key-path only)
const privateKey = new PrivateKey()
const internalPubKey = privateKey.publicKey

const taprootScript = buildKeyPathTaproot(internalPubKey)
const taprootAddress = taprootScript.toAddress()

console.log('Taproot address:', taprootAddress?.toString())

// Taproot with script paths
const script1 = new Script()
  .add(internalPubKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

const script2 = new Script()
  .add(720) // ~1 day timelock (30 blocks per hour (2min average) * 24 hours per day)
  .add(Opcode.OP_CHECKSEQUENCEVERIFY)
  .add(Opcode.OP_DROP)
  .add(internalPubKey.toBuffer())
  .add(Opcode.OP_CHECKSIG)

// Build tree with script paths
const tree = {
  left: { script: script1 },
  right: { script: script2 },
}

const taprootWithScripts = buildScriptPathTaproot(internalPubKey, tree)
const addressWithScripts = taprootWithScripts.toAddress()

console.log('Taproot with scripts:', addressWithScripts?.toString())
```

> 💡 **See also:** [`examples/taproot-example.ts`](examples/taproot-example.ts) for complete Taproot examples including spending

### RPC Client

```typescript
import {
  getNetworkInfo,
  getMiningInfo,
  getBlockHash,
  getBlock,
  sendRPCRequest,
} from 'lotus-lib'

// Get network info
const networkInfo = await getNetworkInfo()
console.log('Connections:', networkInfo.connections)

// Get mining info
const miningInfo = await getMiningInfo()
console.log('Block height:', miningInfo.blocks)

// Get block by height
const blockHash = await getBlockHash(100000)
const block = await getBlock(blockHash)

console.log('Block:', block)

// Send raw transaction (using generic RPC method)
const txId = await sendRPCRequest('sendrawtransaction', [serializedTx])
console.log('Transaction ID:', txId)
```

---

## Core Modules

### Bitcore

Bitcoin-like transaction primitives adapted for Lotus XPI:

- **Transaction building** - Inputs, outputs, signing
- **Script system** - P2PKH, P2SH, custom scripts
- **Cryptography** - ECDSA, Schnorr signatures
- **Addresses** - P2PKH, P2SH, Taproot (x-addresses)
- **HD Wallets** - BIP32 derivation, BIP39 mnemonics
- **Encoding** - Base58, Base58Check, Varint

```typescript
import * as Bitcore from 'lotus-lib/Bitcore'
// or
import { PrivateKey, Transaction, Address } from 'lotus-lib'
```

### P2P Networking

libp2p-based P2P infrastructure with protocol extension system:

- **P2PCoordinator** - Main networking coordinator
- **DHT** - Kademlia distributed hash table
- **GossipSub** - Real-time pub/sub messaging
- **Protocol handlers** - Extend with custom protocols

```typescript
import { P2PCoordinator, IProtocolHandler } from 'lotus-lib/lib/p2p'
```

See: [`lib/p2p/README.md`](lib/p2p/README.md)

### MuSig2

Multi-signature Schnorr signatures with P2P coordination:

- **2-round signing** - Non-interactive nonce exchange
- **Coordinator election** - Deterministic with automatic failover
- **Security** - Replay protection, rate limiting, Sybil resistance
- **Identity system** - Burn-based blockchain anchoring (optional)

```typescript
import { MuSig2P2PCoordinator } from 'lotus-lib/lib/p2p/musig2'
```

See: [`lib/p2p/musig2/README.md`](lib/p2p/musig2/README.md)

### SwapSig

CoinJoin-equivalent privacy protocol using MuSig2:

- **Pool coordination** - Multi-party transaction mixing
- **Dynamic sizing** - 2-of-2, 3-of-3, 5-of-5, 10-of-10 groups
- **Sybil defense** - XPI burn mechanism
- **Privacy** - Breaks on-chain transaction graph

```typescript
import { SwapSigCoordinator } from 'lotus-lib/lib/p2p/swapsig'
```

See: [`lib/p2p/swapsig/README.md`](lib/p2p/swapsig/README.md)

### RANK Protocol

On-chain social ranking and reputation system:

- **Sentiment tracking** - Positive/negative/neutral
- **Multi-platform** - Twitter, Lotusia
- **Comments** - RNKC protocol
- **Spam prevention** - Fee-based filtering

```typescript
import { toScriptRANK, toScriptRNKC, ScriptProcessor } from 'lotus-lib'
```

### Taproot

Pay-to-Taproot support with script paths:

- **Key path spending** - Standard Taproot addresses
- **Script path spending** - MAST-like script trees
- **MuSig2 integration** - Multi-sig via Taproot
- **RANK integration** - RANK protocol via Taproot

```typescript
import { Taproot } from 'lotus-lib'
```

---

## Examples

The library includes comprehensive examples in the [`examples/`](examples/) directory:

### Taproot Examples

- `taproot-example.ts` - Basic Taproot usage
- `taproot-rank-multisig.ts` - RANK protocol with multisig
- `taproot-rank-timelock.ts` - Timelock scripts
- `taproot-rnkc-moderation.ts` - Moderation scripts

### MuSig2 Examples

- `musig2-example.ts` - Basic 2-of-2 signing
- `musig2-session-example.ts` - Session management
- `musig2-p2p-example.ts` - P2P coordination
- `musig2-p2p-election-example.ts` - 5-party signing with election
- `musig2-p2p-taproot-example.ts` - MuSig2 with Taproot
- `musig2-three-phase-example.ts` - Advertisement and matchmaking

### SwapSig Examples

- `swapsig-core.ts` - Complete SwapSig workflow

### P2P Examples

- `p2p-basic-example.ts` - Basic P2P networking
- `p2p-peer-discovery-example.ts` - Peer discovery
- `p2p-protocol-extension-example.ts` - Custom protocols
- `bootstrap-persistent-identity-example.ts` - Persistent peer identity

### NFT Examples

- `nft-class-example.ts` - NFT class usage
- `nft-examples.ts` - NFT creation and transfer

### Running Examples

```bash
# Basic example
npx tsx examples/taproot-example.ts

# MuSig2 P2P coordination
npx tsx examples/musig2-p2p-example.ts

# SwapSig privacy protocol
npx tsx examples/swapsig-core.ts

# P2P networking
npx tsx examples/p2p-basic-example.ts
```

---

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

### Getting Started

- [MuSig2 Start Here](docs/MUSIG2_START_HERE.md) - Introduction to MuSig2
- [MuSig2 Quick Reference](docs/MUSIG2_QUICK_REFERENCE.md) - Quick reference guide
- [Taproot Quickstart](docs/TAPROOT_QUICKSTART.md) - Taproot introduction
- [SwapSig Quick Start](docs/SWAPSIG_QUICK_START.md) - SwapSig introduction

### Architecture & Implementation

- [P2P Infrastructure](docs/P2P_INFRASTRUCTURE.md) - P2P networking overview
- [MuSig2 P2P Coordination](docs/MUSIG2_P2P_COORDINATION.md) - MuSig2 P2P design
- [SwapSig Architecture](docs/SWAPSIG_ARCHITECTURE.md) - SwapSig design
- [Taproot Implementation](docs/TAPROOT_IMPLEMENTATION.md) - Taproot details

### Security

- [MuSig2 DHT Security Analysis](docs/MUSIG2_DHT_SECURITY_ANALYSIS.md) - Security audit
- [SwapSig Security Analysis](docs/SWAPSIG_SECURITY_ANALYSIS.md) - SwapSig security
- [P2P Core Security](docs/P2P_CORE_SECURITY.md) - P2P security
- [Burn-Based Identity](docs/BURN_BASED_IDENTITY_IMPLEMENTATION.md) - Identity system

### API References

- [SwapSig API Reference](docs/SWAPSIG_API_REFERENCE.md) - Complete SwapSig API
- [Taproot API Reference](docs/taproot/api-reference.md) - Taproot API

### Status & Summaries

- [MuSig2 Implementation Status](docs/MUSIG2_IMPLEMENTATION_STATUS.md) - Current status
- [SwapSig Summary](docs/SWAPSIG_SUMMARY.md) - SwapSig overview
- [Taproot Complete](docs/TAPROOT_COMPLETE.md) - Taproot completion summary

---

## Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- test/p2p/musig2/

# Run with coverage
npm run test:coverage
```

---

## Development

### Build

```bash
# Compile TypeScript
npm run build

# Watch mode
npm run build:watch
```

### Linting & Formatting

```bash
# Format code
npm run format

# Lint code
npm run lint
```

---

## Lotus Network Information

**Lotus (XPI)** is a Bitcoin-based cryptocurrency with several key differences:

- **Decimals**: 6 (1 XPI = 1,000,000 satoshis) vs Bitcoin's 8
- **Supply**: Inflationary with no hard cap
- **Consensus**: Proof-of-Work (SHA-256d)
- **Features**: OP_RETURN data, Taproot, RANK protocol

**Network Resources:**

- Official Website: https://lotusia.org
- Documentation: https://lotusia.org/docs
- Block Explorer: https://explorer.lotusia.org
- Full Node (lotusd): https://github.com/LotusiaStewardship/lotusd

---

## Community

**Discord:** [Lotusia](https://discord.gg/fZrFa3vf)  
**Telegram:** [Lotusia Discourse](https://t.me/LotusiaDiscourse)  
**GitHub:** [LotusiaStewardship](https://github.com/LotusiaStewardship)

---

## Contributing

Contributions are welcome! Please:

1. Read the relevant documentation thoroughly
2. Follow the existing code style (Prettier + ESLint)
3. Add tests for new features
4. Update documentation as needed
5. Submit a pull request

### Development Setup

```bash
# Clone repository
git clone https://github.com/LotusiaStewardship/lotus-lib.git
cd lotus-lib

# Install dependencies
npm install

# Build library
npm run build

# Run tests
npm test
```

---

## License

[MIT License](LICENSE) - Copyright (c) 2025 The Lotusia Stewardship

---

## Related Projects

- **lotusd** - Lotus full node implementation  
  https://github.com/LotusiaStewardship/lotusd

- **lotus-explorer** - Lotus blockchain explorer  
  https://github.com/LotusiaStewardship/lotus-explorer

- **lotus-backend-ts** - Lotus backend services  
  https://github.com/LotusiaStewardship/lotus-backend-ts

- **rank-dashboard** - RANK protocol dashboard  
  https://github.com/LotusiaStewardship/rank-dashboard

---

**Built with ❤️ for the Lotus Ecosystem** 🌸
