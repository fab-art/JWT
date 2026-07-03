/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Paper, Typography, Box, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from "@mui/material";
import { FolderHeart, Plus, UserCheck, CheckCircle2, AlertTriangle, ShieldCheck, HelpCircle, Sparkles, User } from "lucide-react";

interface Case {
  id: number;
  title: string;
  description: string;
  status: string; // "Open" | "Pending Review" | "Closed"
  investigator: string;
  targetType: string; // "patient" | "doctor" | "facility" | "claim"
  targetId: string;
  findings: string;
  createdAt: string;
  updatedAt: string;
}

interface CaseManagementProps {
  token: string;
  currentUser: { email: string; role: string };
  onRefreshStats: () => void;
}

export default function CaseManagement({ token, currentUser, onRefreshStats }: CaseManagementProps) {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("All");

  // Selected Case Detail
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [relatedClaims, setRelatedClaims] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // Case Note History
  const [notesHistory, setNotesHistory] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Edit State
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [editStatus, setEditStatus] = useState("Open");
  const [editInvestigator, setEditInvestigator] = useState("");
  const [editFindings, setEditFindings] = useState("");
  const [isSavingCase, setIsSavingCase] = useState(false);

  // New Case Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTargetType, setNewTargetType] = useState("patient");
  const [newTargetId, setNewTargetId] = useState("");
  const [newInvestigator, setNewInvestigator] = useState("");
  const [newFindings, setNewFindings] = useState("");
  const [isSubmittingNewCase, setIsSubmittingNewCase] = useState(false);

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (selectedCase) {
      fetchCaseDetails(selectedCase);
    }
  }, [selectedCase]);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      } else {
        setError("Failed to fetch cases from server.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to reach server backend.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseDetails = async (kase: Case) => {
    setLoadingRelated(true);
    try {
      // 1. Fetch related claims using query parameters
      const claimsRes = await fetch(`/api/vouchers?targetType=${kase.targetType}&targetId=${encodeURIComponent(kase.targetId)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (claimsRes.ok) {
        const data = await claimsRes.json();
        setRelatedClaims(data);
      }

      // 2. Fetch comments/audit logs specific to this case
      const notesRes = await fetch(`/api/cases/${kase.id}/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        setNotesHistory(notesData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTargetId.trim()) return;

    setIsSubmittingNewCase(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          targetType: newTargetType,
          targetId: newTargetId.trim(),
          findings: newFindings.trim(),
          investigator: newInvestigator || currentUser.email
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCases(prev => [data.case, ...prev]);
        setIsCreateModalOpen(false);
        onRefreshStats();
        // Clear forms
        setNewTitle("");
        setNewDescription("");
        setNewTargetId("");
        setNewFindings("");
        setNewInvestigator("");
        // Select it
        setSelectedCase(data.case);
      } else {
        alert("Failed to initialize case dossier.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNewCase(false);
    }
  };

  const handleUpdateCase = async () => {
    if (!selectedCase) return;
    setIsSavingCase(true);
    try {
      const res = await fetch(`/api/cases/${selectedCase.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: editStatus,
          investigator: editInvestigator,
          findings: editFindings
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update local items
        setCases(prev => prev.map(c => c.id === selectedCase.id ? data.case : c));
        setSelectedCase(data.case);
        setIsEditingCase(false);
        onRefreshStats();
      } else {
        alert("Failed to save changes.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCase(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedCase || !newNote.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await fetch(`/api/cases/${selectedCase.id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: newNote.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setNotesHistory(prev => [...prev, data.note]);
        setNewNote("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const triggerGeminiCaseAudit = async () => {
    if (!selectedCase) return;
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/investigate-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetId: String(selectedCase.id),
          type: "case"
        })
      });

      if (res.ok) {
        // AI note is automatically filed in the case. Refresh detail.
        await fetchCaseDetails(selectedCase);
      } else {
        alert("Gemini failed to audit this case dossier.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const filteredCases = cases.filter(c => {
    if (statusFilter !== "All" && c.status !== statusFilter) return false;
    return true;
  });

  const getStatusChip = (status: string) => {
    switch (status) {
      case "Closed":
        return <Chip label="Closed" size="small" className="bg-[#0c1a10] text-[#76df8b] border border-[#1b3d22] font-semibold text-[10px] uppercase tracking-wider rounded" />;
      case "Pending Review":
        return <Chip label="In Review" size="small" className="bg-[#1a140a] text-[#ffd54f] border border-[#ffb300]/30 font-semibold text-[10px] uppercase tracking-wider rounded" />;
      default:
        return <Chip label="Active" size="small" className="bg-[#111] text-[#82b1ff] border border-[#1565c0] font-semibold text-[10px] uppercase tracking-wider rounded" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Header and Case Creator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Typography variant="h5" className="font-serif italic text-white tracking-wider flex items-center gap-2">
            <FolderHeart className="text-[#F27D26]" size={24} />
            Forensic Case Management
          </Typography>
          <Typography className="text-[#555] text-[10px] uppercase tracking-widest font-mono mt-1">
            Track, assign, and audit active healthcare fraud investigations
          </Typography>
        </div>

        {currentUser.role !== "Read-Only" && (
          <button
            onClick={() => {
              setNewTitle("");
              setNewDescription("");
              setNewTargetId("");
              setNewFindings("");
              setNewInvestigator("");
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#F27D26] hover:bg-[#df6c1c] text-black font-semibold text-xs uppercase tracking-wider rounded transition-colors"
          >
            <Plus size={14} />
            Initialize Folder
          </button>
        )}
      </div>

      {error && <Alert severity="error">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column - Case List */}
        <div className={selectedCase ? "lg:col-span-5" : "lg:col-span-12"}>
          <Paper className="border border-[#1a1a1a] rounded-xl overflow-hidden bg-[#0a0a0a]">
            {/* Folder Filters */}
            <div className="p-4 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center justify-between">
              <span className="text-[10px] text-[#888] font-mono uppercase tracking-wider font-bold">
                Investigation Dossiers
              </span>
              <div className="flex gap-2">
                {["All", "Open", "Pending Review", "Closed"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors ${
                      statusFilter === st
                        ? "bg-[#F27D26] text-black font-bold"
                        : "bg-[#151515] text-[#888] hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#F27D26]">
                <CircularProgress size={24} color="inherit" />
                <span className="text-xs text-[#555] font-semibold">Aggregating dossiers...</span>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="py-20 text-center text-[#555] font-serif italic text-sm">
                No investigation files found matching filters.
              </div>
            ) : (
              <div className="divide-y divide-[#151515]">
                {filteredCases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCase(c);
                      setEditStatus(c.status);
                      setEditInvestigator(c.investigator);
                      setEditFindings(c.findings);
                      setIsEditingCase(false);
                    }}
                    className={`p-4 cursor-pointer hover:bg-[#0e0e0e] transition-colors flex items-start justify-between gap-4 border-l-2 ${
                      selectedCase?.id === c.id
                        ? "bg-[#111] border-[#F27D26]"
                        : "border-transparent"
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusChip(c.status)}
                        <span className="text-[10px] text-[#555] font-mono font-bold uppercase tracking-wider">
                          Folder #{c.id}
                        </span>
                      </div>
                      <Typography className="text-sm font-semibold text-white tracking-tight">
                        {c.title}
                      </Typography>
                      <div className="flex items-center gap-2 text-[10px] text-[#666]">
                        <User size={10} />
                        <span>By: <strong className="text-[#aaa]">{c.investigator}</strong></span>
                        <span>&bull;</span>
                        <span>Target: <strong className="text-[#aaa]">{c.targetType} ({c.targetId})</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Paper>
        </div>

        {/* Right Column - Case Details Folder */}
        {selectedCase && (
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-6">
              <Paper className="p-6 border border-[#1a1a1a] rounded-xl bg-[#0a0a0a] space-y-6">
                
                {/* Header detail */}
                <div className="border-b border-[#1a1a1a] pb-4 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-[#555] font-mono uppercase tracking-widest font-bold">
                      Investigation Folder Details
                    </span>
                    <Typography variant="h5" className="font-serif italic text-white tracking-tight mt-1">
                      {selectedCase.title}
                    </Typography>
                    <span className="text-[10px] text-[#666] font-mono block mt-1.5">
                      Created: {new Date(selectedCase.createdAt).toLocaleString()} &bull; Last Update: {new Date(selectedCase.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  {currentUser.role !== "Read-Only" && !isEditingCase && (
                    <button
                      onClick={() => setIsEditingCase(true)}
                      className="px-3.5 py-1.5 border border-[#F27D26]/30 hover:border-[#F27D26] bg-[#111] text-[#F27D26] font-semibold text-xs rounded transition-all duration-300 uppercase tracking-widest"
                    >
                      Update Folder
                    </button>
                  )}
                </div>

                {/* Case Status and Assignment (Normal vs Edit Mode) */}
                {isEditingCase ? (
                  <div className="p-4 border border-[#F27D26]/20 bg-[#150f0c] rounded-lg space-y-4">
                    <Typography className="text-xs text-[#F27D26] font-mono uppercase tracking-wider font-bold mb-2">
                      Update Folder Settings
                    </Typography>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-[#888] font-mono uppercase tracking-wider">Investigator</label>
                          <select
                            value={editInvestigator}
                            onChange={(e) => setEditInvestigator(e.target.value)}
                            className="bg-[#111] border border-[#222] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50"
                          >
                            <option value="admin@pharmascan.gov.rw">Admin</option>
                            <option value="investigator@pharmascan.gov.rw">Investigator Jean</option>
                            <option value="auditor@pharmascan.gov.rw">Read-Only Auditor</option>
                            <option value="Unassigned">Unassigned</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-[#888] font-mono uppercase tracking-wider">Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="bg-[#111] border border-[#222] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50"
                          >
                            <option value="Open">Active / Open</option>
                            <option value="Pending Review">Pending Review</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-[#888] font-mono uppercase tracking-wider">Investigative Findings</label>
                          <textarea
                            rows={4}
                            value={editFindings}
                            onChange={(e) => setEditFindings(e.target.value)}
                            className="bg-[#111] border border-[#222] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 font-sans leading-relaxed"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setIsEditingCase(false)}
                        className="px-3 py-1.5 bg-[#1a1a1a] text-[#888] rounded text-xs uppercase tracking-widest font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateCase}
                        disabled={isSavingCase}
                        className="px-4 py-1.5 bg-[#F27D26] hover:bg-[#df6c1c] text-black rounded text-xs uppercase tracking-widest font-bold"
                      >
                        {isSavingCase ? "Saving..." : "Save Dossier"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-[9px] text-[#555] font-mono uppercase tracking-wider block">Status</span>
                      <div className="mt-1">{getStatusChip(selectedCase.status)}</div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#555] font-mono uppercase tracking-wider block">Assigned Investigator</span>
                      <span className="font-bold text-white mt-1.5 block">{selectedCase.investigator}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#555] font-mono uppercase tracking-wider block">Target Entity</span>
                      <span className="font-medium text-[#aaa] mt-1.5 block uppercase">{selectedCase.targetType}: {selectedCase.targetId}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#555] font-mono uppercase tracking-wider block">Claims Count</span>
                      <span className="font-mono font-bold text-[#F27D26] text-sm block mt-1">{loadingRelated ? "Calculating..." : relatedClaims.length} Claims</span>
                    </div>
                  </div>
                )}

                {/* Case Description */}
                <div>
                  <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[9px] mb-2">
                    Case Description
                  </Typography>
                  <Paper className="p-4 border border-[#1a1a1a] bg-[#050505] rounded-lg text-xs leading-relaxed text-[#aaa] font-sans">
                    {selectedCase.description || "No dossier description entered."}
                  </Paper>
                </div>

                {/* Case Findings */}
                {!isEditingCase && (
                  <div>
                    <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[9px] mb-2">
                      Investigative Findings
                    </Typography>
                    <Paper className="p-4 border border-[#1a1a1a] bg-[#050505] rounded-lg text-xs leading-relaxed text-[#e0e0e0] font-sans whitespace-pre-wrap">
                      {selectedCase.findings || "No formal findings have been compiled yet. Investigators can update this with verified evidence."}
                    </Paper>
                  </div>
                )}

                {/* Gemini AI forensic auditing on Case target */}
                <Paper className="p-4 border border-[#F27D26]/20 bg-[#0a0a0a] rounded-lg shadow-none">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#F27D26]" />
                      <Typography variant="subtitle2" className="font-semibold text-white uppercase tracking-wider text-[9px]">
                        Forensic AI Assistant
                      </Typography>
                    </div>
                    {currentUser.role !== "Read-Only" && (
                      <button
                        onClick={triggerGeminiCaseAudit}
                        disabled={isLoadingAi || loadingRelated || relatedClaims.length === 0}
                        className="text-[9px] px-3 py-1 bg-[#111] hover:bg-[#222] text-[#F27D26] border border-[#F27D26]/30 font-semibold rounded uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        {isLoadingAi ? <CircularProgress size={10} color="inherit" /> : <Sparkles size={10} />}
                        {isLoadingAi ? "Auditing Dossier..." : "Run AI Case Investigator"}
                      </button>
                    )}
                  </div>
                  
                  {isLoadingAi ? (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-[#F27D26]">
                      <CircularProgress size={20} color="inherit" />
                      <span className="text-[10px] text-[#666] font-semibold text-center">Gemini Forensic is conducting cross-file correlation on {selectedCase.targetType} "{selectedCase.targetId}"...</span>
                    </div>
                  ) : (
                    <Typography variant="caption" className="text-[#666] block leading-normal text-[10px] italic">
                      Invoke Gemini AI to run a deep forensic review of this target. Gemini will ingest all {relatedClaims.length} matched claims, run statistical correlations, detect anomalies, and draft a forensic case report into the audit log.
                    </Typography>
                  )}
                </Paper>

                {/* Matched Claims Timeline inside case */}
                <div>
                  <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[9px] mb-3">
                    Linked Claims Records ({relatedClaims.length})
                  </Typography>

                  {loadingRelated ? (
                    <CircularProgress size={16} className="text-[#F27D26]" />
                  ) : relatedClaims.length === 0 ? (
                    <span className="text-xs text-[#555] italic text-[#555]">No active claims found matching this target ID.</span>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border border-[#1a1a1a] rounded bg-[#0d0d0d] divide-y divide-[#151515] text-xs font-mono">
                      {relatedClaims.map((rc) => (
                        <div key={rc.id} className="p-3 flex items-center justify-between hover:bg-[#111] transition-colors">
                          <div className="space-y-1">
                            <span className="text-white font-sans font-medium">{rc.medicineName} (x{rc.quantity})</span>
                            <div className="flex gap-2 text-[10px] text-[#555] flex-wrap">
                              <span>Date: {rc.date}</span>
                              <span>&bull;</span>
                              <span>MD: {rc.doctorName}</span>
                              <span>&bull;</span>
                              <span>Pharmacy: {rc.facilityName}</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <span className="text-white font-bold">{rc.amount.toLocaleString()} RWF</span>
                            <div className="text-[9px] uppercase font-bold text-[#F27D26]">
                              {rc.isFlagged ? "Clinical Warning" : "Clean"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Case Note logs */}
                <div className="space-y-3 pt-4 border-t border-[#1a1a1a]">
                  <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[9px]">
                    Investigation History & Audit Logs
                  </Typography>

                  {notesHistory.length > 0 ? (
                    <div className="space-y-3">
                      {notesHistory.map((note) => (
                        <Paper key={note.id} className="p-3 border border-[#1a1a1a] rounded bg-[#050505] text-xs">
                          <div className="flex justify-between items-center mb-1.5 border-b border-[#151515] pb-1">
                            <span className="font-bold text-[#F27D26] font-mono text-[9px]">{note.author}</span>
                            <span className="text-[#444] font-mono text-[9px]">
                              {new Date(note.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[#aaa] leading-relaxed whitespace-pre-wrap font-mono text-[11px]">{note.note}</p>
                        </Paper>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[#555] italic block text-[#555]">No log entries filed for this dossier yet.</span>
                  )}

                  {/* Add handwritten Note Form */}
                  {currentUser.role !== "Read-Only" && (
                    <div className="space-y-3 pt-3">
                      <div className="flex flex-col gap-1">
                        <textarea
                          placeholder="File a handwritten investigative finding, audit progress, or call log..."
                          rows={2}
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] placeholder-[#444] focus:outline-none focus:border-[#F27D26]/50 font-sans"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddNote}
                          disabled={isSubmittingNote || !newNote.trim()}
                          className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] text-[#F27D26] border border-[#F27D26]/30 font-semibold text-[10px] uppercase tracking-widest rounded transition-colors"
                        >
                          {isSubmittingNote ? "Filing..." : "File Audit Note"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </Paper>
            </div>
          </div>
        )}

      </div>

      {/* CREATE NEW CASE MODAL */}
      <Dialog
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        maxWidth="sm"
        fullWidth
        classes={{ paper: "bg-[#0a0a0a] border border-[#1a1a1a] text-[#e0e0e0]" }}
      >
        <DialogTitle className="font-serif italic text-[#F27D26] border-b border-[#151515] text-lg">
          Initialize Investigation Folder
        </DialogTitle>
        <form onSubmit={handleCreateCase}>
          <DialogContent className="space-y-4 pt-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Folder Title / Subject</label>
              <input
                type="text"
                required
                placeholder="Review: High unit-cost claims spike"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 placeholder-[#444]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Target Entity Type</label>
                <select
                  value={newTargetType}
                  onChange={(e) => setNewTargetType(e.target.value)}
                  className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50"
                >
                  <option value="patient">Patient Card ID (RAMA)</option>
                  <option value="doctor">Prescribing Doctor (MD)</option>
                  <option value="facility">Dispensing Pharmacy (Facility)</option>
                  <option value="claim">Single Claim ID</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Target Entity ID (Exact ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RW/002341, Dr. Gasana Emmanuel"
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 placeholder-[#444]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Dossier Description</label>
              <textarea
                placeholder="Outline the reason for opening this folder, initial clinical thresholds violated, or flagged anomalies..."
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 placeholder-[#444] font-sans"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Initial Audit Findings</label>
              <textarea
                placeholder="Enter initial evidence, hospital logs matches, or suspect pharmacy transactions..."
                rows={3}
                value={newFindings}
                onChange={(e) => setNewFindings(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 placeholder-[#444] font-sans"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Lead Investigator Assignment</label>
              <select
                value={newInvestigator}
                onChange={(e) => setNewInvestigator(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50"
              >
                <option value="">Auto-Assign to Myself</option>
                <option value="admin@pharmascan.gov.rw">Admin</option>
                <option value="investigator@pharmascan.gov.rw">Investigator Jean</option>
                <option value="auditor@pharmascan.gov.rw">Read-Only Auditor</option>
                <option value="Unassigned">Leave Unassigned</option>
              </select>
            </div>
          </DialogContent>
          <DialogActions className="p-6 border-t border-[#151515] bg-[#0d0d0d] gap-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-[#1a1a1a] text-[#888] rounded text-xs uppercase tracking-widest font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingNewCase}
              className="px-5 py-2 bg-[#F27D26] hover:bg-[#df6c1c] text-black rounded text-xs uppercase tracking-widest font-bold"
            >
              {isSubmittingNewCase ? "Filing..." : "File Dossier"}
            </button>
          </DialogActions>
        </form>
      </Dialog>

    </div>
  );
}
