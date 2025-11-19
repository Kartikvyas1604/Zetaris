/**
 * Offline Transaction Sync
 * Manages offline transaction queue and synchronization
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface OfflineTransaction {
  id: string;
  type: 'transfer' | 'swap' | 'bridge';
  from: string;
  to: string;
  amount: string;
  proof?: any;
  timestamp: number;
  status: 'queued' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  lastError?: string;
}

export interface SyncStatus {
  totalQueued: number;
  syncing: number;
  synced: number;
  failed: number;
  lastSyncTime?: number;
}

export class OfflineSyncManager extends EventEmitter {
  private queue: Map<string, OfflineTransaction>;
  private maxRetries: number;
  private syncInterval: number;
  private syncTimer?: NodeJS.Timeout;
  private isOnline: boolean;

  constructor(maxRetries: number = 3, syncInterval: number = 30000) {
    super();
    this.queue = new Map();
    this.maxRetries = maxRetries;
    this.syncInterval = syncInterval;
    this.isOnline = false;
  }

  /**
   * Start the sync manager
   */
  start(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(() => {
      this.syncPending();
    }, this.syncInterval);

    this.emit('started');
  }

  /**
   * Stop the sync manager
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    this.emit('stopped');
  }

  /**
   * Add transaction to offline queue
   */
  queueTransaction(tx: Omit<OfflineTransaction, 'status' | 'retryCount'>): string {
    const transaction: OfflineTransaction = {
      ...tx,
      status: 'queued',
      retryCount: 0,
    };

    this.queue.set(tx.id, transaction);
    this.emit('transaction:queued', transaction);

    // Try immediate sync if online
    if (this.isOnline) {
      this.syncTransaction(tx.id);
    }

    return tx.id;
  }

  /**
   * Get transaction from queue
   */
  getTransaction(id: string): OfflineTransaction | undefined {
    return this.queue.get(id);
  }

  /**
   * Get all queued transactions
   */
  getQueuedTransactions(): OfflineTransaction[] {
    return Array.from(this.queue.values()).filter(
      (tx) => tx.status === 'queued'
    );
  }

  /**
   * Get sync status
   */
  getSyncStatus(): SyncStatus {
    const transactions = Array.from(this.queue.values());
    
    return {
      totalQueued: transactions.filter((tx) => tx.status === 'queued').length,
      syncing: transactions.filter((tx) => tx.status === 'syncing').length,
      synced: transactions.filter((tx) => tx.status === 'synced').length,
      failed: transactions.filter((tx) => tx.status === 'failed').length,
      lastSyncTime: this.getLastSyncTime(),
    };
  }

  /**
   * Mark as online
   */
  setOnline(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (online && wasOffline) {
      this.emit('online');
      this.syncPending();
    } else if (!online) {
      this.emit('offline');
    }
  }

  /**
   * Check if online
   */
  isOnlineMode(): boolean {
    return this.isOnline;
  }

  /**
   * Sync a specific transaction
   */
  async syncTransaction(id: string): Promise<void> {
    const tx = this.queue.get(id);

    if (!tx) {
      throw new Error('Transaction not found');
    }

    if (tx.status === 'syncing' || tx.status === 'synced') {
      return;
    }

    if (tx.retryCount >= this.maxRetries) {
      tx.status = 'failed';
      tx.lastError = 'Max retries exceeded';
      this.emit('transaction:failed', tx);
      return;
    }

    tx.status = 'syncing';
    tx.retryCount++;

    try {
      // Emit for external handlers to process
      this.emit('transaction:syncing', tx);

      // Simulate sync (actual implementation would broadcast to mesh network)
      await this.broadcastTransaction(tx);

      tx.status = 'synced';
      this.emit('transaction:synced', tx);

      // Remove from queue after successful sync
      setTimeout(() => {
        this.queue.delete(id);
      }, 60000); // Keep for 1 minute for status checks
    } catch (error) {
      tx.status = 'queued';
      tx.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('transaction:error', { tx, error });
    }
  }

  /**
   * Sync all pending transactions
   */
  async syncPending(): Promise<void> {
    if (!this.isOnline) {
      return;
    }

    const queued = this.getQueuedTransactions();

    for (const tx of queued) {
      await this.syncTransaction(tx.id);
    }
  }

  /**
   * Retry failed transactions
   */
  async retryFailed(): Promise<void> {
    const failed = Array.from(this.queue.values()).filter(
      (tx) => tx.status === 'failed'
    );

    for (const tx of failed) {
      tx.status = 'queued';
      tx.retryCount = 0;
      tx.lastError = undefined;
      await this.syncTransaction(tx.id);
    }
  }

  /**
   * Clear synced transactions
   */
  clearSynced(): void {
    const synced = Array.from(this.queue.values())
      .filter((tx) => tx.status === 'synced')
      .map((tx) => tx.id);

    for (const id of synced) {
      this.queue.delete(id);
    }

    this.emit('queue:cleared', { count: synced.length });
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Clear all transactions
   */
  clearAll(): void {
    this.queue.clear();
    this.emit('queue:cleared:all');
  }

  /**
   * Broadcast transaction to network (stub for actual implementation)
   */
  private async broadcastTransaction(tx: OfflineTransaction): Promise<void> {
    // This would be implemented by the mesh network layer
    // For now, just simulate network delay
    return new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  /**
   * Get last sync time
   */
  private getLastSyncTime(): number | undefined {
    const synced = Array.from(this.queue.values())
      .filter((tx) => tx.status === 'synced')
      .sort((a, b) => b.timestamp - a.timestamp);

    return synced.length > 0 ? synced[0].timestamp : undefined;
  }
}

export default OfflineSyncManager;
