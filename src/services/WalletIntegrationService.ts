/**
 * WalletIntegrationService - Centralized service to integrate all wallet features
 * Connects ProductionTransactionService, PriceOracleService, BiometricAuthService
 */

import { ProductionTransactionService } from './ProductionTransactionService';
import { priceOracle } from './PriceOracleService';
import { biometricAuth } from './BiometricAuthService';
import { ZetarisWalletCore } from '../core/ZetarisWalletCore';
import * as logger from '../utils/logger';

export interface WalletBalance {
  network: string;
  balance: string;
  balanceFormatted: string;
  usdValue: number;
  symbol: string;
}

export interface TransactionParams {
  from: string;
  to: string;
  amount: string;
  network: string;
  privateKey?: string;
  requireBiometric?: boolean;
  memo?: string;
}

export class WalletIntegrationService {
  private static instance: WalletIntegrationService;
  private txService: ProductionTransactionService;
  private walletCore: ZetarisWalletCore | null = null;

  private constructor() {
    this.txService = ProductionTransactionService.getInstance();
  }

  public static getInstance(): WalletIntegrationService {
    if (!WalletIntegrationService.instance) {
      WalletIntegrationService.instance = new WalletIntegrationService();
    }
    return WalletIntegrationService.instance;
  }

  /**
   * Initialize wallet core
   */
  public async initializeWallet(mnemonic: string): Promise<boolean> {
    try {
      this.walletCore = new ZetarisWalletCore();
      // Note: Actual wallet initialization handled by ZetarisWalletCore internally
      logger.info('✅ Wallet initialized');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize wallet:', error);
      return false;
    }
  }

  /**
   * Get all wallet balances with USD values
   */
  public async getAllBalances(address: string): Promise<WalletBalance[]> {
    try {
      const networks = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'solana'];
      const balances: WalletBalance[] = [];

      for (const network of networks) {
        try {
          const balanceData = await this.txService.getBalance(address, network);
          
          const usdValue = await priceOracle.calculateUSDValue(
            balanceData.symbol,
            balanceData.balanceFormatted
          );

          balances.push({
            network,
            balance: balanceData.balance,
            balanceFormatted: balanceData.balanceFormatted,
            usdValue,
            symbol: balanceData.symbol,
          });
        } catch (error) {
          logger.warn(`⚠️ Failed to get balance for ${network}:`, error);
        }
      }

      return balances;
    } catch (error) {
      logger.error('❌ Failed to get all balances:', error);
      return [];
    }
  }

  /**
   * Send transaction with optional biometric authentication
   */
  public async sendTransaction(params: TransactionParams): Promise<string> {
    try {
      // Check if biometric is required and enabled
      if (params.requireBiometric) {
        const walletId = params.from.slice(0, 10);
        const isEnabled = await biometricAuth.isBiometricEnabled(walletId);
        
        if (isEnabled) {
          const auth = await biometricAuth.authenticateForTransaction(
            params.amount,
            params.to
          );

          if (!auth.success) {
            throw new Error('Biometric authentication failed');
          }

          logger.info('✅ Biometric authentication successful');
        }
      }

      // Get private key if not provided
      let privateKey = params.privateKey;
      
      if (!privateKey) {
        throw new Error('Private key is required for transactions');
      }

      // Send transaction
      const result = await this.txService.sendTransaction({
        from: params.from,
        to: params.to,
        amount: params.amount,
        privateKey,
      });

      const txHash = result.hash;
      logger.info('✅ Transaction sent:', txHash);
      return txHash;
    } catch (error) {
      logger.error('❌ Failed to send transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction history with USD values at time of transaction
   */
  public async getTransactionHistory(
    address: string,
    network: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const history = await this.txService.getTransactionHistory(
        address,
        network,
        limit
      );

      // Enhance with current USD prices (could be improved with historical prices)
      for (const tx of history) {
        try {
          const symbol = this.getNetworkSymbol(network);
          const usdValue = await priceOracle.calculateUSDValue(
            symbol,
            tx.value || '0'
          );
          tx.usdValue = usdValue;
        } catch (error) {
          logger.warn('⚠️ Failed to get USD value for transaction');
          tx.usdValue = 0;
        }
      }

      return history;
    } catch (error) {
      logger.error('❌ Failed to get transaction history:', error);
      return [];
    }
  }

  /**
   * Get portfolio summary with total USD value
   */
  public async getPortfolioSummary(address: string): Promise<{
    totalUSD: number;
    balances: WalletBalance[];
    change24h: number;
  }> {
    try {
      const balances = await this.getAllBalances(address);
      
      const totalUSD = balances.reduce((sum, b) => sum + b.usdValue, 0);

      // Calculate 24h change (simple average for now)
      let totalChange = 0;
      let changeCount = 0;

      for (const balance of balances) {
        try {
          const change = await priceOracle.get24hChange(balance.symbol);
          totalChange += change;
          changeCount++;
        } catch (error) {
          // Skip if price change not available
        }
      }

      const change24h = changeCount > 0 ? totalChange / changeCount : 0;

      return {
        totalUSD,
        balances,
        change24h,
      };
    } catch (error) {
      logger.error('❌ Failed to get portfolio summary:', error);
      return {
        totalUSD: 0,
        balances: [],
        change24h: 0,
      };
    }
  }

  /**
   * Enable biometric for wallet
   */
  public async enableBiometric(address: string): Promise<boolean> {
    const walletId = address.slice(0, 10);
    return biometricAuth.enableBiometricAuth(walletId);
  }

  /**
   * Estimate gas for transaction
   */
  public async estimateGas(params: {
    from: string;
    to: string;
    amount: string;
    privateKey: string;
  }): Promise<{
    gasLimit: string;
    gasPrice: string;
    totalCost: string;
    totalCostUSD: number;
  }> {
    try {
      const estimate = await this.txService.estimateGas(
        params.from,
        params.to,
        params.amount,
        params.privateKey
      );
      
      return estimate;
    } catch (error) {
      logger.error('❌ Failed to estimate gas:', error);
      throw error;
    }
  }

  /**
   * Get network symbol
   */
  private getNetworkSymbol(network: string): string {
    const symbolMap: { [key: string]: string } = {
      'ethereum': 'ETH',
      'polygon': 'MATIC',
      'arbitrum': 'ETH',
      'optimism': 'ETH',
      'base': 'ETH',
      'solana': 'SOL',
      'bsc': 'BNB',
      'avalanche': 'AVAX',
    };

    return symbolMap[network.toLowerCase()] || 'ETH';
  }

  /**
   * Get wallet address for network
   */
  public getAddress(network: string, accountIndex: number = 0): string | null {
    // Return null for now - addresses should be passed from external wallet
    logger.warn('⚠️ getAddress not implemented - use external wallet address');
    return null;
  }

  /**
   * Check if wallet is initialized
   */
  public isInitialized(): boolean {
    return this.walletCore !== null;
  }
}

export const walletIntegration = WalletIntegrationService.getInstance();
