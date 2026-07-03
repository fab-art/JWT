/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Container, Typography, Paper, Box, CircularProgress, Tabs, Tab } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Activity, ShieldAlert, Sparkles, Network, User, Clock, CheckCircle, FolderHeart, Terminal, LogOut } from "lucide-react";
import { DashboardStats, Voucher } from "./types";
import UploadCenter from "./components/UploadCenter";
import MetricCards from "./components/MetricCards";
import ClaimsList from "./components/ClaimsList";
import CrossFacilityMatches from "./components/CrossFacilityMatches";
import NetworkGraphViewer from "./components/NetworkGraphViewer";
import DoctorAnalytics from "./components/DoctorAnalytics";
import RapidRevisits from "./components/RapidRevisits";
import LoginScreen from "./components/LoginScreen";
import CaseManagement from "./components/CaseManagement";
import AuditTrailList from "./components/AuditTrailList";

// Customized "Sophisticated Dark" theme for Material UI components
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#F27D26", // Sophisticated Deep Orange / Copper
    },
    background: {
      default: "#050505", // Deep pitch black
      paper: "#0a0a0a",   // Clean elevated black
    },
    text: {
      primary: "#e0e0e0",
      secondary: "#888888",
    },
    divider: "#1a1a1a",
  },
  typography: {
    fontFamily: '"Inter", sans-serif',
    h1: { fontFamily: '"Playfair Display", serif' },
    h2: { fontFamily: '"Playfair Display", serif' },
    h3: { fontFamily: '"Playfair Display", serif' },
    h4: { fontFamily: '"Playfair Display", serif' },
    h5: { fontFamily: '"Playfair Display", serif' },
    h6: { fontFamily: '"Playfair Display", serif' },
    subtitle1: { fontFamily: '"Playfair Display", serif' },
    subtitle2: { fontFamily: '"Playfair Display", serif' },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: "8px",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          color: "#888888",
          fontSize: "0.75rem",
          minHeight: "48px",
          "&.Mui-selected": {
            color: "#F27D26",
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: "#F27D26",
          height: "3px",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ ownerState }: any) => ({
          borderRadius: "6px",
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.8rem",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
          ...(ownerState.variant === "contained" && ownerState.color === "primary" && {
            backgroundColor: "#F27D26",
            color: "#050505",
            "&:hover": {
              backgroundColor: "#df6c1c",
            },
          }),
          ...(ownerState.variant === "outlined" && ownerState.color === "primary" && {
            borderColor: "#1a1a1a",
            color: "#e0e0e0",
            "&:hover": {
              borderColor: "#F27D26",
              backgroundColor: "#ffffff05",
            },
          }),
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #1a1a1a",
          padding: "12px 16px",
          color: "#e0e0e0",
        },
        head: {
          backgroundColor: "#0d0d0d",
          color: "#888888",
          fontWeight: 600,
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          borderBottom: "1px solid #1a1a1a",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#0a0a0a",
          borderLeft: "1px solid #1a1a1a",
          backgroundImage: "none",
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          backgroundColor: "#111111",
        },
      },
    },
  },
});

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem("pharmascan_token");
  });
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(() => {
    const saved = sessionStorage.getItem("pharmascan_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      // Fetch stats and vouchers in parallel using JWT Bearer token
      const [statsRes, vouchersRes] = await Promise.all([
        fetch("/api/dashboard-stats", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/vouchers", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (statsRes.ok && vouchersRes.ok) {
        const statsData = await statsRes.json();
        const vouchersData = await vouchersRes.json();
        setStats(statsData);
        setVouchers(vouchersData);
      } else if (statsRes.status === 401 || vouchersRes.status === 401) {
        // Expired or bad token, force logout
        handleLogout();
      }
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (newToken: string, user: { email: string; role: string }) => {
    sessionStorage.setItem("pharmascan_token", newToken);
    sessionStorage.setItem("pharmascan_user", JSON.stringify(user));
    setToken(newToken);
    setCurrentUser(user);
    setCurrentTab(0);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("pharmascan_token");
    sessionStorage.removeItem("pharmascan_user");
    setToken(null);
    setCurrentUser(null);
    setStats(null);
    setVouchers([]);
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  // If not authenticated, render Login Gate
  if (!token || !currentUser) {
    return (
      <ThemeProvider theme={darkTheme}>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <div className="min-h-screen bg-[#050505] font-sans text-[#e0e0e0] selection:bg-[#F27D26]/30 selection:text-white">
        {/* 1. Global Navigation / Header Bar */}
        <div className="bg-[#0a0a0a] border-b border-[#1a1a1a] py-4 px-6 sticky top-0 z-50 shadow-sm/50">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-[#F27D26] to-[#df6c1c] text-black p-2.5 rounded-lg border border-[#ff9f59]/20 shadow-md">
                <Activity size={22} />
              </div>
              <div>
                <Typography variant="h6" className="font-serif italic tracking-wider text-[#F27D26] leading-none mb-1">
                  PharmaScan
                </Typography>
                <span className="text-[10px] text-[#666] font-bold uppercase tracking-widest block">
                  Pharmacy Claims Intelligence & Fraud Detection Platform
                </span>
              </div>
            </div>

            {/* User Role and Live Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#888] font-semibold bg-[#111] border border-[#222] rounded-full py-1.5 px-4">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-[#F27D26]" />
                <span>UTC: <strong className="font-mono text-[#e0e0e0]">2026-07-03 09:34:19</strong></span>
              </div>
              <div className="h-3 w-px bg-[#222]" />
              <div className="flex items-center gap-1.5">
                <User size={13} className="text-[#888]" />
                <span>Operator: <strong className="text-[#e0e0e0]">{currentUser.email} ({currentUser.role})</strong></span>
              </div>
              <div className="h-3 w-px bg-[#222]" />
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 text-[#F27D26] hover:text-[#df6c1c] font-bold cursor-pointer transition-colors"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Main Dashboard Content Area */}
        <Container maxWidth="lg" className="py-8">
          
          {/* Upload Hub & File ingest */}
          {currentUser.role !== "Read-Only" && (
            <UploadCenter token={token} onUploadSuccess={handleRefresh} />
          )}

          {loading || !stats ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#F27D26]">
              <CircularProgress color="inherit" size={28} />
              <Typography variant="body2" className="font-semibold text-[#888]">
                Aggregating claims database & running clinical validations...
              </Typography>
            </div>
          ) : (
            <>
              {/* KPI metrics row */}
              <MetricCards stats={stats} />

              {/* Workspace tabs navigator */}
              <Paper elevation={0} className="border border-[#1a1a1a] rounded-xl overflow-hidden bg-[#0a0a0a] mb-8">
                <Tabs
                  value={currentTab}
                  onChange={(e, val) => setCurrentTab(val)}
                  className="bg-[#0e0e0e] border-b border-[#1a1a1a]"
                  textColor="primary"
                  indicatorColor="primary"
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab
                    icon={<ShieldAlert size={14} className="mr-1.5" />}
                    iconPosition="start"
                    label="Claims Register"
                    className="font-bold text-xs py-4 normal-case"
                  />
                  <Tab
                    icon={<CheckCircle size={14} className="mr-1.5" />}
                    iconPosition="start"
                    label="Cross-Facility Verification"
                    className="font-bold text-xs py-4 normal-case"
                  />
                  <Tab
                    icon={<Network size={14} className="mr-1.5" />}
                    iconPosition="start"
                    label="Doctor/Patient Networks"
                    className="font-bold text-xs py-4 normal-case"
                  />
                  <Tab
                    icon={<Activity size={14} className="mr-1.5" />}
                    iconPosition="start"
                    label="Prescriber Audits"
                    className="font-bold text-xs py-4 normal-case"
                  />
                  <Tab
                    icon={<Clock size={14} className="mr-1.5" />}
                    iconPosition="start"
                    label="Revisit succession"
                    className="font-bold text-xs py-4 normal-case"
                  />
                  <Tab
                    icon={<FolderHeart size={14} className="mr-1.5" />}
                    iconPosition="start"
                    label="Case folders"
                    className="font-bold text-xs py-4 normal-case"
                  />
                  {currentUser.role === "Admin" && (
                    <Tab
                      icon={<Terminal size={14} className="mr-1.5" />}
                      iconPosition="start"
                      label="Security Ledger"
                      className="font-bold text-xs py-4 normal-case"
                    />
                  )}
                </Tabs>

                <div className="p-6">
                  {currentTab === 0 && (
                    <ClaimsList token={token} currentUser={currentUser} vouchers={vouchers} onActionComplete={handleRefresh} />
                  )}
                  {currentTab === 1 && (
                    <CrossFacilityMatches token={token} />
                  )}
                  {currentTab === 2 && (
                    <NetworkGraphViewer token={token} />
                  )}
                  {currentTab === 3 && (
                    <DoctorAnalytics token={token} />
                  )}
                  {currentTab === 4 && (
                    <RapidRevisits token={token} />
                  )}
                  {currentTab === 5 && (
                    <CaseManagement token={token} currentUser={currentUser} onRefreshStats={handleRefresh} />
                  )}
                  {currentTab === 6 && currentUser.role === "Admin" && (
                    <AuditTrailList token={token} />
                  )}
                </div>
              </Paper>
            </>
          )}
        </Container>

        {/* 3. Understated Footer and Clinical Standards */}
        <footer className="bg-[#0a0a0a] border-t border-[#1a1a1a] py-6 px-6 text-center text-[10px] text-[#444] font-mono">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <span>
              PharmaScan Claims Intelligence Platform &copy; 2026. All Rights Reserved.
            </span>
            <div className="flex flex-wrap justify-center gap-4 text-[10px] text-[#555] uppercase tracking-widest">
              <span>Aligned with RHIA (Jan 2025)</span>
              <span>&bull;</span>
              <span className="text-[#666]">UCG 2023 Guidelines</span>
              <span>&bull;</span>
              <span className="text-[#F27D26]/70">WHO & GINA Standards</span>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
