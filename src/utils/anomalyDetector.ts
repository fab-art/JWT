/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VoucherEntity, FacilityRecordEntity } from "../db/entities.js";

export interface MLPredictionResult {
  score: number;
  isAnomaly: boolean;
  reasons: string[];
}

export class PharmaMLAnomalyDetector {
  private meanAmount = 0;
  private stdDevAmount = 1;
  private meanQuantity = 0;
  private stdDevQuantity = 1;
  private maxAmount = 1;
  private maxQuantity = 1;

  constructor() {}

  /**
   * Trains the model on historical data to learn normal statistics
   */
  public train(vouchers: VoucherEntity[]) {
    if (vouchers.length === 0) return;

    const amounts = vouchers.map(v => v.amount);
    const quantities = vouchers.map(v => v.quantity);

    this.maxAmount = Math.max(...amounts, 1);
    this.maxQuantity = Math.max(...quantities, 1);

    // Calculate mean amount
    const sumAmount = amounts.reduce((sum, val) => sum + val, 0);
    this.meanAmount = sumAmount / vouchers.length;

    // Calculate std dev amount
    const varianceAmount = amounts.reduce((sum, val) => sum + Math.pow(val - this.meanAmount, 2), 0) / vouchers.length;
    this.stdDevAmount = Math.sqrt(varianceAmount) || 1;

    // Calculate mean quantity
    const sumQuantity = quantities.reduce((sum, val) => sum + val, 0);
    this.meanQuantity = sumQuantity / vouchers.length;

    // Calculate std dev quantity
    const varianceQuantity = quantities.reduce((sum, val) => sum + Math.pow(val - this.meanQuantity, 2), 0) / vouchers.length;
    this.stdDevQuantity = Math.sqrt(varianceQuantity) || 1;

    console.log(`[ML Detector] Trained on ${vouchers.length} records. Amount Mean: ${this.meanAmount.toFixed(1)}, StdDev: ${this.stdDevAmount.toFixed(1)}`);
  }

  /**
   * Evaluates a claim based on multidimensional features
   */
  public predict(voucher: VoucherEntity, allPatientVouchers: VoucherEntity[]): MLPredictionResult {
    const reasons: string[] = [];
    
    // 1. Amount Anomaly Score (Z-Score)
    const amountZ = (voucher.amount - this.meanAmount) / this.stdDevAmount;
    const amountScore = Math.min(1.0, Math.max(0.0, amountZ / 3.0)); // Scale to 0-1, capping at Z=3
    if (amountZ > 2.0) {
      reasons.push(`High cost outlier (Amount RWF ${voucher.amount.toLocaleString()}, Z-score: +${amountZ.toFixed(1)})`);
    }

    // 2. Quantity Anomaly Score (Z-Score)
    const quantityZ = (voucher.quantity - this.meanQuantity) / this.stdDevQuantity;
    const quantityScore = Math.min(1.0, Math.max(0.0, quantityZ / 3.0));
    if (quantityZ > 2.0) {
      reasons.push(`Abnormal dispense volume (${voucher.quantity} units, Z-score: +${quantityZ.toFixed(1)})`);
    }

    // 3. Network Shopping Behavior (Doctor & Pharmacy counts in a 15-day window)
    const activeDate = new Date(voucher.date);
    const windowClaims = allPatientVouchers.filter(v => {
      const vDate = new Date(v.date);
      const diffDays = Math.abs(vDate.getTime() - activeDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 15;
    });

    const uniqueDoctors = new Set(windowClaims.map(v => v.doctorNameNormalized)).size;
    const uniqueFacilities = new Set(windowClaims.map(v => v.facilityName.toLowerCase())).size;

    let shoppingScore = 0.0;
    if (uniqueDoctors > 1) {
      shoppingScore += 0.5;
      reasons.push(`Prescriber Multiplicity (${uniqueDoctors} unique physicians visited in 15 days)`);
    }
    if (uniqueFacilities > 1) {
      shoppingScore += 0.5;
      reasons.push(`Pharmacy Shopping (${uniqueFacilities} different pharmacies used in 15 days)`);
    }

    // 4. Clinical Audit Overlap
    const ruleOverlapScore = voucher.isFlagged ? 1.0 : 0.0;
    if (voucher.isFlagged) {
      reasons.push(`Corroborating clinical audit flag: "${voucher.flagReason}"`);
    }

    // Weighted fusion formula
    // W_amount = 0.2, W_quantity = 0.2, W_shopping = 0.4, W_rule = 0.2
    const score = (amountScore * 0.2) + (quantityScore * 0.2) + (shoppingScore * 0.4) + (ruleOverlapScore * 0.2);

    const isAnomaly = score >= 0.60;

    return {
      score: Math.min(0.99, Math.max(0.05, score)),
      isAnomaly,
      reasons: reasons.length > 0 ? reasons : ["Normal baseline usage pattern"]
    };
  }
}
