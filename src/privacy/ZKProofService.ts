/**
 * Zero-Knowledge Proof Service
 * Real zk-SNARK proof generation using Circom circuits
 * 
 * Features:
 * - Groth16 proof generation
 * - Range proofs for private amounts
 * - Commitment schemes (Pedersen)
 * - Nullifier generation
 * - Proof verification
 */

import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import * as logger from '../utils/logger';

export interface PrivateTransactionInputs {
  // Sender's secret
  senderSecret: string;
  
  // Transaction details
  amount: string;
  recipient: string;
  
  // Nullifier for double-spend prevention
  nullifier: string;
  
  // Commitment randomness
  randomness: string;
}

export interface ZKProof {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

export interface CommitmentData {
  commitment: string;
  nullifier: string;
  randomness: string;
}

/**
 * Zero-Knowledge Proof Service for Private Transactions
 */
export class ZKProofService {
  private static instance: ZKProofService;
  private poseidon: any = null;
  
  private constructor() {}
  
  public static getInstance(): ZKProofService {
    if (!ZKProofService.instance) {
      ZKProofService.instance = new ZKProofService();
    }
    return ZKProofService.instance;
  }
  
  /**
   * Initialize Poseidon hash function
   */
  private async initializePoseidon() {
    if (!this.poseidon) {
      this.poseidon = await buildPoseidon();
      logger.info('✅ Poseidon hash initialized');
    }
  }
  
  /**
   * Generate Pedersen commitment
   * commitment = hash(amount, randomness)
   */
  public async generateCommitment(
    amount: string,
    randomness: string
  ): Promise<string> {
    await this.initializePoseidon();
    
    const amountBigInt = BigInt(amount);
    const randomnessBigInt = BigInt(randomness);
    
    const hash = this.poseidon([amountBigInt, randomnessBigInt]);
    const commitment = this.poseidon.F.toString(hash);
    
    logger.info(`🔐 Generated commitment: ${commitment.substring(0, 16)}...`);
    
    return commitment;
  }
  
  /**
   * Generate nullifier for double-spend prevention
   * nullifier = hash(secret, commitment)
   */
  public async generateNullifier(
    secret: string,
    commitment: string
  ): Promise<string> {
    await this.initializePoseidon();
    
    const secretBigInt = BigInt(secret);
    const commitmentBigInt = BigInt(commitment);
    
    const hash = this.poseidon([secretBigInt, commitmentBigInt]);
    const nullifier = this.poseidon.F.toString(hash);
    
    logger.info(`🔒 Generated nullifier: ${nullifier.substring(0, 16)}...`);
    
    return nullifier;
  }
  
  /**
   * Generate random field element for commitment randomness
   */
  public generateRandomness(): string {
    // Generate random 256-bit value
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    
    // Convert to BigInt
    let randomness = 0n;
    for (let i = 0; i < bytes.length; i++) {
      randomness = (randomness << 8n) | BigInt(bytes[i]);
    }
    
    return randomness.toString();
  }
  
  /**
   * Generate zk-SNARK proof for confidential transfer
   * 
   * Proves:
   * 1. Sender knows secret for input commitment
   * 2. Amount is in valid range (0 to max)
   * 3. Nullifier is correctly computed
   * 4. Output commitment is correctly formed
   */
  public async generateConfidentialTransferProof(
    inputs: PrivateTransactionInputs,
    wasmPath: string,
    zkeyPath: string
  ): Promise<ZKProof> {
    logger.info('🔐 Generating zk-SNARK proof for confidential transfer...');
    
    try {
      // Prepare circuit inputs
      const circuitInputs = {
        secret: inputs.senderSecret,
        amount: inputs.amount,
        recipient: inputs.recipient,
        nullifier: inputs.nullifier,
        randomness: inputs.randomness,
      };
      
      logger.info('📝 Circuit inputs prepared');
      logger.info(`   Amount: ${inputs.amount}`);
      logger.info(`   Recipient: ${inputs.recipient.substring(0, 16)}...`);
      
      // Generate witness
      logger.info('⚙️ Generating witness...');
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        wasmPath,
        zkeyPath
      );
      
      logger.info('✅ Proof generated successfully!');
      logger.info(`   Public signals: ${publicSignals.length}`);
      logger.info(`   Proof size: ~${JSON.stringify(proof).length} bytes`);
      
      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      logger.error('❌ Failed to generate proof:', error);
      throw error;
    }
  }
  
