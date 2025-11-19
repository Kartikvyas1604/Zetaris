import { ethers } from 'ethers';
import axios from 'axios';

// Chainlink Price Feed Addresses (Ethereum Mainnet)
const PRICE_FEEDS = {
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'MATIC/USD': '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676',
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
};

const PRICE_FEED_ABI = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];

export interface PriceData {
  price: number;
  timestamp: number;
  change24h: number;
  changePercent24h: number;
}

export class ChainlinkService {
  private provider: ethers.JsonRpcProvider;
  private priceCache: Map<string, { price: PriceData; expiry: number }>;
  private cacheDuration = 60000; // 1 minute

  constructor(rpcUrl: string = 'https://eth.llamarpc.com') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.priceCache = new Map();
  }

  /**
   * Get real-time price from Chainlink oracle
   */
  async getPrice(pair: string): Promise<number> {
    const feedAddress = PRICE_FEEDS[pair as keyof typeof PRICE_FEEDS];
    if (!feedAddress) {
      throw new Error(`Price feed not found for ${pair}`);
    }

    try {
      const priceFeed = new ethers.Contract(
        feedAddress,
        PRICE_FEED_ABI,
        this.provider
      );

      const [, answer, , updatedAt] = await priceFeed.latestRoundData();
      const decimals = await priceFeed.decimals();

      const price = Number(answer) / Math.pow(10, Number(decimals));
      
      console.log(`Chainlink ${pair}: $${price.toFixed(2)} (updated: ${new Date(Number(updatedAt) * 1000).toLocaleString()})`);
      
      return price;
    } catch (error) {
      console.error(`Failed to fetch Chainlink price for ${pair}:`, error);
      // Fallback to CoinGecko
      return this.getFallbackPrice(pair);
    }
  }

  /**
   * Get comprehensive price data with 24h change
   */
  async getPriceData(symbol: string): Promise<PriceData> {
    // Check cache
    const cached = this.priceCache.get(symbol);
    if (cached && cached.expiry > Date.now()) {
      return cached.price;
    }

    try {
      // Get current price from Chainlink
      let currentPrice: number;
      
      if (symbol === 'ETH') {
        currentPrice = await this.getPrice('ETH/USD');
      } else if (symbol === 'MATIC') {
        currentPrice = await this.getPrice('MATIC/USD');
      } else if (symbol === 'BTC') {
        currentPrice = await this.getPrice('BTC/USD');
      } else {
        // For other coins, use fallback
        currentPrice = await this.getFallbackPrice(symbol);
      }

      // Get 24h change from CoinGecko API
      const coinGeckoIds: { [key: string]: string } = {
        'ETH': 'ethereum',
        'MATIC': 'matic-network',
        'BTC': 'bitcoin',
        'ZEC': 'zcash',
        'SOL': 'solana',
      };

      const coinId = coinGeckoIds[symbol] || symbol.toLowerCase();
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`,
        { timeout: 5000 }
      );

      const data = response.data[coinId];
      const change24h = data?.usd_24h_change || 0;

      const priceData: PriceData = {
        price: currentPrice,
        timestamp: Date.now(),
        change24h: (currentPrice * change24h) / 100,
        changePercent24h: change24h,
      };

      // Cache the result
      this.priceCache.set(symbol, {
        price: priceData,
        expiry: Date.now() + this.cacheDuration,
      });

      return priceData;
    } catch (error) {
      console.error(`Failed to fetch price data for ${symbol}:`, error);
      
      // Return cached data if available, even if expired
      if (cached) {
        return cached.price;
      }

      // Last resort: return default
      return {
        price: 0,
        timestamp: Date.now(),
        change24h: 0,
        changePercent24h: 0,
      };
    }
  }

  private async getFallbackPrice(pairOrSymbol: string): Promise<number> {
    try {
      const symbol = pairOrSymbol.split('/')[0].toLowerCase();
      
      const coinGeckoIds: { [key: string]: string } = {
        'eth': 'ethereum',
        'matic': 'matic-network',
        'btc': 'bitcoin',
        'zec': 'zcash',
        'sol': 'solana',
      };

      const coinId = coinGeckoIds[symbol] || symbol;
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
        { timeout: 5000 }
      );

      return response.data[coinId]?.usd || 0;
    } catch (error) {
      console.error('Fallback price fetch failed:', error);
      return 0;
    }
  }

  /**
   * Calculate USD value
   */
  async calculateUSDValue(amount: number, symbol: string): Promise<number> {
    const priceData = await this.getPriceData(symbol);
    return amount * priceData.price;
  }

  /**
   * Batch fetch prices for multiple symbols
   */
  async getBatchPrices(symbols: string[]): Promise<Map<string, PriceData>> {
    const prices = new Map<string, PriceData>();
    
    await Promise.all(
      symbols.map(async (symbol) => {
        const priceData = await this.getPriceData(symbol);
        prices.set(symbol, priceData);
      })
    );

    return prices;
  }
}

// Export singleton instance
export default new ChainlinkService();
