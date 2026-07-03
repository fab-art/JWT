/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Typography, Alert, Card, CardContent, Grid, Button
} from "@mui/material";
import { Clock, ShieldAlert, ArrowRight, UserMinus, UserCheck, HelpCircle } from "lucide-react";
import { RevisitAlert } from "../types";

interface RapidRevisitsProps {
  token: string;
}

export default function RapidRevisits({ token }: RapidRevisitsProps) {
  const [alerts, setAlerts] = useState<RevisitAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/rapid-revisits", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#F27D26]">
        <Clock className="animate-spin h-8 w-8" />
        <span className="text-xs font-semibold text-[#888]">Scanning prescription timelines...</span>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-6">
        <Typography variant="h5" className="font-serif italic text-white tracking-wider">
          Rapid Revisit & Shopping Alerts
        </Typography>
        <Typography variant="caption" className="text-[#555] uppercase tracking-widest text-[9px] mt-0.5 block">
          Identifies instances where a single patient redeemed prescriptions within a 4-day threshold, often indicating doctor shopping or split billing.
        </Typography>
      </div>

      {alerts.length === 0 ? (
        <div className="p-4 rounded-sm border border-[#1b3d22] bg-[#0c1a10] text-[#76df8b] text-xs">
          No rapid revisit alerts detected in the current audited claims batch.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Stats banner */}
          <div className="p-4 rounded-sm border border-[#4a1c1c] bg-[#1a0c0c] text-[#ff6b6b] flex gap-3 items-start">
            <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-[#ff6b6b]" />
            <div>
              <Typography className="font-bold text-xs uppercase tracking-wider mb-0.5 text-white">
                Potential Multi-Prescription Claims Fraud Detected
              </Typography>
              <Typography className="text-[11px] text-[#ff9b9b] leading-relaxed">
                {alerts.length} rapid-succession visits flagged. The average interval between these redemptions is{" "}
                <strong className="text-white">{(alerts.reduce((sum, a) => sum + a.daysBetween, 0) / alerts.length).toFixed(1)} days</strong>. Review pharmacy logs for medication overlaps.
              </Typography>
            </div>
          </div>

          {/* Alert Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {alerts.map((alert, idx) => (
              <Card key={idx} className="border border-[#1a1a1a] rounded-sm shadow-none bg-[#0a0a0a] hover:bg-[#0d0d0d] transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Typography variant="h6" className="font-serif text-[#e0e0e0] leading-tight text-base font-medium">
                        {alert.patientName}
                      </Typography>
                      <Typography variant="caption" className="text-[#555] font-semibold font-mono text-[10px]">
                        RAMA ID: {alert.ramaNumber}
                      </Typography>
                    </div>
                    <Chip
                      label={`${alert.daysBetween} Day Revisit`}
                      size="small"
                      color={alert.daysBetween === 0 ? "error" : "secondary"}
                      className="font-bold text-[10px]"
                    />
                  </div>

                  <Divider className="my-3 opacity-50" />

                  <div className="space-y-4">
                    {/* Dispense 1 */}
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#111] text-[#F27D26] border border-[#1a1a1a] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white block">{alert.medicine1}</span>
                        <span className="text-[#888] block text-[11px]">
                          Prescribed by: <strong className="text-[#e0e0e0] font-normal font-serif italic">{alert.doctor1}</strong> @ {alert.facility1}
                        </span>
                        <span className="text-[#555] font-mono font-medium block text-[10px] mt-0.5">
                          Date: {alert.visit1Date} | Value: {alert.amount1.toLocaleString()} RWF
                        </span>
                      </div>
                    </div>

                    {/* Direction Arrow */}
                    <div className="flex justify-center my-1 text-[#F27D26]/40">
                      <ArrowRight size={16} className="rotate-90 md:rotate-0" />
                    </div>

                    {/* Dispense 2 */}
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#111] text-[#F27D26] border border-[#1a1a1a] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-white block">{alert.medicine2}</span>
                        <span className="text-[#888] block text-[11px]">
                          Prescribed by: <strong className="text-[#e0e0e0] font-normal font-serif italic">{alert.doctor2}</strong> @ {alert.facility2}
                        </span>
                        <span className="text-[#555] font-mono font-medium block text-[10px] mt-0.5">
                          Date: {alert.visit2Date} | Value: {alert.amount2.toLocaleString()} RWF
                        </span>
                      </div>
                    </div>
                  </div>

                  <Divider className="my-4 opacity-50" />

                  {/* Forensic Analysis Advice */}
                  <div className="bg-[#050505] p-3.5 rounded border border-[#1a1a1a] text-[11px] text-[#888] leading-relaxed">
                    <strong className="text-[#F27D26] uppercase font-mono tracking-wider text-[9px] block mb-1">Audit Recommendation</strong>{" "}
                    {alert.doctor1 === alert.doctor2 ? (
                      <span>Same prescriber. Likely <strong className="text-[#e0e0e0]">Split Billing</strong> to evade single consultation cost caps. Review dosage totals.</span>
                    ) : (
                      <span>Different prescribers (<strong className="text-[#e0e0e0]">Doctor Shopping</strong>). Patient obtained drugs from multiple practitioners to stockpiling medications. Risk of therapeutic duplication.</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Divider Mock
function Divider(props: any) {
  return <hr className={`border-t border-[#1a1a1a] ${props.className}`} />;
}

// Inline Chip Mock
function Chip(props: any) {
  const colorMap = {
    error: "bg-[#1a0c0c] text-[#ff6b6b] border-[#4a1c1c]",
    secondary: "bg-[#111] text-[#F27D26] border-[#F27D26]/30"
  };
  const classes = colorMap[props.color as "error" | "secondary"] || "bg-[#111] text-[#888] border-[#1a1a1a]";
  return (
    <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider border ${classes} ${props.className}`}>
      {props.label}
    </span>
  );
}

