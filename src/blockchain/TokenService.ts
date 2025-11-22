/**
 * ERC-20 Token Service - Production Implementation
 * Real token balances, approvals, and transfers
 */

import { ethers } from 'ethers';
import * as logger from '../utils/logger';
import RealBlockchainService from './RealBlockchainService';

// Standard ERC-20 ABI
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logoUrl?: string;
}

export interface TokenBalance {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  balance: string; // Raw balance
  balanceFormatted: string; // Human readable
  decimals: number;
  balanceUSD: number;
}

/**
 * Popular ERC-20 tokens on each network
 */
export const KNOWN_TOKENS: { [network: string]: Array<{ address: string; symbol: string }> } = {
  ethereum: [
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI' },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC' },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH' },
  ],
  polygon: [
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT' },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC' },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI' },
    { address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', symbol: 'WBTC' },
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'WMATIC' },
  ],
  arbitrum: [
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT' },
    { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC' },
    { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI' },
    { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', symbol: 'WBTC' },
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH' },
  ],
};

export class TokenService {
  private static instance: TokenService;
  private blockchainService: typeof RealBlockchainService;
  private tokenCache: Map<string, TokenInfo> = new Map();
  
  private constructor() {
    this.blockchainService = RealBlockchainService;
  }
  
  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }
  
  /**
   * Get provider for a specific network
   */
  private async getProvider(network: string): Promise<ethers.JsonRpcProvider> {
    // Access private provider from RealBlockchainService
    // In production, you might want to expose a getProvider method
    const rpcUrls: { [key: string]: string } = {
      ethereum: 'https://eth.llamarpc.com',
      polygon: 'https://polygon-rpc.com',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
    };
    
    return new ethers.JsonRpcProvider(rpcUrls[network]);
  }
  
  /**
   * Get real ERC-20 token information
   */
  public async getTokenInfo(network: string, tokenAddress: string): Promise<TokenInfo> {
    const cacheKey = `${network}:${tokenAddress}`;
    
    // Check cache
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }
    
    logger.info(`📋 Fetching token info for ${tokenAddress} on ${network}`);
    
    const provider = await this.getProvider(network);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply(),
      ]);
      
      const tokenInfo: TokenInfo = {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: totalSupply.toString(),
      };
      
      // Cache the token info
      this.tokenCache.set(cacheKey, tokenInfo);
      
      logger.info(`✅ Token: ${name} (${symbol}), Decimals: ${decimals}`);
      
      return tokenInfo;
    } catch (error) {
      logger.error(`❌ Failed to fetch token info:`, error);
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }
  }
  
  /**
   * Get real ERC-20 token balance
   */
  public async getTokenBalance(
    network: string,
    tokenAddress: string,
    walletAddress: string
  ): Promise<TokenBalance> {
    logger.info(`💰 Fetching token balance for ${tokenAddress}`);
    
    const provider = await this.getProvider(network);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    try {
      // Get token info
      const tokenInfo = await this.getTokenInfo(network, tokenAddress);
      
      // Get balance
      const balance = await tokenContract.balanceOf(walletAddress);
      const balanceFormatted = ethers.formatUnits(balance, tokenInfo.decimals);
      
      // Get USD price from oracle
      const balanceUSD = await priceOracle.calculateUSDValue(
        tokenInfo.symbol,
        balanceFormatted
      );
      
      const tokenBalance: TokenBalance = {
        tokenAddress,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        balance: balance.toString(),
        balanceFormatted,
        decimals: tokenInfo.decimals,
        balanceUSD,
      };
      
      logger.info(`✅ Balance: ${balanceFormatted} ${tokenInfo.symbol}`);
      
      return tokenBalance;
    } catch (error) {
      logger.error(`❌ Failed to fetch token balance:`, error);
      throw error;
    }
  }
  
  /**
   * Get balances for all known tokens
   */
  public async getAllTokenBalances(
    network: string,
    walletAddress: string
  ): Promise<TokenBalance[]> {
    logger.info(`📊 Fetching all token balances for ${walletAddress} on ${network}`);
    
    const tokens = KNOWN_TOKENS[network] || [];
    const balances: TokenBalance[] = [];
    
    for (const token of tokens) {
      try {
        const balance = await this.getTokenBalance(network, token.address, walletAddress);
        if (parseFloat(balance.balanceFormatted) > 0) {
          balances.push(balance);
        }
      } catch (error) {
        logger.error(`Failed to fetch balance for ${token.symbol}:`, error);
      }
    }
    
    logger.info(`✅ Found ${balances.length} tokens with non-zero balance`);
    
    return balances;
  }
  
  /**
   * Approve token spending (required before swap)
   */
  public async approveToken(
    network: string,
    tokenAddress: string,
    spenderAddress: string,
    amount: string,
    privateKey: string
  ): Promise<string> {
    logger.info(`✅ Approving ${amount} tokens for ${spenderAddress}`);
    
    const provider = await this.getProvider(network);
    const wallet = new ethers.Wallet(privateKey, provider);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    
    try {
      const tokenInfo = await this.getTokenInfo(network, tokenAddress);
      const amountWei = ethers.parseUnits(amount, tokenInfo.decimals);
      
      const tx = await tokenContract.approve(spenderAddress, amountWei);
      logger.info(`📝 Approval transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`✅ Approval confirmed in block ${receipt?.blockNumber}`);
      
      return tx.hash;
    } catch (error) {
      logger.error(`❌ Token approval failed:`, error);
      throw error;
    }
  }
  
  /**
   * Check token allowance
   */
  public async checkAllowance(
    network: string,
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    const provider = await this.getProvider(network);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    try {
      const tokenInfo = await this.getTokenInfo(network, tokenAddress);
      const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
      const allowanceFormatted = ethers.formatUnits(allowance, tokenInfo.decimals);
      
      logger.info(`ℹ️ Allowance: ${allowanceFormatted} ${tokenInfo.symbol}`);
      
      return allowanceFormatted;
    } catch (error) {
      logger.error(`❌ Failed to check allowance:`, error);
      throw error;
    }
  }
  
  /**
   * Transfer ERC-20 tokens
   */
  public async transferToken(
    network: string,
    tokenAddress: string,
    toAddress: string,
    amount: string,
    privateKey: string
  ): Promise<string> {
    logger.info(`💸 Transferring ${amount} tokens to ${toAddress}`);
    
    const provider = await this.getProvider(network);
    const wallet = new ethers.Wallet(privateKey, provider);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    
    try {
      const tokenInfo = await this.getTokenInfo(network, tokenAddress);
      const amountWei = ethers.parseUnits(amount, tokenInfo.decimals);
      
      const tx = await tokenContract.transfer(toAddress, amountWei);
      logger.info(`📝 Transfer transaction: ${tx.hash}`);
      
      const receipt = await tx.wait();
      logger.info(`✅ Transfer confirmed in block ${receipt?.blockNumber}`);
      
      return tx.hash;
    } catch (error) {
      logger.error(`❌ Token transfer failed:`, error);
      throw error;
    }
  }
}

export default TokenService.getInstance();
