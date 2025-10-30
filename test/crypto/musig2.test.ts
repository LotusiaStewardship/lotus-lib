/**
 * MuSig2 Unit Tests
 *
 * Tests for MuSig2 multi-signature scheme adapted for Lotus Schnorr
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  musigKeyAgg,
  musigNonceGen,
  musigNonceAgg,
  musigPartialSign,
  musigPartialSigVerify,
  musigSigAgg,
  PrivateKey,
  Schnorr,
  BN,
} from '../../lib/bitcore/index.js'

describe('MuSig2', () => {
  describe('musigKeyAgg', () => {
    it('should aggregate 2 public keys', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()

      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])

      assert.strictEqual(ctx.pubkeys.length, 2)
      assert.ok(ctx.aggregatedPubKey)
      assert.ok(ctx.keyAggCoeff.get(0))
      assert.ok(ctx.keyAggCoeff.get(1))
    })

    it('should aggregate N public keys', () => {
      const keys = [
        new PrivateKey(),
        new PrivateKey(),
        new PrivateKey(),
        new PrivateKey(),
        new PrivateKey(),
      ]

      const ctx = musigKeyAgg(keys.map(k => k.publicKey))

      assert.strictEqual(ctx.pubkeys.length, 5)
      assert.ok(ctx.aggregatedPubKey)
      for (let i = 0; i < 5; i++) {
        assert.ok(ctx.keyAggCoeff.get(i), `Coefficient ${i} should exist`)
      }
    })

    it('should produce deterministic aggregated key', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()

      const ctx1 = musigKeyAgg([key1.publicKey, key2.publicKey])
      const ctx2 = musigKeyAgg([key1.publicKey, key2.publicKey])

      assert.strictEqual(
        ctx1.aggregatedPubKey.toString(),
        ctx2.aggregatedPubKey.toString(),
        'Same keys should produce same aggregated key',
      )
    })

    it('should produce different key with different order', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()

      const ctx1 = musigKeyAgg([key1.publicKey, key2.publicKey])
      const ctx2 = musigKeyAgg([key2.publicKey, key1.publicKey])

      // Different order produces different aggregated key (expected behavior)
      assert.notStrictEqual(
        ctx1.aggregatedPubKey.toString(),
        ctx2.aggregatedPubKey.toString(),
      )
    })

    it('should throw on empty pubkeys array', () => {
      assert.throws(() => {
        musigKeyAgg([])
      }, /Cannot aggregate zero public keys/)
    })
  })

  describe('musigNonceGen', () => {
    it('should generate valid nonces', () => {
      const key = new PrivateKey()
      const ctx = musigKeyAgg([key.publicKey])
      const message = Buffer.from('test message', 'utf8')

      const nonce = musigNonceGen(key, ctx.aggregatedPubKey, message)

      assert.ok(nonce.secretNonces)
      assert.ok(nonce.publicNonces)
      assert.strictEqual(nonce.secretNonces.length, 2)
      assert.strictEqual(nonce.publicNonces.length, 2)
      assert.ok(nonce.secretNonces[0])
      assert.ok(nonce.secretNonces[1])
      assert.ok(nonce.publicNonces[0])
      assert.ok(nonce.publicNonces[1])
    })

    it('should generate different nonces for different messages', () => {
      const key = new PrivateKey()
      const ctx = musigKeyAgg([key.publicKey])
      const message1 = Buffer.from('message 1', 'utf8')
      const message2 = Buffer.from('message 2', 'utf8')

      const nonce1 = musigNonceGen(key, ctx.aggregatedPubKey, message1)
      const nonce2 = musigNonceGen(key, ctx.aggregatedPubKey, message2)

      // Different messages should produce different nonces
      assert.notStrictEqual(
        nonce1.secretNonces[0].toString(),
        nonce2.secretNonces[0].toString(),
      )
    })

    it('should generate non-zero nonces', () => {
      const key = new PrivateKey()
      const ctx = musigKeyAgg([key.publicKey])
      const message = Buffer.from('test', 'utf8')

      const nonce = musigNonceGen(key, ctx.aggregatedPubKey, message)

      assert.ok(!nonce.secretNonces[0].isZero())
      assert.ok(!nonce.secretNonces[1].isZero())
    })
  })

  describe('musigNonceAgg', () => {
    it('should aggregate 2 nonces', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()
      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])
      const message = Buffer.from('test', 'utf8')

      const nonce1 = musigNonceGen(key1, ctx.aggregatedPubKey, message)
      const nonce2 = musigNonceGen(key2, ctx.aggregatedPubKey, message)

      const aggNonce = musigNonceAgg([nonce1.publicNonces, nonce2.publicNonces])

      assert.ok(aggNonce.R1)
      assert.ok(aggNonce.R2)
    })

    it('should aggregate N nonces', () => {
      const keys = [new PrivateKey(), new PrivateKey(), new PrivateKey()]
      const ctx = musigKeyAgg(keys.map(k => k.publicKey))
      const message = Buffer.from('test', 'utf8')

      const nonces = keys.map(k =>
        musigNonceGen(k, ctx.aggregatedPubKey, message),
      )

      const aggNonce = musigNonceAgg(nonces.map(n => n.publicNonces))

      assert.ok(aggNonce.R1)
      assert.ok(aggNonce.R2)
    })

    it('should throw on empty nonces array', () => {
      assert.throws(() => {
        musigNonceAgg([])
      }, /Cannot aggregate zero nonces/)
    })
  })

  describe('musigPartialSign', () => {
    it('should create valid partial signature', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()
      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])
      const message = Buffer.alloc(32).fill(0x42)

      const nonce1 = musigNonceGen(key1, ctx.aggregatedPubKey, message)
      const nonce2 = musigNonceGen(key2, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce1.publicNonces, nonce2.publicNonces])

      const partialSig1 = musigPartialSign(
        nonce1,
        key1,
        ctx,
        0,
        aggNonce,
        message,
      )

      assert.ok(partialSig1)
      assert.ok(!partialSig1.isZero())
    })

    it('should throw on invalid signer index', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()
      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])
      const message = Buffer.alloc(32).fill(0x42)

      const nonce1 = musigNonceGen(key1, ctx.aggregatedPubKey, message)
      const nonce2 = musigNonceGen(key2, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce1.publicNonces, nonce2.publicNonces])

      assert.throws(() => {
        musigPartialSign(nonce1, key1, ctx, 99, aggNonce, message)
      }, /Invalid signer index/)
    })
  })

  describe('musigPartialSigVerify', () => {
    it('should verify valid partial signature', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()
      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])
      const message = Buffer.alloc(32).fill(0x42)

      const nonce1 = musigNonceGen(key1, ctx.aggregatedPubKey, message)
      const nonce2 = musigNonceGen(key2, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce1.publicNonces, nonce2.publicNonces])

      const partialSig1 = musigPartialSign(
        nonce1,
        key1,
        ctx,
        0,
        aggNonce,
        message,
      )

      const valid = musigPartialSigVerify(
        partialSig1,
        nonce1.publicNonces,
        key1.publicKey,
        ctx,
        0,
        aggNonce,
        message,
      )

      assert.ok(valid, 'Valid partial signature should verify')
    })

    it('should reject invalid partial signature', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()
      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])
      const message = Buffer.alloc(32).fill(0x42)

      const nonce1 = musigNonceGen(key1, ctx.aggregatedPubKey, message)
      const nonce2 = musigNonceGen(key2, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce1.publicNonces, nonce2.publicNonces])

      const partialSig1 = musigPartialSign(
        nonce1,
        key1,
        ctx,
        0,
        aggNonce,
        message,
      )

      // Tamper with the partial signature
      const invalidPartialSig = partialSig1.add(new BN(1))

      const valid = musigPartialSigVerify(
        invalidPartialSig,
        nonce1.publicNonces,
        key1.publicKey,
        ctx,
        0,
        aggNonce,
        message,
      )

      assert.ok(!valid, 'Invalid partial signature should not verify')
    })
  })

  describe('musigSigAgg', () => {
    it('should aggregate partial signatures', () => {
      const key1 = new PrivateKey()
      const key2 = new PrivateKey()
      const ctx = musigKeyAgg([key1.publicKey, key2.publicKey])
      const message = Buffer.alloc(32).fill(0x42)

      const nonce1 = musigNonceGen(key1, ctx.aggregatedPubKey, message)
      const nonce2 = musigNonceGen(key2, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce1.publicNonces, nonce2.publicNonces])

      const partialSig1 = musigPartialSign(
        nonce1,
        key1,
        ctx,
        0,
        aggNonce,
        message,
      )
      const partialSig2 = musigPartialSign(
        nonce2,
        key2,
        ctx,
        1,
        aggNonce,
        message,
      )

      const finalSig = musigSigAgg(
        [partialSig1, partialSig2],
        aggNonce,
        message,
        ctx.aggregatedPubKey,
      )

      assert.ok(finalSig)
      assert.ok(finalSig.r)
      assert.ok(finalSig.s)
    })

    it('should throw on empty partial signatures array', () => {
      const key = new PrivateKey()
      const ctx = musigKeyAgg([key.publicKey])
      const message = Buffer.alloc(32).fill(0x42)
      const nonce = musigNonceGen(key, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce.publicNonces])

      assert.throws(() => {
        musigSigAgg([], aggNonce, message, ctx.aggregatedPubKey)
      }, /Cannot aggregate zero partial signatures/)
    })
  })

  describe('Complete 2-of-2 MuSig2 Flow', () => {
    it('should create and verify complete MuSig2 signature', () => {
      // Setup: Two signers
      const alice = new PrivateKey()
      const bob = new PrivateKey()

      // Step 1: Key Aggregation
      const ctx = musigKeyAgg([alice.publicKey, bob.publicKey])
      console.log('Aggregated key:', ctx.aggregatedPubKey.toString())

      // Step 2: Message to sign
      const message = Buffer.alloc(32).fill(0x01)

      // Step 3: Nonce Generation (each signer independently)
      const aliceNonce = musigNonceGen(alice, ctx.aggregatedPubKey, message)
      const bobNonce = musigNonceGen(bob, ctx.aggregatedPubKey, message)

      // Step 4: Nonce Aggregation (can be done by anyone)
      const aggNonce = musigNonceAgg([
        aliceNonce.publicNonces,
        bobNonce.publicNonces,
      ])

      // Step 5: Partial Signatures (each signer independently)
      const alicePartialSig = musigPartialSign(
        aliceNonce,
        alice,
        ctx,
        0,
        aggNonce,
        message,
      )
      const bobPartialSig = musigPartialSign(
        bobNonce,
        bob,
        ctx,
        1,
        aggNonce,
        message,
      )

      // Step 6: Verify Partial Signatures (recommended)
      const aliceValid = musigPartialSigVerify(
        alicePartialSig,
        aliceNonce.publicNonces,
        alice.publicKey,
        ctx,
        0,
        aggNonce,
        message,
      )
      const bobValid = musigPartialSigVerify(
        bobPartialSig,
        bobNonce.publicNonces,
        bob.publicKey,
        ctx,
        1,
        aggNonce,
        message,
      )

      assert.ok(aliceValid, 'Alice partial signature should verify')
      assert.ok(bobValid, 'Bob partial signature should verify')

      // Step 7: Signature Aggregation
      const finalSig = musigSigAgg(
        [alicePartialSig, bobPartialSig],
        aggNonce,
        message,
        ctx.aggregatedPubKey,
      )

      console.log('Final signature created:', finalSig.toString())

      // Step 8: Verify with standard Schnorr verification
      const verified = Schnorr.verify(
        message,
        finalSig,
        ctx.aggregatedPubKey,
        'big',
      )

      assert.ok(verified, 'MuSig2 signature should verify as Schnorr')
      console.log('✓ MuSig2 signature verified successfully!')
    })

    it('should work with 3-of-3 multisig', () => {
      const alice = new PrivateKey()
      const bob = new PrivateKey()
      const carol = new PrivateKey()

      // Key aggregation
      const ctx = musigKeyAgg([alice.publicKey, bob.publicKey, carol.publicKey])

      const message = Buffer.alloc(32).fill(0x02)

      // Nonce generation
      const aliceNonce = musigNonceGen(alice, ctx.aggregatedPubKey, message)
      const bobNonce = musigNonceGen(bob, ctx.aggregatedPubKey, message)
      const carolNonce = musigNonceGen(carol, ctx.aggregatedPubKey, message)

      const aggNonce = musigNonceAgg([
        aliceNonce.publicNonces,
        bobNonce.publicNonces,
        carolNonce.publicNonces,
      ])

      // Partial signatures
      const alicePartialSig = musigPartialSign(
        aliceNonce,
        alice,
        ctx,
        0,
        aggNonce,
        message,
      )
      const bobPartialSig = musigPartialSign(
        bobNonce,
        bob,
        ctx,
        1,
        aggNonce,
        message,
      )
      const carolPartialSig = musigPartialSign(
        carolNonce,
        carol,
        ctx,
        2,
        aggNonce,
        message,
      )

      // Aggregate
      const finalSig = musigSigAgg(
        [alicePartialSig, bobPartialSig, carolPartialSig],
        aggNonce,
        message,
        ctx.aggregatedPubKey,
      )

      // Verify
      const verified = Schnorr.verify(
        message,
        finalSig,
        ctx.aggregatedPubKey,
        'big',
      )

      assert.ok(verified, '3-of-3 MuSig2 signature should verify')
      console.log('✓ 3-of-3 MuSig2 signature verified successfully!')
    })

    it('should fail if partial signature is missing', () => {
      const alice = new PrivateKey()
      const bob = new PrivateKey()
      const ctx = musigKeyAgg([alice.publicKey, bob.publicKey])
      const message = Buffer.alloc(32).fill(0x03)

      const aliceNonce = musigNonceGen(alice, ctx.aggregatedPubKey, message)
      const bobNonce = musigNonceGen(bob, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([
        aliceNonce.publicNonces,
        bobNonce.publicNonces,
      ])

      const alicePartialSig = musigPartialSign(
        aliceNonce,
        alice,
        ctx,
        0,
        aggNonce,
        message,
      )

      // Only aggregate Alice's signature (missing Bob's)
      const finalSig = musigSigAgg(
        [alicePartialSig],
        aggNonce,
        message,
        ctx.aggregatedPubKey,
      )

      // Verify should fail
      const verified = Schnorr.verify(
        message,
        finalSig,
        ctx.aggregatedPubKey,
        'big',
      )

      assert.ok(!verified, 'Incomplete signature should not verify')
    })
  })

  describe('Edge Cases', () => {
    it('should handle single signer (degenerate case)', () => {
      const key = new PrivateKey()
      const ctx = musigKeyAgg([key.publicKey])
      const message = Buffer.alloc(32).fill(0x04)

      const nonce = musigNonceGen(key, ctx.aggregatedPubKey, message)
      const aggNonce = musigNonceAgg([nonce.publicNonces])

      const partialSig = musigPartialSign(nonce, key, ctx, 0, aggNonce, message)

      const finalSig = musigSigAgg(
        [partialSig],
        aggNonce,
        message,
        ctx.aggregatedPubKey,
      )

      const verified = Schnorr.verify(
        message,
        finalSig,
        ctx.aggregatedPubKey,
        'big',
      )

      assert.ok(verified, 'Single signer MuSig2 should work')
    })

    it('should work with many signers (10-of-10)', () => {
      const keys = Array.from({ length: 10 }, () => new PrivateKey())
      const ctx = musigKeyAgg(keys.map(k => k.publicKey))
      const message = Buffer.alloc(32).fill(0x05)

      const nonces = keys.map(k =>
        musigNonceGen(k, ctx.aggregatedPubKey, message),
      )
      const aggNonce = musigNonceAgg(nonces.map(n => n.publicNonces))

      const partialSigs = keys.map((k, i) =>
        musigPartialSign(nonces[i], k, ctx, i, aggNonce, message),
      )

      const finalSig = musigSigAgg(
        partialSigs,
        aggNonce,
        message,
        ctx.aggregatedPubKey,
      )

      const verified = Schnorr.verify(
        message,
        finalSig,
        ctx.aggregatedPubKey,
        'big',
      )

      assert.ok(verified, '10-of-10 MuSig2 should work')
      console.log('✓ 10-of-10 MuSig2 signature verified successfully!')
    })
  })
})
