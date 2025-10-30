# Taproot + RANK Integration

**Date**: October 28, 2025  
**Status**: Implementation Guide  
**Network**: Lotus (2 minute block time, no SegWit)

---

## Overview

This document explores the integration of Taproot with the RANK protocol, demonstrating how Taproot's advanced script capabilities can enhance on-chain voting, reputation systems, and content moderation on Lotus.

**Lotus Network Specifications**:

- Block time: ~2 minutes (average)
- No SegWit: All transaction sizes in bytes (not weight units)
- UTXO-based with full script support
- Compatible with Taproot via custom output format

### What is RANK?

RANK is an OP_RETURN-based protocol for on-chain reputation and voting:

- **RANK**: Vote on profiles/posts with sentiment (positive/negative/neutral)
- **RNKC**: Comment on content with stake-based spam prevention

### Why Taproot + RANK?

Combining Taproot with RANK unlocks powerful new capabilities:

1. **Privacy-Preserving Votes**: Hide voting mechanisms until needed
2. **Time-Locked Commitments**: Prevent vote manipulation
3. **Moderated Comments**: Economic spam deterrence
4. **Organizational Voting**: Multi-sig governance with single footprint
5. **Conditional Refunds**: Reward good actors, penalize bad actors

---

## Architecture Patterns

### Pattern 1: Time-Locked Voting

**Problem**: Votes can be manipulated by rapid buying/selling.

**Solution**: Lock voting funds for a commitment period using Taproot scripts.

**Implementation**:

```
Taproot Output:
├─ Key Path: Normal spending (private)
└─ Script Path: Time-locked refund
   └─ <height> OP_CHECKLOCKTIMEVERIFY OP_DROP <pubkey> OP_CHECKSIG
```

**Transaction Structure**:

```
TX Outputs:
0: OP_RETURN <RANK vote data>
1: Taproot commitment (locked funds)
2: Change (optional)
```

**Benefits**:

- Votes require time commitment
- Prevents rapid vote manipulation
- Privacy: Lock mechanism hidden via key path
- Voter retains ultimate control

**Use Cases**:

- Governance voting
- Reputation staking
- Anti-vote-buying mechanisms
- Campaign time limits

---

### Pattern 2: Moderated Comments

**Problem**: Spam and abuse in comment systems.

**Solution**: Stake funds that can be penalized for spam or refunded for legitimate content.

**Implementation**:

```
Taproot Output:
├─ Key Path: Normal refund (legitimate comment)
└─ Script Paths:
   ├─ Path 1: Time-locked full refund
   ├─ Path 2: Moderator penalty (partial refund)
   └─ Path 3: Emergency recovery (2-of-2 multisig)
```

**Transaction Structure**:

```
TX Outputs:
0: OP_RETURN <RNKC metadata>
1: OP_RETURN <comment data 1>
2: OP_RETURN <comment data 2> (if needed)
3: Taproot stake (locked funds)
4: Change (optional)
```

**Economic Model**:

- Comment stake: 50,000 sats (configurable)
- Spam penalty: 50% (25,000 sats to moderation fund)
- Legitimate refund: 100% after delay period
- Refund delay: ~1 week (1,008 blocks)

**Benefits**:

- Spam deterrence via economic cost
- Legitimate users get full refunds
- Privacy: Moderation hidden for good comments
- Fair dispute resolution mechanism

**Use Cases**:

- Social media comments
- Forum posts
- Product reviews
- Content curation

---

### Pattern 3: Multi-Signature Organizational Voting

**Problem**: Organizations want to vote as single entity without revealing internal structure.

**Solution**: Use Taproot with MuSig2 aggregation for private multi-sig voting.

**Implementation**:

```
Taproot Output:
├─ Key Path: MuSig2 aggregated signature (M-of-N)
└─ Script Paths:
   ├─ Path 1: Explicit multisig (fallback)
   └─ Path 2: Emergency recovery (time-locked)
```

**Transaction Structure**:

```
TX Outputs:
0: OP_RETURN <RANK organizational vote>
1: Taproot commitment (large stake = vote weight)
2: Change (optional)
```

**Comparison**:

| Metric      | Traditional P2SH       | Taproot Key Path        | Savings |
| ----------- | ---------------------- | ----------------------- | ------- |
| Size        | ~300 bytes             | ~50 bytes               | 83%     |
| Privacy     | Low (multisig visible) | High (looks single-sig) | -       |
| Cost        | Higher fees            | Lower fees              | ~83%    |
| Flexibility | Fixed M-of-N           | Multiple paths          | High    |

