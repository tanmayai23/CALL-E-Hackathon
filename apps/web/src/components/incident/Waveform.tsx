"use client";

/**
 * Call activity waveform — §4.4.
 *
 * HONESTY RULE (§4.4, and Rule 8): these bars are NOT driven by call audio.
 * They are a state indicator whose amplitude follows the current speaking turn.
 * The component labels itself "call activity", never "live audio", and nothing
 * in the UI or the demo narration may claim otherwise. When the real CALL-E
 * audio stream is available, swap the amplitude source for an AnalyserNode and
 * the label along with it.
 *
 * Canvas, not 64 animated DOM nodes.
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { CallState, Speaker } from "@/lib/contracts/domain";

const BARS = 68;

export function Waveform({
  callState,
  speaker,
}: {
  callState: CallState | null;
  speaker: Speaker | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const amplitudes = useRef<number[]>(new Array(BARS).fill(0.04));
  const frame = useRef(0);
  const reduced = useReducedMotion() ?? false;

  const live = callState === "in_conversation" || callState === "connected";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let seed = 0.37;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const styles = getComputedStyle(document.documentElement);
      const agentColour = styles.getPropertyValue("--state-active").trim() || "#06B6D4";
      const humanColour = styles.getPropertyValue("--text-secondary").trim() || "#98A2B3";
      const idleColour = styles.getPropertyValue("--border-strong").trim() || "#333B4A";

      /* Push a new amplitude every 3rd frame so the scroll reads at ~20fps. */
      if (!reduced && frame.current % 3 === 0) {
        const envelope = live && speaker ? 0.42 + random() * 0.58 : 0.05 + random() * 0.05;
        const emphasis = speaker === "AGENT" ? 1 : 0.82;
        amplitudes.current.push(Math.min(1, envelope * emphasis));
        amplitudes.current.shift();
      }
      frame.current += 1;

      const barW = width / BARS;
      const colour = !live ? idleColour : speaker === "HUMAN" ? humanColour : agentColour;
      ctx.fillStyle = colour;

      for (let i = 0; i < BARS; i += 1) {
        const a = amplitudes.current[i];
        const h = Math.max(1.5, a * (height - 6));
        const x = i * barW;
        const y = (height - h) / 2;
        ctx.globalAlpha = 0.35 + (i / BARS) * 0.65;
        ctx.fillRect(x, y, Math.max(1, barW - 1.6), h);
      }
      ctx.globalAlpha = 1;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [live, speaker, reduced]);

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="micro">Call activity</span>
        <span className="micro">
          {live ? (speaker === "HUMAN" ? "responder speaking" : "agent speaking") : "no audio"}
        </span>
      </div>
      {/* The canvas is absolutely positioned inside a relative box: as a
          replaced element its intrinsic size sets `min-height: auto`, so a
          plain `flex-1` canvas cannot shrink below the pixel height we assign
          it and slowly grows out of its panel. */}
      <div className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={
            live
              ? `Call in progress, ${speaker === "HUMAN" ? "responder" : "agent"} speaking`
              : "No call activity"
          }
        />
      </div>
      <p className="text-[10px] leading-tight text-ink-faint">
        Turn-taking indicator — not an audio visualisation.
      </p>
    </div>
  );
}
