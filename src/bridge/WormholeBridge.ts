import { ethers } from 'ethers';
import * as logger from '../utils/logger';

interface WormholeMessage {
  emitterChainId: number;
  emitterAddress: string;
  sequence: number;
  payload: Uint8Array;
  consistencyLevel: number;
  timestamp: number;
  nonce: number;
  signatures: SignatureSet[];
}

interface SignatureSet {
  guardianIndex: number;
  signature: Uint8Array;
}

interface TokenBridgeTransfer {
  tokenChain: number;
  tokenAddress: string;
  amount: bigint;
  targetChain: number;
  targetAddress: string;
}

interface VAA {
  version: number;
  guardianSetIndex: number;
  signatures: SignatureSet[];
  timestamp: number;
  nonce: number;
  emitterChain: number;
  emitterAddress: string;
  sequence: bigint;
  consistencyLevel: number;
  payload: Uint8Array;
}

export class WormholeBridgeService {
  private static instance: WormholeBridgeService;
  
  private readonly WORMHOLE_CONTRACTS = {
    1: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
    137: '0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7',
    42161: '0xa5f208e072434bC67592E4C49C1B991BA79BCA46',
    10: '0xEe91C335eab126dF5fDB3797EA9d6aD93aeC9722',
    8453: '0xbebdb6C8ddC678FfA9f8748f85C815C556Dd8ac6',
    56: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
  };

  private readonly TOKEN_BRIDGE_CONTRACTS = {
    1: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
    137: '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE',
    42161: '0x0b2402144Bb366A632D14B83F244D2e0e21bD39c',
    10: '0x1D68124e65faFC907325e3EDbF8c4d84499DAa8b',
    8453: '0x8d2de8d2f73F1F4cAB472AC9A881C9b123C79627',
    56: '0xB6F6D86a8f9879A9c87f643768d9efc38c1Da6E7',
  };

  private readonly GUARDIAN_RPC_HOSTS = [
    'https://wormhole-v2-mainnet-api.certus.one',
    'https://wormhole.inotel.ro',
    'https://wormhole-v2-mainnet-api.mcf.rocks',
    'https://wormhole-v2-mainnet-api.chainlayer.network',
    'https://wormhole-v2-mainnet-api.staking.fund',
  ];

  private readonly CHAIN_IDS = {
    ethereum: 2,
    bsc: 4,
    polygon: 5,
    avalanche: 6,
    oasis: 7,
    algorand: 8,
    aurora: 9,
    fantom: 10,
    karura: 11,
    acala: 12,
    klaytn: 13,
    celo: 14,
    near: 15,
    moonbeam: 16,
    neon: 17,
    terra2: 18,
    injective: 19,
    osmosis: 20,
    sui: 21,
    aptos: 22,
    arbitrum: 23,
    optimism: 24,
    gnosis: 25,
    pythnet: 26,
    xpla: 28,
    base: 30,
    sei: 32,
    rootstock: 33,
    scroll: 34,
    mantle: 35,
    blast: 36,
    xlayer: 37,
    linea: 38,
    berachain: 39,
    seievm: 40,
    solana: 1,
  };

  private providers: Map<number, ethers.Provider> = new Map();
  private activeTransfers: Map<string, TokenBridgeTransfer> = new Map();

  private constructor() {
    this.initializeProviders();
  }

  public static getInstance(): WormholeBridgeService {
    if (!WormholeBridgeService.instance) {
      WormholeBridgeService.instance = new WormholeBridgeService();
    }
    return WormholeBridgeService.instance;
  }

