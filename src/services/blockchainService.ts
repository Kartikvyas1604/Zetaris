import axios from 'axios';
import { ethers } from 'ethers';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as logger from '../utils/logger';

// Multi-chain blockchain service for real balance fetching and transactions
export interface ChainBalance {
  chain: string;
  address: string;
  balance: string;
  balanceUSD: number;
  symbol: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  chain: string;
}

export class BlockchainService {
  private static instance: BlockchainService;
  
  // RPC endpoints
  private readonly ETHEREUM_RPC = 'https://eth.llamarpc.com';
  private readonly POLYGON_RPC = 'https://polygon-rpc.com';
  private readonly SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
  private readonly ZCASH_API = 'https://api.zcha.in/v2/mainnet';
  private readonly BITCOIN_API = 'https://blockstream.info/api';
  
  // Price API
  private readonly PRICE_API = 'https://api.coingecko.com/api/v3/simple/price';
  
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly PRICE_CACHE_DURATION = 60000; // 1 minute

  private constructor() {}

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  /**
   * Fetch real balance for Ethereum address
   */
  public async getEthereumBalance(address: string): Promise<ChainBalance> {
    try {
      if (!address || address === 'null' || address === 'undefined') {
        return this.getEmptyBalance('Ethereum', 'ETH');
      }

      const provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC);
      const balance = await provider.getBalance(address);
      const ethBalance = ethers.formatEther(balance);
      const priceUSD = await this.getPrice('ethereum');

      return {
        chain: 'Ethereum',
        address,
        balance: parseFloat(ethBalance).toFixed(6),
        balanceUSD: parseFloat(ethBalance) * priceUSD,
        symbol: 'ETH',
      };
    } catch (error) {
      logger.error('Error fetching Ethereum balance:', error);
      return this.getEmptyBalance('Ethereum', 'ETH', address);
    }
  }

  /**
   * Fetch real balance for Polygon address
   */
  public async getPolygonBalance(address: string): Promise<ChainBalance> {
    try {
      if (!address || address === 'null' || address === 'undefined') {
        return this.getEmptyBalance('Polygon', 'MATIC');
      }

      const provider = new ethers.JsonRpcProvider(this.POLYGON_RPC);
      const balance = await provider.getBalance(address);
      const maticBalance = ethers.formatEther(balance);
      const priceUSD = await this.getPrice('matic-network');

      return {
        chain: 'Polygon',
        address,
        balance: parseFloat(maticBalance).toFixed(6),
        balanceUSD: parseFloat(maticBalance) * priceUSD,
        symbol: 'MATIC',
      };
    } catch (error) {
      logger.error('Error fetching Polygon balance:', error);
      return this.getEmptyBalance('Polygon', 'MATIC', address);
    }
  }
        balance: '0.000000',
        balanceUSD: 0,
        symbol: 'MATIC',
      };
    }
  }

  /**
   * Fetch real balance for Solana address
   */
  public async getSolanaBalance(address: string): Promise<ChainBalance> {
    try {
      if (!address || address === 'null' || address === 'undefined') {
        return this.getEmptyBalance('Solana', 'SOL');
      }

      const connection = new Connection(this.SOLANA_RPC, 'confirmed');
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;
      const priceUSD = await this.getPrice('solana');

      return {
        chain: 'Solana',
        address,
        balance: solBalance.toFixed(6),
        balanceUSD: solBalance * priceUSD,
        symbol: 'SOL',
      };
    } catch (error) {
      logger.error('Error fetching Solana balance:', error);
      return this.getEmptyBalance('Solana', 'SOL', address);
    }
  }

  /**
   * Fetch real balance for Zcash address (shielded/transparent)
   */
  public async getZcashBalance(address: string): Promise<ChainBalance> {
    try {
      if (!address || address === 'null' || address === 'undefined') {
        return this.getEmptyBalance('Zcash', 'ZEC');
      }

      // Check if shielded or transparent address
      const isShielded = address.startsWith('z');
      
      if (isShielded) {
        // For shielded addresses, we need a light client
        logger.info('Zcash shielded balance requires light client sync');
        return this.getEmptyBalance('Zcash', 'ZEC', address);
      } else {
        // Transparent address - query blockchain API
        const response = await axios.get(`${this.ZCASH_API}/accounts/${address}`);
        const balance = response.data.balance || 0;
        const zecBalance = balance / 100000000; // Convert zatoshis to ZEC
        const priceUSD = await this.getPrice('zcash');

        return {
          chain: 'Zcash',
          address,
          balance: zecBalance.toFixed(6),
          balanceUSD: zecBalance * priceUSD,
          symbol: 'ZEC',
        };
      }
    } catch (error) {
      logger.error('Error fetching Zcash balance:', error);
      return this.getEmptyBalance('Zcash', 'ZEC', address);
    }
  }

  /**
   * Fetch real balance for Bitcoin address
   */
  public async getBitcoinBalance(address: string): Promise<ChainBalance> {
    try {
      if (!address || address === 'null' || address === 'undefined') {
        return this.getEmptyBalance('Bitcoin', 'BTC');
      }

      const response = await axios.get(`${this.BITCOIN_API}/address/${address}`);
      const satoshis = response.data.chain_stats.funded_txo_sum - response.data.chain_stats.spent_txo_sum;
      const btcBalance = satoshis / 100000000; // Convert satoshis to BTC
      const priceUSD = await this.getPrice('bitcoin');

      return {
        chain: 'Bitcoin',
        address,
        balance: btcBalance.toFixed(8),
        balanceUSD: btcBalance * priceUSD,
        symbol: 'BTC',
      };
    } catch (error) {
      logger.error('Error fetching Bitcoin balance:', error);
      return this.getEmptyBalance('Bitcoin', 'BTC', address);
    }
  }

  /**
   * Helper method to return empty balance
   */
  private getEmptyBalance(chain: string, symbol: string, address: string = ''): ChainBalance {
    return {
      chain,
      address,
      balance: '0.000000',
      balanceUSD: 0,
      symbol,
    };
  }
        balanceUSD: btcBalance * priceUSD,
        symbol: 'BTC',
      };
    } catch (error) {
      logger.error('Error fetching Bitcoin balance:', error);
      return {
        chain: 'Bitcoin',
        address,
        balance: '0.00000000',
        balanceUSD: 0,
        symbol: 'BTC',
      };
    }
  }

  /**
   * Fetch all balances for a wallet
   */
  public async getAllBalances(walletAddresses: {
    ethereum: string;
    polygon: string;
    solana: string;
    zcash: string;
    bitcoin: string;
  }): Promise<ChainBalance[]> {
    try {
      const balances = await Promise.all([
        this.getEthereumBalance(walletAddresses.ethereum),
        this.getPolygonBalance(walletAddresses.polygon),
        this.getSolanaBalance(walletAddresses.solana),
        this.getZcashBalance(walletAddresses.zcash),
        this.getBitcoinBalance(walletAddresses.bitcoin),
      ]);

      // Cache balances
      await this.cacheBalances(balances);

      return balances;
    } catch (error) {
      logger.error('Error fetching all balances:', error);
      // Return cached balances if available
      return await this.getCachedBalances() || [];
    }
  }

  /**
   * Get cryptocurrency price in USD
   */
  private async getPrice(coinId: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.priceCache.get(coinId);
      if (cached && Date.now() - cached.timestamp < this.PRICE_CACHE_DURATION) {
        return cached.price;
      }

      // Fetch from API
      const response = await axios.get(this.PRICE_API, {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
        },
      });

      const price = response.data[coinId]?.usd || 0;
      
      // Cache the price
      this.priceCache.set(coinId, { price, timestamp: Date.now() });

      return price;
    } catch (error) {
      logger.error(`Error fetching price for ${coinId}:`, error);
      return 0;
    }
  }

  /**
   * Fetch transaction history for Ethereum address
   */
  public async getEthereumTransactions(address: string): Promise<Transaction[]> {
    try {
      const provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC);
      const currentBlock = await provider.getBlockNumber();
      const transactions: Transaction[] = [];

      // Get last 10 blocks of transactions (simplified)
      for (let i = 0; i < 10; i++) {
        const blockNumber = currentBlock - i;
        const block = await provider.getBlock(blockNumber, true);
        
        if (block && block.transactions) {
          for (const txData of block.transactions) {
            if (typeof txData !== 'string') {
              const tx = txData as any; // Type assertion for transaction object
              if (tx.from?.toLowerCase() === address.toLowerCase() || 
                  tx.to?.toLowerCase() === address.toLowerCase()) {
                transactions.push({
                  hash: tx.hash || '',
                  from: tx.from || '',
                  to: tx.to || '',
                  amount: ethers.formatEther(tx.value || 0),
                  timestamp: block.timestamp * 1000,
                  status: 'confirmed',
                  chain: 'Ethereum',
                });
              }
            }
          }
        }
      }

      return transactions;
    } catch (error) {
      logger.error('Error fetching Ethereum transactions:', error);
      return [];
    }
  }

  /**
   * Fetch transaction history for Solana address
   */
  public async getSolanaTransactions(address: string): Promise<Transaction[]> {
    try {
      const connection = new Connection(this.SOLANA_RPC, 'confirmed');
      const publicKey = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 10 });
      
      const transactions: Transaction[] = [];

      for (const sig of signatures) {
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (tx && tx.meta) {
          transactions.push({
            hash: sig.signature,
            from: address,
            to: '', // Solana transactions can have multiple recipients
            amount: (Math.abs(tx.meta.postBalances[0] - tx.meta.preBalances[0]) / LAMPORTS_PER_SOL).toFixed(6),
            timestamp: (tx.blockTime || 0) * 1000,
            status: tx.meta.err ? 'failed' : 'confirmed',
            chain: 'Solana',
          });
        }
      }

      return transactions;
    } catch (error) {
      logger.error('Error fetching Solana transactions:', error);
      return [];
    }
  }

  /**
   * Send Ethereum transaction
   */
  public async sendEthereumTransaction(
    privateKey: string,
    to: string,
    amount: string
  ): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tx = await wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });

      logger.info('Ethereum transaction sent:', tx.hash);
      return tx.hash;
    } catch (error) {
      logger.error('Error sending Ethereum transaction:', error);
      throw error;
    }
  }

  /**
   * Send Polygon transaction
   */
  public async sendPolygonTransaction(
    privateKey: string,
    to: string,
    amount: string
  ): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(this.POLYGON_RPC);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tx = await wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });

      logger.info('Polygon transaction sent:', tx.hash);
      return tx.hash;
    } catch (error) {
      logger.error('Error sending Polygon transaction:', error);
      throw error;
    }
  }

  /**
   * Cache balances to AsyncStorage
   */
  private async cacheBalances(balances: ChainBalance[]): Promise<void> {
    try {
      await AsyncStorage.setItem('cached_balances', JSON.stringify(balances));
      await AsyncStorage.setItem('balances_timestamp', Date.now().toString());
    } catch (error) {
      logger.error('Error caching balances:', error);
    }
  }

  /**
   * Get cached balances from AsyncStorage
   */
  private async getCachedBalances(): Promise<ChainBalance[] | null> {
    try {
      const cached = await AsyncStorage.getItem('cached_balances');
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Error getting cached balances:', error);
      return null;
    }
  }

  /**
   * Estimate gas for Ethereum transaction
   */
  public async estimateEthereumGas(_to: string, _amount: string): Promise<string> {
    try {
      const provider = new ethers.JsonRpcProvider(this.ETHEREUM_RPC);
      const gasPrice = await provider.getFeeData();
      
      // Estimate: 21000 gas for simple transfer
      const gasLimit = 21000n;
      const totalGas = gasLimit * (gasPrice.gasPrice || 0n);
      
      return ethers.formatEther(totalGas);
    } catch (error) {
      logger.error('Error estimating Ethereum gas:', error);
      return '0.001'; // Default estimate
    }
  }

  /**
   * Get total portfolio value in USD
   */
  public async getTotalPortfolioValue(balances: ChainBalance[]): Promise<number> {
    return balances.reduce((total, balance) => total + balance.balanceUSD, 0);
  }
}

export default BlockchainService.getInstance();
