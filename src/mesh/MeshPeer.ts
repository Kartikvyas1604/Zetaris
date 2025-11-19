/**
 * Mesh Network Peer
 * Represents a peer node in the decentralized mesh network
 */

import { EventEmitter } from '../utils/EventEmitter';
import { randomBytes } from '@noble/hashes/utils';

export interface PeerInfo {
  id: string;
  publicKey: string;
  address: string;
  port: number;
  lastSeen: number;
  reputation: number;
  capabilities: string[];
}

export interface PeerMessage {
  id: string;
  type: 'transaction' | 'block' | 'sync' | 'ping' | 'discover';
  from: string;
  to?: string;
  payload: any;
  timestamp: number;
  signature?: string;
  ttl: number;
}

export class MeshPeer extends EventEmitter {
  public readonly id: string;
  public readonly publicKey: string;
  private connections: Map<string, PeerConnection>;
  private knownPeers: Map<string, PeerInfo>;
  private messageCache: Map<string, number>;
  private isActive: boolean;
  private discoveryInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(publicKey: string) {
    super();
    this.id = this.generatePeerId(publicKey);
    this.publicKey = publicKey;
    this.connections = new Map();
    this.knownPeers = new Map();
    this.messageCache = new Map();
    this.isActive = false;
  }

  /**
   * Start the peer node
   */
  async start(port: number = 8333): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    // Start peer discovery
    this.discoveryInterval = setInterval(() => {
      this.discoverPeers();
    }, 30000); // Every 30 seconds

    // Start cleanup of old messages
    this.cleanupInterval = setInterval(() => {
      this.cleanupMessageCache();
    }, 60000); // Every minute

