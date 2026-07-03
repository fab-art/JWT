/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DrugReference {
  id: string;
  name: string;
  atcCode: string;
  therapeuticClass: string;
  typicalUnitCost: number;
  maxStandardQty: number; // typical maximum for single consultation
  isSpecialistOnly: boolean;
}

// Embedded sample of drug reference database (representative of WHO, RHIA Jan 2025, UCG 2023)
export const DRUG_DATABASE: Record<string, DrugReference> = {
  amoxicillin: {
    id: "AMOX",
    name: "Amoxicillin 500mg Cap",
    atcCode: "J01CA04",
    therapeuticClass: "Beta-lactam Antibacterials",
    typicalUnitCost: 150,
    maxStandardQty: 30,
    isSpecialistOnly: false
  },
  paracetamol: {
    id: "PARA",
    name: "Paracetamol 500mg Tab",
    atcCode: "N02BE01",
    therapeuticClass: "Other Analgesics and Antipyretics",
    typicalUnitCost: 20,
    maxStandardQty: 60,
    isSpecialistOnly: false
  },
  ibuprofen: {
    id: "IBU",
    name: "Ibuprofen 400mg Tab",
    atcCode: "M01AE01",
    therapeuticClass: "Anti-inflammatory and Antirheumatic Products",
    typicalUnitCost: 50,
    maxStandardQty: 30,
    isSpecialistOnly: false
  },
  metformin: {
    id: "METF",
    name: "Metformin 850mg Tab",
    atcCode: "A10BA02",
    therapeuticClass: "Blood Glucose Lowering Drugs (Oral)",
    typicalUnitCost: 80,
    maxStandardQty: 90,
    isSpecialistOnly: false
  },
  insulin_glargine: {
    id: "INSG",
    name: "Insulin Glargine 100 U/ml",
    atcCode: "A10AE04",
    therapeuticClass: "Insulins and Analogues",
    typicalUnitCost: 9500,
    maxStandardQty: 5,
    isSpecialistOnly: true
  },
  atorvastatin: {
    id: "ATOR",
    name: "Atorvastatin 20mg Tab",
    atcCode: "C10AA05",
    therapeuticClass: "Lipid Modifying Agents (Statins)",
    typicalUnitCost: 350,
    maxStandardQty: 30,
    isSpecialistOnly: false
  },
  amlodipine: {
    id: "AMLO",
    name: "Amlodipine 5mg Tab",
    atcCode: "C08CA01",
    therapeuticClass: "Calcium Channel Blockers",
    typicalUnitCost: 40,
    maxStandardQty: 30,
    isSpecialistOnly: false
  },
  salbutamol_inhaler: {
    id: "SALB",
    name: "Salbutamol 100mcg Inhaler",
    atcCode: "R03AC02",
    therapeuticClass: "Selective Beta-2-Adrenoreceptor Agonists",
    typicalUnitCost: 2500,
    maxStandardQty: 2,
    isSpecialistOnly: false
  },
  artemether_lumefantrine: {
    id: "ARTL",
    name: "Artemether + Lumefantrine 20/120 Tab",
    atcCode: "P01BF01",
    therapeuticClass: "Antimalarials",
    typicalUnitCost: 1200,
    maxStandardQty: 24,
    isSpecialistOnly: false
  },
  diclofenac: {
    id: "DICL",
    name: "Diclofenac 50mg Tab",
    atcCode: "M01AB05",
    therapeuticClass: "Anti-inflammatory and Antirheumatic Products",
    typicalUnitCost: 60,
    maxStandardQty: 30,
    isSpecialistOnly: false
  },
  omeprazole: {
    id: "OMEP",
    name: "Omeprazole 20mg Cap",
    atcCode: "A02BC01",
    therapeuticClass: "Proton Pump Inhibitors",
    typicalUnitCost: 100,
    maxStandardQty: 30,
    isSpecialistOnly: false
  },
  ceftriaxone_injection: {
    id: "CEFT",
    name: "Ceftriaxone 1g Inj",
    atcCode: "J01DD04",
    therapeuticClass: "Third-generation Cephalosporins",
    typicalUnitCost: 1500,
    maxStandardQty: 10,
    isSpecialistOnly: true
  }
};

/**
 * Searches our drug reference database using simple token matching
 * to retrieve clinical guidelines and classification details.
 */
export function getDrugReference(medicineName: string): DrugReference | null {
  const normSearch = medicineName.toLowerCase();
  
  // 1. Direct key match
  if (DRUG_DATABASE[normSearch]) {
    return DRUG_DATABASE[normSearch];
  }

  // 2. Fuzzy token sub-match
  for (const [key, ref] of Object.entries(DRUG_DATABASE)) {
    if (normSearch.includes(key) || ref.name.toLowerCase().includes(normSearch) || normSearch.includes(ref.name.toLowerCase())) {
      return ref;
    }
  }

  return null;
}

export interface ClinicalAuditResult {
  isFlagged: boolean;
  flagReason: string;
  atcCode: string;
  therapeuticClass: string;
}

/**
 * Automatically flags claims based on clinical anomalies:
 * 1. Abnormally high quantity for the drug class.
 * 2. Excessively high cost (unit cost > 3x typical reference).
 * 3. Restricted specialist medication dispensed at general/non-specialist pharmacies.
 * 4. General cost spike threshold (> 80,000 RWF).
 */
export function auditClinicalClaim(
  medicineName: string,
  quantity: number,
  amount: number,
  facilityName: string
): ClinicalAuditResult {
  const ref = getDrugReference(medicineName);
  const unitCost = quantity > 0 ? amount / quantity : amount;
  
  if (!ref) {
    // If drug not found in clinical DB, do a standard cost check
    if (amount > 80000) {
      return {
        isFlagged: true,
        flagReason: "High Value Claim Audit Trigger (> 80,000 RWF)",
        atcCode: "U000000",
        therapeuticClass: "Unclassified High Value"
      };
    }
    return {
      isFlagged: false,
      flagReason: "",
      atcCode: "U000000",
      therapeuticClass: "Unclassified"
    };
  }

  const reasons: string[] = [];

  // Check 1: Quantity anomaly
  if (quantity > ref.maxStandardQty) {
    reasons.push(`Excessive quantity (${quantity} units, standard max: ${ref.maxStandardQty})`);
  }

  // Check 2: Unit cost inflation
  if (unitCost > ref.typicalUnitCost * 3) {
    reasons.push(`Unit cost inflation (${Math.round(unitCost)} RWF vs typical ${ref.typicalUnitCost} RWF)`);
  }

  // Check 3: Specialist only drug at general clinic
  const isGeneralFacility = /health centre|dispensary|clinic|post|poste|general/i.test(facilityName);
  if (ref.isSpecialistOnly && isGeneralFacility) {
    reasons.push(`Restricted specialist-only drug dispensed at primary/general facility`);
  }

  // Check 4: General high value claim trigger
  if (amount > 80000) {
    reasons.push(`High Claim Value (> 80,000 RWF)`);
  }

  return {
    isFlagged: reasons.length > 0,
    flagReason: reasons.join("; "),
    atcCode: ref.atcCode,
    therapeuticClass: ref.therapeuticClass
  };
}
