# DHT Automatic Routing Table Population - Critical Discovery

## Problem

DHT routing tables were not auto-populating when peers connected, even though:

- TopologyListener was correctly registered
- Identify service was exchanging protocol information
- Both peers advertised DHT protocol support (`/lotus/kad/1.0.0`)

## Root Cause

**The default `peerInfoMapper` in `@libp2p/kad-dht` is `removePrivateAddressesMapper`**, which filters out private addresses like `127.0.0.1`.

When testing locally on localhost:

1. Peers connect and exchange protocols via identify service
2. TopologyListener detects DHT-capable peers and fires
3. DHT's `onPeerConnect()` is called with peer info
4. **`removePrivateAddressesMapper` filters out all `127.0.0.1` addresses**
5. `peerData.multiaddrs` becomes empty array
6. `onPeerConnect()` returns early without adding peer to routing table

```typescript
// From @libp2p/kad-dht/src/kad-dht.ts:395-415
async onPeerConnect (peerData: PeerInfo): Promise<void> {
  peerData = this.peerInfoMapper(peerData)  // ← Filters out 127.0.0.1!

  if (peerData.multiaddrs.length === 0) {
    this.log.trace('ignoring peer - no valid addresses after filtering')
    return  // ← Early return! Peer NOT added to routing table
  }

  await this.routingTable.add(peerData.id)
}
```

## Solution

Use `passthroughMapper` for local development and `removePrivateAddressesMapper` for production:

### Automatic Detection (Recommended)

The coordinator now auto-detects the environment:

```typescript
// coordinator.ts automatically detects:
// - Localhost (127.0.0.1) → passthroughMapper (allow private addresses)
// - Public (0.0.0.0, etc.) → removePrivateAddressesMapper (security)

const alice = new P2PCoordinator({
  listen: ['/ip4/127.0.0.1/tcp/0'], // ← Auto-detects localhost
  enableDHT: true,
  enableDHTServer: true,
})
// Uses passthroughMapper automatically
```

### Explicit Override

For custom configurations:

```typescript
import { passthroughMapper, removePrivateAddressesMapper } from 'lotus-sdk/p2p'

// Development: Allow all addresses
const devCoordinator = new P2PCoordinator({
  listen: ['/ip4/0.0.0.0/tcp/8080'],
  enableDHT: true,
  enableDHTServer: true,
  dhtPeerInfoMapper: passthroughMapper, // ← Explicitly allow private addresses
})

// Production: Only public addresses
const prodCoordinator = new P2PCoordinator({
  listen: ['/ip4/0.0.0.0/tcp/8080'],
  enableDHT: true,
  enableDHTServer: true,
  dhtPeerInfoMapper: removePrivateAddressesMapper, // ← Security: filter private
})
```

## Available Mappers

From `@libp2p/kad-dht`:

1. **`passthroughMapper`**: Allow all addresses (development/testing)
2. **`removePrivateAddressesMapper`**: Only public addresses (production security)
3. **`removePublicAddressesMapper`**: Only private addresses (LAN-only DHT)

## Impact

### Before Fix

- ❌ DHT routing tables remained empty on localhost
- ❌ Manual `routingTable.add()` required for testing
- ❌ `announceResource()` would hang (no peers to replicate to)
- ❌ `discoverResource()` always returned null (routing table empty)

### After Fix

- ✅ DHT routing tables auto-populate via TopologyListener
- ✅ No manual intervention needed
- ✅ DHT operations work automatically
- ✅ Production deployments secure by default

## Technical Details

### How Auto-Population Works

1. **Connection**: Peer A connects to Peer B
2. **Identify**: `@libp2p/identify` service exchanges protocol lists
3. **Event**: `peer:identify` event emitted by identify service
4. **Registrar**: `registrar._onPeerIdentify()` receives event
5. **Protocol Match**: Checks if peer supports DHT protocol (`/lotus/kad/1.0.0`)
6. **Topology Callback**: Calls `TopologyListener.onConnect(peerId)`
7. **DHT Event**: TopologyListener emits `peer` event
8. **Routing Table**: DHT's `onPeerConnect()` called
9. **Filter**: `peerInfoMapper` filters addresses
10. **Add Peer**: If addresses remain, peer added to routing table

### Why Manual Population Worked

Manual population bypassed the `peerInfoMapper` filter:

```typescript
// Manual approach (test-only)
const rt = dht.routingTable as RoutingTableWithAdd
await rt.add(peerId) // ← Directly adds, no filtering!
```

### Why It Failed on Localhost

The default mapper filtered out `127.0.0.1`:

```typescript
// Default behavior in @libp2p/kad-dht
peerInfoMapper: removePrivateAddressesMapper // ← Filters localhost!

// Result: All 127.0.0.1 addresses removed
// onPeerConnect() sees empty multiaddrs array
// Returns early, peer never added to routing table
```

## Security Considerations

### Development

- **Use `passthroughMapper`** to enable DHT testing on localhost
- Safe because only local network is accessible

### Production

- **Use `removePrivateAddressesMapper`** (default for non-localhost)
- Prevents attackers from injecting private IP addresses
- Ensures DHT only includes publicly reachable peers
- Critical for network security and reliability

## Lessons Learned

1. **Default settings optimize for production**, not development
2. **libp2p filters are security features** that can break local testing
3. **Auto-population works**, but environment-specific configuration is needed
4. **Debugging required deep dive** into libp2p internals (registrar, topology, identify)
5. **Manual population was a workaround**, not the real solution

## References

- `@libp2p/kad-dht` documentation
- `libp2p/src/registrar.ts`: Topology notification system
- `@libp2p/kad-dht/src/topology-listener.ts`: DHT peer discovery
- `@libp2p/kad-dht/src/kad-dht.ts`: Routing table management
