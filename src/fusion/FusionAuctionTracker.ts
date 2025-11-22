import { EventEmitter } from '../utils/EventEmitter';
import * as logger from '../utils/logger';
import { FusionPlusClient, AuctionStatus } from './FusionPlusClient';


export enum AuctionState {
  PENDING = 'pending',
  ANNOUNCED = 'announced',
  IN_AUCTION = 'in_auction',
  RESOLVER_SELECTED = 'resolver_selected',
  ESCROW_DEPOSITED = 'escrow_deposited',
  SECRET_REVEALING = 'secret_revealing',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  REFUNDING = 'refunding',
  REFUNDED = 'refunded',
}

/**
 * Auction Event Types
 */
export interface AuctionEvent {
  orderHash: string;
  state: AuctionState;
  timestamp: number;
  data?: any;
}

/**
 * Resolver Info
 */
export interface ResolverInfo {
  address: string;
  bidAmount: string;
  reputation: number;
  estimatedTime: number;
  depositTxHash?: string;
}

/**
 * Real-time Auction Tracking Service
 * 
 * Monitors 1inch Fusion+ auction lifecycle:
 * 1. Order announcement
 * 2. Resolver auction
 * 3. Resolver selection
 * 4. Escrow deposit
 * 5. Secret reveal
 * 6. Settlement
 * 7. Refund (if timeout)
 */
export class FusionAuctionTracker extends EventEmitter {
  private fusionClient: FusionPlusClient;
  private activeAuctions: Map<string, {
    state: AuctionState;
    resolver?: ResolverInfo;
    startTime: number;
    timeoutMs: number;
    pollInterval?: NodeJS.Timeout;
  }> = new Map();

  constructor(fusionClient?: FusionPlusClient) {
    super();
    this.fusionClient = fusionClient || new FusionPlusClient();
    logger.info('🎯 Fusion Auction Tracker initialized');
  }

  /**
   * Start tracking an order through the auction process
   */
  async trackOrder(orderHash: string, timeoutMinutes: number = 30): Promise<void> {
    try {
      logger.info('👁️ Starting auction tracking:', { orderHash, timeoutMinutes });

      const timeoutMs = timeoutMinutes * 60 * 1000;
      
      this.activeAuctions.set(orderHash, {
        state: AuctionState.PENDING,
        startTime: Date.now(),
        timeoutMs,
      });

      // Emit initial event
      this.emitAuctionEvent(orderHash, AuctionState.ANNOUNCED);

      // Start polling for status updates
      await this.startPolling(orderHash);

    } catch (error) {
      logger.error('❌ Failed to start tracking:', error);
      throw error;
    }
  }

  /**
   * Poll for auction status updates
   */
  private async startPolling(orderHash: string): Promise<void> {
    const auction = this.activeAuctions.get(orderHash);
    if (!auction) return;

    const pollInterval = setInterval(async () => {
      try {
        await this.checkAuctionStatus(orderHash);
        
        // Stop polling if auction is complete or expired
        const currentAuction = this.activeAuctions.get(orderHash);
        if (!currentAuction) {
          clearInterval(pollInterval);
          return;
        }

        if ([
          AuctionState.COMPLETED,
          AuctionState.FAILED,
          AuctionState.EXPIRED,
          AuctionState.REFUNDED
        ].includes(currentAuction.state)) {
          clearInterval(pollInterval);
          this.activeAuctions.delete(orderHash);
          logger.info('✅ Auction tracking completed:', orderHash);
        }

        // Check timeout
        const elapsed = Date.now() - currentAuction.startTime;
        if (elapsed > currentAuction.timeoutMs) {
          logger.warn('⏰ Auction timeout reached:', orderHash);
          this.handleTimeout(orderHash);
          clearInterval(pollInterval);
        }

      } catch (error) {
        logger.error('❌ Polling error:', error);
      }
    }, 5000); // Poll every 5 seconds

    auction.pollInterval = pollInterval;
  }

