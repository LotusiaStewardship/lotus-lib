# MuSig2 P2P Event-Driven Architecture

**Version**: 1.0.0  
**Status**: ✅ **IMPLEMENTED**  
**Last Updated**: November 2025

---

## Overview

The MuSig2 P2P implementation is **100% event-driven** with **zero internal timeouts or intervals**. All timing and scheduling is controlled by the application layer, not the library.

## Core Principle

> **The library emits events; the application controls timing.**

This architectural decision provides:

- ✅ **Flexibility**: Applications control timeout durations
- ✅ **Testability**: No internal timers to mock or wait for
- ✅ **Determinism**: Behavior is predictable and reproducible
- ✅ **Resource Efficiency**: No background timers running
- ✅ **Clarity**: Clear separation between library and application concerns

---

## Removed Internal Timers

The following internal timers have been **completely removed**:

### 1. Session Cleanup (`setInterval`)

**Old Behavior** (❌ Removed):

```typescript
// Library automatically cleaned up sessions every 60 seconds
this.sessionCleanupIntervalId = setInterval(() => {
  this.cleanupExpiredSessions()
}, 60000)
```

**New Behavior** (✅ Event-Driven):

```typescript
// Application manually triggers cleanup when needed
coordinator.cleanupExpiredSessions()

// Or set up application-level periodic cleanup if desired
setInterval(() => {
  coordinator.cleanupExpiredSessions()
}, 60000)
```

### 2. Coordinator Failover (`setTimeout`)

**Old Behavior** (❌ Removed):

```typescript
// Library automatically triggered failover after 5 minutes
const timeoutId = setTimeout(
  () => {
    this._handleCoordinatorTimeout(sessionId)
  },
  5 * 60 * 1000,
)
```

**New Behavior** (✅ Event-Driven):

```typescript
// Application controls failover timing
coordinator.on('session:should-broadcast', async sessionId => {
  const timeout = setTimeout(
    () => {
      coordinator.triggerCoordinatorFailover(sessionId)
    },
    5 * 60 * 1000,
  ) // Application chooses timeout

  try {
    await broadcastTransaction(sessionId)
    clearTimeout(timeout) // Success - cancel failover
    coordinator.notifyBroadcastComplete(sessionId)
  } catch (error) {
    // Let timeout trigger failover
  }
})
```

### 3. Identity Manager Cleanup (`setInterval`)

**Old Behavior** (❌ Removed):

```typescript
// Library automatically cleaned up identity data every hour
this.cleanupIntervalId = setInterval(
  () => {
    this.cleanup()
  },
  60 * 60 * 1000,
)
```

**New Behavior** (✅ Event-Driven):

```typescript
// Application manually triggers cleanup when needed
const identityManager = coordinator.getIdentityManager()
identityManager.cleanup()
```

---

## Removed Configuration Options

The following configuration options have been **removed** as they are no longer needed:

```typescript
interface MuSig2P2PConfig {
  // ❌ REMOVED: No automatic broadcast timeout
  broadcastTimeout?: number

  // ❌ REMOVED: No automatic cleanup
  enableAutoCleanup?: boolean
  cleanupInterval?: number
}
```

The following configuration options remain:

```typescript
interface MuSig2P2PConfig {
  // ✅ RETAINED: Used by manual cleanup to determine "stuck" threshold
  stuckSessionTimeout?: number // Default: 10 minutes
}
```

---

## Event-Driven API

### Public Methods for Manual Control

#### 1. `cleanupExpiredSessions()`

Manually clean up expired and stuck sessions.

```typescript
public cleanupExpiredSessions(): void
```

**When to call**:

- Before processing important operations
- Periodically (if desired, via application-level timer)
- When memory pressure is detected
- On application startup/shutdown

**Example**:

```typescript
// Option 1: On-demand cleanup
coordinator.cleanupExpiredSessions()

// Option 2: Periodic cleanup (application-managed)
setInterval(() => {
  coordinator.cleanupExpiredSessions()
}, 60000) // Every minute

// Option 3: Event-triggered cleanup
coordinator.on('session:created', () => {
  coordinator.cleanupExpiredSessions() // Clean before creating new session
})
```

#### 2. `triggerCoordinatorFailover()`

Manually trigger coordinator failover.

