import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Check } from 'lucide-react';
import type { Mood } from '../lib/moodMapper';

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onKeyDown: (key: string) => void;
  onSave: () => string | null;  // returns filename or null
  mood: Mood;
}

const MOOD_LABEL: Record<Mood, string> = {
  neutral: '— drifting —',
  melancholy: '— melancholy —',
  joyful: '— light —',
  calm: '— quiet —',
  intense: '— storm —',
};

const MoodEditor: React.FC<Props> = ({ text, onTextChange, onKeyDown, onSave, mood }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [savedFile, setSavedFile] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const triggerSave = () => {
    const name = onSave();
    if (name) {
      setSavedFile(name);
      setTimeout(() => setSavedFile(null), 2200);
    }
  };

  const canSave = text.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[min(620px,80vw)] pointer-events-auto"
    >
      <div className="relative">
        <div className="absolute -top-8 left-1 text-[10px] uppercase tracking-[0.35em] text-white/40 font-mono transition-colors">
          {MOOD_LABEL[mood]}
        </div>

        <textarea
          ref={ref}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => {
            // Cmd+S / Ctrl+S → save as markdown
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              triggerSave();
              return;
            }
            onKeyDown(e.key);
          }}
          placeholder="write what's on your mind…"
          rows={10}
          spellCheck={false}
          className="w-full min-h-[40vh] max-h-[60vh] resize-none
                     bg-white/[0.03] backdrop-blur-xl
                     border border-white/10 hover:border-white/20 focus:border-white/30
                     rounded-2xl px-8 py-7
                     text-[15px] leading-[1.9] text-white/85
                     placeholder:text-white/25 placeholder:italic placeholder:font-light
                     font-light tracking-wide
                     outline-none focus:ring-0
                     transition-all duration-500
                     shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
          style={{ fontFamily: '"Georgia", "Noto Serif SC", serif' }}
        />

        {/* Bottom bar: save button (left) | char count (right) */}
        <div className="absolute -bottom-7 left-1 right-1 flex items-center justify-between">
          <button
            onClick={triggerSave}
            disabled={!canSave}
            title={canSave ? 'Save as .md  (⌘S)' : 'nothing to save yet'}
            className={`flex items-center gap-1.5 text-[9px] uppercase tracking-[0.3em] font-mono transition-all
              ${canSave
                ? 'text-white/40 hover:text-white/80 cursor-pointer'
                : 'text-white/15 cursor-not-allowed'}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {savedFile ? (
                <motion.span
                  key="saved"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5 text-green-300/70"
                >
                  <Check size={11} /> saved
                </motion.span>
              ) : (
                <motion.span
                  key="save"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1.5"
                >
                  <Download size={11} /> save .md
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <span className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-mono">
            {text.length} chars
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default MoodEditor;
