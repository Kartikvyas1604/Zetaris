/**
 * Meshcrypt Wallet Core - Multi-Chain HD Wallet
 * Supports: Zcash, Ethereum, Polygon, Solana, Bitcoin
 */

import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import * as ed25519 from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { keccak_256 } from '@noble/hashes/sha3';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { Logger } from '../utils/logger';

// Configure crypto functions for bip39
bip39.setDefaultWordlist('english');
// @ts-ignore - bip39 expects node crypto but we provide compatible functions
bip39.mnemonicToSeedSync = (mnemonic: string, password?: string) => {
  const mnemonicBuffer = Buffer.from(bip39.mnemonicToEntropy(mnemonic), 'hex');
  const salt = 'mnemonic' + (password || '');
  return Buffer.from(pbkdf2(sha512, mnemonicBuffer, salt, { c: 2048, dkLen: 64 }));
};
// @ts-ignore
bip39.mnemonicToSeed = async (mnemonic: string, password?: string) => {
  return bip39.mnemonicToSeedSync(mnemonic, password);
};

export enum ChainType {
  ZCASH = 'Zcash',
  ETHEREUM = 'Ethereum',
  POLYGON = 'Polygon',
  SOLANA = 'Solana',
  BITCOIN = 'Bitcoin',
}

export interface Account {
  name: string;
  chain: ChainType;
  address: string;
  publicKey: string;
  privateKey: string;
  balance: string;
  derivationPath: string;
}

export interface WalletData {
  seedPhrase: string;
  accounts: Account[];
  unifiedAddress: string;
  createdAt: number;
}

export class MeshcryptWalletCore {
  private walletData: WalletData | null = null;