```typescript
public async triggerCoordinatorFailover(sessionId: string): Promise<void>
```

**When to call**:

- When coordinator fails to broadcast within acceptable timeframe
- When broadcast error is detected
- When coordinator becomes unresponsive

**Example**:

```typescript
coordinator.on('session:should-broadcast', async sessionId => {
  // Application-level timeout
  const timeout = setTimeout(
    () => {
      console.warn('Coordinator timeout, triggering failover')
      coordinator.triggerCoordinatorFailover(sessionId)
    },
    5 * 60 * 1000,
  )

  try {
    await buildAndBroadcastTransaction(sessionId)
    clearTimeout(timeout)
    coordinator.notifyBroadcastComplete(sessionId)
  } catch (error) {
    console.error('Broadcast failed:', error)
    // Optionally trigger immediate failover
    clearTimeout(timeout)
    await coordinator.triggerCoordinatorFailover(sessionId)
  }
})
```

#### 3. `notifyBroadcastComplete()`

Signal that broadcast completed successfully.

```typescript
public notifyBroadcastComplete(sessionId: string): void
```

**When to call**:

- Immediately after successful transaction broadcast
- Emits `SESSION_BROADCAST_CONFIRMED` event

**Example**:

```typescript
try {
  await lotus.sendRawTransaction(tx.serialize())
  coordinator.notifyBroadcastComplete(sessionId) // Success
} catch (error) {
  // Handle error, possibly trigger failover
}
```

---

## Migration Guide

### For Applications Using Old API

**Before (❌ Old Automatic API)**:

```typescript
const coordinator = new MuSig2P2PCoordinator(p2pConfig, {
  enableAutoCleanup: true,
  cleanupInterval: 60000,
  broadcastTimeout: 5 * 60 * 1000,
})

// Coordinator automatically cleaned up and failed over
coordinator.on('session:should-broadcast', async sessionId => {
  await broadcastTransaction(sessionId)
  coordinator.notifyBroadcastComplete(sessionId)
})
```

**After (✅ New Event-Driven API)**:

```typescript
const coordinator = new MuSig2P2PCoordinator(p2pConfig, {
  // Removed: enableAutoCleanup, cleanupInterval, broadcastTimeout
  stuckSessionTimeout: 10 * 60 * 1000, // For manual cleanup threshold
})

// Application manages timing
coordinator.on('session:should-broadcast', async sessionId => {
  const timeout = setTimeout(
    () => {
      coordinator.triggerCoordinatorFailover(sessionId)
    },
    5 * 60 * 1000,
  )

  try {
    await broadcastTransaction(sessionId)
    clearTimeout(timeout)
    coordinator.notifyBroadcastComplete(sessionId)
  } catch (error) {
    // Let timeout trigger failover
  }
})

// Application manages cleanup (if desired)
setInterval(() => {
  coordinator.cleanupExpiredSessions()
}, 60000)
```

---

## Benefits of Event-Driven Architecture

### 1. **Testability**

**Before**:

```typescript
// Hard to test - need to wait for internal timers
await coordinator.createSession(...)
await sleep(5 * 60 * 1000) // Wait for timeout
expect(failoverTriggered).toBe(true)
```

**After**:

```typescript
// Easy to test - direct control
await coordinator.createSession(...)
await coordinator.triggerCoordinatorFailover(sessionId)
expect(failoverTriggered).toBe(true)
```

### 2. **Flexibility**

Applications can:

- Use different timeout durations per session
- Implement custom failover logic
- Skip cleanup when not needed
- Control resource usage precisely

### 3. **Debugging**

All timing is explicit in application code:

- Clear stack traces
- No hidden background tasks
- Predictable execution flow

### 4. **Resource Efficiency**

No background timers when library is idle:

- Lower CPU usage
- Better battery life (mobile/IoT)
- Cleaner shutdown

---

## Complete Example

