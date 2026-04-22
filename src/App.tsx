/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CloudRain, 
  Settings2, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  X, 
  Droplet, 
  Wind, 
  Eye,
  Camera,
  Maximize2
} from 'lucide-react';
import RaindropsShader from './components/RaindropsShader';

export default function App() {
  const [intensity, setIntensity] = useState(0.85);
  const [fog, setFog] = useState(0.3);
  const [refraction, setRefraction] = useState(0.65);
  const [speed, setSpeed] = useState(1.0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mediaElement, setMediaElement] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';

    if (type === 'video') {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        setMediaElement(video);
        setMediaType('video');
      };
      video.src = url;
      video.play().catch(e => console.error("Video play failed:", e));
    } else {
      const img = new Image();
      img.onload = () => {
        setMediaElement(img);
        setMediaType('image');
      };
      img.src = url;
    }
  }, []);

  const resetBackground = () => {
    setMediaElement(null);
    setMediaType(null);
  };

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-[#e0e0e0]">
      {/* Background Gradient Layer (Visible behind translucent shader if empty) */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none" 
        style={{ background: 'radial-gradient(circle at 30% 30%, #1a1f35 0%, #050505 70%)' }} 
      />

      {/* Main Shader Layer */}
      <div className="absolute inset-0 z-10 transition-opacity duration-1000">
        <RaindropsShader
          intensity={intensity}
          fog={fog}
          refraction={refraction}
          speed={speed}
          backgroundTexture={mediaElement}
        />
      </div>

      {/* Elegant Dark Title (Top Left) */}
      <div className="absolute top-10 left-10 z-20 pointer-events-none">
        <motion.div
           initial={{ y: -20, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           className="space-y-1"
        >
          <h1 className="text-2xl font-extralight tracking-[0.2em] uppercase text-white/80">
            HEARTFELT
          </h1>
          <p className="text-[10px] lowercase tracking-[0.4em] text-white/40 uppercase">
            Atmospheric GLSL Editor
          </p>
        </motion.div>
      </div>

      {/* Status Indicators (Bottom Left) */}
      <div className="absolute bottom-10 left-10 z-20 pointer-events-none flex items-center space-x-6 text-[10px] tracking-widest text-white/30 uppercase font-mono">
        <span className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
          RAW GLSL: HEARTFELT.FRAG
        </span>
        <span>SYSTEM ID: 0x9F2E</span>
        <span>60 FPS</span>
      </div>

      {/* Floating Trigger (Bottom Right) */}
      <div className="absolute bottom-10 right-10 z-50 flex items-center gap-4">
        <AnimatePresence>
          {!isPanelOpen && (
            <motion.button
              id="toggle-panel"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setIsPanelOpen(true)}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/20 hover:bg-white/10 transition-all cursor-pointer group shadow-[0_0_30px_rgba(0,0,0,0.5)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings2 className="w-6 h-6 text-white/60 group-hover:text-white transition-colors" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Control Panel (Bottom Right) */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/10 flex items-center justify-end p-10 pointer-events-none"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-[320px] bg-[#141419]/85 backdrop-blur-3xl border border-white/10 rounded-[24px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tracking-wide">Parameters</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] opacity-40 font-mono">SHADER V.2.4</span>
                  <button 
                    id="close-panel"
                    onClick={() => setIsPanelOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4 opacity-40 hover:opacity-100" />
                  </button>
                </div>
              </div>

              {/* Sliders Implementation matching Elegant Dark */}
              <div className="space-y-8">
                {/* Rainfall */}
                <div className="parameter-group">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-3 ml-1">Rain Intensity</div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={intensity}
                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                    className="w-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] opacity-30 mt-2 tracking-tighter uppercase px-1">
                    <span>Mist</span>
                    <span>Storm</span>
                  </div>
                </div>

                {/* Fog */}
                <div className="parameter-group">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-3 ml-1">Fog Density</div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={fog}
                    onChange={(e) => setFog(parseFloat(e.target.value))}
                    className="w-full cursor-pointer appearance-none"
                  />
                  <div className="flex justify-between text-[9px] opacity-30 mt-2 tracking-tighter uppercase px-1">
                    <span>Clear</span>
                    <span>Deep</span>
                  </div>
                </div>

                {/* Refraction */}
                <div className="parameter-group">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-3 ml-1">Refraction Index</div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={refraction}
                    onChange={(e) => setRefraction(parseFloat(e.target.value))}
                    className="w-full cursor-pointer appearance-none"
                  />
                  <div className="flex justify-between text-[9px] opacity-30 mt-2 tracking-tighter uppercase px-1">
                    <span>1.33 (Water)</span>
                    <span>2.42 (Diamond)</span>
                  </div>
                </div>

                {/* Flow Speed */}
                <div className="parameter-group">
                  <div className="text-[10px] uppercase tracking-[0.1em] text-white/50 mb-3 ml-1">Flow Speed</div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full cursor-pointer appearance-none"
                  />
                  <div className="flex justify-between text-[9px] opacity-30 mt-2 tracking-tighter uppercase px-1">
                    <span>Static</span>
                    <span>Rush</span>
                  </div>
                </div>
              </div>

              {/* Background Actions */}
              <div className="mt-10 pt-6 border-t border-white/5 space-y-4">
                <button
                  id="upload-media"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3.5 flex items-center justify-center gap-2 bg-white/5 border border-white/10 border-dashed rounded-xl text-[11px] uppercase tracking-[0.1em] text-white/70 hover:bg-white/10 hover:border-white/30 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Upload size={14} className="opacity-50" />
                  Upload BG Image / Video
                </button>
                
                {mediaElement && (
                  <button
                    onClick={resetBackground}
                    className="w-full py-2 text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    Reset Background
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Decorative Circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none z-10">
        <svg width="400" height="400" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2 4" />
        </svg>
      </div>
    </div>
  );
}
