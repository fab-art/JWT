/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Paper, Typography, CircularProgress, Alert } from "@mui/material";
import { ShieldCheck, Terminal, Server, Key, UserCheck } from "lucide-react";

interface AuditTrail {
  id: number;
  userId: number;
  userEmail: string;
  action: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

interface AuditTrailProps {
  token: string;
}

export default function AuditTrailList({ token }: AuditTrailProps) {
  const [logs, setLogs] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit-trails", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      } else {
        setError("Failed to load audit trail logs. Access is restricted to Admin roles.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to audit trails service.");
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("LOGIN") || act.includes("AUTH")) {
      return <Key size={14} className="text-[#F27D26]" />;
    }
    if (act.includes("CASE")) {
      return <UserCheck size={14} className="text-[#3b82f6]" />;
    }
    return <Server size={14} className="text-[#10b981]" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h5" className="font-serif italic text-white tracking-wider flex items-center gap-2">
          <Terminal className="text-[#F27D26]" size={24} />
          Security Operations Audit Trail
        </Typography>
        <Typography className="text-[#555] text-[10px] uppercase tracking-widest font-mono mt-1">
          Cryptographically signed system events, user actions, and forensic calculations (Admin Only)
        </Typography>
      </div>

      {error ? (
        <Alert severity="warning" className="bg-[#1a0f0a] text-[#ff9f59] border border-[#ff9f59]/20 text-xs font-semibold rounded">
          {error}
        </Alert>
      ) : loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#F27D26]">
          <CircularProgress size={24} color="inherit" />
          <span className="text-xs text-[#555] font-semibold">Streaming ledger entries...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-20 text-center text-[#555] font-serif italic text-sm">
          No system operations recorded in the ledger yet.
        </div>
      ) : (
        <Paper className="border border-[#1a1a1a] rounded-xl overflow-hidden bg-[#0a0a0a]">
          <div className="p-4 bg-[#0d0d0d] border-b border-[#1a1a1a] flex justify-between items-center">
            <span className="text-[10px] text-[#888] font-mono uppercase tracking-wider font-bold">
              Ledger Events Feed
            </span>
            <button
              onClick={fetchLogs}
              className="text-[9px] font-mono font-semibold text-[#F27D26] hover:underline"
            >
              [REQUERY LEDGER]
            </button>
          </div>

          <div className="divide-y divide-[#151515] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0b0b0b] text-[10px] text-[#555] font-mono uppercase border-b border-[#1a1a1a]">
                  <th className="p-3">Timestamp (UTC)</th>
                  <th className="p-3">Operator</th>
                  <th className="p-3">Operation / Event</th>
                  <th className="p-3">Diagnostic Details</th>
                  <th className="p-3">Ingress IP</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[11px] divide-y divide-[#151515]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#0d0d0d] text-[#ccc] transition-colors">
                    <td className="p-3 text-[#555] whitespace-nowrap">
                      {new Date(log.createdAt).toISOString().replace("T", " ").substring(0, 19)}
                    </td>
                    <td className="p-3 text-white font-bold whitespace-nowrap">{log.userEmail}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="uppercase text-[#aaa] font-bold text-[10px] tracking-wide">
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-[#888] font-sans leading-relaxed min-w-[280px]">
                      {log.details}
                    </td>
                    <td className="p-3 text-right text-[#555] font-mono">{log.ipAddress || "127.0.0.1"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Paper>
      )}
    </div>
  );
}