  /**
   * Check current auction status
   */
  private async checkAuctionStatus(orderHash: string): Promise<void> {
    try {
      const status: AuctionStatus = await this.fusionClient.getOrderStatus(orderHash);
      const auction = this.activeAuctions.get(orderHash);
      
      if (!auction) return;

      // Map API status to our internal state
      let newState: AuctionState;
      
      switch (status.status) {
        case 'pending':
          newState = AuctionState.ANNOUNCED;
          break;
        case 'in_auction':
          newState = AuctionState.IN_AUCTION;
          break;
        case 'resolver_selected':
          newState = AuctionState.RESOLVER_SELECTED;
          // Extract resolver info
          if (status.resolver) {
            auction.resolver = {
              address: status.resolver,
              bidAmount: '0', // Would come from auction data
              reputation: 0,
              estimatedTime: 300, // 5 minutes estimate
            };
          }
          break;
        case 'executing':
          // Check if escrow is deposited
          if (status.fills && status.fills.length > 0) {
            newState = AuctionState.ESCROW_DEPOSITED;
          } else {
            newState = AuctionState.EXECUTING;
          }
          break;
        case 'completed':
          newState = AuctionState.COMPLETED;
          break;
        case 'failed':
          newState = AuctionState.FAILED;
          break;
        case 'expired':
          newState = AuctionState.EXPIRED;
          break;
        default:
          newState = auction.state;
      }

      // Only emit event if state changed
      if (newState !== auction.state) {
        auction.state = newState;
        this.emitAuctionEvent(orderHash, newState, {
          status,
          resolver: auction.resolver,
        });
      }

    } catch (error) {
      logger.error('❌ Failed to check auction status:', error);
    }
  }

  /**
   * Handle auction timeout
   */
  private handleTimeout(orderHash: string): void {
    const auction = this.activeAuctions.get(orderHash);
    if (!auction) return;

    auction.state = AuctionState.EXPIRED;
    this.emitAuctionEvent(orderHash, AuctionState.EXPIRED);
    
    // Trigger refund process
    this.emit('refund_needed', { orderHash });
  }

  /**
   * Emit auction event
   */
  private emitAuctionEvent(
    orderHash: string,
    state: AuctionState,
    data?: any
  ): void {
    const event: AuctionEvent = {
      orderHash,
      state,
      timestamp: Date.now(),
      data,
    };

    logger.info(`📊 Auction event: ${state}`, { orderHash });
    this.emit('auction_update', event);
    this.emit(state, event);
  }

  /**
   * Get current auction state
   */
  getAuctionState(orderHash: string): AuctionState | null {
    return this.activeAuctions.get(orderHash)?.state || null;
  }

  /**
   * Get resolver info
   */
  getResolverInfo(orderHash: string): ResolverInfo | undefined {
    return this.activeAuctions.get(orderHash)?.resolver;
  }

  /**
   * Stop tracking an order
   */
  stopTracking(orderHash: string): void {
    const auction = this.activeAuctions.get(orderHash);
    if (auction?.pollInterval) {
      clearInterval(auction.pollInterval);
    }
    this.activeAuctions.delete(orderHash);
    logger.info('🛑 Stopped tracking:', orderHash);
  }

  /**
   * Stop all tracking
   */
  stopAll(): void {
    for (const [orderHash, auction] of this.activeAuctions.entries()) {
      if (auction.pollInterval) {
        clearInterval(auction.pollInterval);
      }
    }
    this.activeAuctions.clear();
    logger.info('🛑 Stopped all auction tracking');
  }

  /**
   * Get all active auctions
   */
  getActiveAuctions(): Map<string, AuctionState> {
    const result = new Map<string, AuctionState>();
    for (const [orderHash, auction] of this.activeAuctions.entries()) {
      result.set(orderHash, auction.state);
    }
    return result;
  }
}

export default FusionAuctionTracker;