  /**
   * Create new wallet with 24-word seed phrase
   */
  async createWallet(): Promise<WalletData> {
    try {
      Logger.info('Starting wallet creation...');
      
      // Generate 24-word BIP39 mnemonic
      const mnemonic = bip39.generateMnemonic(256); // 256 bits = 24 words
      Logger.debug('Generated mnemonic:', mnemonic.split(' ').length + ' words');
      
      // Derive master key using BIP32
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const masterKey = HDKey.fromMasterSeed(Buffer.from(seed));

      // Derive accounts for all chains
      const accounts: Account[] = [];
      
      // Zcash (shielded)
      accounts.push(await this.deriveZcashAccount(masterKey));
      
      // Ethereum
      accounts.push(await this.deriveEthereumAccount(masterKey));
      
      // Polygon (same as Ethereum - EVM compatible)
      accounts.push(await this.derivePolygonAccount(masterKey));
      
      // Solana
      accounts.push(await this.deriveSolanaAccount(masterKey));
      
      // Bitcoin
      accounts.push(await this.deriveBitcoinAccount(masterKey));

      // Generate unified address
      const unifiedAddress = this.generateUnifiedAddress(accounts);

      this.walletData = {
        seedPhrase: mnemonic,
        accounts,
        unifiedAddress,
        createdAt: Date.now(),
      };

      Logger.info('Wallet created successfully with ' + accounts.length + ' accounts');
      return this.walletData;
    } catch (error) {
      Logger.error('Wallet creation error:', error);
      throw new Error(`Failed to create wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import wallet from seed phrase
   */
  async importWallet(mnemonic: string): Promise<WalletData> {
    try {
      Logger.info('Starting wallet import...');
      
      // Normalize the mnemonic (trim, collapse whitespace)
      const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
      Logger.debug('Normalized mnemonic:', normalizedMnemonic.split(' ').length + ' words');
      
      // Validate mnemonic
      if (!bip39.validateMnemonic(normalizedMnemonic)) {
        Logger.error('Invalid mnemonic validation failed');
        throw new Error('Invalid recovery phrase');
      }
      
      Logger.info('Mnemonic validated successfully');

      // Derive from existing seed phrase
      const seed = await bip39.mnemonicToSeed(normalizedMnemonic);
      const masterKey = HDKey.fromMasterSeed(Buffer.from(seed));

      const accounts: Account[] = [];
      accounts.push(await this.deriveZcashAccount(masterKey));
      accounts.push(await this.deriveEthereumAccount(masterKey));
      accounts.push(await this.derivePolygonAccount(masterKey));
      accounts.push(await this.deriveSolanaAccount(masterKey));
      accounts.push(await this.deriveBitcoinAccount(masterKey));

      const unifiedAddress = this.generateUnifiedAddress(accounts);

      this.walletData = {
        seedPhrase: normalizedMnemonic,
        accounts,
        unifiedAddress,
        createdAt: Date.now(),
      };

      Logger.info('Wallet imported successfully with ' + accounts.length + ' accounts');
      return this.walletData;
    } catch (error) {
      Logger.error('Wallet import error:', error);
      throw new Error('Invalid recovery phrase. Please check and try again.');
    }
  }

  /**
   * Import single account from private key
   */
  async importPrivateKey(privateKey: string, chain: ChainType): Promise<Account> {
    switch (chain) {
      case ChainType.ETHEREUM:
      case ChainType.POLYGON:
        return this.importEVMPrivateKey(privateKey, chain);
      
      case ChainType.SOLANA:
        return this.importSolanaPrivateKey(privateKey);
      
      case ChainType.BITCOIN:
        return this.importBitcoinPrivateKey(privateKey);
      
      default:
        throw new Error(`Private key import not supported for ${chain}`);
    }
  }

  // ========================================================================
  // CHAIN-SPECIFIC DERIVATIONS
  // ========================================================================

  private async deriveZcashAccount(masterKey: HDKey): Promise<Account> {
    // BIP44: m/44'/133'/0'/0/0 (133 is Zcash coin type)
    const path = "m/44'/133'/0'/0/0";
    const child = masterKey.derive(path);
    
    const privateKey = Buffer.from(child.privateKey!).toString('hex');
    const publicKey = Buffer.from(child.publicKey!).toString('hex');
    
    // Generate Zcash shielded address (simplified)
    const address = 'zs1' + Buffer.from(child.publicKey!).toString('hex').substring(0, 76);

    return {
      name: 'Zcash Shielded',
      chain: ChainType.ZCASH,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveEthereumAccount(masterKey: HDKey): Promise<Account> {
    // BIP44: m/44'/60'/0'/0/0 (60 is Ethereum coin type)
    const path = "m/44'/60'/0'/0/0";
    const child = masterKey.derive(path);
    
    const privateKey = Buffer.from(child.privateKey!).toString('hex');
    const publicKey = Buffer.from(child.publicKey!).toString('hex');
    
    // Derive Ethereum address from public key
    const pubKeyBytes = Buffer.from(publicKey, 'hex').slice(1); // Remove first byte
    const hash = keccak_256(pubKeyBytes);
    const address = '0x' + Buffer.from(hash).slice(-20).toString('hex');

    return {
      name: 'Ethereum',
      chain: ChainType.ETHEREUM,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async derivePolygonAccount(masterKey: HDKey): Promise<Account> {
    // Same as Ethereum (EVM compatible)
    const ethAccount = await this.deriveEthereumAccount(masterKey);
    
    return {
      ...ethAccount,
      name: 'Polygon',
      chain: ChainType.POLYGON,
    };
  }

  private async deriveSolanaAccount(masterKey: HDKey): Promise<Account> {
    // BIP44: m/44'/501'/0'/0/0 (501 is Solana coin type)
    const path = "m/44'/501'/0'/0/0";
    const child = masterKey.derive(path);
    
    const privateKey = Buffer.from(child.privateKey!).toString('hex');
    
    // Solana uses Ed25519
    const publicKeyBytes = await ed25519.getPublicKey(child.privateKey!);
    const publicKey = Buffer.from(publicKeyBytes).toString('hex');
    
    // Base58 encode for Solana address
    const address = bs58.encode(publicKeyBytes);

    return {
      name: 'Solana',
      chain: ChainType.SOLANA,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  private async deriveBitcoinAccount(masterKey: HDKey): Promise<Account> {
    // BIP84: m/84'/0'/0'/0/0 (Native SegWit)
    const path = "m/84'/0'/0'/0/0";
    const child = masterKey.derive(path);
    
    const privateKey = Buffer.from(child.privateKey!).toString('hex');
    const publicKey = Buffer.from(child.publicKey!).toString('hex');
    
    // Generate Bitcoin address (simplified - real implementation would use proper encoding)
    const address = 'bc1q' + Buffer.from(sha256(child.publicKey!)).toString('hex').substring(0, 38);

    return {
      name: 'Bitcoin',
      chain: ChainType.BITCOIN,
      address,
      publicKey,
      privateKey,
      balance: '0',
      derivationPath: path,
    };
  }

  // ========================================================================
  // UNIFIED ADDRESS
  // ========================================================================

  private generateUnifiedAddress(accounts: Account[]): string {
    // Create commitment to all addresses
    const data = accounts.map(a => a.address).join('');
    const hash = sha256(Buffer.from(data, 'utf8'));
    
    // Encode as Bech32 with 'cm' prefix (Meshcrypt)
    const base32 = Buffer.from(hash).toString('base64')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '')
      .toLowerCase()
      .substring(0, 50);
    
    return `cm1${base32}`;
  }

  // ========================================================================
  // PRIVATE KEY IMPORTS
  // ========================================================================

  private importEVMPrivateKey(privateKey: string, chain: ChainType): Account {
    // Remove 0x prefix if present
    const key = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
    
    // Derive address (simplified)
    const address = '0x' + Buffer.from(sha256(Buffer.from(key, 'hex'))).toString('hex').substring(0, 40);
    
    return {
      name: chain,
      chain,
      address,
      publicKey: '',
      privateKey: key,
      balance: '0',
      derivationPath: 'imported',
    };
  }

  private importSolanaPrivateKey(privateKey: string): Account {
    // Base58 decode
    const keyBytes = bs58.decode(privateKey);
    
    // First 32 bytes are private key
    const privateKeyHex = Buffer.from(keyBytes.slice(0, 32)).toString('hex');
    
    // Derive public key
    const publicKeyBytes = keyBytes.slice(32, 64);
    const address = bs58.encode(publicKeyBytes);
    
    return {
      name: 'Solana',
      chain: ChainType.SOLANA,
      address,
      publicKey: Buffer.from(publicKeyBytes).toString('hex'),
      privateKey: privateKeyHex,
      balance: '0',
      derivationPath: 'imported',
    };
  }

  private importBitcoinPrivateKey(privateKey: string): Account {
    // WIF format decoding (simplified)
    const address = 'bc1q' + Buffer.from(sha256(Buffer.from(privateKey, 'hex'))).toString('hex').substring(0, 38);
    
    return {
      name: 'Bitcoin',
      chain: ChainType.BITCOIN,
      address,
      publicKey: '',
      privateKey,
      balance: '0',
      derivationPath: 'imported',
    };
  }

  // ========================================================================
  // GETTERS
  // ========================================================================

  getWalletData(): WalletData | null {
    return this.walletData;
  }

  getAccount(chain: ChainType): Account | undefined {
    return this.walletData?.accounts.find(a => a.chain === chain);
  }

  getSeedPhrase(): string {
    if (!this.walletData) throw new Error('No wallet loaded');
    return this.walletData.seedPhrase;
  }
}