**Benefits**:

- Single on-chain vote per organization
- Private governance (key path)
- Efficient (83% smaller than P2SH)
- Flexible spending conditions
- Emergency recovery mechanism

**Use Cases**:

- DAO voting
- Company board decisions
- Investment group consensus
- Moderation teams
- Reputation networks

---

## Technical Specifications

### RANK Vote with Taproot

**Standard RANK Output**:

```
OP_RETURN <4-byte LOKAD> <sentiment> <platform> <profileId> [<postId>]
```

**Enhanced with Taproot**:

```
Output 0: OP_RETURN (RANK data)
Output 1: Taproot P2TR (commitment + conditions)
```

**Taproot Script Template**:

```javascript
const taprootScript = Script.buildPayToTaproot(commitment, state?)
// 36 bytes: OP_SCRIPTTYPE OP_1 <33-byte commitment> [<32-byte state>]
```

### RNKC Comment with Taproot

**Standard RNKC Outputs**:

```
Output 0: OP_RETURN <4-byte LOKAD> <platform> <profileId> <postId>
Output 1: OP_RETURN <OP_PUSHDATA1> <comment data 1>
Output 2: OP_RETURN <OP_PUSHDATA1> <comment data 2> (optional)
```

**Enhanced with Taproot**:

```
Output 0: OP_RETURN (RNKC metadata)
Output 1: OP_RETURN (comment data 1)
Output 2: OP_RETURN (comment data 2, if needed)
Output 3: Taproot P2TR (staked funds + moderation)
```

### Script Construction

**Time-Lock Script**:

```javascript
const timeLockScript = new Script()
  .add(Buffer.from(blockHeight.toString(16), 'hex'))
  .add(OpCode.OP_CHECKLOCKTIMEVERIFY)
  .add(OpCode.OP_DROP)
  .add(pubkey.toBuffer())
  .add(OpCode.OP_CHECKSIG)
```

**Penalty Script**:

```javascript
const penaltyScript = new Script()
  .add(moderatorPubkey.toBuffer())
  .add(OpCode.OP_CHECKSIG)
```

**Multisig Script**:

```javascript
const multisigScript = new Script()
  .add(OpCode.OP_3) // Require 3
  .add(pubkey1.toBuffer())
  .add(pubkey2.toBuffer())
  .add(pubkey3.toBuffer())
  .add(pubkey4.toBuffer())
  .add(pubkey5.toBuffer())
  .add(OpCode.OP_5) // Out of 5
  .add(OpCode.OP_CHECKMULTISIG)
```

### Taproot Tree Construction

**Simple Tree (2 leaves)**:

```javascript
const tree: TapNode = {
  left: { script: refundScript.toBuffer() },
  right: { script: penaltyScript.toBuffer() }
}
```

**Complex Tree (3+ leaves)**:

```javascript
const tree: TapNode = {
  left: { script: refundScript.toBuffer() },
  right: {
    left: { script: penaltyScript.toBuffer() },
    right: { script: emergencyScript.toBuffer() }
  }
}
```

**Build Commitment**:

```javascript
const tapResult = buildScriptPathTaproot(internalPubKey, tree)
const address = Address.fromTaprootCommitment(tapResult.commitment, 'livenet')
```

---

## Economic Models

### Time-Locked Voting

**Parameters**:

- Lock period: 720 blocks (~24 hours at 2 min/block)
- Minimum stake: 10,000 sats
- Vote weight: Linear with stake amount

**Formula**:

```
Vote Weight = Stake Amount × Time Factor
Time Factor = min(Lock Period / 720, 2.0)
```

**Example**:

- 10,000 sats locked for 24h (720 blocks) = 10,000 weight
- 10,000 sats locked for 48h (1440 blocks) = 20,000 weight
- 20,000 sats locked for 24h (720 blocks) = 20,000 weight

### Moderated Comments

**Parameters**:

- Comment stake: 50,000 sats
- Spam penalty: 50% (25,000 sats)
- Refund delay: 5,040 blocks (~1 week at 2 min/block)
- Minimum comment length: 10 characters
- Maximum comment length: 440 bytes (2 OP_RETURN outputs)

**Cost Structure**:

```
Legitimate Comment:
  Stake: 50,000 sats
  Refund: 50,000 sats (after 1 week)
  Net Cost: 0 sats + fees

Spam Comment:
  Stake: 50,000 sats
  Penalty: 25,000 sats (to moderation fund)
  Refund: 25,000 sats (to commenter)
  Net Cost: 25,000 sats + fees
```

