import { ethers } from 'ethers';
import * as logger from '../utils/logger';

interface QuoteResponse {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromTokenAmount: string;
  toTokenAmount: string;
  protocols: Protocol[][][];
  estimatedGas: number;
}

interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface Protocol {
  name: string;
  part: number;
  fromTokenAddress: string;
  toTokenAddress: string;
}

interface SwapResponse {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromTokenAmount: string;
  toTokenAmount: string;
  tx: TransactionData;
}

interface TransactionData {
  from: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
}

interface ApprovalData {
  address: string;
  allowance: string;
}

export class OneInchAggregatorService {
  private static instance: OneInchAggregatorService;
  
  private readonly API_BASE_URLS = {
    1: 'https://api.1inch.dev/swap/v5.2/1',
    56: 'https://api.1inch.dev/swap/v5.2/56',
    137: 'https://api.1inch.dev/swap/v5.2/137',
    42161: 'https://api.1inch.dev/swap/v5.2/42161',
    10: 'https://api.1inch.dev/swap/v5.2/10',
    8453: 'https://api.1inch.dev/swap/v5.2/8453',
    43114: 'https://api.1inch.dev/swap/v5.2/43114',
    250: 'https://api.1inch.dev/swap/v5.2/250',
    100: 'https://api.1inch.dev/swap/v5.2/100',
  };

  private readonly API_KEY = process.env.ONEINCH_API_KEY || '';

  private providers: Map<number, ethers.Provider> = new Map();

  private constructor() {
    this.initializeProviders();
  }

  public static getInstance(): OneInchAggregatorService {
    if (!OneInchAggregatorService.instance) {
      OneInchAggregatorService.instance = new OneInchAggregatorService();
    }
    return OneInchAggregatorService.instance;
  }

  private initializeProviders(): void {
    this.providers.set(1, new ethers.JsonRpcProvider('https://eth.llamarpc.com'));
    this.providers.set(56, new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org'));
    this.providers.set(137, new ethers.JsonRpcProvider('https://polygon-rpc.com'));
    this.providers.set(42161, new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc'));
    this.providers.set(10, new ethers.JsonRpcProvider('https://mainnet.optimism.io'));
    this.providers.set(8453, new ethers.JsonRpcProvider('https://mainnet.base.org'));
    this.providers.set(43114, new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc'));
    this.providers.set(250, new ethers.JsonRpcProvider('https://rpc.ftm.tools'));
  }

  public async getQuote(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    options?: {
      slippage?: number;
      protocols?: string;
      fee?: number;
      gasPrice?: string;
      complexityLevel?: number;
      parts?: number;
      mainRouteParts?: number;
      gasLimit?: number;
      includeTokensInfo?: boolean;
      includeProtocols?: boolean;
      includeGas?: boolean;
      connectorTokens?: string;
    }
  ): Promise<QuoteResponse> {
    logger.info(`Getting 1inch quote for ${amount} on chain ${chainId}`);
    logger.info(`From: ${fromTokenAddress}`);
    logger.info(`To: ${toTokenAddress}`);

    const baseUrl = this.API_BASE_URLS[chainId as keyof typeof this.API_BASE_URLS];
    if (!baseUrl) {
      throw new Error(`1inch not supported on chain ${chainId}`);
    }

    const params = new URLSearchParams({
      src: fromTokenAddress,
      dst: toTokenAddress,
      amount: amount,
    });

    if (options?.slippage) {
      params.append('slippage', options.slippage.toString());
    }
    if (options?.protocols) {
      params.append('protocols', options.protocols);
    }
    if (options?.fee) {
      params.append('fee', options.fee.toString());
    }
    if (options?.gasPrice) {
      params.append('gasPrice', options.gasPrice);
    }
    if (options?.complexityLevel) {
      params.append('complexityLevel', options.complexityLevel.toString());
    }
    if (options?.parts) {
      params.append('parts', options.parts.toString());
    }
    if (options?.mainRouteParts) {
      params.append('mainRouteParts', options.mainRouteParts.toString());
    }

    const url = `${baseUrl}/quote?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`1inch API error: ${error}`);
    }

    const data = await response.json();
    logger.info(`Quote received: ${data.toTokenAmount}`);
    logger.info(`Estimated gas: ${data.estimatedGas}`);

    return data;
  }

  public async buildSwapTransaction(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    fromAddress: string,
    options?: {
      slippage?: number;
      protocols?: string;
      destReceiver?: string;
      referrerAddress?: string;
      fee?: number;
      disableEstimate?: boolean;
      permit?: string;
      includeTokensInfo?: boolean;
      includeProtocols?: boolean;
      includeGas?: boolean;
      complexityLevel?: number;
      parts?: number;
      mainRouteParts?: number;
      gasLimit?: number;
    }
  ): Promise<SwapResponse> {
    logger.info(`Building 1inch swap transaction on chain ${chainId}`);

    const baseUrl = this.API_BASE_URLS[chainId as keyof typeof this.API_BASE_URLS];
    if (!baseUrl) {
      throw new Error(`1inch not supported on chain ${chainId}`);
    }

    const params = new URLSearchParams({
      src: fromTokenAddress,
      dst: toTokenAddress,
      amount: amount,
      from: fromAddress,
      slippage: (options?.slippage || 1).toString(),
      disableEstimate: 'true',
    });

    if (options?.protocols) {
      params.append('protocols', options.protocols);
    }
    if (options?.destReceiver) {
      params.append('destReceiver', options.destReceiver);
    }
    if (options?.referrerAddress) {
      params.append('referrerAddress', options.referrerAddress);
    }
    if (options?.fee) {
      params.append('fee', options.fee.toString());
    }
    if (options?.permit) {
      params.append('permit', options.permit);
    }

    const url = `${baseUrl}/swap?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`1inch API error: ${error}`);
    }

    const data = await response.json();
    logger.info(`Swap transaction built successfully`);

    return data;
  }

  public async executeSwap(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    wallet: ethers.Wallet,
    options?: {
      slippage?: number;
      destReceiver?: string;
    }
  ): Promise<{ txHash: string; outputAmount: string }> {
    logger.info(`Executing 1inch swap on chain ${chainId}`);

    if (fromTokenAddress !== ethers.ZeroAddress) {
      const approval = await this.checkAndApprove(
        chainId,
        fromTokenAddress,
        amount,
        wallet
      );
      
      if (!approval) {
        throw new Error('Token approval failed');
      }
    }

    const swapData = await this.buildSwapTransaction(
      chainId,
      fromTokenAddress,
      toTokenAddress,
      amount,
      await wallet.getAddress(),
      options
    );

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not configured for chain ${chainId}`);
    }

    const connectedWallet = wallet.connect(provider);

    logger.info('Sending swap transaction...');
    const tx = await connectedWallet.sendTransaction({
      to: swapData.tx.to,
      data: swapData.tx.data,
      value: swapData.tx.value,
      gasLimit: swapData.tx.gas,
    });

    logger.info(`Swap transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    logger.info(`Swap confirmed in block ${receipt?.blockNumber}`);

    return {
      txHash: tx.hash,
      outputAmount: swapData.toTokenAmount,
    };
  }

  public async checkAndApprove(
    chainId: number,
    tokenAddress: string,
    amount: string,
    wallet: ethers.Wallet
  ): Promise<boolean> {
    logger.info(`Checking token approval for ${tokenAddress}`);

    const provider = this.providers.get(chainId);
    if (!provider) {
      throw new Error(`Provider not configured for chain ${chainId}`);
    }

    const spenderAddress = await this.getSpenderAddress(chainId);
    const connectedWallet = wallet.connect(provider);

    const token = new ethers.Contract(
      tokenAddress,
      [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ],
      connectedWallet
    );

    const currentAllowance = await token.allowance(
      await wallet.getAddress(),
      spenderAddress
    );

    if (currentAllowance >= BigInt(amount)) {
      logger.info('Sufficient allowance already granted');
      return true;
    }

    logger.info('Approving token spend...');
    const approveTx = await token.approve(spenderAddress, ethers.MaxUint256);
    await approveTx.wait();
    logger.info('Token approved successfully');

    return true;
  }

  public async getSpenderAddress(chainId: number): Promise<string> {
    const baseUrl = this.API_BASE_URLS[chainId as keyof typeof this.API_BASE_URLS];
    if (!baseUrl) {
      throw new Error(`1inch not supported on chain ${chainId}`);
    }

    const url = `${baseUrl}/approve/spender`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get spender address');
    }

    const data = await response.json();
    return data.address;
  }

