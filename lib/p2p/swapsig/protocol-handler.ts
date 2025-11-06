/**
 * SwapSig P2P Protocol Handler
 *
 * Implements IProtocolHandler for SwapSig coordination
 */

import { P2PMessage, PeerInfo, IProtocolHandler } from '../types.js'
import {
  SwapSigMessageType,
  SwapSigEvent,
  SwapPoolAnnouncement,
} from './types.js'
import { deserializePublicKey } from '../musig2/serialization.js'
import { DeserializationError, ValidationError } from '../musig2/errors.js'
import {
  validatePoolJoinPayload,
  validateParticipantRegisteredPayload,
  validateRegistrationAckPayload,
  validateSetupTxBroadcastPayload,
  validateSetupConfirmedPayload,
  validateSetupCompletePayload,
  validateDestinationRevealPayload,
  validateRevealCompletePayload,
  validateSettlementTxBroadcastPayload,
  validateSettlementConfirmedPayload,
  validateSettlementCompletePayload,
  validatePoolAbortPayload,
  validateParticipantDroppedPayload,
} from './validation.js'
import type { SwapSigCoordinator } from './coordinator.js'
import type { Address } from '../../bitcore/address.js'

/**
 * Message payload types for SwapSig
 */

export interface PoolAnnouncePayload {
  announcement: SwapPoolAnnouncement
}

export interface PoolJoinPayload {
  poolId: string
  participantIndex: number
}

export interface ParticipantRegisteredPayload {
  poolId: string
  participantIndex: number
  peerId: string
  publicKey: string
  inputTxId: string
  inputIndex: number
  ownershipProof: string // hex
  finalOutputCommitment: string // hex
  timestamp: number
}

export interface RegistrationAckPayload {
  poolId: string
  participantIndex: number
  acknowledgedBy: string
  timestamp: number
}

export interface SetupTxBroadcastPayload {
  poolId: string
  participantIndex: number
  txId: string
  timestamp: number
}

export interface SetupConfirmedPayload {
  poolId: string
  participantIndex: number
  txId: string
  confirmations: number
  timestamp: number
}

export interface SetupCompletePayload {
  poolId: string
  timestamp: number
}

export interface DestinationRevealPayload {
  poolId: string
  participantIndex: number
  finalAddress: string
  revealProof: string // hex - proves this matches commitment
  timestamp: number
}

export interface RevealCompletePayload {
  poolId: string
  timestamp: number
}

export interface SettlementTxBroadcastPayload {
  poolId: string
  outputIndex: number
  txId: string
  timestamp: number
}

export interface SettlementConfirmedPayload {
  poolId: string
  outputIndex: number
  txId: string
  confirmations: number
  timestamp: number
}

export interface SettlementCompletePayload {
  poolId: string
  timestamp: number
}

export interface PoolAbortPayload {
  poolId: string
  reason: string
  timestamp: number
}

export interface ParticipantDroppedPayload {
  poolId: string
  peerId: string
  reason: string
  timestamp: number
}

/**
 * SwapSig P2P Protocol Handler
 *
 * Handles incoming SwapSig messages and routes them to the coordinator
 */
export class SwapSigP2PProtocolHandler implements IProtocolHandler {
  readonly protocolName = 'swapsig'
  readonly protocolId = '/lotus/swapsig/1.0.0'

  private coordinator?: SwapSigCoordinator