  /**
   * Verify zk-SNARK proof
   */
  public async verifyProof(
    proof: ZKProof,
    vkeyPath: string
  ): Promise<boolean> {
    logger.info('🔍 Verifying zk-SNARK proof...');
    
    try {
      // Load verification key
      const vkey = require(vkeyPath);
      
      // Verify proof
      const isValid = await groth16.verify(
        vkey,
        proof.publicSignals,
        proof.proof
      );
      
      if (isValid) {
        logger.info('✅ Proof is VALID');
      } else {
        logger.error('❌ Proof is INVALID');
      }
      
      return isValid;
    } catch (error) {
      logger.error('❌ Proof verification failed:', error);
      return false;
    }
  }
  
  /**
   * Generate range proof
   * Proves that amount is in range [0, 2^n - 1] without revealing amount
   */
  public async generateRangeProof(
    amount: string,
    bitLength: number,
    wasmPath: string,
    zkeyPath: string
  ): Promise<ZKProof> {
    logger.info(`🔐 Generating range proof for ${bitLength}-bit value...`);
    
    try {
      const amountBigInt = BigInt(amount);
      const maxValue = (1n << BigInt(bitLength)) - 1n;
      
      if (amountBigInt < 0n || amountBigInt > maxValue) {
        throw new Error(`Amount ${amount} is out of range [0, ${maxValue}]`);
      }
      
      // Convert amount to bit array
      const bits: number[] = [];
      for (let i = 0; i < bitLength; i++) {
        bits.push(Number((amountBigInt >> BigInt(i)) & 1n));
      }
      
      const circuitInputs = {
        amount: amount,
        bits: bits,
      };
      
      logger.info('⚙️ Generating range proof witness...');
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        wasmPath,
        zkeyPath
      );
      
      logger.info('✅ Range proof generated!');
      
      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      logger.error('❌ Range proof generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Create shielded transaction data
   * Returns commitment and nullifier for Zcash-style transaction
   */
  public async createShieldedTransaction(
    amount: string,
    secret: string
  ): Promise<CommitmentData> {
    logger.info('🛡️ Creating shielded transaction data...');
    
    // Generate randomness
    const randomness = this.generateRandomness();
    
    // Generate commitment
    const commitment = await this.generateCommitment(amount, randomness);
    
    // Generate nullifier
    const nullifier = await this.generateNullifier(secret, commitment);
    
    logger.info('✅ Shielded transaction data created');
    logger.info(`   Commitment: ${commitment.substring(0, 16)}...`);
    logger.info(`   Nullifier: ${nullifier.substring(0, 16)}...`);
    
    return {
      commitment,
      nullifier,
      randomness,
    };
  }
  
  /**
   * Generate Merkle tree proof for membership
   * Proves that a commitment exists in the Merkle tree
   */
  public async generateMerkleProof(
    leaf: string,
    pathElements: string[],
    pathIndices: number[],
    wasmPath: string,
    zkeyPath: string
  ): Promise<ZKProof> {
    logger.info('🌳 Generating Merkle tree membership proof...');
    
    try {
      const circuitInputs = {
        leaf: leaf,
        pathElements: pathElements,
        pathIndices: pathIndices,
      };
      
      logger.info(`   Tree depth: ${pathElements.length}`);
      
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        wasmPath,
        zkeyPath
      );
      
      logger.info('✅ Merkle proof generated!');
      logger.info(`   Root: ${publicSignals[0]}`);
      
      return {
        proof,
        publicSignals,
      };
    } catch (error) {
      logger.error('❌ Merkle proof generation failed:', error);
      throw error;
    }
  }
  
  /**
   * Hash using Poseidon (ZK-friendly hash)
   */
  public async poseidonHash(inputs: string[]): Promise<string> {
    await this.initializePoseidon();
    
    const inputsBigInt = inputs.map(i => BigInt(i));
    const hash = this.poseidon(inputsBigInt);
    
    return this.poseidon.F.toString(hash);
  }
  
  /**
   * Export proof as JSON for on-chain verification
   */
  public exportProofForContract(proof: ZKProof): string {
    return JSON.stringify({
      a: proof.proof.pi_a.slice(0, 2),
      b: [
        proof.proof.pi_b[0].slice(0, 2).reverse(),
        proof.proof.pi_b[1].slice(0, 2).reverse(),
      ],
      c: proof.proof.pi_c.slice(0, 2),
      publicSignals: proof.publicSignals,
    });
  }
}

export default ZKProofService.getInstance();