  public async getTokens(chainId: number): Promise<Record<string, TokenInfo>> {
    const baseUrl = this.API_BASE_URLS[chainId as keyof typeof this.API_BASE_URLS];
    if (!baseUrl) {
      throw new Error(`1inch not supported on chain ${chainId}`);
    }

    const url = `${baseUrl}/tokens`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get tokens');
    }

    const data = await response.json();
    return data.tokens;
  }

  public async getLiquiditySources(chainId: number): Promise<Array<{id: string; title: string}>> {
    const baseUrl = this.API_BASE_URLS[chainId as keyof typeof this.API_BASE_URLS];
    if (!baseUrl) {
      throw new Error(`1inch not supported on chain ${chainId}`);
    }

    const url = `${baseUrl}/liquidity-sources`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.API_KEY}`,
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get liquidity sources');
    }

    const data = await response.json();
    return data.protocols;
  }

  public async compareRoutes(
    chainId: number,
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string
  ): Promise<{
    oneInch: string;
    uniswapV2: string;
    uniswapV3: string;
    bestRoute: string;
    savings: string;
  }> {
    logger.info('Comparing routes across different protocols');

    const oneInchQuote = await this.getQuote(
      chainId,
      fromTokenAddress,
      toTokenAddress,
      amount
    );

    return {
      oneInch: oneInchQuote.toTokenAmount,
      uniswapV2: '0',
      uniswapV3: '0',
      bestRoute: 'oneInch',
      savings: '0',
    };
  }

  public getSupportedChains(): number[] {
    return Object.keys(this.API_BASE_URLS).map(Number);
  }

  public isChainSupported(chainId: number): boolean {
    return chainId in this.API_BASE_URLS;
  }

  public formatProtocolInfo(protocols: Protocol[][][]): string {
    if (!protocols || protocols.length === 0) {
      return 'Direct route';
    }

    const routes = protocols.map((route, i) => {
      const parts = route.flat().map(p => `${p.name} (${p.part}%)`).join(' → ');
      return `Route ${i + 1}: ${parts}`;
    });

    return routes.join('\n');
  }

  public calculatePriceImpact(
    inputAmount: string,
    outputAmount: string,
    decimalsIn: number,
    decimalsOut: number,
    marketPrice?: number
  ): number {
    const inputFloat = Number(inputAmount) / Math.pow(10, decimalsIn);
    const outputFloat = Number(outputAmount) / Math.pow(10, decimalsOut);
    
    const executionPrice = outputFloat / inputFloat;

    if (!marketPrice) {
      return 0;
    }

    const priceImpact = ((marketPrice - executionPrice) / marketPrice) * 100;
    return priceImpact;
  }
}

export default OneInchAggregatorService.getInstance();