```typescript
import { MuSig2P2PCoordinator } from 'lotus-lib/lib/p2p/musig2'

// 1. Create coordinator (event-driven, no automatic timers)
const coordinator = new MuSig2P2PCoordinator(
  {
    listen: ['/ip4/0.0.0.0/tcp/4001'],
    enableDHT: true,
  },
  {
    enableCoordinatorElection: true,
    enableCoordinatorFailover: true,
    stuckSessionTimeout: 10 * 60 * 1000, // For manual cleanup
  },
)

// 2. Application-level periodic cleanup (optional)
const cleanupTimer = setInterval(() => {
  coordinator.cleanupExpiredSessions()
}, 60000) // Every minute

// 3. Application-managed coordinator failover
coordinator.on('session:should-broadcast', async sessionId => {
  console.log('I am the coordinator, attempting broadcast...')

  // Application controls timeout duration
  const failoverTimeout = setTimeout(
    () => {
      console.warn('Broadcast timeout, triggering failover')
      coordinator.triggerCoordinatorFailover(sessionId)
    },
    5 * 60 * 1000,
  ) // 5 minutes

  try {
    // Build and broadcast transaction
    const signature = coordinator.getFinalSignature(sessionId)
    const tx = buildTransaction(signature)
    await lotus.sendRawTransaction(tx.serialize())

    // Success: cancel failover and notify
    clearTimeout(failoverTimeout)
    coordinator.notifyBroadcastComplete(sessionId)
    console.log('✅ Broadcast successful')
  } catch (error) {
    console.error('❌ Broadcast failed:', error)
    // Let timeout trigger failover automatically
  }
})

// 4. Monitor failover events
coordinator.on(
  'session:coordinator-failed',
  (sessionId, oldIndex, newIndex) => {
    console.log(`Coordinator ${oldIndex} failed, ${newIndex} taking over`)
  },
)

coordinator.on('session:failover-exhausted', sessionId => {
  console.error('All coordinators failed! Manual intervention needed.')
})

// 5. Cleanup on shutdown
process.on('SIGINT', async () => {
  clearInterval(cleanupTimer)
  await coordinator.cleanup()
  process.exit(0)
})

// 6. Start coordinator
await coordinator.start()
```

---

## Security Considerations

### No Internal Timers = No Timing Side Channels

The event-driven architecture eliminates potential timing side channels:

- ✅ No predictable timer intervals to observe
- ✅ No internal state changes at fixed intervals
- ✅ Application controls all timing behavior

### Failover Security

Application-managed failover provides:

- ✅ Custom timeout durations per session
- ✅ Immediate failover on detected errors
- ✅ Conditional failover based on application logic

---

## Frequently Asked Questions

### Q: Why remove automatic cleanup?

**A**: Automatic cleanup requires internal `setInterval`, which:

- Runs continuously (resource waste when idle)
- Adds non-determinism to tests
- Limits application control over cleanup timing
- Violates single responsibility principle

Event-driven manual cleanup solves all these issues.

### Q: Why remove automatic coordinator failover timeout?

**A**: Different applications need different timeout durations:

- High-frequency trading: 30 seconds
- Standard transactions: 5 minutes
- Large batches: 30 minutes

Application-level control provides this flexibility.

### Q: Won't this make the API more complex?

**A**: Slightly more verbose, but:

- More explicit and predictable
- Better testability
- Greater flexibility
- Clearer responsibilities

The tradeoff heavily favors event-driven architecture.

### Q: What if I want automatic cleanup?

**A**: Simple! Just add it in your application:

```typescript
setInterval(() => {
  coordinator.cleanupExpiredSessions()
}, 60000)
```

Now YOU control the interval, not the library.

---

## Summary

| Feature                  | Old (Automatic)           | New (Event-Driven)                    |
| ------------------------ | ------------------------- | ------------------------------------- |
| **Session Cleanup**      | Automatic `setInterval`   | Manual `cleanupExpiredSessions()`     |
| **Coordinator Failover** | Automatic `setTimeout`    | Manual `triggerCoordinatorFailover()` |
| **Identity Cleanup**     | Automatic `setInterval`   | Manual `cleanup()`                    |
| **Testability**          | ❌ Hard (wait for timers) | ✅ Easy (direct control)              |
| **Flexibility**          | ❌ Fixed timeouts         | ✅ Application-controlled             |
| **Resource Efficiency**  | ❌ Always running timers  | ✅ No background timers               |
| **Determinism**          | ❌ Non-deterministic      | ✅ Fully deterministic                |

---

**The MuSig2 P2P implementation is now 100% event-driven with zero internal timeouts.**

All timing and scheduling is controlled by the application layer, providing maximum flexibility, testability, and resource efficiency.