  private initializeProviders(): void {
    this.providers.set(1, new ethers.JsonRpcProvider('https://eth.llamarpc.com'));
    this.providers.set(137, new ethers.JsonRpcProvider('https://polygon-rpc.com'));
    this.providers.set(42161, new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc'));
    this.providers.set(10, new ethers.JsonRpcProvider('https://mainnet.optimism.io'));
    this.providers.set(8453, new ethers.JsonRpcProvider('https://mainnet.base.org'));
    this.providers.set(56, new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org'));
  }

  public async transferTokens(
    sourceChainId: number,
    targetChainId: number,
    tokenAddress: string,
    amount: string,
    recipientAddress: string,
    wallet: ethers.Wallet
  ): Promise<{ txHash: string; sequence: number }> {
    logger.info(`Initiating Wormhole bridge transfer`);
    logger.info(`From chain ${sourceChainId} to chain ${targetChainId}`);
    logger.info(`Amount: ${amount}`);

    const tokenBridgeAddress = this.TOKEN_BRIDGE_CONTRACTS[sourceChainId as keyof typeof this.TOKEN_BRIDGE_CONTRACTS];
    if (!tokenBridgeAddress) {
      throw new Error(`Token bridge not supported on chain ${sourceChainId}`);
    }

    const provider = this.providers.get(sourceChainId);
    if (!provider) {
      throw new Error(`Provider not configured for chain ${sourceChainId}`);
    }

    const connectedWallet = wallet.connect(provider);

    const tokenBridge = new ethers.Contract(
      tokenBridgeAddress,
      [
        'function transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce) returns (uint64 sequence)',
        'function completeTransfer(bytes encodedVm)',
      ],
      connectedWallet
    );

    const token = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      connectedWallet
    );

    logger.info('Approving token bridge...');
    const approveTx = await token.approve(tokenBridgeAddress, ethers.parseUnits(amount, 18));
    await approveTx.wait();

    const recipientBytes32 = ethers.zeroPadValue(recipientAddress, 32);
    const wormholeChainId = this.CHAIN_IDS[this.getChainName(targetChainId) as keyof typeof this.CHAIN_IDS];
    
    logger.info('Transferring tokens via Wormhole...');
    const transferTx = await tokenBridge.transferTokens(
      tokenAddress,
      ethers.parseUnits(amount, 18),
      wormholeChainId,
      recipientBytes32,
      0,
      Math.floor(Math.random() * 1000000)
    );

    const receipt = await transferTx.wait();
    const sequence = this.extractSequence(receipt);

    logger.info(`Transfer initiated: ${transferTx.hash}`);
    logger.info(`Sequence: ${sequence}`);

    const transfer: TokenBridgeTransfer = {
      tokenChain: this.CHAIN_IDS[this.getChainName(sourceChainId) as keyof typeof this.CHAIN_IDS],
      tokenAddress,
      amount: ethers.parseUnits(amount, 18),
      targetChain: wormholeChainId,
      targetAddress: recipientAddress,
    };

    this.activeTransfers.set(`${sourceChainId}-${sequence}`, transfer);

    return {
      txHash: transferTx.hash,
      sequence,
    };
  }

  public async getSignedVAA(
    emitterChain: number,
    emitterAddress: string,
    sequence: number
  ): Promise<Uint8Array> {
    logger.info(`Fetching signed VAA for sequence ${sequence}`);

    for (let attempt = 0; attempt < 30; attempt++) {
      for (const host of this.GUARDIAN_RPC_HOSTS) {
        try {
          const url = `${host}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            const vaaBytes = Buffer.from(data.vaaBytes, 'base64');
            logger.info('VAA retrieved successfully');
            return new Uint8Array(vaaBytes);
          }
        } catch (error) {
          continue;
        }
      }

      logger.info(`VAA not ready yet, attempt ${attempt + 1}/30`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error('Failed to retrieve signed VAA after 30 attempts');
  }

  public async completeTransfer(
    targetChainId: number,
    vaa: Uint8Array,
    wallet: ethers.Wallet
  ): Promise<string> {
    logger.info(`Completing transfer on chain ${targetChainId}`);

    const tokenBridgeAddress = this.TOKEN_BRIDGE_CONTRACTS[targetChainId as keyof typeof this.TOKEN_BRIDGE_CONTRACTS];
    if (!tokenBridgeAddress) {
      throw new Error(`Token bridge not supported on chain ${targetChainId}`);
    }

    const provider = this.providers.get(targetChainId);
    if (!provider) {
      throw new Error(`Provider not configured for chain ${targetChainId}`);
    }

    const connectedWallet = wallet.connect(provider);

    const tokenBridge = new ethers.Contract(
      tokenBridgeAddress,
      ['function completeTransfer(bytes encodedVm)'],
      connectedWallet
    );

    logger.info('Submitting VAA to complete transfer...');
    const completeTx = await tokenBridge.completeTransfer(vaa);
    const receipt = await completeTx.wait();

    logger.info(`Transfer completed: ${completeTx.hash}`);

    return completeTx.hash;
  }

  public async bridgeTokens(
    sourceChainId: number,
    targetChainId: number,
    tokenAddress: string,
    amount: string,
    recipientAddress: string,
    wallet: ethers.Wallet
  ): Promise<{ lockTx: string; unlockTx: string }> {
    const { txHash, sequence } = await this.transferTokens(
      sourceChainId,
      targetChainId,
      tokenAddress,
      amount,
      recipientAddress,
      wallet
    );

    const tokenBridgeAddress = this.TOKEN_BRIDGE_CONTRACTS[sourceChainId as keyof typeof this.TOKEN_BRIDGE_CONTRACTS];
    const emitterAddress = this.formatEmitterAddress(tokenBridgeAddress);
    const emitterChain = this.CHAIN_IDS[this.getChainName(sourceChainId) as keyof typeof this.CHAIN_IDS];

    logger.info('Waiting for VAA to be signed by guardians...');
    const vaa = await this.getSignedVAA(emitterChain, emitterAddress, sequence);

    const unlockTx = await this.completeTransfer(targetChainId, vaa, wallet);

    return {
      lockTx: txHash,
      unlockTx,
    };
  }

  public parseVAA(vaaBytes: Uint8Array): VAA {
    let index = 0;

    const version = vaaBytes[index++];
    const guardianSetIndex = (vaaBytes[index++] << 24) |
                            (vaaBytes[index++] << 16) |
                            (vaaBytes[index++] << 8) |
                            vaaBytes[index++];

    const sigLength = vaaBytes[index++];
    const signatures: SignatureSet[] = [];

    for (let i = 0; i < sigLength; i++) {
      const guardianIndex = vaaBytes[index++];
      const signature = vaaBytes.slice(index, index + 65);
      index += 65;
      signatures.push({ guardianIndex, signature });
    }

    const timestamp = (vaaBytes[index++] << 24) |
                     (vaaBytes[index++] << 16) |
                     (vaaBytes[index++] << 8) |
                     vaaBytes[index++];

    const nonce = (vaaBytes[index++] << 24) |
                 (vaaBytes[index++] << 16) |
                 (vaaBytes[index++] << 8) |
                 vaaBytes[index++];

    const emitterChain = (vaaBytes[index++] << 8) | vaaBytes[index++];
    const emitterAddress = ethers.hexlify(vaaBytes.slice(index, index + 32));
    index += 32;

    const sequence = BigInt('0x' + Buffer.from(vaaBytes.slice(index, index + 8)).toString('hex'));
    index += 8;

    const consistencyLevel = vaaBytes[index++];
    const payload = vaaBytes.slice(index);

    return {
      version,
      guardianSetIndex,
      signatures,
      timestamp,
      nonce,
      emitterChain,
      emitterAddress,
      sequence,
      consistencyLevel,
      payload,
    };
  }

  public async getTransferStatus(
    sourceChainId: number,
    sequence: number
  ): Promise<{ status: string; vaa?: Uint8Array }> {
    const transfer = this.activeTransfers.get(`${sourceChainId}-${sequence}`);
    
    if (!transfer) {
      return { status: 'not_found' };
    }

    try {
      const tokenBridgeAddress = this.TOKEN_BRIDGE_CONTRACTS[sourceChainId as keyof typeof this.TOKEN_BRIDGE_CONTRACTS];
      const emitterAddress = this.formatEmitterAddress(tokenBridgeAddress);
      const emitterChain = this.CHAIN_IDS[this.getChainName(sourceChainId) as keyof typeof this.CHAIN_IDS];

      const vaa = await this.getSignedVAA(emitterChain, emitterAddress, sequence);
      
      return {
        status: 'ready',
        vaa,
      };
    } catch {
      return { status: 'pending' };
    }
  }

  private extractSequence(receipt: ethers.TransactionReceipt): number {
    const logTransferTopic = ethers.id('LogMessagePublished(address,uint64,uint32,bytes,uint8)');
    
    const log = receipt.logs.find(
      (log: ethers.Log) => log.topics[0] === logTransferTopic
    );

    if (!log) {
      throw new Error('LogMessagePublished event not found');
    }

    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['address', 'uint64', 'uint32', 'bytes', 'uint8'],
      log.data
    );

    return Number(decoded[1]);
  }

  private formatEmitterAddress(address: string): string {
    return address.toLowerCase().replace('0x', '').padStart(64, '0');
  }

  private getChainName(chainId: number): string {
    const names: Record<number, string> = {
      1: 'ethereum',
      56: 'bsc',
      137: 'polygon',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
    };
    return names[chainId] || 'ethereum';
  }

  public getSupportedChains(): number[] {
    return Object.keys(this.WORMHOLE_CONTRACTS).map(Number);
  }

  public isChainSupported(chainId: number): boolean {
    return chainId in this.WORMHOLE_CONTRACTS;
  }
}

export default WormholeBridgeService.getInstance();
