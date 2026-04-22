/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings2,
  Upload,
  X,
  Volume2,
  VolumeX,
  Keyboard as KeyboardIcon,
  CloudRain,
} from 'lucide-react';
import SceneShader from './components/SceneShader';
import MoodEditor from './components/MoodEditor';
import { mapTextToParams, type Mood } from './lib/moodMapper';
import { AudioEngine, type AudioSettings } from './lib/audio/AudioEngine';
import { SCENES, DEFAULT_SCENE_ID, findScene } from './shaders';
import { saveAsMarkdown } from './lib/saveNote';

export default function App() {
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood>('neutral');

  // Shader params — written by moodMapper when text is non-empty,
  // or by manual sliders when text is empty.
  const [intensity, setIntensity] = useState(0.25);
  const [fog, setFog] = useState(0.3);
  const [refraction, setRefraction] = useState(0.65);
  const [speed, setSpeed] = useState(0.8);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mediaElement, setMediaElement] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [sceneId, setSceneId] = useState<string>(DEFAULT_SCENE_ID);
  const scene = findScene(sceneId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // typing speed tracking
  const keystrokesRef = useRef<number[]>([]);
  const trackKeystroke = useCallback(() => {
    const now = performance.now();
    const arr = keystrokesRef.current;
    arr.push(now);
    while (arr.length && now - arr[0] > 4000) arr.shift();
  }, []);
  const getTypingCps = useCallback(() => {
    const arr = keystrokesRef.current;
    if (arr.length < 2) return 0;
    const span = (arr[arr.length - 1] - arr[0]) / 1000;
    if (span <= 0) return 0;
    return arr.length / span;
  }, []);

  // Audio engine (lazily created, started on first user gesture)
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    engineRef.current!.getSettings()
  );
  const [audioReady, setAudioReady] = useState(false);

  // Debounced text → shader params
  useEffect(() => {
    const h = setTimeout(() => {
      if (text.length === 0) return; // manual mode takes over
      const params = mapTextToParams({ text, typingSpeedCps: getTypingCps() });
      setIntensity(params.intensity);
      setFog(params.fog);
      setRefraction(params.refraction);
      setSpeed(params.speed);
      setMood(params.mood);
      engineRef.current?.setRainIntensity(params.intensity);
    }, 150);
    return () => clearTimeout(h);
  }, [text, getTypingCps]);

  // keep audio engine rain intensity in sync even when manual
  useEffect(() => {
    engineRef.current?.setRainIntensity(intensity);
  }, [intensity]);

  const handleKeyDown = useCallback(async (key: string) => {
    const engine = engineRef.current;
    if (engine && !audioReady) {
      await engine.ensureStarted();
      setAudioReady(true);
    }
    engine?.playKey(key);
    trackKeystroke();
  }, [audioReady, trackKeystroke]);

  const updateAudio = useCallback((patch: Partial<AudioSettings>) => {
    const engine = engineRef.current!;
    engine.updateSettings(patch);
    setAudioSettings(engine.getSettings());
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';
    if (type === 'video') {
      const video = document.createElement('video');
      video.muted = true; video.loop = true; video.playsInline = true;
      video.onloadeddata = () => setMediaElement(video);
      video.src = url;
      video.play().catch(e => console.error('video play failed:', e));
    } else {
      const img = new Image();
      img.onload = () => setMediaElement(img);
      img.src = url;
    }
  }, []);

  const resetBackground = () => setMediaElement(null);
  const manualMode = text.length === 0;

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-[#e0e0e0]">
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 30% 30%, #1a1f35 0%, #050505 70%)' }}
      />

      <div className="absolute inset-0 z-10 transition-opacity duration-1000">
        <SceneShader
          scene={scene}
          intensity={intensity}
          fog={fog}
          refraction={refraction}
          speed={speed}
          backgroundTexture={mediaElement}
        />
      </div>

      {/* Title */}
      <div className="absolute top-10 left-10 z-20 pointer-events-none">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="space-y-1">
          <h1 className="text-2xl font-extralight tracking-[0.2em] uppercase text-white/80">MOOD WRITER</h1>
          <p className="text-[10px] lowercase tracking-[0.4em] text-white/40 uppercase">write into the rain</p>
        </motion.div>
      </div>

      {/* Central writing area */}
      <MoodEditor
        text={text}
        onTextChange={setText}
        onKeyDown={handleKeyDown}
        mood={mood}
        onSave={() => saveAsMarkdown(text, mood)}
      />

      {/* Status line */}
      <div className="absolute bottom-10 left-10 z-20 pointer-events-none flex items-center space-x-6 text-[10px] tracking-widest text-white/30 uppercase font-mono">
        <span className="flex items-center gap-2">
          <div className={`w-1 h-1 rounded-full ${audioReady ? 'bg-green-500' : 'bg-white/30'} animate-pulse`} />
          {audioReady ? 'AMBIENCE LIVE' : 'AMBIENCE READY'}
        </span>
        <span>MOOD: {mood.toUpperCase()}</span>
        <span>{manualMode ? 'MANUAL' : 'WRITING-DRIVEN'}</span>
      </div>

      {/* Settings trigger */}
      <div className="absolute bottom-10 right-10 z-50 flex items-center gap-4">
        <AnimatePresence>
          {!isPanelOpen && (
            <motion.button
              id="toggle-panel"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={() => setIsPanelOpen(true)}
              className="w-14 h-14 flex items-center justify-center rounded-full bg-white/5 backdrop-blur-xl border border-white/20 hover:bg-white/10 transition-all cursor-pointer group shadow-[0_0_30px_rgba(0,0,0,0.5)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings2 className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 flex items-center justify-end p-10 pointer-events-none"
            onClick={() => setIsPanelOpen(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[340px] max-h-[85vh] overflow-y-auto bg-[#141419]/90 backdrop-blur-3xl border border-white/10 rounded-[24px] p-7 shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-auto"
            >
              <div className="flex items-center justify-between mb-7">
                <span className="text-sm font-medium tracking-wide">Parameters</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] opacity-40 font-mono">v.3.0</span>
                  <button onClick={() => setIsPanelOpen(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                    <X className="w-4 h-4 opacity-40 hover:opacity-100" />
                  </button>
                </div>
              </div>

              {/* Ambience */}
              <div className="mb-8">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-4">Ambience</div>
                <AudioRow
                  icon={<CloudRain size={14} />}
                  label="Rain"
                  enabled={audioSettings.rainEnabled}
                  volume={audioSettings.rainVolume}
                  onToggle={(v) => updateAudio({ rainEnabled: v })}
                  onVolume={(v) => updateAudio({ rainVolume: v })}
                />
                <div className="h-3" />
                <AudioRow
                  icon={<KeyboardIcon size={14} />}
                  label="Keystrokes"
                  enabled={audioSettings.keyboardEnabled}
                  volume={audioSettings.keyboardVolume}
                  onToggle={(v) => updateAudio({ keyboardEnabled: v })}
                  onVolume={(v) => updateAudio({ keyboardVolume: v })}
                />
              </div>

              {/* Scene selector */}
              <div className="mb-8">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Scene</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {SCENES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSceneId(s.id)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                        sceneId === s.id
                          ? 'bg-white/10 border-white/30 text-white'
                          : 'bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <div className="tracking-wider">{s.name}</div>
                      <div className="text-[9px] opacity-60 mt-0.5 leading-tight">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual sliders */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                    Shader
                  </span>
                  <span className="text-[9px] text-white/30 font-mono">
                    {manualMode ? 'manual' : 'auto — writing'}
                  </span>
                </div>
                <SliderRow label="Rain Intensity" value={intensity} min={0} max={1}  disabled={!manualMode} onChange={setIntensity} />
                <SliderRow label="Fog"            value={fog}       min={0} max={1}  disabled={!manualMode} onChange={setFog} />
                <SliderRow label="Refraction"     value={refraction} min={0} max={2}  disabled={!manualMode} onChange={setRefraction} />
                <SliderRow label="Flow Speed"     value={speed}      min={0} max={2}  disabled={!manualMode} onChange={setSpeed} />
              </div>

              {/* Background */}
              <div className="pt-5 border-t border-white/5 space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 flex items-center justify-center gap-2 bg-white/5 border border-white/10 border-dashed rounded-xl text-[11px] uppercase tracking-[0.1em] text-white/70 hover:bg-white/10 hover:border-white/30 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Upload size={14} className="opacity-50" />
                  Upload BG Image / Video
                </button>
                {mediaElement && (
                  <button onClick={resetBackground} className="w-full py-2 text-[10px] uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                    Reset Background
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Helper components ------------------------------------------------------

function SliderRow({ label, value, min, max, onChange, disabled }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className={`text-[10px] uppercase tracking-[0.1em] mb-2 ml-1 ${disabled ? 'text-white/25' : 'text-white/50'}`}>{label}</div>
      <input
        type="range"
        min={min} max={max} step="0.01"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      />
    </div>
  );
}

function AudioRow({ icon, label, enabled, volume, onToggle, onVolume }: {
  icon: React.ReactNode; label: string; enabled: boolean; volume: number;
  onToggle: (v: boolean) => void; onVolume: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] tracking-wide text-white/70">
          <span className="opacity-60">{icon}</span>{label}
        </div>
        <button
          onClick={() => onToggle(!enabled)}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          aria-label={enabled ? `mute ${label}` : `unmute ${label}`}
        >
          {enabled
            ? <Volume2 size={14} className="text-white/70" />
            : <VolumeX size={14} className="text-white/30" />}
        </button>
      </div>
      <input
        type="range" min={0} max={1} step="0.01"
        value={volume}
        disabled={!enabled}
        onChange={(e) => onVolume(parseFloat(e.target.value))}
        className={`w-full ${enabled ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
      />
    </div>
  );
}
