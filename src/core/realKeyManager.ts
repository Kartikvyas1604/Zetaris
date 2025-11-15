/**
 * REAL HD Wallet - Working Implementation
 * NO MOCKS - Real BIP-39, BIP-32, BIP-44 with actual cryptography
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
// @ts-ignore - wordlist is a JS module
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

export class RealKeyManager {
  private hdKey: HDKey | null = null;
  private mnemonic: string | null = null;
  
  /**
   * REAL: Generate 24-word mnemonic using BIP-39
   */
  static generateMnemonic(): string {
    return generateMnemonic(wordlist, 256); // 256 bits = 24 words
  }
  
  /**
   * REAL: Validate BIP-39 mnemonic checksum
   */
  static validateMnemonic(mnemonic: string): boolean {
    return validateMnemonic(mnemonic, wordlist);
  }
  
  /**
   * REAL: Initialize from mnemonic - creates actual HD wallet
   */
  async initialize(mnemonic: string, passphrase: string = ''): Promise<void> {
    if (!RealKeyManager.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }
    
    this.mnemonic = mnemonic;
    
    // REAL: Convert to seed (BIP-39)
    const seed = mnemonicToSeedSync(mnemonic, passphrase);
    
    // REAL: Create HD wallet (BIP-32)
    this.hdKey = HDKey.fromMasterSeed(seed);
  }
  
  /**
   * REAL: Derive Ethereum address (BIP-44: m/44'/60'/0'/0/index)
   */
  deriveEthereumKey(index: number = 0): { address: string; privateKey: string; publicKey: string } {
    if (!this.hdKey) throw new Error('Not initialized');
    
    // REAL BIP-44 path for Ethereum
    const path = `m/44'/60'/0'/0/${index}`;
    const child = this.hdKey.derive(path);
    
    if (!child.privateKey) throw new Error('No private key');
    
    // REAL: Ethereum address from public key
    const publicKeyUncompressed = secp256k1.ProjectivePoint.fromPrivateKey(child.privateKey).toRawBytes(false).slice(1);
    const addressHash = keccak_256(publicKeyUncompressed);
    const address = '0x' + Buffer.from(addressHash.slice(-20)).toString('hex');
    
    return {
      address,
      privateKey: '0x' + Buffer.from(child.privateKey).toString('hex'),
      publicKey: '0x' + Buffer.from(child.publicKey!).toString('hex')
    };
  }
  
  /**
   * REAL: Sign message with derived key
   */
  async signMessage(message: Uint8Array, path: string): Promise<Uint8Array> {
    if (!this.hdKey) throw new Error('Not initialized');
    
    const child = this.hdKey.derive(path);
    if (!child.privateKey) throw new Error('No private key');
    
    const msgHash = sha256(message);
    const sig = secp256k1.sign(msgHash, child.privateKey);
    
    return sig.toCompactRawBytes();
  }
  
  /**
   * Get the mnemonic (CAREFUL - sensitive!)
   */
  getMnemonic(): string | null {
    return this.mnemonic;
  }
  
  /**
   * REAL: Securely destroy keys
   */
  destroy(): void {
    if (this.hdKey?.privateKey) {
      this.hdKey.privateKey.fill(0);
    }
    this.hdKey = null;
    this.mnemonic = null;
  }
}
