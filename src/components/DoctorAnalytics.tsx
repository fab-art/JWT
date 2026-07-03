/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Typography, LinearProgress, Box
} from "@mui/material";
import { Stethoscope, AlertTriangle } from "lucide-react";

interface DoctorStat {
  name: string;
  claimsCount: number;
  totalCost: number;
  flaggedCount: number;
  flagRate: number;
  uniqueDrugsCount: number;
  uniquePatientsCount: number;
}

interface DoctorAnalyticsProps {
  token: string;
}

export default function DoctorAnalytics({ token }: DoctorAnalyticsProps) {
  const [stats, setStats] = useState<DoctorStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/doctor-analytics", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRateColor = (rate: number) => {
    if (rate >= 50) return "error"; // High risk
    if (rate >= 20) return "warning"; // Medium risk
    return "primary"; // Low risk
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#F27D26]">
        <Stethoscope className="animate-spin h-8 w-8" />
        <span className="text-xs font-semibold text-[#888]">Compiling prescriber analytics...</span>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-6">
        <Typography variant="h5" className="font-serif italic text-white tracking-wider">
          Prescriber Analytics
        </Typography>
        <Typography variant="caption" className="text-[#555] uppercase tracking-widest text-[9px] mt-0.5 block">
          Ranks and analyzes medical practitioners based on volume, cost, unique therapeutics, and clinical audit flag rates.
        </Typography>
      </div>

      <TableContainer component={Paper} elevation={0} className="border border-[#1a1a1a] rounded-sm overflow-hidden bg-[#0a0a0a]">
        <Table>
          <TableHead className="bg-[#0e0e0e]">
            <TableRow>
              <TableCell className="font-semibold text-[#888]">Prescribing Physician</TableCell>
              <TableCell className="font-semibold text-[#888] text-right">Claims Count</TableCell>
              <TableCell className="font-semibold text-[#888] text-right">Unique Patients</TableCell>
              <TableCell className="font-semibold text-[#888] text-right">Unique Drugs</TableCell>
              <TableCell className="font-semibold text-[#888] text-right">Total Prescribed Value</TableCell>
              <TableCell className="font-semibold text-[#888]">Clinical Audit Flag Rate</TableCell>
              <TableCell className="font-semibold text-[#888]">Risk Assessment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" className="py-12 text-[#555] font-serif italic text-sm">
                  No prescriber records found.
                </TableCell>
              </TableRow>
            ) : (
              stats.map((doc, idx) => (
                <TableRow 
                  key={idx} 
                  hover
                  className="border-b border-[#1a1a1a] transition-colors hover:bg-[#0d0d0d]"
                >
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-[#111] text-[#F27D26] border border-[#1a1a1a] flex items-center justify-center font-serif italic font-bold">
                        {doc.name.replace(/Dr\.\s+/gi, "").charAt(0)}
                      </div>
                      <span className="font-medium text-[#e0e0e0]">{doc.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[#888] font-semibold font-mono">
                    {doc.claimsCount}
                  </TableCell>
                  <TableCell className="text-right text-[#666] font-medium text-xs">
                    {doc.uniquePatientsCount} patients
                  </TableCell>
                  <TableCell className="text-right text-[#666] font-medium text-xs">
                    {doc.uniqueDrugsCount} drugs
                  </TableCell>
                  <TableCell className="text-right font-bold text-white font-mono text-sm">
                    {doc.totalCost.toLocaleString()} RWF
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col w-32">
                      <span className="text-[10px] font-semibold text-[#888] font-mono mb-1">
                        {doc.flagRate.toFixed(1)}% ({doc.flaggedCount} flags)
                      </span>
                      <LinearProgress
                        variant="determinate"
                        value={doc.flagRate}
                        color={getRateColor(doc.flagRate)}
                        className="h-1 rounded-sm bg-[#111]"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {doc.flagRate >= 50 ? (
                      <span className="text-[10px] text-[#ff6b6b] font-bold flex items-center gap-1 bg-[#1a0c0c] border border-[#4a1c1c] px-2 py-1 rounded w-fit uppercase tracking-wider">
                        <AlertTriangle size={11} />
                        <span>High Risk</span>
                      </span>
                    ) : doc.flagRate >= 20 ? (
                      <span className="text-[10px] text-[#dfa61c] font-bold flex items-center gap-1 bg-[#1a140c] border border-[#3d2f1b] px-2 py-1 rounded w-fit uppercase tracking-wider">
                        <AlertTriangle size={11} />
                        <span>Audit Target</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#76df8b] font-bold flex items-center gap-1 bg-[#0c1a10] border border-[#1b3d22] px-2 py-1 rounded w-fit uppercase tracking-wider">
                        <span>Low Risk Standard</span>
                      </span>
                    )}
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
