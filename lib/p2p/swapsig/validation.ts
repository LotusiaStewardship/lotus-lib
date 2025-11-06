/**
 * SwapSig P2P Payload Validation
 *
 * Validates message payloads before processing to catch structural issues early
 */

import { ValidationError } from '../musig2/errors.js'
import type {
  ParticipantRegisteredPayload,
  DestinationRevealPayload,
  PoolJoinPayload,
  RegistrationAckPayload,
  SetupTxBroadcastPayload,
  SetupConfirmedPayload,
  SetupCompletePayload,
  RevealCompletePayload,
  SettlementTxBroadcastPayload,
  SettlementConfirmedPayload,
  SettlementCompletePayload,
  PoolAbortPayload,
  ParticipantDroppedPayload,
} from './protocol-handler.js'

/**
 * Validate that a value is a non-empty string
 */
function validateString(
  value: unknown,
  fieldName: string,
  allowEmpty = false,
): void {
  if (typeof value !== 'string') {
    throw new ValidationError(
      `${fieldName} must be a string`,
      `invalid-type-${fieldName}`,
    )
  }
  if (!allowEmpty && value.length === 0) {
    throw new ValidationError(
      `${fieldName} cannot be empty`,
      `empty-${fieldName}`,
    )
  }
}

/**
 * Validate that a value is a number
 */
function validateNumber(value: unknown, fieldName: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(
      `${fieldName} must be a finite number`,
      `invalid-type-${fieldName}`,
    )
  }
}

/**
 * Validate pool join payload
 */
export function validatePoolJoinPayload(
  payload: unknown,
): asserts payload is PoolJoinPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.participantIndex, 'participantIndex')
}

/**
 * Validate participant registered payload
 */
export function validateParticipantRegisteredPayload(
  payload: unknown,
): asserts payload is ParticipantRegisteredPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.participantIndex, 'participantIndex')
  validateString(p.peerId, 'peerId')
  validateString(p.publicKey, 'publicKey')
  validateString(p.inputTxId, 'inputTxId')
  validateNumber(p.inputIndex, 'inputIndex')
  validateString(p.ownershipProof, 'ownershipProof')
  validateString(p.finalOutputCommitment, 'finalOutputCommitment')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate registration acknowledgment payload
 */
export function validateRegistrationAckPayload(
  payload: unknown,
): asserts payload is RegistrationAckPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.participantIndex, 'participantIndex')
  validateString(p.acknowledgedBy, 'acknowledgedBy')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate setup transaction broadcast payload
 */
export function validateSetupTxBroadcastPayload(
  payload: unknown,
): asserts payload is SetupTxBroadcastPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.participantIndex, 'participantIndex')
  validateString(p.txId, 'txId')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate setup confirmed payload
 */
export function validateSetupConfirmedPayload(
  payload: unknown,
): asserts payload is SetupConfirmedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.participantIndex, 'participantIndex')
  validateString(p.txId, 'txId')
  validateNumber(p.confirmations, 'confirmations')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate setup complete payload
 */
export function validateSetupCompletePayload(
  payload: unknown,
): asserts payload is SetupCompletePayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate destination reveal payload
 */
export function validateDestinationRevealPayload(
  payload: unknown,
): asserts payload is DestinationRevealPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.participantIndex, 'participantIndex')
  validateString(p.finalAddress, 'finalAddress')
  validateString(p.revealProof, 'revealProof')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate reveal complete payload
 */
export function validateRevealCompletePayload(
  payload: unknown,
): asserts payload is RevealCompletePayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate settlement transaction broadcast payload
 */
export function validateSettlementTxBroadcastPayload(
  payload: unknown,
): asserts payload is SettlementTxBroadcastPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.outputIndex, 'outputIndex')
  validateString(p.txId, 'txId')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate settlement confirmed payload
 */
export function validateSettlementConfirmedPayload(
  payload: unknown,
): asserts payload is SettlementConfirmedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.outputIndex, 'outputIndex')
  validateString(p.txId, 'txId')
  validateNumber(p.confirmations, 'confirmations')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate settlement complete payload
 */
export function validateSettlementCompletePayload(
  payload: unknown,
): asserts payload is SettlementCompletePayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate pool abort payload
 */
export function validatePoolAbortPayload(
  payload: unknown,
): asserts payload is PoolAbortPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateString(p.reason, 'reason')
  validateNumber(p.timestamp, 'timestamp')
}

/**
 * Validate participant dropped payload
 */
export function validateParticipantDroppedPayload(
  payload: unknown,
): asserts payload is ParticipantDroppedPayload {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload must be an object', 'invalid-payload')
  }

  const p = payload as Record<string, unknown>
  validateString(p.poolId, 'poolId')
  validateString(p.peerId, 'peerId')
  validateString(p.reason, 'reason')
  validateNumber(p.timestamp, 'timestamp')
}