  /**
   * Set the coordinator instance
   */
  setCoordinator(coordinator: SwapSigCoordinator): void {
    this.coordinator = coordinator
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message: P2PMessage, from: PeerInfo): Promise<void> {
    if (!this.coordinator) {
      console.error('[SwapSigP2P] Coordinator not set')
      return
    }

    if (message.protocol !== this.protocolName) {
      return // Not for us
    }

    try {
      switch (message.type) {
        // Pool lifecycle
        case SwapSigMessageType.POOL_ANNOUNCE:
          await this._handlePoolAnnounce(
            message.payload as PoolAnnouncePayload,
            from,
          )
          break

        case SwapSigMessageType.POOL_JOIN:
          await this._handlePoolJoin(message.payload as PoolJoinPayload, from)
          break

        // Registration
        case SwapSigMessageType.PARTICIPANT_REGISTERED:
          await this._handleParticipantRegistered(
            message.payload as ParticipantRegisteredPayload,
            from,
          )
          break

        case SwapSigMessageType.REGISTRATION_ACK:
          await this._handleRegistrationAck(
            message.payload as RegistrationAckPayload,
            from,
          )
          break

        // Setup round
        case SwapSigMessageType.SETUP_TX_BROADCAST:
          await this._handleSetupTxBroadcast(
            message.payload as SetupTxBroadcastPayload,
            from,
          )
          break

        case SwapSigMessageType.SETUP_CONFIRMED:
          await this._handleSetupConfirmed(
            message.payload as SetupConfirmedPayload,
            from,
          )
          break

        case SwapSigMessageType.SETUP_COMPLETE:
          await this._handleSetupComplete(
            message.payload as SetupCompletePayload,
            from,
          )
          break

        // Destination reveal
        case SwapSigMessageType.DESTINATION_REVEAL:
          await this._handleDestinationReveal(
            message.payload as DestinationRevealPayload,
            from,
          )
          break

        case SwapSigMessageType.REVEAL_COMPLETE:
          await this._handleRevealComplete(
            message.payload as RevealCompletePayload,
            from,
          )
          break

        // Settlement round
        case SwapSigMessageType.SETTLEMENT_TX_BROADCAST:
          await this._handleSettlementTxBroadcast(
            message.payload as SettlementTxBroadcastPayload,
            from,
          )
          break

        case SwapSigMessageType.SETTLEMENT_CONFIRMED:
          await this._handleSettlementConfirmed(
            message.payload as SettlementConfirmedPayload,
            from,
          )
          break

        case SwapSigMessageType.SETTLEMENT_COMPLETE:
          await this._handleSettlementComplete(
            message.payload as SettlementCompletePayload,
            from,
          )
          break

        // Errors
        case SwapSigMessageType.POOL_ABORT:
          await this._handlePoolAbort(message.payload as PoolAbortPayload, from)
          break

        case SwapSigMessageType.PARTICIPANT_DROPPED:
          await this._handleParticipantDropped(
            message.payload as ParticipantDroppedPayload,
            from,
          )
          break

        default:
          console.warn(`[SwapSigP2P] Unknown message type: ${message.type}`)
      }
    } catch (error) {
      console.error(
        `[SwapSigP2P] Error handling message ${message.type}:`,
        error,
      )
      // Send error notification back if possible
      if (
        message.payload &&
        typeof message.payload === 'object' &&
        'poolId' in message.payload
      ) {
        try {
          await this._sendPoolError(
            (message.payload as { poolId: string }).poolId,
            from.peerId,
            error instanceof Error ? error.message : String(error),
          )
        } catch (sendError) {
          console.error(
            '[SwapSigP2P] Failed to send error notification:',
            sendError,
          )
        }
      }
    }
  }

  /**
   * Handle peer connection
   */
  async onPeerConnected(peerId: string): Promise<void> {
    if (this.coordinator) {
      this.coordinator._onSwapSigPeerConnected(peerId)
    }
  }

  /**
   * Handle peer disconnection
   */
  async onPeerDisconnected(peerId: string): Promise<void> {
    if (this.coordinator) {
      this.coordinator._onSwapSigPeerDisconnected(peerId)
    }
  }

  /**
   * Handle pool announcement
   */
  private async _handlePoolAnnounce(
    payload: PoolAnnouncePayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    const announcement = payload.announcement

    // Validate announcement signature
    if (!this.coordinator._validatePoolAnnouncement(announcement)) {
      console.warn(`[SwapSigP2P] Invalid pool announcement from ${from.peerId}`)
      return
    }

    // Store announcement in coordinator's pool manager if needed
    // For now, just log discovery - actual pool creation happens via createPool()
    console.log(
      `[SwapSigP2P] Discovered pool ${announcement.poolId.substring(0, 8)}... from ${from.peerId}`,
    )
  }

