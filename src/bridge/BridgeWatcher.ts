/**
 * Bridge Watcher Service
 * Monitors bridge events and triggers relay operations
 */

import { EventEmitter } from '../utils/EventEmitter';
import BridgeService, { BridgeNetwork, BridgeTransfer } from './BridgeService';
import zkProofService from '../privacy/zkProofService';

export interface WatcherConfig {
  pollInterval: number; // milliseconds
  autoRelay: boolean;
  networks: BridgeNetwork[];
}

export class BridgeWatcher extends EventEmitter {
  private bridgeService: BridgeService;
  private config: WatcherConfig;
  private isRunning: boolean;
  private pollTimer?: NodeJS.Timeout;

  constructor(bridgeService: BridgeService, config: WatcherConfig) {
    super();
    this.bridgeService = bridgeService;
    this.config = config;
    this.isRunning = false;
  }

  /**
   * Start watching for bridge events
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.bridgeService.startWatching();

    // Listen to bridge events
    this.setupEventListeners();

    // Start polling for pending transfers
    this.pollTimer = setInterval(() => {
      this.checkPendingTransfers();
    }, this.config.pollInterval);

    this.emit('watcher:started');
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.bridgeService.stopWatching();

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.removeAllListeners();
    this.emit('watcher:stopped');
  }

  /**
   * Manually relay a transfer
   */
  async relayTransfer(transferId: string): Promise<void> {
    const transfer = this.bridgeService.getTransfer(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (transfer.status !== 'confirmed') {
      throw new Error(`Transfer ${transferId} is not ready for relay`);
    }

    this.emit('relay:started', transfer);

    try {
      // Generate ZK proof for private transfers
      const proof = await this.generateTransferProof(transfer);

      // Complete transfer on target chain
      // Note: In production, this would be signed by a relayer
      this.emit('relay:proof-generated', { transferId, proof });

      this.emit('relay:completed', transfer);
    } catch (error) {
      this.emit('relay:failed', { transferId, error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    this.bridgeService.on('tokens:locked', (transfer: BridgeTransfer) => {
      this.emit('event:tokens-locked', transfer);

      if (this.config.autoRelay && this.shouldRelay(transfer)) {
        this.relayTransfer(transfer.id).catch(error => {
          console.error(`Auto-relay failed for ${transfer.id}:`, error);
        });
      }
    });

    this.bridgeService.on('tokens:unlocked', (transfer: BridgeTransfer) => {
      this.emit('event:tokens-unlocked', transfer);
    });

    this.bridgeService.on('transfer:confirmed', (transfer: BridgeTransfer) => {
      this.emit('event:transfer-confirmed', transfer);
    });

    this.bridgeService.on('transfer:completed', (transfer: BridgeTransfer) => {
      this.emit('event:transfer-completed', transfer);
    });
  }

  private async checkPendingTransfers(): Promise<void> {
    if (!this.config.autoRelay) {
      return;
    }

    for (const network of this.config.networks) {
      const pending = this.bridgeService.getPendingTransfers(network);

      for (const transfer of pending) {
        if (this.shouldRelay(transfer)) {
          try {
            await this.relayTransfer(transfer.id);
          } catch (error) {
            console.error(`Failed to relay ${transfer.id}:`, error);
          }
        }
      }
    }
  }

  private shouldRelay(transfer: BridgeTransfer): boolean {
    // Check if transfer is ready for relay
    if (transfer.status !== 'confirmed') {
      return false;
    }

    // Check if target network is in watched networks
    if (!this.config.networks.includes(transfer.targetNetwork)) {
      return false;
    }

    // Add custom relay logic here (e.g., minimum amount, fee checks)
    return true;
  }

  private async generateTransferProof(transfer: BridgeTransfer): Promise<any> {
    // Generate ZK proof for confidential transfer
    const inputBlinding = zkProofService.generateBlinding();
    const outputBlinding = zkProofService.generateBlinding();

    // For bridge transfers, we prove the amount is valid
    // In production, this would include more complex proofs
    const { proof, publicSignals } = await zkProofService.generateConfidentialTransferProof(
      transfer.amount,
      transfer.amount, // Output equals input for bridge
      0n, // No fee for bridge
      inputBlinding,
      outputBlinding
    );

    return {
      proof: zkProofService.exportProofForSolidity(proof),
      publicSignals,
    };
  }
}

export default BridgeWatcher;
