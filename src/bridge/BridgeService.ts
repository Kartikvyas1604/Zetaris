/**
 * Cross-Chain Bridge Service
 * Manages asset transfers between different blockchain networks
 */

import { ethers } from 'ethers';
import { EventEmitter } from '../utils/EventEmitter';

export enum BridgeNetwork {
  ETHEREUM = 'ethereum',
  POLYGON = 'polygon',
  ARBITRUM = 'arbitrum',
  OPTIMISM = 'optimism',
  BASE = 'base',
}

export interface BridgeConfig {
  network: BridgeNetwork;
  rpcUrl: string;
  bridgeContractAddress: string;
  confirmations: number;
}

export interface BridgeTransfer {
  id: string;
  sourceNetwork: BridgeNetwork;
  targetNetwork: BridgeNetwork;
  sender: string;
  recipient: string;
  amount: bigint;
  token: string;
  proof?: any;
  status: 'pending' | 'confirmed' | 'relayed' | 'completed' | 'failed';
  txHash?: string;
  timestamp: number;
}

export class BridgeService extends EventEmitter {
  private providers: Map<BridgeNetwork, ethers.JsonRpcProvider>;
  private bridgeContracts: Map<BridgeNetwork, ethers.Contract>;
  private configs: Map<BridgeNetwork, BridgeConfig>;
  private transfers: Map<string, BridgeTransfer>;
  private isWatching: boolean;

  constructor() {
    super();
    this.providers = new Map();
    this.bridgeContracts = new Map();
    this.configs = new Map();
    this.transfers = new Map();
    this.isWatching = false;
  }

  /**
   * Add a network configuration
   */
  addNetwork(config: BridgeConfig): void {
    this.configs.set(config.network, config);
    
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.providers.set(config.network, provider);

    // Initialize bridge contract
    const bridgeContract = new ethers.Contract(
      config.bridgeContractAddress,
      BRIDGE_ABI,
      provider
    );
    this.bridgeContracts.set(config.network, bridgeContract);
  }

  /**
   * Initiate a cross-chain transfer
   */
  async initiateTransfer(
    sourceNetwork: BridgeNetwork,
    targetNetwork: BridgeNetwork,
    recipient: string,
    amount: bigint,
    token: string,
    signer: ethers.Signer
  ): Promise<string> {
    const bridgeContract = this.bridgeContracts.get(sourceNetwork);
    if (!bridgeContract) {
      throw new Error(`Bridge contract not found for ${sourceNetwork}`);
    }

    // Create transfer ID
    const transferId = this.generateTransferId(
      sourceNetwork,
      targetNetwork,
      recipient,
      amount
    );

    // Lock tokens on source chain
    const tx = await (bridgeContract.connect(signer) as any).lockTokens(
      token,
      amount,
      targetNetwork,
      recipient,
      { value: amount } // For native token transfers
    );

    const transfer: BridgeTransfer = {
      id: transferId,
      sourceNetwork,
      targetNetwork,
      sender: await signer.getAddress(),
      recipient,
      amount,
      token,
      status: 'pending',
      txHash: tx.hash,
      timestamp: Date.now(),
    };

    this.transfers.set(transferId, transfer);
    this.emit('transfer:initiated', transfer);

    // Wait for confirmations
    const receipt = await tx.wait(this.configs.get(sourceNetwork)?.confirmations);
    
    if (receipt?.status === 1) {
      transfer.status = 'confirmed';
      this.emit('transfer:confirmed', transfer);
    } else {
      transfer.status = 'failed';
      this.emit('transfer:failed', transfer);
    }

    return transferId;
  }

  /**
   * Complete a transfer on the target chain
   */
  async completeTransfer(
    transferId: string,
    proof: any,
    signer: ethers.Signer
  ): Promise<void> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (transfer.status !== 'confirmed') {
      throw new Error(`Transfer ${transferId} not ready for completion`);
    }