    this.emit('peer:started', { id: this.id, port });
  }

  /**
   * Stop the peer node
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Close all connections
    for (const connection of this.connections.values()) {
      await connection.close();
    }
    this.connections.clear();

    // Clear intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.emit('peer:stopped');
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(peerInfo: PeerInfo): Promise<void> {
    if (this.connections.has(peerInfo.id)) {
      return; // Already connected
    }

    const connection = new PeerConnection(peerInfo);
    await connection.connect();

    this.connections.set(peerInfo.id, connection);
    this.knownPeers.set(peerInfo.id, peerInfo);

    connection.on('message', (message: PeerMessage) => {
      this.handleMessage(message);
    });

    connection.on('close', () => {
      this.connections.delete(peerInfo.id);
    });

    this.emit('peer:connected', peerInfo);
  }

  /**
   * Disconnect from a peer
   */
  async disconnectFromPeer(peerId: string): Promise<void> {
    const connection = this.connections.get(peerId);
    if (connection) {
      await connection.close();
      this.connections.delete(peerId);
      this.emit('peer:disconnected', peerId);
    }
  }

  /**
   * Broadcast a message to all connected peers
   */
  async broadcast(type: PeerMessage['type'], payload: any, ttl: number = 5): Promise<void> {
    const message: PeerMessage = {
      id: this.generateMessageId(),
      type,
      from: this.id,
      payload,
      timestamp: Date.now(),
      ttl,
    };

    // Add to cache to prevent rebroadcast
    this.messageCache.set(message.id, message.timestamp);

    // Send to all connected peers
    const promises = Array.from(this.connections.values()).map(conn =>
      conn.send(message).catch(err => {
        this.emit('error', { type: 'send-failed', peer: conn.peerId, error: err });
      })
    );

    await Promise.all(promises);
    this.emit('message:broadcast', { messageId: message.id, peers: this.connections.size });
  }

  /**
   * Send a message to a specific peer
   */
  async sendToPeer(peerId: string, type: PeerMessage['type'], payload: any): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`Not connected to peer ${peerId}`);
    }

    const message: PeerMessage = {
      id: this.generateMessageId(),
      type,
      from: this.id,
      to: peerId,
      payload,
      timestamp: Date.now(),
      ttl: 1,
    };

    await connection.send(message);
    this.emit('message:sent', { messageId: message.id, to: peerId });
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.knownPeers.values()).filter(peer =>
      this.connections.has(peer.id)
    );
  }

  /**
   * Get all known peers
   */
  getKnownPeers(): PeerInfo[] {
    return Array.from(this.knownPeers.values());
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.connections.size;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: PeerMessage): void {
    // Check if already processed
    if (this.messageCache.has(message.id)) {
      return;
    }

    // Add to cache
    this.messageCache.set(message.id, message.timestamp);

    // Emit message event
    this.emit('message:received', message);

    // Handle specific message types
    switch (message.type) {
      case 'ping':
        this.handlePing(message);
        break;
      case 'discover':
        this.handleDiscover(message);
        break;
      case 'transaction':
        this.emit('transaction:received', message.payload);
        break;
      case 'block':
        this.emit('block:received', message.payload);
        break;
      case 'sync':
        this.emit('sync:request', message);
        break;
    }

    // Rebroadcast if TTL > 0 and not directed to specific peer
    if (message.ttl > 0 && !message.to) {
      this.rebroadcast(message);
    }
  }

  /**
   * Rebroadcast a message
   */
  private async rebroadcast(message: PeerMessage): Promise<void> {
    const rebroadcastMessage = {
      ...message,
      ttl: message.ttl - 1,
    };

    const promises = Array.from(this.connections.values())
      .filter(conn => conn.peerId !== message.from)
      .map(conn => conn.send(rebroadcastMessage).catch(() => {}));

    await Promise.all(promises);
  }

  /**
   * Handle ping message
   */
  private handlePing(message: PeerMessage): void {
    // Send pong back
    this.sendToPeer(message.from, 'ping', { pong: true }).catch(() => {});
  }

  /**
   * Handle discover message
   */
  private handleDiscover(message: PeerMessage): void {
    const peers = this.getKnownPeers().map(p => ({
      id: p.id,
      address: p.address,
      port: p.port,
    }));

    this.sendToPeer(message.from, 'discover', { peers }).catch(() => {});
  }

  /**
   * Discover new peers
   */
  private async discoverPeers(): Promise<void> {
    if (this.connections.size === 0) {
      return;
    }

    // Ask random peer for more peers
    const connectedPeers = Array.from(this.connections.keys());
    const randomPeer = connectedPeers[Math.floor(Math.random() * connectedPeers.length)];

    await this.sendToPeer(randomPeer, 'discover', {}).catch(() => {});
  }

  /**
   * Cleanup old messages from cache
   */
  private cleanupMessageCache(): void {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [messageId, timestamp] of this.messageCache.entries()) {
      if (now - timestamp > maxAge) {
        this.messageCache.delete(messageId);
      }
    }
  }

  /**
   * Generate peer ID from public key
   */
  private generatePeerId(publicKey: string): string {
    // Simple hash of public key for peer ID
    return publicKey.slice(0, 16);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const bytes = randomBytes(16);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const bytes = randomBytes(16);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

/**
 * Peer Connection
 * Manages connection to a single peer
 */
class PeerConnection extends EventEmitter {
  public readonly peerId: string;
  private peerInfo: PeerInfo;
  private isConnected: boolean;

  constructor(peerInfo: PeerInfo) {
    super();
    this.peerId = peerInfo.id;
    this.peerInfo = peerInfo;
    this.isConnected = false;
  }

  async connect(): Promise<void> {
    // Simulate connection (in production, use WebSocket/libp2p)
    this.isConnected = true;
    this.emit('connected');
  }

  async close(): Promise<void> {
    this.isConnected = false;
    this.emit('close');
  }

  async send(message: PeerMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    // Simulate sending (in production, use actual network transport)
    this.emit('sent', message);
  }

  isActive(): boolean {
    return this.isConnected;
  }
}

export default MeshPeer;
