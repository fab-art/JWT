/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Paper, Typography, Box, CircularProgress, Alert } from "@mui/material";
import { Activity, ShieldCheck, Key, Eye, UserCircle } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: { email: string; role: string }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const activeEmail = customEmail || email;
    const activePassword = customPassword || password;

    if (!activeEmail || !activePassword) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: activeEmail, password: activePassword })
      });

      const data = await res.json();
      if (res.ok) {
        onLoginSuccess(data.token, data.user);
      } else {
        setError(data.error || "Authentication failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Server connection failed. Make sure server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: "Admin" | "Investigator" | "Read-Only") => {
    let demoEmail = "";
    let demoPass = "";

    switch (role) {
      case "Admin":
        demoEmail = "admin@pharmascan.gov.rw";
        demoPass = "admin123";
        break;
      case "Investigator":
        demoEmail = "investigator@pharmascan.gov.rw";
        demoPass = "investigator123";
        break;
      case "Read-Only":
        demoEmail = "auditor@pharmascan.gov.rw";
        demoPass = "auditor123";
        break;
    }

    setEmail(demoEmail);
    setPassword(demoPass);
    handleLogin(undefined, demoEmail, demoPass);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-[#e0e0e0]">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo and Identity */}
        <div className="text-center space-y-2">
          <div className="inline-flex bg-gradient-to-br from-[#F27D26] to-[#df6c1c] text-black p-3 rounded-2xl shadow-xl border border-[#ff9f59]/20">
            <Activity size={28} />
          </div>
          <div>
            <Typography variant="h4" className="font-serif italic text-white tracking-widest text-2xl mt-2 leading-none">
              PharmaScan
            </Typography>
            <span className="text-[9px] text-[#555] font-bold uppercase tracking-widest block mt-1.5">
              Secure Pharmacy Auditing & Claims Intelligence
            </span>
          </div>
        </div>

        {/* Login Card */}
        <Paper elevation={0} className="p-6 border border-[#1a1a1a] rounded-xl bg-[#0a0a0a]">
          <Typography variant="subtitle2" className="text-white font-semibold uppercase tracking-widest text-[10px] mb-4 text-center">
            Secured Access Portal
          </Typography>

          {error && (
            <Alert severity="error" className="bg-[#1a0c0c] text-[#ff6b6b] border border-[#4a1c1c] text-xs font-semibold rounded mb-4 py-1.5">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Government Email</label>
              <input
                type="email"
                placeholder="auditor@pharmascan.gov.rw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 placeholder-[#444]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Password Credentials</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#F27D26]/50 placeholder-[#444]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-xs uppercase tracking-widest font-bold text-black bg-[#F27D26] hover:bg-[#df6c1c] py-2.5 rounded transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <CircularProgress size={14} color="inherit" /> : <Key size={14} />}
              {loading ? "Verifying..." : "Authorize Portal Session"}
            </button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-[#1a1a1a]"></div>
            <span className="flex-shrink mx-4 text-[9px] text-[#444] uppercase tracking-widest font-bold">OR</span>
            <div className="flex-grow border-t border-[#1a1a1a]"></div>
          </div>

          <button
            onClick={() => handleDemoLogin("Read-Only")}
            disabled={loading}
            className="w-full text-xs uppercase tracking-widest font-bold text-[#e0e0e0] bg-[#111] border border-[#1a1a1a] hover:bg-[#1a1a1a] hover:border-[#F27D26]/30 py-2.5 rounded transition-all duration-300 flex items-center justify-center gap-2 mb-2"
          >
            <UserCircle size={14} className="text-[#888]" />
            <span>Continue as Guest</span>
          </button>

          {/* Quick Demologin Selector */}
          <div className="mt-6 pt-6 border-t border-[#1a1a1a] space-y-3">
            <span className="text-[9px] text-[#555] font-bold uppercase tracking-widest text-center block">
              Quick Role-Based Demo Accounts
            </span>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDemoLogin("Admin")}
                className="py-2 px-1 border border-[#ff9f59]/20 hover:border-[#F27D26]/50 bg-[#150f0c] hover:bg-[#1a110a] rounded flex flex-col items-center justify-center text-[10px] text-white font-bold transition-all duration-300"
              >
                <ShieldCheck size={14} className="text-[#F27D26] mb-1" />
                <span>Admin</span>
              </button>
              
              <button
                onClick={() => handleDemoLogin("Investigator")}
                className="py-2 px-1 border border-[#3b82f6]/20 hover:border-[#3b82f6]/50 bg-[#0e121a] hover:bg-[#101625] rounded flex flex-col items-center justify-center text-[10px] text-white font-bold transition-all duration-300"
              >
                <Key size={14} className="text-[#3b82f6] mb-1" />
                <span>Investigator</span>
              </button>

              <button
                onClick={() => handleDemoLogin("Read-Only")}
                className="py-2 px-1 border border-[#10b981]/20 hover:border-[#10b981]/50 bg-[#0c1611] hover:bg-[#102018] rounded flex flex-col items-center justify-center text-[10px] text-white font-bold transition-all duration-300"
              >
                <Eye size={14} className="text-[#10b981] mb-1" />
                <span>Read-Only</span>
              </button>
            </div>
          </div>
        </Paper>

        <p className="text-center text-[9px] text-[#444] font-mono uppercase tracking-widest">
          Authorized RSSB Government Agencies Only &bull; Jan 2026
        </p>
      </div>
    </div>
  );
}
