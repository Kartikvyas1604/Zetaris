import axios from 'axios';
import * as logger from '../utils/logger';

interface TokenPrice {
  tokenAddress: string;
  symbol: string;
  usd: number;
  usd_24h_change: number;
  last_updated_at: number;
}

interface PriceCache {
  [key: string]: {
    price: TokenPrice;
    timestamp: number;
  };
}

export class PriceOracleService {
  private static instance: PriceOracleService;
  private cache: PriceCache = {};
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  private readonly FALLBACK_API = 'https://api.coinpaprika.com/v1';

  // CoinGecko token ID mappings
  private readonly TOKEN_ID_MAP: { [key: string]: string } = {
    'ETH': 'ethereum',
    'WETH': 'weth',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'DAI': 'dai',
    'MATIC': 'matic-network',
    'WMATIC': 'wmatic',
    'SOL': 'solana',
    'BTC': 'bitcoin',
    'WBTC': 'wrapped-bitcoin',
    'BNB': 'binancecoin',
    'AVAX': 'avalanche-2',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'UNI': 'uniswap',
    'LINK': 'chainlink',
    'AAVE': 'aave',
    'CRV': 'curve-dao-token',
    'SUSHI': 'sushi',
    'MKR': 'maker',
    'SNX': 'havven',
    'COMP': 'compound-governance-token',
    'YFI': 'yearn-finance',
    '1INCH': '1inch',
    'LDO': 'lido-dao',
  };

  private constructor() {}

  public static getInstance(): PriceOracleService {
    if (!PriceOracleService.instance) {
      PriceOracleService.instance = new PriceOracleService();
    }
    return PriceOracleService.instance;
  }

  public async getPrice(symbol: string): Promise<number> {
    const cacheKey = symbol.toUpperCase();
    
    // Check cache
    if (this.isCached(cacheKey)) {
      logger.info(`💰 Cache hit for ${symbol}: $${this.cache[cacheKey].price.usd}`);
      return this.cache[cacheKey].price.usd;
    }

    try {
      const price = await this.fetchPriceFromCoinGecko(symbol);
      return price;
    } catch (error) {
      logger.warn(`⚠️ CoinGecko failed for ${symbol}, trying fallback...`);
      
      try {
        const price = await this.fetchPriceFromFallback(symbol);
        return price;
      } catch (fallbackError) {
        logger.error(`❌ All price sources failed for ${symbol}`);
        return 0;
      }
    }
  }

  /**
   * Get prices for multiple tokens at once
   */
  public async getPrices(symbols: string[]): Promise<{ [symbol: string]: number }> {
    const prices: { [symbol: string]: number } = {};
    
    // Batch request to CoinGecko
    try {
      const tokenIds = symbols
        .map(s => this.TOKEN_ID_MAP[s.toUpperCase()])
        .filter(id => id !== undefined);
      
      if (tokenIds.length === 0) {
        throw new Error('No valid token IDs found');
      }

      const response = await axios.get(
        `${this.COINGECKO_API}/simple/price`,
        {
          params: {
            ids: tokenIds.join(','),
            vs_currencies: 'usd',
            include_24hr_change: true,
            include_last_updated_at: true,
          },
          timeout: 5000,
        }
      );

      symbols.forEach((symbol) => {
        const tokenId = this.TOKEN_ID_MAP[symbol.toUpperCase()];
        if (tokenId && response.data[tokenId]) {
          const usdPrice = response.data[tokenId].usd || 0;
          prices[symbol] = usdPrice;

          // Cache the result
          this.cache[symbol.toUpperCase()] = {
            price: {
              tokenAddress: '',
              symbol: symbol.toUpperCase(),
              usd: usdPrice,
              usd_24h_change: response.data[tokenId].usd_24h_change || 0,
              last_updated_at: response.data[tokenId].last_updated_at || Date.now() / 1000,
            },
            timestamp: Date.now(),
          };
        } else {
          prices[symbol] = 0;
        }
      });

      logger.info(`💰 Fetched ${Object.keys(prices).length} prices from CoinGecko`);
    } catch (error) {
      logger.error('❌ Batch price fetch failed:', error);
      
      // Fallback to individual requests
      for (const symbol of symbols) {
        prices[symbol] = await this.getPrice(symbol);
      }
    }

    return prices;
  }

