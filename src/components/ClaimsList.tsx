/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, Drawer, Typography, IconButton, Box, CircularProgress, Alert
} from "@mui/material";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { Search, X, ShieldAlert, Sparkles } from "lucide-react";
import { Voucher, ClaimStatus } from "../types";

interface ClaimsListProps {
  token: string;
  currentUser: { email: string; role: string };
  vouchers: Voucher[];
  onActionComplete: () => void;
}

export default function ClaimsList({ token, currentUser, vouchers, onActionComplete }: ClaimsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Drawer action states
  const [newStatus, setNewStatus] = useState<ClaimStatus>(ClaimStatus.PENDING);
  const [auditorNote, setAuditorNote] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isRecalculatingMl, setIsRecalculatingMl] = useState(false);
  
  // AI Audit states
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [notesHistory, setNotesHistory] = useState<any[]>([]);

  // Fetch auditor/system notes when voucher changes
  useEffect(() => {
    if (selectedVoucher) {
      fetchNotes(selectedVoucher.id);
      setNewStatus(selectedVoucher.status);
      setAiReport(null);
      setAuditorNote("");
    }
  }, [selectedVoucher]);

  const fetchNotes = async (id: number) => {
    try {
      const res = await fetch(`/api/notes/voucher/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotesHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    }
  };

  const handleOpenDrawer = (vouch: Voucher) => {
    setSelectedVoucher(vouch);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedVoucher(null);
  };

  const handleActionSubmit = async () => {
    if (!selectedVoucher) return;
    setIsSubmittingAction(true);
    try {
      const res = await fetch(`/api/vouchers/${selectedVoucher.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          note: auditorNote.trim() || undefined
        })
      });

      if (res.ok) {
        onActionComplete();
        if (auditorNote.trim()) {
          await fetchNotes(selectedVoucher.id);
          setAuditorNote("");
        }
        // Update local state status
        setSelectedVoucher(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const triggerAiAudit = async () => {
    if (!selectedVoucher) return;
    setIsLoadingAi(true);
    setAiReport(null);
    try {
      const res = await fetch("/api/investigate-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetId: String(selectedVoucher.id),
          type: "voucher"
        })
      });

      const data = await res.json();
      if (res.ok) {
        setAiReport(data.notes);
        await fetchNotes(selectedVoucher.id);
      } else {
        setAiReport(`### Audit Error\n\n${data.error}`);
      }
    } catch (err: any) {
      setAiReport(`### Audit Error\n\nFailed to invoke forensic API: ${err.message}`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const triggerMlRecalculate = async () => {
    setIsRecalculatingMl(true);
    try {
      const res = await fetch("/api/vouchers/recalculate-ml", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        onActionComplete();
        alert("Machine learning anomaly scores successfully retrained across active database!");
      } else {
        const d = await res.json();
        alert(d.error || "Failed to retrain ML engine.");
      }
    } catch (err: any) {
      alert("Failed to connect to ML recalculation service.");
    } finally {
      setIsRecalculatingMl(false);
    }
  };

  // Filter list
  const filteredVouchers = vouchers.filter(v => {
    // 1. Tab filters
    if (activeTab === 1 && !v.isFlagged) return false;
    if (activeTab === 2 && !v.isMlAnomaly) return false;
    if (activeTab === 3 && v.status !== ClaimStatus.PENDING) return false;
    if (activeTab === 4 && v.status !== ClaimStatus.APPROVED) return false;
    if (activeTab === 5 && v.status !== ClaimStatus.REJECTED) return false;

    // 2. Search query filter
    const search = searchQuery.toLowerCase();
    return (
      v.patientName.toLowerCase().includes(search) ||
      v.ramaNumber.toLowerCase().includes(search) ||
      v.medicineName.toLowerCase().includes(search) ||
      v.doctorName.toLowerCase().includes(search) ||
      v.facilityName.toLowerCase().includes(search)
    );
  });

  const getStatusChip = (status: ClaimStatus) => {
    switch (status) {
      case ClaimStatus.APPROVED:
        return <Chip label="Approved" size="small" className="bg-[#0c1a10] text-[#76df8b] border border-[#1b3d22] font-semibold text-[10px] uppercase tracking-wider rounded" />;
      case ClaimStatus.REJECTED:
        return <Chip label="Rejected" size="small" className="bg-[#1a0c0c] text-[#ff6b6b] border border-[#4a1c1c] font-semibold text-[10px] uppercase tracking-wider rounded" />;
      case ClaimStatus.INVESTIGATING:
        return <Chip label="Investigating" size="small" className="bg-[#111] text-[#b388ff] border border-[#311b92] font-semibold text-[10px] uppercase tracking-wider rounded" />;
      default:
        return <Chip label="Pending" size="small" className="bg-[#111] text-[#82b1ff] border border-[#1565c0] font-semibold text-[10px] uppercase tracking-wider rounded" />;
    }
  };

  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Typography variant="h5" className="font-serif italic text-white tracking-wider">
            Pharmacy Claims Register
          </Typography>
          {currentUser.role !== "Read-Only" && (
            <button
              onClick={triggerMlRecalculate}
              disabled={isRecalculatingMl}
              className="flex items-center gap-1.5 px-3 py-1 border border-[#F27D26]/20 hover:border-[#F27D26] bg-[#111] text-[#F27D26] font-semibold text-[10px] uppercase tracking-wider rounded transition-all duration-300"
            >
              {isRecalculatingMl ? (
                <>
                  <CircularProgress size={10} color="inherit" />
                  <span>Retraining ML...</span>
                </>
              ) : (
                <>
                  <Sparkles size={10} />
                  <span>Retrain ML Engine</span>
                </>
              )}
            </button>
          )}
        </div>
        
        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#555]">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search patient, card ID, prescriber..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-[#1a1a1a] rounded bg-[#111] text-sm text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#F27D26]/60 transition-colors"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, val) => setActiveTab(val)}
        className="border-b border-[#1a1a1a] mb-6"
        textColor="primary"
        indicatorColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label={`All Claims (${vouchers.length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px]" />
        <Tab label={`Rule Alerts (${vouchers.filter(v => v.isFlagged).length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px] text-[#F27D26]" />
        <Tab label={`ML Alerts (${vouchers.filter(v => v.isMlAnomaly).length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px] text-[#ffd54f]" />
        <Tab label={`Pending (${vouchers.filter(v => v.status === ClaimStatus.PENDING).length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px]" />
        <Tab label={`Approved (${vouchers.filter(v => v.status === ClaimStatus.APPROVED).length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px]" />
        <Tab label={`Rejected (${vouchers.filter(v => v.status === ClaimStatus.REJECTED).length})`} className="font-semibold text-xs tracking-wider uppercase text-[10px]" />
      </Tabs>

      {/* Claims Table */}
      <TableContainer component={Paper} elevation={0} className="border border-[#1a1a1a] rounded-sm overflow-hidden bg-[#0a0a0a]">
        <Table>
          <TableHead className="bg-[#0e0e0e]">
            <TableRow>
              <TableCell className="font-semibold text-[#888]">Dispense Date</TableCell>
              <TableCell className="font-semibold text-[#888]">Patient / RAMA ID</TableCell>
              <TableCell className="font-semibold text-[#888]">Prescription / Medication</TableCell>
              <TableCell className="font-semibold text-[#888] text-right">Qty</TableCell>
              <TableCell className="font-semibold text-[#888] text-right">Claim Amount</TableCell>
              <TableCell className="font-semibold text-[#888] text-center">ML Score</TableCell>
              <TableCell className="font-semibold text-[#888]">Prescribing MD</TableCell>
              <TableCell className="font-semibold text-[#888]">Pharmacy Location</TableCell>
              <TableCell className="font-semibold text-[#888]">Status</TableCell>
              <TableCell className="font-semibold text-[#888]" align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVouchers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" className="py-12 text-[#555] font-serif italic text-sm">
                  No pharmacy vouchers found matching filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredVouchers.map((v) => (
                <TableRow 
                  key={v.id} 
                  hover 
                  className={`border-b border-[#1a1a1a] transition-colors hover:bg-[#0d0d0d] ${
                    v.isFlagged || v.isMlAnomaly ? "bg-[#1a0f0a]/40 border-l-2 border-[#F27D26]" : ""
                  }`}
                >
                  <TableCell className="text-[#888] font-mono text-xs">{v.date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#e0e0e0]">{v.patientName}</span>
                      <span className="text-[10px] text-[#555] font-mono">{v.ramaNumber || "NO INSURANCE"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-[#e0e0e0]">{v.medicineName}</span>
                      {v.isFlagged && (
                        <div className="flex items-center gap-1 text-[#F27D26] font-semibold text-[10px] mt-1 uppercase tracking-wider">
                          <ShieldAlert size={12} />
                          <span>{v.flagReason}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[#888] font-medium font-mono">{v.quantity}</TableCell>
                  <TableCell className="text-right font-semibold text-white font-mono text-sm">
                    {v.amount.toLocaleString()} RWF
                  </TableCell>
                  <TableCell align="center">
                    {v.mlAnomalyScore !== undefined ? (
                      <div className="flex flex-col items-center justify-center">
                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                          v.isMlAnomaly 
                            ? "bg-[#1a150a] text-[#ffd54f] border border-[#ffd54f]/30" 
                            : "bg-[#111] text-[#888] border border-[#222]"
                        }`}>
                          {(v.mlAnomalyScore * 100).toFixed(0)}%
                        </span>
                        {v.isMlAnomaly && (
                          <span className="text-[8px] text-[#ffd54f] font-semibold mt-0.5 uppercase tracking-wider">
                            ANOMALOUS
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#444] font-mono text-[10px]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[#e0e0e0] font-serif italic">{v.doctorName}</TableCell>
                  <TableCell className="text-[#888] text-xs">{v.facilityName}</TableCell>
                  <TableCell>{getStatusChip(v.status)}</TableCell>
                  <TableCell align="center">
                    <button
                      onClick={() => handleOpenDrawer(v)}
                      className="text-[11px] px-3.5 py-1.5 bg-[#F27D26] hover:bg-[#df6c1c] text-black font-semibold rounded transition-colors"
                    >
                      Audit Claim
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Forensic Audit Side Drawer */}
      <Drawer 
        anchor="right" 
        open={isDrawerOpen} 
        onClose={handleCloseDrawer} 
        classes={{ paper: "w-full md:w-[580px]" }}
      >
        {selectedVoucher && (
          <Box className="flex flex-col h-full bg-[#050505] text-[#e0e0e0]">
            {/* Header */}
            <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] p-6 flex items-center justify-between">
              <div>
                <Typography variant="h6" className="font-serif italic text-[#F27D26] tracking-wider text-lg">
                  Investigate Claim #{selectedVoucher.id}
                </Typography>
                <Typography variant="caption" className="text-[#555] uppercase tracking-widest text-[9px] mt-0.5 block">
                  Forensic audit controls for {selectedVoucher.patientName}
                </Typography>
              </div>
              <IconButton onClick={handleCloseDrawer} className="text-[#666] hover:text-white transition-colors">
                <X size={20} />
              </IconButton>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Claim Overview Card */}
              <Paper className="p-5 border border-[#1a1a1a] rounded-sm bg-[#0a0a0a] shadow-none">
                <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[10px] mb-4">
                  Dispensation Details
                </Typography>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block">Patient Name</span>
                    <span className="font-medium text-[#e0e0e0] block">{selectedVoucher.patientName}</span>
                    <span className="text-[10px] text-[#444] font-mono">Normalized: {selectedVoucher.patientNameNormalized}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block">RAMA Card ID</span>
                    <span className="font-bold text-white font-mono block">{selectedVoucher.ramaNumber || "Not Provided"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block">Prescribing Doctor</span>
                    <span className="font-medium text-[#e0e0e0] font-serif italic block">{selectedVoucher.doctorName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block">Dispensing Pharmacy</span>
                    <span className="font-medium text-[#e0e0e0] block">{selectedVoucher.facilityName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block">Prescribed Drug & Qty</span>
                    <span className="font-medium text-[#e0e0e0] block">{selectedVoucher.medicineName} ({selectedVoucher.quantity} Units)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider block">Total Claim Amount</span>
                    <span className="font-bold text-[#F27D26] font-mono block">{selectedVoucher.amount.toLocaleString()} RWF</span>
                  </div>
                </div>
              </Paper>

              {/* Rule Anomalies alert if flagged */}
              {selectedVoucher.isFlagged && (
                <div className="p-4 rounded-sm border border-[#3a1c0d] bg-[#1a0f0a] text-[#F27D26] flex items-start gap-3">
                  <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <Typography className="font-bold text-xs uppercase tracking-wider mb-0.5">
                      Clinical Validation Warning
                    </Typography>
                    <Typography className="text-[11px] text-[#c08d75] leading-relaxed">
                      {selectedVoucher.flagReason}
                    </Typography>
                  </div>
                </div>
              )}

              {/* ML Anomaly Alert */}
              {selectedVoucher.isMlAnomaly && (
                <div className="p-4 rounded-sm border border-[#ffd54f]/20 bg-[#1a150a] text-[#ffd54f] flex items-start gap-3">
                  <Sparkles size={18} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <Typography className="font-bold text-xs uppercase tracking-wider mb-0.5 text-white">
                      Machine Learning Anomaly Alert (Score: {(selectedVoucher.mlAnomalyScore * 100).toFixed(0)}%)
                    </Typography>
                    <Typography className="text-[11px] text-[#d4b97a] leading-relaxed">
                      {selectedVoucher.mlAnomalyReason || "Multivariate anomaly detector flag: Patient shopping or prescribing outlier detected."}
                    </Typography>
                  </div>
                </div>
              )}

              {/* Gemini AI forensic auditing */}
              <Paper className="p-5 border border-[#F27D26]/20 bg-[#0a0a0a] rounded-sm shadow-none">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#F27D26]" />
                    <Typography variant="subtitle2" className="font-semibold text-white uppercase tracking-wider text-[10px]">
                      Gemini Forensic AI Copilot
                    </Typography>
                  </div>
                  {currentUser.role !== "Read-Only" && (
                    <button
                      onClick={triggerAiAudit}
                      disabled={isLoadingAi}
                      className="text-[10px] px-3 py-1 bg-[#111] hover:bg-[#222] text-[#F27D26] border border-[#F27D26]/30 font-semibold rounded uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                      {isLoadingAi ? <CircularProgress size={10} color="inherit" /> : <Sparkles size={10} />}
                      {isLoadingAi ? "Auditing..." : "Run AI Forensic Audit"}
                    </button>
                  )}
                </div>
                
                {isLoadingAi ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-3 text-[#F27D26]">
                    <CircularProgress size={24} color="inherit" />
                    <span className="text-[11px] text-[#666] font-semibold text-center leading-relaxed">Gemini is analyzing dosage rules, provider records, and network hubs...</span>
                  </div>
                ) : aiReport ? (
                  <div className="bg-[#050505] border border-[#1a1a1a] p-4 rounded-sm max-h-80 overflow-y-auto text-[#ccc] whitespace-pre-wrap text-xs leading-relaxed font-mono">
                    {aiReport}
                  </div>
                ) : (
                  <Typography variant="caption" className="text-[#666] block leading-normal text-[11px] italic">
                    Let Gemini investigate this claim. Gemini will correlate hospital records, detect "pharmacy shopping" revisit intervals, verify clinical dosages, and draft an investigative report.
                  </Typography>
                )}
              </Paper>

              {/* Note History */}
              {notesHistory.length > 0 && (
                <div>
                  <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[10px] mb-3">
                    Audit Log & History
                  </Typography>
                  <div className="space-y-3">
                    {notesHistory.map((n, idx) => (
                      <Paper key={idx} className="p-3.5 border border-[#1a1a1a] rounded-sm bg-[#0a0a0a] shadow-none text-xs">
                        <div className="flex justify-between items-center mb-1.5 border-b border-[#151515] pb-1">
                          <span className="font-bold text-[#e0e0e0] font-mono text-[10px]">{n.author}</span>
                          <span className="text-[#444] font-mono text-[9px]">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[#888] whitespace-pre-wrap leading-relaxed font-sans">{n.note}</p>
                      </Paper>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Board */}
              {currentUser.role !== "Read-Only" && (
                <Paper className="p-5 border border-[#1a1a1a] rounded-sm bg-[#0a0a0a] shadow-none">
                  <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[10px] mb-4">
                    Audit Decision Control
                  </Typography>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#555] font-mono uppercase tracking-wider">Change Status</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as ClaimStatus)}
                        className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50"
                      >
                        <option value={ClaimStatus.PENDING}>Pending Review</option>
                        <option value={ClaimStatus.APPROVED}>Approve Claim (Valid)</option>
                        <option value={ClaimStatus.INVESTIGATING}>Flag for Investigation</option>
                        <option value={ClaimStatus.REJECTED}>Reject Claim (Fraudulent)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-[#555] font-mono uppercase tracking-wider">Internal Audit Review Comment</label>
                      <textarea
                        placeholder="Enter investigative details, interview notes, or clinical findings..."
                        rows={3}
                        value={auditorNote}
                        onChange={(e) => setAuditorNote(e.target.value)}
                        className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#F27D26]/50 font-sans"
                      />
                    </div>

                    <button
                      onClick={handleActionSubmit}
                      disabled={isSubmittingAction}
                      className="w-full text-xs uppercase tracking-widest font-semibold text-black bg-[#F27D26] hover:bg-[#df6c1c] py-2.5 rounded transition-colors"
                    >
                      {isSubmittingAction ? "Saving..." : "Submit Audit Decision"}
                    </button>
                  </div>
                </Paper>
              )}
            </div>
          </Box>
        )}
      </Drawer>
    </div>
  );
}
