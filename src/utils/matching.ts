/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VoucherEntity, FacilityRecordEntity } from "../db/entities";
import { MatchCategory, MatchResult } from "../types";
import { jaroWinklerDistance } from "./cleaning";

/**
 * Calculates date proximity score based on the days difference:
 * - 0 days apart (same day): 1.0
 * - 1 day apart: 0.8
 * - 2 days apart: 0.5
 * - 3 days apart: 0.2
 * - >3 days apart: 0.0
 */
export function calculateDateProximityScore(date1: string, date2: string): { score: number; daysApart: number } {
  if (!date1 || !date2) return { score: 0, daysApart: 999 };
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const daysApart = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let score = 0;
  if (daysApart === 0) score = 1.0;
  else if (daysApart === 1) score = 0.8;
  else if (daysApart === 2) score = 0.5;
  else if (daysApart === 3) score = 0.2;
  
  return { score, daysApart };
}

/**
 * Performs Cross-Facility Verification between a Pharmacy Voucher and hospital logs.
 * Correlates data using both RAMA insurance numbers and patient name similarity.
 */
export function matchVoucherToRecords(
  voucher: VoucherEntity,
  facilityRecords: FacilityRecordEntity[],
  daysWindow: number = 3
): MatchResult {
  let bestCandidate: FacilityRecordEntity | null = null;
  let bestScore = 0;
  let bestDaysApart = 999;
  let matchDetails = "No record found in hospital facility dataset.";

  // 1. Search candidate records by identical RAMA ID or high name similarity
  const candidates = facilityRecords.filter(rec => {
    // Exact RAMA match
    if (voucher.ramaNumberNormalized && rec.ramaNumberNormalized && voucher.ramaNumberNormalized === rec.ramaNumberNormalized) {
      return true;
    }
    // High name similarity fallback (in case RAMA is typed wrong or missing)
    const nameSim = jaroWinklerDistance(voucher.patientNameNormalized, rec.patientNameNormalized);
    return nameSim >= 0.85;
  });

  // 2. Evaluate each candidate
  for (const rec of candidates) {
    const nameSim = jaroWinklerDistance(voucher.patientNameNormalized, rec.patientNameNormalized);
    const { score: dateScore, daysApart } = calculateDateProximityScore(voucher.date, rec.date);
    
    // Confidence formula: 40% Name Similarity + 60% Date Proximity
    const confidence = 0.40 * nameSim + 0.60 * dateScore;

    if (confidence > bestScore) {
      bestScore = confidence;
      bestCandidate = rec;
      bestDaysApart = daysApart;
    }
  }

  // 3. Classify matches based on best candidate scores
  let category = MatchCategory.NO_RECORD;
  if (bestCandidate) {
    const exactRama = voucher.ramaNumberNormalized === bestCandidate.ramaNumberNormalized;
    
    if (bestScore >= 0.75 && bestDaysApart <= daysWindow) {
      category = MatchCategory.MATCHED;
      matchDetails = `Verified match found at ${bestCandidate.facilityName} on ${bestCandidate.date} (${bestDaysApart} days apart). Confidence: ${Math.round(bestScore * 100)}%. ${exactRama ? "Exact RAMA match." : "Matched by name similarity."}`;
    } else {
      category = MatchCategory.UNLINKED;
      matchDetails = `Patient found in system, but visit dates or facilities do not align. Best match was at ${bestCandidate.facilityName} on ${bestCandidate.date} (${bestDaysApart} days apart). Confidence: ${Math.round(bestScore * 100)}%.`;
    }
  }

  return {
    voucherId: voucher.id,
    patientName: voucher.patientName,
    ramaNumber: voucher.ramaNumber,
    voucherDate: voucher.date,
    voucherFacility: voucher.facilityName,
    medicineName: voucher.medicineName,
    amount: voucher.amount,
    category,
    confidenceScore: bestScore,
    matchedRecordId: bestCandidate?.id,
    matchedRecordDate: bestCandidate?.date,
    matchedRecordFacility: bestCandidate?.facilityName,
    matchDetails
  };
}