  /**
   * Get token price by contract address
   */
  public async getPriceByAddress(
    network: string,
    tokenAddress: string
  ): Promise<number> {
    try {
      const platformId = this.getCoingeckoPlatformId(network);
      
      const response = await axios.get(
        `${this.COINGECKO_API}/simple/token_price/${platformId}`,
        {
          params: {
            contract_addresses: tokenAddress.toLowerCase(),
            vs_currencies: 'usd',
          },
          timeout: 5000,
        }
      );

      const price = response.data[tokenAddress.toLowerCase()]?.usd || 0;
      logger.info(`💰 Price for ${tokenAddress}: $${price}`);
      
      return price;
    } catch (error) {
      logger.error(`❌ Failed to fetch price by address:`, error);
      return 0;
    }
  }

  /**
   * Calculate USD value for a token amount
   */
  public async calculateUSDValue(
    symbol: string,
    amount: string
  ): Promise<number> {
    const price = await this.getPrice(symbol);
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount) || price === 0) {
      return 0;
    }

    return numericAmount * price;
  }

  /**
   * Get 24h price change percentage
   */
  public async get24hChange(symbol: string): Promise<number> {
    const cacheKey = symbol.toUpperCase();
    
    if (this.isCached(cacheKey)) {
      return this.cache[cacheKey].price.usd_24h_change;
    }

    await this.getPrice(symbol);
    return this.cache[cacheKey]?.price.usd_24h_change || 0;
  }

  /**
   * Fetch price from CoinGecko
   */
  private async fetchPriceFromCoinGecko(symbol: string): Promise<number> {
    const tokenId = this.TOKEN_ID_MAP[symbol.toUpperCase()];
    
    if (!tokenId) {
      throw new Error(`Unknown token: ${symbol}`);
    }

    const response = await axios.get(
      `${this.COINGECKO_API}/simple/price`,
      {
        params: {
          ids: tokenId,
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_last_updated_at: true,
        },
        timeout: 5000,
      }
    );

    const data = response.data[tokenId];
    
    if (!data || !data.usd) {
      throw new Error(`No price data for ${symbol}`);
    }

    const price: TokenPrice = {
      tokenAddress: '',
      symbol: symbol.toUpperCase(),
      usd: data.usd,
      usd_24h_change: data.usd_24h_change || 0,
      last_updated_at: data.last_updated_at || Date.now() / 1000,
    };

    // Cache the result
    this.cache[symbol.toUpperCase()] = {
      price,
      timestamp: Date.now(),
    };

    logger.info(`💰 CoinGecko price for ${symbol}: $${price.usd}`);
    return price.usd;
  }

  /**
   * Fetch price from fallback source (CoinPaprika)
   */
  private async fetchPriceFromFallback(symbol: string): Promise<number> {
    const paprikaIds: { [key: string]: string } = {
      'ETH': 'eth-ethereum',
      'BTC': 'btc-bitcoin',
      'USDC': 'usdc-usd-coin',
      'USDT': 'usdt-tether',
      'MATIC': 'matic-polygon',
      'SOL': 'sol-solana',
    };

    const paprikaId = paprikaIds[symbol.toUpperCase()];
    
    if (!paprikaId) {
      throw new Error(`Unknown token for fallback: ${symbol}`);
    }

    const response = await axios.get(
      `${this.FALLBACK_API}/tickers/${paprikaId}`,
      { timeout: 5000 }
    );

    const price = response.data.quotes?.USD?.price || 0;
    logger.info(`💰 Fallback price for ${symbol}: $${price}`);
    
    return price;
  }

  /**
   * Check if price is cached and still valid
   */
  private isCached(symbol: string): boolean {
    const cached = this.cache[symbol];
    
    if (!cached) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    return age < this.CACHE_DURATION;
  }

  /**
   * Get CoinGecko platform ID for network
   */
  private getCoingeckoPlatformId(network: string): string {
    const platformMap: { [key: string]: string } = {
      'ethereum': 'ethereum',
      'polygon': 'polygon-pos',
      'arbitrum': 'arbitrum-one',
      'optimism': 'optimistic-ethereum',
      'base': 'base',
      'bsc': 'binance-smart-chain',
      'avalanche': 'avalanche',
    };

    return platformMap[network.toLowerCase()] || 'ethereum';
  }

  /**
   * Clear price cache
   */
  public clearCache(): void {
    this.cache = {};
    logger.info('🗑️ Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    entries: number;
    symbols: string[];
  } {
    return {
      entries: Object.keys(this.cache).length,
      symbols: Object.keys(this.cache),
    };
  }
}

export const priceOracle = PriceOracleService.getInstance();
