# DHT Integration Testing

This document explains the DHT integration tests and how to run them.

## Test Files

- **`coordinator.test.ts`**: Fast unit tests (~1.2s) for P2P functionality
- **`dht.integration.test.ts`**: Comprehensive DHT tests (~30-60s total)

## Running Tests

### Quick Tests (Unit Tests)

```bash
npx tsx test/p2p/coordinator.test.ts
```

- 18 tests in ~1.2 seconds
- Tests basic P2P functionality
- Suitable for CI/CD

### DHT Integration Tests

```bash
npx tsx test/p2p/dht.integration.test.ts
```

- Comprehensive DHT testing
- Takes 30-60 seconds
- Tests actual network propagation

### Run All Tests

```bash
npx mocha --require tsx/cjs 'test/p2p/**/*.test.ts' --timeout 60000
```

## Test Strategies Implemented

### Strategy 1: Current Unit Tests (coordinator.test.ts)

✅ Fast, reliable unit tests that verify:

- Local cache storage/retrieval
- DHT timeout behavior
- Connection management
- Message passing
- Protocol registration

**What it tests:**

- P2P infrastructure works correctly
- DHT operations complete without hanging
- Proper resource cleanup

**What it doesn't test:**

- Actual DHT propagation across network
- Multi-node DHT routing

### Strategy 2: Mesh Network (5 nodes)

✅ **Test:** `should propagate resources through DHT in 5-node mesh`

**Setup:**

- 5 nodes in server mode
- Fully connected mesh (everyone connected to everyone)
- Wait 3s for routing table stabilization
- Node 0 announces resource
- Wait 3s for DHT replication
- Node 4 queries DHT

**What it tests:**

- DHT propagation through multiple hops
- Resource replication across nodes
- DHT routing table functionality

**Expected behavior:**

- In networks with 5+ nodes, DHT should propagate data
- In smaller networks, propagation is probabilistic
- Tests verify timeout behavior works regardless

### Strategy 3: Bootstrap Node Architecture

✅ **Test:** `should use bootstrap node for DHT discovery`

**Setup:**

- 1 bootstrap node (central hub)
- Alice and Bob both connect to bootstrap
- Wait 3s for DHT stabilization
- Alice announces through bootstrap
- Bob queries through bootstrap

**What it tests:**

- Centralized bootstrap node pattern
- DHT discovery through central hub
- Realistic deployment scenario

**Use case:**

- Production deployments with known bootstrap nodes
- Simplified network topology
- Faster peer discovery

### Strategy 4: DHT Operation Unit Tests

✅ **Tests:**

- `should handle DHT put timeout gracefully`
- `should handle DHT query timeout gracefully`
- `should abort DHT operations on timeout`
- `should handle DHT operations in client mode`
- `should limit DHT events to prevent infinite loops`

**What it tests:**

- Individual DHT methods (`_putDHT`, `_queryDHT`)
- Timeout behavior
- Abort controller functionality
- Client vs server mode differences
- Event limiting mechanism

**Why it's important:**

- Verifies core DHT logic in isolation
- Tests edge cases (timeouts, aborts, empty results)
- Fast execution (~5s total)

## Understanding DHT Behavior

### In Small Networks (2-3 nodes)

- **DHT propagation is unreliable** - Kademlia DHT needs sufficient nodes
- **Timeouts are expected** - DHT queries may not find resources
- **Local cache always works** - Resources stored locally are always retrievable

### In Medium Networks (5-10 nodes)

- **DHT starts working** - Routing tables have enough entries
- **Propagation takes time** - 3-5 seconds typical
- **Success rates improve** - More nodes = better DHT coverage

### In Large Networks (100+ nodes)

- **DHT works as designed** - Full Kademlia routing
- **Fast propagation** - Well-connected network
- **High reliability** - Redundant storage

## Configuration Options

### Client Mode (`enableDHTServer: false`)

```typescript
{
  enableDHT: true,
  enableDHTServer: false  // Client mode
}
```

- **Can query DHT** ✅
- **Cannot serve data** ❌
- **No background operations** ✅
- **Fast shutdown** ✅

**Use for:** Tests, lightweight clients, mobile apps

### Server Mode (`enableDHTServer: true`)

```typescript
{
  enableDHT: true,
  enableDHTServer: true  // Server mode
}
```

- **Can query DHT** ✅
- **Serves data to network** ✅
- **Background routing operations** ⚠️
- **Slower shutdown** ⚠️

**Use for:** Production nodes, bootstrap nodes, persistent services

## Troubleshooting

### Tests Hang or Timeout

**Cause:** DHT background operations not terminating
**Solution:** Use `enableDHTServer: false` in tests

### "Resource not found" in DHT tests

**Cause:** Network too small for DHT propagation
**Solution:** This is expected - tests verify timeout behavior works

### Tests are slow

**Cause:** DHT needs time to stabilize (3-5s per operation)
**Solution:** This is normal for integration tests

### AbortError in logs

**Cause:** DHT operations timing out (expected behavior)
**Solution:** These are caught and handled gracefully

## Best Practices

### For Unit Tests

- Use `enableDHTServer: false`
- Test local cache only
- Use `waitForEvent` for async operations
- Keep tests fast (<2s total)

### For Integration Tests

- Use `enableDHTServer: true`
- Allow time for DHT stabilization (3-5s)
- Use longer timeouts (10-30s)
- Accept probabilistic outcomes

### For Production

- Use `enableDHTServer: true`
- Configure bootstrap nodes
- Monitor DHT routing table size
- Use timeouts appropriate for network size

## Continuous Integration

### Fast CI (< 2 minutes)

```bash
npx tsx test/p2p/coordinator.test.ts
```

### Full CI (< 5 minutes)

```bash
npx mocha --require tsx/cjs 'test/p2p/**/*.test.ts' --timeout 60000
```

### Nightly/Comprehensive

```bash
# Run with larger networks, longer timeouts
ENABLE_SLOW_TESTS=1 npx mocha --require tsx/cjs 'test/p2p/**/*.test.ts' --timeout 300000
```

## Future Enhancements

### Potential Additions

1. **10-node mesh test** - More realistic DHT behavior
2. **Multi-bootstrap test** - Multiple bootstrap nodes
3. **Network partition test** - Resilience to splits
4. **Load testing** - Many concurrent operations
5. **Real bootstrap nodes** - Test against live network

### Performance Metrics

Consider adding:

- DHT query latency measurements
- Propagation time tracking
- Success rate statistics
- Network topology analysis
