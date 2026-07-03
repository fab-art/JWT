/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Button, CircularProgress, Typography, Alert, Paper } from "@mui/material";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

interface UploadCenterProps {
  token: string;
  onUploadSuccess: () => void;
}

export default function UploadCenter({ token, onUploadSuccess }: UploadCenterProps) {
  const [loadingType, setLoadingType] = useState<"voucher" | "facility" | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<Record<string, boolean>>({});

  const handleDrag = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [key]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDrop = async (e: React.DragEvent, type: "voucher" | "facility") => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [type]: false }));

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await uploadFile(e.dataTransfer.files[0], type);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "voucher" | "facility") => {
    if (e.target.files && e.target.files[0]) {
      await uploadFile(e.target.files[0], type);
    }
  };

  const uploadFile = async (file: File, type: "voucher" | "facility") => {
    setLoadingType(type);
    setSuccessMsg(null);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = type === "voucher" ? "/api/vouchers/upload" : "/api/facility-records/upload";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload and parse file.");
      }

      setSuccessMsg(data.message || "File uploaded and processed successfully!");
      onUploadSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred during file upload.");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Pharmacy Claims Dropzone */}
      <Paper
        elevation={0}
        onDragEnter={(e) => handleDrag(e, "voucher")}
        onDragOver={(e) => handleDrag(e, "voucher")}
        onDragLeave={(e) => handleDrag(e, "voucher")}
        onDrop={(e) => handleDrop(e, "voucher")}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded p-8 transition-all duration-300 ${
          dragActive["voucher"]
            ? "border-[#F27D26] bg-[#1a110a]"
            : "border-[#1a1a1a] hover:border-[#F27D26]/50 bg-[#0a0a0a]"
        }`}
      >
        <input
          id="voucher-upload-input"
          type="file"
          accept=".csv, .xlsx, .xls, .ods"
          className="hidden"
          onChange={(e) => handleFileChange(e, "voucher")}
        />
        <label htmlFor="voucher-upload-input" className="flex flex-col items-center cursor-pointer w-full text-center">
          <div className="bg-[#111] p-3.5 border border-[#222] rounded-full text-[#F27D26] mb-3 shadow-inner">
            <Upload size={24} />
          </div>
          <Typography variant="h6" className="font-serif italic text-white text-base mb-1">
            Pharmacy Claim Vouchers
          </Typography>
          <Typography variant="body2" className="text-[#666] text-xs mb-4 max-w-xs leading-relaxed">
            Drag and drop or click to upload <strong className="text-[#888]">Claims CSV/Excel</strong> files (e.g. patients, medications, doctors, copay)
          </Typography>
          {loadingType === "voucher" ? (
            <div className="flex items-center gap-2 text-[#F27D26] text-xs font-semibold uppercase tracking-wider">
              <CircularProgress size={16} color="inherit" />
              <span>Parsing & Auditing...</span>
            </div>
          ) : (
            <Button variant="outlined" component="span" size="small" className="text-[#e0e0e0] border-[#222] hover:border-[#F27D26]/40 uppercase text-[10px] tracking-wider px-4">
              Select Voucher File
            </Button>
          )}
        </label>
      </Paper>

      {/* Hospital Logs Dropzone */}
      <Paper
        elevation={0}
        onDragEnter={(e) => handleDrag(e, "facility")}
        onDragOver={(e) => handleDrag(e, "facility")}
        onDragLeave={(e) => handleDrag(e, "facility")}
        onDrop={(e) => handleDrop(e, "facility")}
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded p-8 transition-all duration-300 ${
          dragActive["facility"]
            ? "border-[#F27D26] bg-[#1a110a]"
            : "border-[#1a1a1a] hover:border-[#F27D26]/50 bg-[#0a0a0a]"
        }`}
      >
        <input
          id="facility-upload-input"
          type="file"
          accept=".csv, .xlsx, .xls, .ods"
          className="hidden"
          onChange={(e) => handleFileChange(e, "facility")}
        />
        <label htmlFor="facility-upload-input" className="flex flex-col items-center cursor-pointer w-full text-center">
          <div className="bg-[#111] p-3.5 border border-[#222] rounded-full text-[#F27D26] mb-3 shadow-inner">
            <FileSpreadsheet size={24} />
          </div>
          <Typography variant="h6" className="font-serif italic text-white text-base mb-1">
            Hospital Encounter Logs
          </Typography>
          <Typography variant="body2" className="text-[#666] text-xs mb-4 max-w-xs leading-relaxed">
            Drag and drop or click to upload <strong className="text-[#888]">Facility Registry logs</strong> to verify if pharmacy patient visits actually took place
          </Typography>
          {loadingType === "facility" ? (
            <div className="flex items-center gap-2 text-[#F27D26] text-xs font-semibold uppercase tracking-wider">
              <CircularProgress size={16} color="inherit" />
              <span>Importing Encounters...</span>
            </div>
          ) : (
            <Button variant="outlined" component="span" size="small" className="text-[#e0e0e0] border-[#222] hover:border-[#F27D26]/40 uppercase text-[10px] tracking-wider px-4">
              Select Hospital Log
            </Button>
          )}
        </label>
      </Paper>

      {/* Messages */}
      {(successMsg || errorMsg) && (
        <div className="col-span-1 md:col-span-2">
          {successMsg && (
            <Alert 
              severity="success" 
              icon={<CheckCircle className="h-4 w-4" />} 
              className="rounded-sm border border-[#1b3d22] bg-[#0c1a10] text-[#76df8b]"
            >
              {successMsg}
            </Alert>
          )}
          {errorMsg && (
            <Alert 
              severity="error" 
              icon={<AlertCircle className="h-4 w-4" />} 
              className="rounded-sm border border-[#4a1c1c] bg-[#1a0c0c] text-[#ff6b6b]"
            >
              {errorMsg}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

