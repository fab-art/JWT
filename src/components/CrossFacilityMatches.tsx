/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Typography, Tabs, Tab, Chip, LinearProgress, Box
} from "@mui/material";
import { Search, ShieldAlert, CheckCircle, HelpCircle, FileHeart } from "lucide-react";
import { MatchCategory, MatchResult } from "../types";

interface CrossFacilityMatchesProps {
  token: string;
}

export default function CrossFacilityMatches({ token }: CrossFacilityMatchesProps) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/cross-facility-matches", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryChip = (category: MatchCategory) => {
    switch (category) {
      case MatchCategory.MATCHED:
        return <Chip label="Matched" size="small" className="bg-[#0c1a10] text-[#76df8b] border border-[#1b3d22] font-semibold text-[10px] uppercase tracking-wider rounded" />;
      case MatchCategory.UNLINKED:
        return <Chip label="Unlinked Visit" size="small" className="bg-[#1a140c] text-[#dfa61c] border border-[#3d2f1b] font-semibold text-[10px] uppercase tracking-wider rounded" />;
      case MatchCategory.NO_RECORD:
      default:
        return <Chip label="No Record" size="small" className="bg-[#1a0c0c] text-[#ff6b6b] border border-[#4a1c1c] font-semibold text-[10px] uppercase tracking-wider rounded animate-pulse" />;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return "primary"; // Orange/primary in our theme
    if (score >= 0.5) return "warning"; // Amber
    return "error"; // Red
  };

  const filteredMatches = matches.filter(m => {
    // 1. Tab filters
    if (activeTab === 1 && m.category !== MatchCategory.MATCHED) return false;
    if (activeTab === 2 && m.category !== MatchCategory.UNLINKED) return false;
    if (activeTab === 3 && m.category !== MatchCategory.NO_RECORD) return false;

    // 2. Search query filter
    const search = searchQuery.toLowerCase();
    return (
      m.patientName.toLowerCase().includes(search) ||
      m.ramaNumber.toLowerCase().includes(search) ||
      m.medicineName.toLowerCase().includes(search) ||
      m.voucherFacility.toLowerCase().includes(search) ||
      (m.matchedRecordFacility && m.matchedRecordFacility.toLowerCase().includes(search))
    );
  });

  // Calculate Verification Stats
  const total = matches.length;
  const matchedCount = matches.filter(m => m.category === MatchCategory.MATCHED).length;
  const unlinkedCount = matches.filter(m => m.category === MatchCategory.UNLINKED).length;
  const noRecordCount = matches.filter(m => m.category === MatchCategory.NO_RECORD).length;

  if (loading) {
    return (
      <Box className="flex flex-col items-center justify-center py-20 text-[#F27D26] gap-3">
        <CircularProgress color="inherit" />
        <Typography variant="body2" className="font-semibold text-[#888]">
          Comparing voucher logs with clinical logs...
        </Typography>
      </Box>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <Typography variant="h5" className="font-serif italic text-white tracking-wider">
            Cross-Facility Verification
          </Typography>
          <Typography variant="caption" className="text-[#555] uppercase tracking-widest text-[9px] mt-0.5 block">
            Cross-referencing insurance pharmacy redemptions with clinical hospital consultation records
          </Typography>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#555]">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search by patient, drug, pharmacy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-[#1a1a1a] rounded bg-[#111] text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#F27D26]/60 transition-colors"
          />
        </div>
      </div>

      {/* Mini bento cards for verification metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Paper elevation={0} className="p-5 border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#666] uppercase tracking-widest font-semibold block">Verified Matches</span>
            <Typography variant="h4" className="font-serif text-2xl text-[#76df8b] tracking-tight my-1">
              {matchedCount} <span className="text-xs font-sans font-normal text-[#555]">claims</span>
            </Typography>
            <span className="text-[10px] text-[#555] font-mono italic">
              {total > 0 ? ((matchedCount / total) * 100).toFixed(0) : 0}% Legitimacy Verified
            </span>
          </div>
          <div className="p-2.5 bg-[#0c1a10] text-[#76df8b] border border-[#1b3d22] rounded">
            <CheckCircle size={20} />
          </div>
        </Paper>

        <Paper elevation={0} className="p-5 border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#666] uppercase tracking-widest font-semibold block">Unlinked Visits</span>
            <Typography variant="h4" className="font-serif text-2xl text-[#dfa61c] tracking-tight my-1">
              {unlinkedCount} <span className="text-xs font-sans font-normal text-[#555]">claims</span>
            </Typography>
            <span className="text-[10px] text-[#555] font-mono italic">
              {total > 0 ? ((unlinkedCount / total) * 100).toFixed(0) : 0}% Mismatched Dates/Sites
            </span>
          </div>
          <div className="p-2.5 bg-[#1a140c] text-[#dfa61c] border border-[#3d2f1b] rounded">
            <HelpCircle size={20} />
          </div>
        </Paper>

        <Paper elevation={0} className="p-5 border border-[#1a1a1a] bg-[#0a0a0a] rounded-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#666] uppercase tracking-widest font-semibold block">Ghost Claims</span>
            <Typography variant="h4" className="font-serif text-2xl text-[#ff6b6b] tracking-tight my-1">
              {noRecordCount} <span className="text-xs font-sans font-normal text-[#555]">claims</span>
            </Typography>
            <span className="text-[10px] text-rose-500/80 font-mono italic">
              {total > 0 ? ((noRecordCount / total) * 100).toFixed(0) : 0}% Suspicious (No Encounter)
            </span>
          </div>
          <div className="p-2.5 bg-[#1a0c0c] text-[#ff6b6b] border border-[#4a1c1c] rounded">
            <ShieldAlert size={20} />
          </div>
        </Paper>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, val) => setActiveTab(val)}
        className="border-b border-[#1a1a1a] mb-6"
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab label={`All Matches (${matches.length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px]" />
        <Tab label={`Matched (${matchedCount})`} className="font-semibold text-xs tracking-wider uppercase text-[10px] text-[#76df8b]" />
        <Tab label={`Unlinked Consultation (${unlinkedCount})`} className="font-semibold text-xs tracking-wider uppercase text-[10px] text-[#dfa61c]" />
        <Tab label={`Ghost Claims (${noRecordCount})`} className="font-semibold text-xs tracking-wider uppercase text-[10px] text-[#ff6b6b]" />
      </Tabs>

      {/* Cross-Facility Table */}
      <TableContainer component={Paper} elevation={0} className="border border-[#1a1a1a] rounded-sm overflow-hidden bg-[#0a0a0a]">
        <Table>
          <TableHead className="bg-[#0e0e0e]">
            <TableRow>
              <TableCell className="font-semibold text-[#888]">Patient & RAMA</TableCell>
              <TableCell className="font-semibold text-[#888]">Pharmacy Claim (Voucher)</TableCell>
              <TableCell className="font-semibold text-[#888]">Clinical Hospital Record</TableCell>
              <TableCell className="font-semibold text-[#888]">Match Accuracy</TableCell>
              <TableCell className="font-semibold text-[#888]">Verification Outcome</TableCell>
              <TableCell className="font-semibold text-[#888]">Forensic Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" className="py-12 text-[#555] font-serif italic text-sm">
                  No cross-facility records matching filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredMatches.map((m, idx) => (
                <TableRow 
                  key={idx} 
                  hover 
                  className={`border-b border-[#1a1a1a] transition-colors hover:bg-[#0d0d0d] ${
                    m.category === MatchCategory.NO_RECORD ? "bg-[#1a0c0c]/10 border-l-2 border-[#ff6b6b]" : ""
                  }`}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#e0e0e0]">{m.patientName}</span>
                      <span className="text-[10px] text-[#555] font-mono">{m.ramaNumber || "NO INSURANCE"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col text-xs space-y-0.5">
                      <span className="font-semibold text-[#e0e0e0]">{m.medicineName}</span>
                      <span className="text-[#888] text-[11px]">Site: {m.voucherFacility}</span>
                      <span className="text-[#555] font-mono text-[10px]">Date: {m.voucherDate}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.category !== MatchCategory.NO_RECORD && m.matchedRecordFacility ? (
                      <div className="flex flex-col text-xs space-y-0.5">
                        <span className="font-semibold text-[#82b1ff] flex items-center gap-1">
                          <FileHeart size={12} />
                          <span>Hospital Visit Validated</span>
                        </span>
                        <span className="text-[#888] text-[11px]">Site: {m.matchedRecordFacility}</span>
                        <span className="text-[#555] font-mono text-[10px]">Date: {m.matchedRecordDate}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#ff6b6b] font-bold flex items-center gap-1">
                        <ShieldAlert size={12} />
                        <span>No consultation record found</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col w-24">
                      <span className="text-[10px] font-semibold text-[#888] font-mono mb-1">
                        {Math.round(m.confidenceScore * 100)}% Match
                      </span>
                      <LinearProgress
                        variant="determinate"
                        value={m.confidenceScore * 100}
                        color={getConfidenceColor(m.confidenceScore)}
                        className="h-1 rounded-sm bg-[#111]"
                      />
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryChip(m.category)}</TableCell>
                  <TableCell className="text-xs text-[#888] max-w-xs font-medium leading-relaxed font-sans">
                    {m.matchDetails}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

// Inline circular progress mock for safety in imports
function CircularProgress(props: any) {
  return (
    <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${props.size === 12 ? 'h-3 w-3' : 'h-8 w-8'}`} />
  );
}