  /**
   * Handle pool join
   */
  private async _handlePoolJoin(
    payload: PoolJoinPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validatePoolJoinPayload(payload)

      await this.coordinator._handlePoolJoin(
        payload.poolId,
        payload.participantIndex,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed pool join from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling pool join from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle participant registered
   */
  private async _handleParticipantRegistered(
    payload: ParticipantRegisteredPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateParticipantRegisteredPayload(payload)

      // Safely deserialize public key and hex buffers
      const publicKey = deserializePublicKey(payload.publicKey)
      const ownershipProof = Buffer.from(payload.ownershipProof, 'hex')
      const finalOutputCommitment = Buffer.from(
        payload.finalOutputCommitment,
        'hex',
      )

      await this.coordinator._handleParticipantRegistered(
        payload.poolId,
        payload.participantIndex,
        payload.peerId,
        publicKey,
        payload.inputTxId,
        payload.inputIndex,
        ownershipProof,
        finalOutputCommitment,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed participant registration from ${from.peerId}: ${error.message}`,
        )
        // Note: SwapSig doesn't have a security manager - could add one or just drop
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling participant registration from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle registration acknowledgment
   */
  private async _handleRegistrationAck(
    payload: RegistrationAckPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateRegistrationAckPayload(payload)

      await this.coordinator._handleRegistrationAck(
        payload.poolId,
        payload.participantIndex,
        payload.acknowledgedBy,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed registration ack from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling registration ack from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle setup transaction broadcast
   */
  private async _handleSetupTxBroadcast(
    payload: SetupTxBroadcastPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateSetupTxBroadcastPayload(payload)

      await this.coordinator._handleSetupTxBroadcast(
        payload.poolId,
        payload.participantIndex,
        payload.txId,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed setup tx broadcast from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling setup tx broadcast from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle setup confirmation
   */
  private async _handleSetupConfirmed(
    payload: SetupConfirmedPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateSetupConfirmedPayload(payload)

      await this.coordinator._handleSetupConfirmed(
        payload.poolId,
        payload.participantIndex,
        payload.txId,
        payload.confirmations,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed setup confirmed from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling setup confirmed from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle setup complete
   */
  private async _handleSetupComplete(
    payload: SetupCompletePayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateSetupCompletePayload(payload)

      await this.coordinator._handleSetupComplete(payload.poolId, from.peerId)
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed setup complete from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling setup complete from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle destination reveal
   */
  private async _handleDestinationReveal(
    payload: DestinationRevealPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateDestinationRevealPayload(payload)

      // Safely parse address and hex buffer
      const { Address: AddressClass } = await import('../../bitcore/address.js')

      const finalAddress = AddressClass.fromString(payload.finalAddress)
      const revealProof = Buffer.from(payload.revealProof, 'hex')

      await this.coordinator._handleDestinationReveal(
        payload.poolId,
        payload.participantIndex,
        finalAddress,
        revealProof,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed destination reveal from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // Wrap Bitcore Address parsing errors
      if (error instanceof Error && error.message.includes('address')) {
        console.warn(
          `[SwapSigP2P] ⚠️  Invalid address in destination reveal from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling destination reveal from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle reveal complete
   */
  private async _handleRevealComplete(
    payload: RevealCompletePayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateRevealCompletePayload(payload)

      await this.coordinator._handleRevealComplete(payload.poolId, from.peerId)
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed reveal complete from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling reveal complete from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle settlement transaction broadcast
   */
  private async _handleSettlementTxBroadcast(
    payload: SettlementTxBroadcastPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateSettlementTxBroadcastPayload(payload)

      await this.coordinator._handleSettlementTxBroadcast(
        payload.poolId,
        payload.outputIndex,
        payload.txId,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed settlement tx broadcast from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling settlement tx broadcast from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle settlement confirmation
   */
  private async _handleSettlementConfirmed(
    payload: SettlementConfirmedPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateSettlementConfirmedPayload(payload)

      await this.coordinator._handleSettlementConfirmed(
        payload.poolId,
        payload.outputIndex,
        payload.txId,
        payload.confirmations,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed settlement confirmed from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling settlement confirmed from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle settlement complete
   */
  private async _handleSettlementComplete(
    payload: SettlementCompletePayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateSettlementCompletePayload(payload)

      await this.coordinator._handleSettlementComplete(
        payload.poolId,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed settlement complete from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling settlement complete from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle pool abort
   */
  private async _handlePoolAbort(
    payload: PoolAbortPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validatePoolAbortPayload(payload)

      await this.coordinator._handlePoolAbort(
        payload.poolId,
        payload.reason,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed pool abort from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling pool abort from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Handle participant dropped
   */
  private async _handleParticipantDropped(
    payload: ParticipantDroppedPayload,
    from: PeerInfo,
  ): Promise<void> {
    if (!this.coordinator) return

    try {
      // SECURITY: Validate payload structure
      validateParticipantDroppedPayload(payload)

      await this.coordinator._handleParticipantDropped(
        payload.poolId,
        payload.peerId,
        payload.reason,
        from.peerId,
      )
    } catch (error) {
      if (
        error instanceof DeserializationError ||
        error instanceof ValidationError
      ) {
        console.warn(
          `[SwapSigP2P] ⚠️  Malformed participant dropped from ${from.peerId}: ${error.message}`,
        )
        return
      }
      // SECURITY: Never re-throw - log and drop to prevent DoS
      console.error(
        `[SwapSigP2P] ❌ Unexpected error handling participant dropped from ${from.peerId}:`,
        error,
      )
      return
    }
  }

  /**
   * Send error notification to peer
   */
  private async _sendPoolError(
    poolId: string,
    peerId: string,
    error: string,
  ): Promise<void> {
    if (!this.coordinator) return

    const payload: PoolAbortPayload = {
      poolId,
      reason: error,
      timestamp: Date.now(),
    }

    await this.coordinator._sendMessageToPeer(
      peerId,
      SwapSigMessageType.POOL_ABORT,
      payload,
    )
  }
}