### Organizational Voting

**Parameters**:

- Minimum stake: 1,000,000 sats (organization weight)
- Vote multiplier: 100× (represents many members)
- Signature requirement: 3-of-5 multisig
- Recovery delay: 21,600 blocks (~30 days at 2 min/block)

**Vote Weight Calculation**:

```
Organization Vote Weight = Stake Amount × Multiplier
Example: 1,000,000 sats × 100 = 100,000,000 effective weight
```

---

## Privacy Analysis

### Key Path Spending (Optimal)

**Information Revealed**:

- Transaction exists
- Amount transferred
- Taproot output type
- Schnorr signature

**Information Hidden**:

- Multi-sig requirement
- Time-lock conditions
- Penalty mechanisms
- Script alternatives
- Number of signatories

**Privacy Score**: 9/10 (indistinguishable from regular Taproot)

### Script Path Spending (Fallback)

**Information Revealed**:

- Transaction exists
- Amount transferred
- Taproot output type
- Specific script used
- Control block (Merkle proof)
- Alternative scripts exist (but not their content)

**Information Hidden**:

- Other scripts in tree
- Key path aggregated key
- Full governance structure

**Privacy Score**: 6/10 (reveals used script only)

### Comparison to Traditional Methods

| Method              | Privacy | Size   | Cost   |
| ------------------- | ------- | ------ | ------ |
| P2PKH Single Vote   | 3/10    | ~200 B | Low    |
| P2SH Multisig       | 2/10    | ~300 B | High   |
| Taproot Key Path    | 9/10    | ~50 B  | Lowest |
| Taproot Script Path | 6/10    | ~250 B | Medium |

**Note**: Lotus does not use SegWit, so all sizes are in bytes (not vbytes).

---

## Security Considerations

### Time-Lock Attacks

**Attack**: Try to manipulate block timestamps to unlock early.

**Mitigation**:

- Use `OP_CHECKLOCKTIMEVERIFY` (consensus-enforced)
- Block timestamps cannot be manipulated significantly
- Median time past (MTP) validation prevents gaming

### Spam Penalty Bypass

**Attack**: Moderator colludes with spammer to avoid penalties.

**Mitigation**:

- Transparent on-chain penalty records
- Multiple moderators (M-of-N)
- Community oversight of moderation fund
- Slashing for malicious moderators

### Key Aggregation Safety

**Risk**: MuSig2 implementation bugs or nonce reuse.

**Mitigation**:

- Use well-tested MuSig2 libraries
- Implement deterministic nonce generation
- Provide script path fallback (explicit multisig)
- Regular security audits

### Front-Running

**Attack**: Watch mempool for large votes and counter-vote.

**Mitigation**:

- Time-locked commitments (reveal after lock)
- Batch voting with delayed reveal
- Encrypted vote payloads (future enhancement)
- Minimum lock periods

---

## Implementation Guide

### Step 1: Install Dependencies

```bash
npm install lotus-lib
```

### Step 2: Import Modules

```javascript
import {
  Transaction,
  PrivateKey,
  Address,
  Script,
  Signature,
  OpCode,
} from 'lotus-lib'

import {
  buildScriptPathTaproot,
  buildTapTree,
  tweakPrivateKey,
} from 'lotus-lib'

import { toScriptRANK, toScriptRNKC } from 'lotus-lib/rank'
```

### Step 3: Create Time-Locked Vote

```javascript
// 1. Create voter key
const voterKey = new PrivateKey()

// 2. Build time-lock script
const unlockHeight = currentHeight + 720 // 24 hours (Lotus: 2 min/block)
const timeLockScript = new Script()
  .add(Buffer.from(unlockHeight.toString(16), 'hex'))
  .add(OpCode.OP_CHECKLOCKTIMEVERIFY)
  .add(OpCode.OP_DROP)
  .add(voterKey.publicKey.toBuffer())
  .add(OpCode.OP_CHECKSIG)

// 3. Build Taproot commitment
const tree = { script: timeLockScript.toBuffer() }
const tapResult = buildScriptPathTaproot(voterKey.publicKey, tree)
const address = Address.fromTaprootCommitment(tapResult.commitment, 'livenet')

// 4. Create RANK vote
const rankScript = toScriptRANK('positive', 'twitter', 'elonmusk')

// 5. Create transaction
const tx = new Transaction()
  .from(utxo)
  .addOutput(
    new Transaction.Output({
      script: Script.fromBuffer(rankScript),
      satoshis: 0,
    }),
  )
  .to(address, 10000) // Lock 10,000 sats
  .sign(voterKey)
```

