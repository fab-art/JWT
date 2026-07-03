/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses various string date formats (e.g., DD/MM/YYYY, MM-DD-YYYY, YYYY/MM/DD, Excel serials)
 * and returns a standardized YYYY-MM-DD format.
 */
export function normalizeDate(dateVal: any): string {
  if (!dateVal) return "";
  
  // If it's already a JS Date object
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split("T")[0];
  }

  // If it's a number (Excel date serial)
  if (typeof dateVal === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + dateVal * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  }

  const str = String(dateVal).trim();
  if (!str) return "";

  // Try split by slash or dash
  const parts = str.split(/[-/.\s]+/);
  if (parts.length === 3) {
    let year = 0;
    let month = 0;
    let day = 0;

    // Detect format based on digit counts
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY or MM-DD-YYYY. Let's assume DD-MM-YYYY for normal international standards, 
      // but if month > 12, swap them.
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);

      if (p1 > 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12) {
        day = p2;
        month = p1;
      } else {
        // Default DD-MM-YYYY
        day = p1;
        month = p2;
      }
    } else {
      // YY-MM-DD or DD-MM-YY
      let p1 = parseInt(parts[0], 10);
      let p2 = parseInt(parts[1], 10);
      let p3 = parseInt(parts[2], 10);
      
      if (p1 > 50) {
        year = 1900 + p1;
        month = p2;
        day = p3;
      } else if (p3 > 50) {
        year = 1900 + p3;
        day = p1;
        month = p2;
      } else {
        year = 2000 + (p3 < 50 ? p3 : p1);
        month = p2;
        day = p3 < 50 ? p1 : p3;
      }
    }

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      // Fallback
      const parsed = Date.parse(str);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString().split("T")[0];
      }
      return "";
    }

    // Zero-pad
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  // Final fallback to JS Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split("T")[0];
  }

  return "";
}

/**
 * Cleans numeric values, stripping currency characters, commas, spaces, etc.
 */
export function normalizeNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  
  const cleanStr = String(val)
    .replace(/[RWF$€, \s]+/gi, "") // Remove currency symbols, commas, and spaces
    .trim();
  
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

/**
 * RAMA Insurance ID normalizer. Removes:
 * - "RW/", "RSSB/" prefixes
 * - leading zeros
 * - spaces, hyphens, non-alphanumeric chars
 * E.g., "RW/001234" -> "1234", "RSSB/5432-1" -> "54321"
 */
export function normalizeRama(rama: any): string {
  if (!rama) return "";
  const str = String(rama).toUpperCase();
  
  const clean = str
    .replace(/^(RW\/|RSSB\/)/g, "") // strip leading prefixes
    .replace(/[^A-Z0-9]/g, "")     // strip any symbols
    .replace(/^0+/, "")            // strip leading zeros
    .trim();

  return clean;
}

/**
 * Cleans and standardizes names (lowercasing, stripping extra whitespace/hyphens)
 */
export function cleanNameString(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_.]+/g, " ")
    .trim();
}

/**
 * Computes Jaro-Winkler string similarity distance.
 * Returns a score between 0 (completely different) and 1 (identical).
 */
export function jaroWinklerDistance(s1: string, s2: string): number {
  const m1 = cleanNameString(s1);
  const m2 = cleanNameString(s2);

  if (m1 === m2) return 1.0;
  if (m1.length === 0 || m2.length === 0) return 0.0;

  const len1 = m1.length;
  const len2 = m2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matchWindowBound = Math.max(0, matchWindow);

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindowBound);
    const end = Math.min(len2 - 1, i + matchWindowBound);
    for (let j = start; j <= end; j++) {
      if (s2Matches[j]) continue;
      if (m1[i] === m2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (m1[i] !== m2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Winkler scaling for common prefix (up to 4 chars)
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(len1, len2));
  for (let i = 0; i < maxPrefix; i++) {
    if (m1[i] === m2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return jaro + prefix * 0.1 * (1.0 - jaro);
}

/**
 * Group of name patterns for automatic mapping.
 */
export const COLUMN_REGEX_MAP = {
  patientName: /patient|name|beneficiary|full\s*name|client|beneficiaire|nom/i,
  ramaNumber: /rama|insurance|card|policy|affil|id\s*num|carte|numero|affilie|member/i,
  date: /date|visit|presc|consultation|day|ordonnance|creation/i,
  medicineName: /medicine|drug|medication|item|product|desc|atc|medicament|article/i,
  quantity: /qty|quantity|count|unit|vol|quantite|nbre/i,
  amount: /amount|cost|price|claim|total|val|copay|ticket|modificateur|valeur|montant/i,
  doctorName: /doctor|prescriber|practitioner|md|physician|dr|medecin|prescripteur/i,
  facilityName: /facility|hospital|pharmacy|dispensary|clinic|site|hopital|centre|officine/i,
  service: /service|dept|department|ward|diagnosis|consultation|acte/i
};

/**
 * Intelligent Column Mapping Engine. Analyzes headers in spreadsheet
 * and returns matched key mappings to standard properties.
 */
export function mapColumns(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, regex] of Object.entries(COLUMN_REGEX_MAP)) {
    const matchedHeader = headers.find(h => regex.test(h));
    if (matchedHeader) {
      result[key] = matchedHeader;
    }
  }

  return result;
}

/**
 * Clustered Name Solver. Groups name variants (doctors/patients)
 * together and maps each unique name to its single "canonical" spelling.
 */
export class IdentityResolver {
  private canonicalMap: Map<string, string> = new Map();
  private nameFrequencies: Map<string, number> = new Map();

  constructor(names: string[]) {
    // 1. Calculate name frequencies to prefer more fully specified / common spellings
    for (const name of names) {
      if (!name) continue;
      const normalized = name.trim();
      this.nameFrequencies.set(normalized, (this.nameFrequencies.get(normalized) || 0) + 1);
    }

    // 2. Perform clustering on unique names
    const uniqueNames = Array.from(this.nameFrequencies.keys()).sort((a, b) => b.length - a.length);
    const visited = new Set<string>();

    for (const name of uniqueNames) {
      if (visited.has(name)) continue;
      
      const cluster: string[] = [name];
      visited.add(name);

      for (const otherName of uniqueNames) {
        if (visited.has(otherName)) continue;

        const score = jaroWinklerDistance(name, otherName);
        
        // Match condition: high similarity (>= 0.88)
        if (score >= 0.88) {
          cluster.push(otherName);
          visited.add(otherName);
        }
      }

      // Find the best representative in this cluster
      // Criteria: highest frequency, followed by longest length
      let canonical = cluster[0];
      let bestWeight = -1;

      for (const candidate of cluster) {
        const freq = this.nameFrequencies.get(candidate) || 1;
        const length = candidate.length;
        const weight = freq * 10 + length; // weight formula favoring frequency and completeness
        
        if (weight > bestWeight) {
          bestWeight = weight;
          canonical = candidate;
        }
      }

      // Map everything in the cluster to the canonical name
      for (const member of cluster) {
        this.canonicalMap.set(member, canonical);
      }
    }
  }

  /**
   * Resolves a name spelling to its canonical clustered identity.
   */
  public resolve(name: string): string {
    if (!name) return "";
    const trimmed = name.trim();
    return this.canonicalMap.get(trimmed) || trimmed;
  }
}
