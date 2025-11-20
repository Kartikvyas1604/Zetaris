import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { logger } from '../utils/logger';

export interface SolanaWalletInfo {
  publicKey: string;
  balance: number;
  tokens: SolanaTokenBalance[];
}

export interface SolanaTokenBalance {
  mint: string;
  amount: string;
  decimals: number;
  uiAmount: number;
}

export interface SolanaTransferParams {
  from: Keypair;
  to: string;
  amount: number;
}

export interface SPLTransferParams {
  from: Keypair;
  to: string;
  mint: string;
  amount: string;
}

class SolanaIntegrationService {
  private static instance: SolanaIntegrationService;
  private connection: Connection | null = null;
  private cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta';

  private readonly RPC_ENDPOINTS = {
    'mainnet-beta': process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    'devnet': 'https://api.devnet.solana.com',
    'testnet': 'https://api.testnet.solana.com',
  };

  private readonly WORMHOLE_SOLANA_BRIDGE = 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth';
  private readonly WORMHOLE_SOLANA_TOKEN_BRIDGE = 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb';

  private constructor() {}

  static getInstance(): SolanaIntegrationService {
    if (!SolanaIntegrationService.instance) {
      SolanaIntegrationService.instance = new SolanaIntegrationService();
    }
    return SolanaIntegrationService.instance;
  }

  async initialize(cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta') {
    this.cluster = cluster;
    this.connection = new Connection(this.RPC_ENDPOINTS[cluster], 'confirmed');
    logger.info(`Solana connection initialized on ${cluster}`);
  }

  private ensureConnection(): Connection {
    if (!this.connection) {
      throw new Error('Solana connection not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  async getBalance(publicKey: string): Promise<number> {
    const connection = this.ensureConnection();
    const pubkey = new PublicKey(publicKey);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getTokenBalances(publicKey: string): Promise<SolanaTokenBalance[]> {
    const connection = this.ensureConnection();
    const pubkey = new PublicKey(publicKey);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    const balances: SolanaTokenBalance[] = [];

    for (const account of tokenAccounts.value) {
      const parsedInfo = account.account.data.parsed.info;
      balances.push({
        mint: parsedInfo.mint,
        amount: parsedInfo.tokenAmount.amount,
        decimals: parsedInfo.tokenAmount.decimals,
        uiAmount: parsedInfo.tokenAmount.uiAmount,
      });
    }

    return balances;
  }

  async getWalletInfo(publicKey: string): Promise<SolanaWalletInfo> {
    const balance = await this.getBalance(publicKey);
    const tokens = await this.getTokenBalances(publicKey);

    return {
      publicKey,
      balance,
      tokens,
    };
  }

  async transferSOL(params: SolanaTransferParams): Promise<string> {
    const connection = this.ensureConnection();
    const toPublicKey = new PublicKey(params.to);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: params.from.publicKey,
        toPubkey: toPublicKey,
        lamports: params.amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [params.from]);
    logger.info(`SOL transfer successful: ${signature}`);

    return signature;
  }

  async transferSPLToken(params: SPLTransferParams): Promise<string> {
    const connection = this.ensureConnection();
    const mintPublicKey = new PublicKey(params.mint);
    const toPublicKey = new PublicKey(params.to);

    const fromTokenAccount = await this.getOrCreateAssociatedTokenAccount(
      params.from.publicKey,
      mintPublicKey,
      params.from
    );

    const toTokenAccount = await this.getOrCreateAssociatedTokenAccount(
      toPublicKey,
      mintPublicKey,
      params.from
    );

    const token = new Token(connection, mintPublicKey, TOKEN_PROGRAM_ID, params.from);

    const signature = await token.transfer(
      fromTokenAccount,
      toTokenAccount,
      params.from,
      [],
      BigInt(params.amount)
    );

    logger.info(`SPL token transfer successful: ${signature}`);
    return signature;
  }

  private async getOrCreateAssociatedTokenAccount(
    owner: PublicKey,
    mint: PublicKey,
    payer: Keypair
  ): Promise<PublicKey> {
    const connection = this.ensureConnection();

    const associatedToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      owner
    );

    const account = await connection.getAccountInfo(associatedToken);

    if (!account) {
      const transaction = new Transaction().add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          mint,
          associatedToken,
          owner,
          payer.publicKey
        )
      );

      await sendAndConfirmTransaction(connection, transaction, [payer]);
      logger.info(`Created associated token account: ${associatedToken.toBase58()}`);
    }