    const bridgeContract = this.bridgeContracts.get(transfer.targetNetwork);
    if (!bridgeContract) {
      throw new Error(`Bridge contract not found for ${transfer.targetNetwork}`);
    }

    // Unlock tokens on target chain
    const tx = await (bridgeContract.connect(signer) as any).unlockTokens(
      transferId,
      transfer.token,
      transfer.amount,
      transfer.recipient,
      proof
    );

    transfer.status = 'relayed';
    this.emit('transfer:relayed', transfer);

    await tx.wait();
    
    transfer.status = 'completed';
    this.emit('transfer:completed', transfer);
  }

  /**
   * Start watching for bridge events
   */
  startWatching(): void {
    if (this.isWatching) return;

    this.isWatching = true;

    for (const [network, contract] of this.bridgeContracts) {
      // Watch for token locks
      contract.on('TokensLocked', (
        transferId: string,
        sender: string,
        token: string,
        amount: bigint,
        targetNetwork: string,
        recipient: string
      ) => {
        this.handleTokensLocked(
          network,
          transferId,
          sender,
          token,
          amount,
          targetNetwork as BridgeNetwork,
          recipient
        );
      });

      // Watch for token unlocks
      contract.on('TokensUnlocked', (
        transferId: string,
        recipient: string,
        token: string,
        amount: bigint
      ) => {
        this.handleTokensUnlocked(network, transferId, recipient, token, amount);
      });
    }
  }

  /**
   * Stop watching for bridge events
   */
  stopWatching(): void {
    if (!this.isWatching) return;

    for (const contract of this.bridgeContracts.values()) {
      contract.removeAllListeners();
    }

    this.isWatching = false;
  }

  /**
   * Get transfer status
   */
  getTransfer(transferId: string): BridgeTransfer | undefined {
    return this.transfers.get(transferId);
  }

  /**
   * Get all transfers
   */
  getAllTransfers(): BridgeTransfer[] {
    return Array.from(this.transfers.values());
  }

  /**
   * Get pending transfers for a network
   */
  getPendingTransfers(network: BridgeNetwork): BridgeTransfer[] {
    return Array.from(this.transfers.values()).filter(
      t => t.targetNetwork === network && t.status === 'confirmed'
    );
  }

  private handleTokensLocked(
    sourceNetwork: BridgeNetwork,
    transferId: string,
    sender: string,
    token: string,
    amount: bigint,
    targetNetwork: BridgeNetwork,
    recipient: string
  ): void {
    const transfer: BridgeTransfer = {
      id: transferId,
      sourceNetwork,
      targetNetwork,
      sender,
      recipient,
      amount,
      token,
      status: 'confirmed',
      timestamp: Date.now(),
    };

    this.transfers.set(transferId, transfer);
    this.emit('tokens:locked', transfer);
  }

  private handleTokensUnlocked(
    network: BridgeNetwork,
    transferId: string,
    recipient: string,
    token: string,
    amount: bigint
  ): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = 'completed';
      this.emit('tokens:unlocked', transfer);
    }
  }

  private generateTransferId(
    sourceNetwork: BridgeNetwork,
    targetNetwork: BridgeNetwork,
    recipient: string,
    amount: bigint
  ): string {
    const data = `${sourceNetwork}-${targetNetwork}-${recipient}-${amount}-${Date.now()}`;
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }
}

// Bridge contract ABI
const BRIDGE_ABI = [
  'event TokensLocked(bytes32 indexed transferId, address indexed sender, address token, uint256 amount, string targetNetwork, address recipient)',
  'event TokensUnlocked(bytes32 indexed transferId, address indexed recipient, address token, uint256 amount)',
  'function lockTokens(address token, uint256 amount, string memory targetNetwork, address recipient) external payable',
  'function unlockTokens(bytes32 transferId, address token, uint256 amount, address recipient, bytes memory proof) external',
  'function getTransferStatus(bytes32 transferId) external view returns (uint8)',
];

export default BridgeService;