### Step 4: Create Moderated Comment

```javascript
// 1. Create keys
const commenterKey = new PrivateKey()
const moderatorKey = new PrivateKey()

// 2. Build script tree (refund + penalty + emergency)
const refundScript = new Script()
  .add(Buffer.from((currentHeight + 5040).toString(16), 'hex')) // 1 week (Lotus)
  .add(OpCode.OP_CHECKLOCKTIMEVERIFY)
  .add(OpCode.OP_DROP)
  .add(commenterKey.publicKey.toBuffer())
  .add(OpCode.OP_CHECKSIG)

const penaltyScript = new Script()
  .add(moderatorKey.publicKey.toBuffer())
  .add(OpCode.OP_CHECKSIG)

const tree = {
  left: { script: refundScript.toBuffer() },
  right: { script: penaltyScript.toBuffer() },
}

// 3. Build Taproot commitment
const tapResult = buildScriptPathTaproot(commenterKey.publicKey, tree)
const address = Address.fromTaprootCommitment(tapResult.commitment, 'livenet')

// 4. Create RNKC comment
const rnkcScripts = toScriptRNKC({
  platform: 'twitter',
  profileId: 'elonmusk',
  postId: '1234567890',
  comment: 'Great post!',
})

// 5. Create transaction
const tx = new Transaction()
  .from(utxo)
  .addOutput(
    new Transaction.Output({
      script: Script.fromBuffer(rnkcScripts[0]),
      satoshis: 0,
    }),
  )
  .addOutput(
    new Transaction.Output({
      script: Script.fromBuffer(rnkcScripts[1]),
      satoshis: 0,
    }),
  )
  .to(address, 50000) // Stake 50,000 sats
  .sign(commenterKey)
```

### Step 5: Create Organizational Vote

```javascript
// 1. Create board member keys
const members = [new PrivateKey(), new PrivateKey(), new PrivateKey()]

// 2. Build multisig script (3-of-3)
const multisigScript = new Script().add(OpCode.OP_3)
members.forEach(m => multisigScript.add(m.publicKey.toBuffer()))
multisigScript.add(OpCode.OP_3).add(OpCode.OP_CHECKMULTISIG)

// 3. Build Taproot (use first member as internal key)
const tree = { script: multisigScript.toBuffer() }
const tapResult = buildScriptPathTaproot(members[0].publicKey, tree)
const address = Address.fromTaprootCommitment(tapResult.commitment, 'livenet')

// 4. Create organizational vote
const rankScript = toScriptRANK('positive', 'twitter', 'LotusProtocol')

// 5. Create transaction with large stake (vote weight)
const tx = new Transaction()
  .from(utxo)
  .addOutput(
    new Transaction.Output({
      script: Script.fromBuffer(rankScript),
      satoshis: 0,
    }),
  )
  .to(address, 1000000) // 1M sats = org vote weight
  .sign(members[0])
```

---

## Examples

Complete working examples are available in the `examples/` directory:

1. **`taproot-rank-timelock.ts`**: Time-locked voting with commitment periods
2. **`taproot-rnkc-moderation.ts`**: Moderated comments with spam penalties
3. **`taproot-rank-multisig.ts`**: Multi-signature organizational voting

Run examples:

```bash
npx tsx examples/taproot-rank-timelock.ts
npx tsx examples/taproot-rnkc-moderation.ts
npx tsx examples/taproot-rank-multisig.ts
```

---

## Future Enhancements

### Phase 1: Current Implementation

- ✅ Time-locked voting
- ✅ Moderated comments
- ✅ Multi-sig organizational votes
- ✅ Basic privacy via key path

### Phase 2: Advanced Features

- ⏳ MuSig2 key aggregation
- ⏳ Encrypted vote payloads
- ⏳ Threshold signatures (t-of-n)
- ⏳ Adaptor signatures for atomic swaps

### Phase 3: Protocol Extensions

- ⏳ Vote delegation with Taproot
- ⏳ Reputation-weighted voting
- ⏳ Cross-chain voting bridges
- ⏳ Zero-knowledge vote proofs

---

## Resources

- [Taproot Specification](./TAPROOT_IMPLEMENTATION.md)
- [RANK Protocol Documentation](../lib/rank.ts)
- [BIP340: Schnorr Signatures](https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki)
- [BIP341: Taproot](https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki)
- [MuSig2 Paper](https://eprint.iacr.org/2020/1261)

---

**Last Modified**: October 28, 2025
