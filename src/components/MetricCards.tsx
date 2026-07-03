/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Paper, Typography } from "@mui/material";
import { DollarSign, ShieldAlert, Users, Stethoscope, AlertTriangle, Activity, Sparkles } from "lucide-react";
import { DashboardStats } from "../types";

interface MetricCardsProps {
  stats: DashboardStats;
}

export default function MetricCards({ stats }: MetricCardsProps) {
  const cards = [
    {
      title: "Total Claims Audited",
      value: stats.totalClaims.toLocaleString(),
      subtitle: `${stats.uniqueFacilities} Facilities Active`,
      icon: <Activity size={20} />,
      color: "text-[#e0e0e0] bg-[#111] border-[#222]",
      valueColor: "text-white",
    },
    {
      title: "Total Claim Value",
      value: `${stats.totalAmount.toLocaleString()} RWF`,
      subtitle: "85% Covered by Insurance",
      icon: <DollarSign size={20} />,
      color: "text-[#F27D26] bg-[#111] border-[#222]",
      valueColor: "text-white",
    },
    {
      title: "Flagged Anomalies",
      value: stats.flaggedClaimsCount.toLocaleString(),
      subtitle: `${((stats.flaggedClaimsCount / (stats.totalClaims || 1)) * 100).toFixed(1)}% Claim Anomaly Rate`,
      icon: <ShieldAlert size={20} />,
      color: "text-[#F27D26] bg-[#1a0f0a] border-[#3a1c0d]",
      valueColor: "text-[#F27D26]",
    },
    {
      title: "ML Anomaly Alerts",
      value: (stats.mlAnomaliesCount ?? 0).toLocaleString(),
      subtitle: "Multidimensional ML Scoring",
      icon: <Sparkles size={20} />,
      color: "text-[#F27D26] bg-[#1a0f0a] border-[#3a1c0d]",
      valueColor: "text-[#F27D26]",
    },
    {
      title: "Suspicious Value",
      value: `${stats.flaggedAmount.toLocaleString()} RWF`,
      subtitle: "High Unit Cost / Qty Spikes",
      icon: <AlertTriangle size={20} />,
      color: "text-[#F27D26] bg-[#1a0f0a] border-[#3a1c0d]",
      valueColor: "text-[#F27D26]",
    },
    {
      title: "Active Prescribers",
      value: stats.uniqueDoctors.toLocaleString(),
      subtitle: `Caring for ${stats.uniquePatients} Patients`,
      icon: <Stethoscope size={20} />,
      color: "text-[#e0e0e0] bg-[#111] border-[#222]",
      valueColor: "text-white",
    },
    {
      title: "Rapid Revisit Alerts",
      value: stats.rapidRevisitAlertsCount.toLocaleString(),
      subtitle: "Visits ≤ 4 Days Apart",
      icon: <Users size={20} />,
      color: "text-[#F27D26] bg-[#111] border-[#222]",
      valueColor: "text-[#F27D26]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, idx) => (
        <Paper
          key={idx}
          elevation={0}
          className="p-5 border border-[#1a1a1a] rounded-sm bg-[#0a0a0a] flex items-start justify-between hover:border-[#F27D26]/40 transition-all duration-300"
        >
          <div className="flex flex-col">
            <Typography variant="body2" className="text-[#666] font-semibold uppercase tracking-widest text-[10px] mb-1">
              {card.title}
            </Typography>
            <Typography variant="h4" className={`font-serif text-2xl ${card.valueColor} tracking-tight mb-1`}>
              {card.value}
            </Typography>
            <Typography variant="caption" className="text-[#555] font-medium font-mono text-[10px] italic">
              {card.subtitle}
            </Typography>
          </div>
          <div className={`p-2.5 rounded border ${card.color} flex items-center justify-center`}>
            {card.icon}
          </div>
        </Paper>
      ))}
    </div>
  );
}

