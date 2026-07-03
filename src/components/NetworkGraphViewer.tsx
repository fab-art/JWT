/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Paper, Typography, FormControlLabel, Checkbox, Card, CardContent } from "@mui/material";
import { Search, ZoomIn, ZoomOut, RotateCcw, Info, HelpCircle } from "lucide-react";
import { NetworkGraph, NetworkNode, NetworkEdge } from "../types";

interface NetworkGraphViewerProps {
  token: string;
}

export default function NetworkGraphViewer({ token }: NetworkGraphViewerProps) {
  const [graph, setGraph] = useState<NetworkGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [highlightedNeighbors, setHighlightedNeighbors] = useState<Set<string>>(new Set());

  // Filters
  const [showPatients, setShowPatients] = useState(true);
  const [showDoctors, setShowDoctors] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showMedicines, setShowMedicines] = useState(true);

  // SVG Pan & Zoom states
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Physics simulation coordinates stored in refs to avoid React re-render lag
  const nodePositionsRef = useRef<Record<string, { x: number; y: number; vx: number; vy: number }>>({});
  const [renderedPositions, setRenderedPositions] = useState<Record<string, { x: number; y: number }>>({});
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    fetchGraph();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/network-graph", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data: NetworkGraph = await res.json();
        setGraph(data);

        // Initialize positions randomly in center area (600x400)
        const initialPositions: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
        data.nodes.forEach((node, idx) => {
          // Spread them on a circle to start cleanly
          const angle = (idx / data.nodes.length) * 2 * Math.PI;
          const r = 150 + Math.random() * 50;
          initialPositions[node.id] = {
            x: 300 + Math.cos(angle) * r,
            y: 200 + Math.sin(angle) * r,
            vx: 0,
            vy: 0
          };
        });
        nodePositionsRef.current = initialPositions;

        // Run force simulation loop
        startSimulation();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startSimulation = () => {
    const step = () => {
      if (!graph) return;

      const positions = nodePositionsRef.current;
      const nodes = graph.nodes;
      const links = graph.links;

      // 1. Repulsion force between all nodes (Electrostatic repulsion)
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        const p1 = positions[n1.id];
        if (!p1) continue;

        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const p2 = positions[n2.id];
          if (!p2) continue;

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          // Only apply repulsion within reasonable distance
          if (dist < 250) {
            const force = 180 / distSq; // force strength inverse square
            const fX = (dx / dist) * force;
            const fY = (dy / dist) * force;

            // Apply opposite forces
            p1.vx -= fX;
            p1.vy -= fY;
            p2.vx += fX;
            p2.vy += fY;
          }
        }
      }

      // 2. Spring attraction force along edges
      links.forEach(link => {
        const sId = typeof link.source === "object" ? (link.source as any).id : link.source;
        const tId = typeof link.target === "object" ? (link.target as any).id : link.target;

        const pSource = positions[sId];
        const pTarget = positions[tId];

        if (pSource && pTarget) {
          const dx = pTarget.x - pSource.x;
          const dy = pTarget.y - pSource.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const targetDist = 90; // Preferred link distance
          const k = 0.045; // Spring constant
          const force = (dist - targetDist) * k;

          const fX = (dx / dist) * force;
          const fY = (dy / dist) * force;

          pSource.vx += fX;
          pSource.vy += fY;
          pTarget.vx -= fX;
          pTarget.vy -= fY;
        }
      });

      // 3. Gravity pulling toward center (300, 200) and update positions with friction
      const gravity = 0.015;
      const friction = 0.78; // Higher values make it settle faster

      const nextRendered: Record<string, { x: number; y: number }> = {};

      nodes.forEach(node => {
        const p = positions[node.id];
        if (!p) return;

        // Pull to center
        p.vx += (300 - p.x) * gravity;
        p.vy += (200 - p.y) * gravity;

        // Update positions
        p.x += p.vx;
        p.y += p.vy;

        // Apply friction damping
        p.vx *= friction;
        p.vy *= friction;

        // Boundary constraint
        p.x = Math.max(50, Math.min(550, p.x));
        p.y = Math.max(50, Math.min(350, p.y));

        nextRendered[node.id] = { x: p.x, y: p.y };
      });

      setRenderedPositions(nextRendered);
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  // Node Click neighbor inspector
  const handleNodeClick = (node: NetworkNode) => {
    if (selectedNode?.id === node.id) {
      // Toggle off
      setSelectedNode(null);
      setHighlightedNeighbors(new Set());
    } else {
      setSelectedNode(node);
      const neighbors = new Set<string>();
      neighbors.add(node.id);

      if (graph) {
        graph.links.forEach(l => {
          if (l.source === node.id) neighbors.add(l.target);
          if (l.target === node.id) neighbors.add(l.source);
        });
      }
      setHighlightedNeighbors(neighbors);
    }
  };

  // SVG Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPanX(e.clientX - dragStart.x);
      setPanY(e.clientY - dragStart.y);
    }
  };

  const handleMouseUpOrLeave = () => {
    setIsDraggingCanvas(false);
  };

  const handleResetPan = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Apply filters
  const isNodeVisible = (node: NetworkNode) => {
    if (node.type === "patient" && !showPatients) return false;
    if (node.type === "doctor" && !showDoctors) return false;
    if (node.type === "facility" && !showFacilities) return false;
    if (node.type === "medicine" && !showMedicines) return false;

    if (searchQuery) {
      return node.label.toLowerCase().includes(searchQuery.toLowerCase());
    }

    return true;
  };

  if (loading || !graph) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-2 text-[#F27D26]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />
        <span className="text-xs font-semibold text-[#888]">Simulating doctor-patient networks...</span>
      </div>
    );
  }

  // Filter links where both source and target are visible nodes
  const visibleNodesMap = new Map(graph.nodes.filter(isNodeVisible).map(n => [n.id, n]));
  const visibleLinks = graph.links.filter(l => visibleNodesMap.has(l.source) && visibleNodesMap.has(l.target));

  return (
    <div className="mb-8">
      <div className="mb-6">
        <Typography variant="h5" className="font-serif italic text-white tracking-wider">
          Doctor & Patient Networks
        </Typography>
        <Typography variant="caption" className="text-[#555] uppercase tracking-widest text-[9px] mt-0.5 block">
          Investigate structural fraud relationships. Search prescribers and trace claimant paths to pharmacies.
        </Typography>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph control Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Paper elevation={0} className="p-5 border border-[#1a1a1a] rounded-sm bg-[#0a0a0a] space-y-4">
            <Typography variant="subtitle2" className="text-[#666] font-semibold uppercase tracking-widest text-[10px]">
              Network Controls
            </Typography>

            {/* Search */}
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#555]">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search node..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 pr-3 py-1.5 border border-[#1a1a1a] rounded bg-[#111] text-xs text-[#e0e0e0] placeholder-[#555] focus:outline-none focus:border-[#F27D26]/50 transition-colors"
              />
            </div>

            {/* Toggles */}
            <div className="flex flex-col space-y-1">
              <Typography variant="caption" className="text-[#444] font-bold uppercase tracking-wider text-[8px] block mb-1">
                Filter Node Types
              </Typography>
              <FormControlLabel
                control={<Checkbox size="small" checked={showPatients} onChange={(e) => setShowPatients(e.target.checked)} className="text-[#82b1ff]" />}
                label={<span className="text-[11px] font-medium text-[#e0e0e0]">Patients (Blue)</span>}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={showDoctors} onChange={(e) => setShowDoctors(e.target.checked)} className="text-[#76df8b]" />}
                label={<span className="text-[11px] font-medium text-[#e0e0e0]">Doctors (Green)</span>}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={showFacilities} onChange={(e) => setShowFacilities(e.target.checked)} className="text-[#dfa61c]" />}
                label={<span className="text-[11px] font-medium text-[#e0e0e0]">Pharmacies (Gold)</span>}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={showMedicines} onChange={(e) => setShowMedicines(e.target.checked)} className="text-[#b388ff]" />}
                label={<span className="text-[11px] font-medium text-[#e0e0e0]">Medicines (Purple)</span>}
              />
            </div>

            {/* Zoom / Pan Navigation */}
            <div className="space-y-2">
              <Typography variant="caption" className="text-[#444] font-bold uppercase tracking-wider text-[8px] block">
                Navigation
              </Typography>
              <div className="flex gap-2">
                <button 
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
                  className="flex-1 py-1.5 px-3 border border-[#1a1a1a] hover:border-[#F27D26]/30 text-[#888] hover:text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <ZoomIn size={12} /> Zoom In
                </button>
                <button 
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
                  className="flex-1 py-1.5 px-3 border border-[#1a1a1a] hover:border-[#F27D26]/30 text-[#888] hover:text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  <ZoomOut size={12} /> Zoom Out
                </button>
              </div>
              <button 
                onClick={handleResetPan}
                className="w-full py-1.5 border border-[#1a1a1a] hover:border-[#F27D26]/30 text-[#888] hover:text-white rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <RotateCcw size={12} /> Reset View
              </button>
            </div>
          </Paper>

          {/* Node Inspector details */}
          {selectedNode && (
            <div className="border border-[#3d2f1b]/50 rounded-sm bg-[#1a140c]/10 p-5 space-y-3">
              <div className="flex items-center gap-1.5 text-[#dfa61c] font-bold uppercase tracking-wider text-[10px]">
                <Info size={12} />
                <span>Node Inspector</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{selectedNode.label}</p>
                <p className="text-[#555] font-mono text-[10px] mt-0.5">Type: <span className="font-bold text-[#888] capitalize">{selectedNode.type}</span></p>
              </div>
              <p className="text-[#888] leading-relaxed text-[11px]">
                {selectedNode.type === "patient" && "Identifies an insurance claimant. Follow lines to see their prescribers and pharmacies."}
                {selectedNode.type === "doctor" && "Prescribing medical officer. Click to reveal their prescription circle."}
                {selectedNode.type === "facility" && "Dispensing pharmacy facility. Hub of claimant redemption circles."}
                {selectedNode.type === "medicine" && "Prescribed drug item. Links multiple patients and practitioners."}
              </p>
              <button 
                onClick={() => { setSelectedNode(null); setHighlightedNeighbors(new Set()); }}
                className="w-full py-2 bg-[#F27D26] hover:bg-[#df6c1c] text-black font-semibold uppercase tracking-wider rounded text-[9px] transition-colors"
              >
                Clear Highlight
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Force SVG Canvas */}
        <div className="lg:col-span-3">
          <Paper
            elevation={0}
            className="border border-[#1a1a1a] rounded-sm bg-[#050505] overflow-hidden relative"
            style={{ height: "480px" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
          >
            {/* Guide Badge */}
            <div className="absolute top-4 left-4 bg-[#0a0a0a]/95 border border-[#1a1a1a] text-[#888] text-[10px] font-semibold py-1.5 px-3 rounded flex items-center gap-1.5 pointer-events-none z-10">
              <HelpCircle size={12} className="text-[#F27D26]" />
              <span>Click node to inspect neighbors. Drag to pan.</span>
            </div>

            <svg
              className="w-full h-full cursor-grab active:cursor-grabbing select-none"
              viewBox="0 0 600 400"
            >
              <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                {/* 1. Render Links / Springs */}
                {visibleLinks.map((link, idx) => {
                  const pSource = renderedPositions[link.source];
                  const pTarget = renderedPositions[link.target];

                  if (!pSource || !pTarget) return null;

                  const isHighlighted = highlightedNeighbors.size === 0 || 
                    (highlightedNeighbors.has(link.source) && highlightedNeighbors.has(link.target));

                  return (
                    <line
                      key={idx}
                      x1={pSource.x}
                      y1={pSource.y}
                      x2={pTarget.x}
                      y2={pTarget.y}
                      stroke={isHighlighted ? "#F27D26" : "#111111"}
                      strokeWidth={isHighlighted ? 1.5 : 0.6}
                      opacity={isHighlighted ? 0.6 : 0.1}
                      className="transition-all duration-300"
                    />
                  );
                })}

                {/* 2. Render Nodes */}
                {graph.nodes.filter(isNodeVisible).map((node) => {
                  const pos = renderedPositions[node.id];
                  if (!pos) return null;

                  const isDimmed = highlightedNeighbors.size > 0 && !highlightedNeighbors.has(node.id);
                  const isSearched = searchQuery && node.label.toLowerCase().includes(searchQuery.toLowerCase());

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(node);
                      }}
                      className="cursor-pointer"
                    >
                      {/* Search highlight ring */}
                      {isSearched && (
                        <circle
                          r={node.val + 6}
                          fill="none"
                          stroke="#F27D26"
                          strokeWidth={1.5}
                          strokeDasharray="3,3"
                          className="animate-spin"
                          style={{ animationDuration: "8s" }}
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={node.val}
                        fill={node.color}
                        stroke={selectedNode?.id === node.id ? "#F27D26" : "none"}
                        strokeWidth={selectedNode?.id === node.id ? 2 : 0}
                        opacity={isDimmed ? 0.25 : 1.0}
                        className="transition-all duration-300"
                      />

                      {/* Text Label */}
                      {!isDimmed && (
                        <text
                          y={node.val + 12}
                          textAnchor="middle"
                          fill="#888"
                          fontSize="9"
                          className="font-semibold pointer-events-none font-mono"
                        >
                          {node.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </Paper>
        </div>
      </div>
    </div>
  );
}