    return associatedToken;
  }

  async createSPLToken(
    payer: Keypair,
    mintAuthority: PublicKey,
    decimals: number
  ): Promise<Token> {
    const connection = this.ensureConnection();

    const mint = await Token.createMint(
      connection,
      payer,
      mintAuthority,
      null,
      decimals,
      TOKEN_PROGRAM_ID
    );

    logger.info(`SPL token created: ${mint.publicKey.toBase58()}`);
    return mint;
  }

  async mintSPLToken(
    mint: PublicKey,
    destination: PublicKey,
    authority: Keypair,
    amount: string
  ): Promise<string> {
    const connection = this.ensureConnection();
    const token = new Token(connection, mint, TOKEN_PROGRAM_ID, authority);

    const associatedToken = await this.getOrCreateAssociatedTokenAccount(
      destination,
      mint,
      authority
    );

    const signature = await token.mintTo(
      associatedToken,
      authority,
      [],
      BigInt(amount)
    );

    logger.info(`Minted ${amount} tokens to ${destination.toBase58()}`);
    return signature;
  }

  async burnSPLToken(
    mint: PublicKey,
    owner: Keypair,
    amount: string
  ): Promise<string> {
    const connection = this.ensureConnection();
    const token = new Token(connection, mint, TOKEN_PROGRAM_ID, owner);

    const ownerTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      owner.publicKey
    );

    const signature = await token.burn(
      ownerTokenAccount,
      owner,
      [],
      BigInt(amount)
    );

    logger.info(`Burned ${amount} tokens from ${owner.publicKey.toBase58()}`);
    return signature;
  }

  async bridgeFromSolana(
    tokenAddress: string,
    amount: string,
    targetChain: string,
    recipientAddress: string,
    signer: Keypair
  ): Promise<string> {
    const connection = this.ensureConnection();
    
    logger.info(`Bridging ${amount} tokens from Solana to ${targetChain}`);

    const bridgeAddress = new PublicKey(this.WORMHOLE_SOLANA_TOKEN_BRIDGE);
    const mintAddress = new PublicKey(tokenAddress);

    const sourceTokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintAddress,
      signer.publicKey
    );

    const transferIx = await this.createWormholeTransferInstruction(
      bridgeAddress,
      sourceTokenAccount,
      mintAddress,
      amount,
      targetChain,
      recipientAddress
    );

    const transaction = new Transaction().add(transferIx as any);
    
    const signature = await sendAndConfirmTransaction(connection, transaction, [signer]);

    logger.info(`Wormhole bridge initiated from Solana: ${signature}`);
    return signature;
  }

  private async createWormholeTransferInstruction(
    bridgeAddress: PublicKey,
    sourceToken: PublicKey,
    mint: PublicKey,
    amount: string,
    targetChain: string,
    recipient: string
  ): Promise<unknown> {
    const targetChainId = this.getWormholeChainId(targetChain);
    
    const recipientBytes = Buffer.from(recipient.replace('0x', ''), 'hex');
    const recipientArray = Array.from(recipientBytes);
    while (recipientArray.length < 32) {
      recipientArray.unshift(0);
    }

    return {
      keys: [
        { pubkey: bridgeAddress, isSigner: false, isWritable: false },
        { pubkey: sourceToken, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
      ],
      programId: new PublicKey(this.WORMHOLE_SOLANA_TOKEN_BRIDGE),
      data: Buffer.from([
        1,
        ...new Array(8).fill(0),
        ...Buffer.from(amount),
        ...Buffer.from([targetChainId]),
        ...recipientArray,
      ]),
    };
  }

  private getWormholeChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      'solana': 1,
      'ethereum': 2,
      'bsc': 4,
      'polygon': 5,
      'arbitrum': 23,
      'optimism': 24,
      'base': 30,
    };
    return chainIds[chain] || 0;
  }

  async bridgeToSolana(
    vaa: string,
    recipientKeypair: Keypair
  ): Promise<string> {
    const connection = this.ensureConnection();

    const bridgeAddress = new PublicKey(this.WORMHOLE_SOLANA_TOKEN_BRIDGE);
    const vaaBytes = Buffer.from(vaa.replace('0x', ''), 'hex');

    const completeTransferIx = {
      keys: [
        { pubkey: bridgeAddress, isSigner: false, isWritable: false },
        { pubkey: recipientKeypair.publicKey, isSigner: true, isWritable: true },
      ],
      programId: new PublicKey(this.WORMHOLE_SOLANA_TOKEN_BRIDGE),
      data: Buffer.concat([Buffer.from([3]), vaaBytes]),
    };

    const transaction = new Transaction().add(completeTransferIx);

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [recipientKeypair]
    );

    logger.info(`Completed bridge to Solana: ${signature}`);
    return signature;
  }

  async getTransaction(signature: string): Promise<unknown> {
    const connection = this.ensureConnection();
    const tx = await connection.getTransaction(signature);
    return tx;
  }

  async getRecentBlockhash(): Promise<string> {
    const connection = this.ensureConnection();
    const { blockhash } = await connection.getLatestBlockhash();
    return blockhash;
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    const connection = this.ensureConnection();
    const result = await connection.confirmTransaction(signature);
    return !result.value.err;
  }

  async requestAirdrop(publicKey: string, amount: number): Promise<string> {
    if (this.cluster === 'mainnet-beta') {
      throw new Error('Airdrops not available on mainnet');
    }

    const connection = this.ensureConnection();
    const pubkey = new PublicKey(publicKey);
    const signature = await connection.requestAirdrop(pubkey, amount * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature);

    logger.info(`Airdrop successful: ${amount} SOL to ${publicKey}`);
    return signature;
  }

  generateKeypair(): { publicKey: string; secretKey: Uint8Array } {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toBase58(),
      secretKey: keypair.secretKey,
    };
  }

  keypairFromSecretKey(secretKey: Uint8Array): Keypair {
    return Keypair.fromSecretKey(secretKey);
  }

  async getTokenMetadata(mint: string): Promise<unknown> {
    const connection = this.ensureConnection();
    const mintPublicKey = new PublicKey(mint);

    const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    
    const [metadataAddress] = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        METADATA_PROGRAM_ID.toBuffer(),
        mintPublicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );

    const accountInfo = await connection.getAccountInfo(metadataAddress);
    
    if (!accountInfo) {
      return null;
    }

    return {
      address: metadataAddress.toBase58(),
      data: accountInfo.data,
    };
  }
}

export const solanaIntegration = SolanaIntegrationService.getInstance();
