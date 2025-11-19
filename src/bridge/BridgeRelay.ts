/**
 * Bridge Relay Service
 * Handles message passing and proof forwarding between chains
 */

import { ethers } from 'ethers';
import { EventEmitter } from '../utils/EventEmitter';
import { BridgeNetwork, BridgeTransfer } from './BridgeService';

export interface RelayMessage {
  id: string;
  sourceNetwork: BridgeNetwork;
  targetNetwork: BridgeNetwork;
  messageType: 'transfer' | 'proof' | 'status';
  payload: any;
  timestamp: number;
  signature?: string;
}

export interface RelayerConfig {
  privateKey: string;
  networks: BridgeNetwork[];
  gasLimits: Map<BridgeNetwork, bigint>;
  maxRetries: number;
}

export class BridgeRelay extends EventEmitter {
  private config: RelayerConfig;
  private signers: Map<BridgeNetwork, ethers.Wallet>;
  private messageQueue: RelayMessage[];
  private processingQueue: boolean;

  constructor(config: RelayerConfig) {
    super();
    this.config = config;
    this.signers = new Map();
    this.messageQueue = [];
    this.processingQueue = false;
  }

  /**
   * Initialize relay service with providers
   */
  initialize(providers: Map<BridgeNetwork, ethers.JsonRpcProvider>): void {
    for (const [network, provider] of providers) {
      if (this.config.networks.includes(network)) {
        const signer = new ethers.Wallet(this.config.privateKey, provider);
        this.signers.set(network, signer);
      }
    }
  }

  /**
   * Queue a message for relay
   */
  async queueMessage(message: Omit<RelayMessage, 'id' | 'timestamp' | 'signature'>): Promise<string> {
    const messageId = this.generateMessageId();
    
    const fullMessage: RelayMessage = {
      ...message,
      id: messageId,
      timestamp: Date.now(),
    };

    // Sign the message
    fullMessage.signature = await this.signMessage(fullMessage);

    this.messageQueue.push(fullMessage);
    this.emit('message:queued', fullMessage);

    // Start processing if not already running
    if (!this.processingQueue) {
      this.processQueue();
    }

    return messageId;
  }

  /**
   * Process queued messages
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (!message) continue;

      try {
        await this.relayMessage(message);
        this.emit('message:relayed', message);
      } catch (error) {
        this.emit('message:failed', { message, error });
        
        // Retry logic
        if (this.shouldRetry(message)) {
          this.messageQueue.push(message);
        }
      }
    }

    this.processingQueue = false;
  }

  /**
   * Relay a single message
   */
  private async relayMessage(message: RelayMessage): Promise<void> {
    const signer = this.signers.get(message.targetNetwork);
    if (!signer) {
      throw new Error(`No signer configured for ${message.targetNetwork}`);
    }

    switch (message.messageType) {
      case 'transfer':
        await this.relayTransfer(message, signer);
        break;
      case 'proof':
        await this.relayProof(message, signer);
        break;
      case 'status':
        await this.relayStatus(message, signer);
        break;
      default:
        throw new Error(`Unknown message type: ${message.messageType}`);
    }
  }

  /**
   * Relay a transfer message
   */
  private async relayTransfer(message: RelayMessage, signer: ethers.Wallet): Promise<void> {
    const transfer: BridgeTransfer = message.payload;
    
    // Build transaction
    const gasLimit = this.config.gasLimits.get(message.targetNetwork) || 500000n;
    
    // In production, this would call the bridge contract
    this.emit('relay:transfer', {
      transferId: transfer.id,
      network: message.targetNetwork,
      gasLimit,
    });
  }

  /**
   * Relay a proof message
   */
  private async relayProof(message: RelayMessage, signer: ethers.Wallet): Promise<void> {
    const { proof, publicSignals } = message.payload;
    
    this.emit('relay:proof', {
      messageId: message.id,
      network: message.targetNetwork,
      proofSize: JSON.stringify(proof).length,
    });
  }

  /**
   * Relay a status update
   */
  private async relayStatus(message: RelayMessage, signer: ethers.Wallet): Promise<void> {
    this.emit('relay:status', {
      messageId: message.id,
      network: message.targetNetwork,
      status: message.payload,
    });
  }

  /**
   * Sign a message
   */
  private async signMessage(message: RelayMessage): Promise<string> {
    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        id: message.id,
        sourceNetwork: message.sourceNetwork,
        targetNetwork: message.targetNetwork,
        messageType: message.messageType,
        payload: message.payload,
        timestamp: message.timestamp,
      }))
    );

    const signer = this.signers.get(message.sourceNetwork);
    if (!signer) {
      throw new Error(`No signer for ${message.sourceNetwork}`);
    }

    return await signer.signMessage(ethers.getBytes(messageHash));
  }

  /**
   * Verify message signature
   */
  async verifyMessage(message: RelayMessage): Promise<boolean> {
    if (!message.signature) {
      return false;
    }

    const messageHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        id: message.id,
        sourceNetwork: message.sourceNetwork,
        targetNetwork: message.targetNetwork,
        messageType: message.messageType,
        payload: message.payload,
        timestamp: message.timestamp,
      }))
    );

    const recoveredAddress = ethers.verifyMessage(
      ethers.getBytes(messageHash),
      message.signature
    );

    const signer = this.signers.get(message.sourceNetwork);
    return signer ? recoveredAddress === signer.address : false;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.messageQueue.length,
      processing: this.processingQueue,
    };
  }

  private shouldRetry(message: RelayMessage): boolean {
    // Simple retry logic - could be enhanced with exponential backoff
    return true;
  }

  private generateMessageId(): string {
    return ethers.keccak256(
      ethers.toUtf8Bytes(`${Date.now()}-${Math.random()}`)
    );
  }
}

export default BridgeRelay;
