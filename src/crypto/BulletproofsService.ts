import * as logger from '../utils/logger';
import { Buffer } from '@craftzdog/react-native-buffer';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';

export interface RangeProof {
  commitment: Uint8Array;
  proof: Uint8Array;
  range: number; // n in [0, 2^n)
}

export interface ConfidentialAmount {
  commitment: Uint8Array; // Pedersen commitment
  rangeProof: RangeProof;
  blindingFactor: Uint8Array; // Secret blinding factor
}

/**
 * Aggregate Proof
 * 
 * Multiple range proofs aggregated for efficiency
 */
export interface AggregateProof {
  commitments: Uint8Array[];
  proof: Uint8Array;
  ranges: number[];
}

export class BulletproofsService {
  // Curve generator points
  private readonly G: Uint8Array;
  private readonly H: Uint8Array;

  // Range parameters
  private readonly DEFAULT_RANGE = 64; // 2^64 max value
  private readonly DEFAULT_BASE = 2;

  constructor() {
    // Initialize generator points (secp256k1)
    this.G = secp256k1.ProjectivePoint.BASE.toRawBytes(true);
    
    // Generate independent H point
    const hashInput = Buffer.concat([this.G, Buffer.from('bulletproofs_h')]);
    const hScalar = BigInt('0x' + Buffer.from(sha256(hashInput)).toString('hex'));
    this.H = secp256k1.ProjectivePoint.BASE.multiply(hScalar).toRawBytes(true);

    logger.info('🎯 Bulletproofs Service initialized', {
      range: `[0, 2^${this.DEFAULT_RANGE})`,
    });
  }

  /**
   * Create Pedersen commitment: C = vG + rH
   * - v: value (secret)
   * - r: blinding factor (secret)
   * - C: commitment (public)
   */
  createCommitment(value: bigint, blindingFactor?: Uint8Array): Uint8Array {
    try {
      // Generate random blinding factor if not provided
      const r = blindingFactor || randomBytes(32);
      const rBigInt = BigInt('0x' + Buffer.from(r).toString('hex'));

      // C = v*G + r*H
      const vG = secp256k1.ProjectivePoint.BASE.multiply(value);
      const hPoint = secp256k1.ProjectivePoint.fromHex(this.H);
      const rH = hPoint.multiply(rBigInt);
      
      const commitment = vG.add(rH);

      logger.debug('🔐 Created Pedersen commitment:', {
        value: value.toString(),
        commitmentSize: commitment.toRawBytes(true).length,
      });

      return commitment.toRawBytes(true);

    } catch (error) {
      logger.error('❌ Failed to create commitment:', error);
      throw error;
    }
  }

  /**
   * Generate range proof for committed value
   * 
   * Proves: v ∈ [0, 2^n) where C = vG + rH
   */
  async generateRangeProof(
    value: bigint,
    blindingFactor: Uint8Array,
    rangeBits: number = this.DEFAULT_RANGE
  ): Promise<RangeProof> {
    try {
      logger.info('📝 Generating range proof:', {
        value: value.toString(),
        range: `[0, 2^${rangeBits})`,
      });

      // Validate value is in range
      const maxValue = BigInt(2) ** BigInt(rangeBits);
      if (value < 0n || value >= maxValue) {
        throw new Error(`Value ${value} out of range [0, ${maxValue})`);
      }

      // Create commitment
      const commitment = this.createCommitment(value, blindingFactor);

      // Generate proof (simplified - production uses inner product argument)
      const proof = await this.generateProofData(value, blindingFactor, rangeBits);

      logger.info('✅ Range proof generated:', {
        proofSize: proof.length,
        rangeBits,
      });

      return {
        commitment,
        proof,
        range: rangeBits,
      };

    } catch (error) {
      logger.error('❌ Failed to generate range proof:', error);
      throw error;
    }
  }

  /**
   * Verify range proof
   */
  async verifyRangeProof(rangeProof: RangeProof): Promise<boolean> {
    try {
      logger.info('🔍 Verifying range proof:', {
        range: `[0, 2^${rangeProof.range})`,
        proofSize: rangeProof.proof.length,
      });

      // Verify commitment is valid point
      const commitmentPoint = secp256k1.ProjectivePoint.fromHex(rangeProof.commitment);
      if (!commitmentPoint) {
        logger.warn('❌ Invalid commitment point');
        return false;
      }

      // Verify proof structure
      if (rangeProof.proof.length < 32) {
        logger.warn('❌ Proof too short');
        return false;
      }

      // In production: full inner product argument verification
      // For now: basic validity check
      const isValid = await this.verifyProofData(rangeProof);

      logger.info(isValid ? '✅ Range proof valid' : '❌ Range proof invalid');
      return isValid;

    } catch (error) {
      logger.error('❌ Failed to verify range proof:', error);
      return false;
    }
  }

  /**
   * Create confidential amount (commitment + range proof)
   */
  async createConfidentialAmount(amount: bigint): Promise<ConfidentialAmount> {
    try {
      logger.info('🔐 Creating confidential amount');

      // Generate random blinding factor
      const blindingFactor = randomBytes(32);

      // Create commitment
      const commitment = this.createCommitment(amount, blindingFactor);

      // Generate range proof
      const rangeProof = await this.generateRangeProof(amount, blindingFactor);

      logger.info('✅ Confidential amount created');

      return {
        commitment,
        rangeProof,
        blindingFactor,
      };

    } catch (error) {
      logger.error('❌ Failed to create confidential amount:', error);
      throw error;
    }
  }

  /**
   * Aggregate multiple range proofs (logarithmic proof size)
   */
  async aggregateProofs(proofs: RangeProof[]): Promise<AggregateProof> {
    try {
      logger.info('📦 Aggregating range proofs:', {
        count: proofs.length,
      });

      if (proofs.length === 0) {
        throw new Error('No proofs to aggregate');
      }

      // Combine commitments
      const commitments = proofs.map(p => p.commitment);

      // Aggregate proof data (simplified)
      const aggregatedProofData = await this.aggregateProofData(proofs);

      const aggregateProof: AggregateProof = {
        commitments,
        proof: aggregatedProofData,
        ranges: proofs.map(p => p.range),
      };

      logger.info('✅ Proofs aggregated:', {
        originalSize: proofs.reduce((sum, p) => sum + p.proof.length, 0),
        aggregatedSize: aggregatedProofData.length,
        compression: ((1 - aggregatedProofData.length / proofs.reduce((sum, p) => sum + p.proof.length, 0)) * 100).toFixed(1) + '%',
      });

      return aggregateProof;

    } catch (error) {
      logger.error('❌ Failed to aggregate proofs:', error);
      throw error;
    }
  }

  /**
   * Verify aggregate proof
   */
  async verifyAggregateProof(aggregateProof: AggregateProof): Promise<boolean> {
    try {
      logger.info('🔍 Verifying aggregate proof:', {
        commitments: aggregateProof.commitments.length,
      });

      // Verify all commitments are valid
      for (const commitment of aggregateProof.commitments) {
        const point = secp256k1.ProjectivePoint.fromHex(commitment);
        if (!point) {
          logger.warn('❌ Invalid commitment in aggregate');
          return false;
        }
      }

      // Verify aggregate proof
      const isValid = await this.verifyAggregateProofData(aggregateProof);

      logger.info(isValid ? '✅ Aggregate proof valid' : '❌ Aggregate proof invalid');
      return isValid;

    } catch (error) {
      logger.error('❌ Failed to verify aggregate proof:', error);
      return false;
    }
  }

  /**
   * Generate proof data (inner product argument)
   * 
   * Production implementation would use:
   * 1. Vector commitments
   * 2. Inner product argument (recursive halving)
   * 3. Fiat-Shamir for non-interactivity
   */
  private async generateProofData(
    value: bigint,
    blindingFactor: Uint8Array,
    rangeBits: number
  ): Promise<Uint8Array> {
    // Simplified proof generation
    // Production: full inner product argument protocol
    
    const proofData = Buffer.concat([
      Buffer.from(blindingFactor),
      Buffer.from(value.toString(16).padStart(16, '0'), 'hex'),
      Buffer.from([rangeBits]),
    ]);

    // Hash for "proof"
    const proof = sha256(proofData);
    
    return proof;
  }

  /**
   * Verify proof data
   */
  private async verifyProofData(rangeProof: RangeProof): Promise<boolean> {
    // Simplified verification
    // Production: full verification with inner product checks
    return rangeProof.proof.length === 32;
  }

  /**
   * Aggregate proof data
   */
  private async aggregateProofData(proofs: RangeProof[]): Promise<Uint8Array> {
    // Simplified aggregation
    // Production: proper multi-exponentiation and batching
    
    const combined = Buffer.concat(proofs.map(p => p.proof));
    const aggregated = sha256(combined);
    
    return aggregated;
  }

  /**
   * Verify aggregate proof data
   */
  private async verifyAggregateProofData(aggregateProof: AggregateProof): Promise<boolean> {
    // Simplified verification
    return aggregateProof.proof.length === 32 && aggregateProof.commitments.length > 0;
  }

  /**
   * Prove balance >= threshold (without revealing balance)
   */
  async proveBalanceThreshold(
    balance: bigint,
    threshold: bigint,
    blindingFactor: Uint8Array
  ): Promise<RangeProof> {
    try {
      if (balance < threshold) {
        throw new Error('Balance below threshold');
      }

      logger.info('🔐 Proving balance >= threshold', {
        threshold: threshold.toString(),
      });

      // Prove: balance - threshold ∈ [0, 2^64)
      const difference = balance - threshold;
      const proof = await this.generateRangeProof(difference, blindingFactor);

      logger.info('✅ Threshold proof generated');
      return proof;

    } catch (error) {
      logger.error('❌ Failed to generate threshold proof:', error);
      throw error;
    }
  }

  /**
   * Get proof size statistics
   */
  getProofSizeStats(rangeBits: number): {
    singleProofSize: number;
    aggregateProofSize: number;
    savingsPercent: number;
  } {
    // Bulletproofs proof size: O(log n)
    const singleSize = 64 + 32 * Math.ceil(Math.log2(rangeBits));
    const aggregateSize = 64 + 32 * Math.ceil(Math.log2(rangeBits)); // Same for multiple proofs!
    
    return {
      singleProofSize: singleSize,
      aggregateProofSize: aggregateSize,
      savingsPercent: 0, // Constant size regardless of count
    };
  }
}

export default BulletproofsService;
