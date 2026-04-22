export type Mood = 'neutral' | 'melancholy' | 'joyful' | 'calm' | 'intense';

export interface MoodParams {
  intensity: number; // 0..1
  fog: number;       // 0..1
  refraction: number;// 0..2
  speed: number;     // 0..2
  mood: Mood;
}

export interface MapInput {
  text: string;
  typingSpeedCps?: number; // characters per second over recent window
}

const MELANCHOLY = [
  '难过','伤心','悲伤','哭','眼泪','孤独','失去','想念','痛','心碎','遗憾','惋惜','失落','空',
  'sad','sorrow','lonely','tears','cry','miss','ache','grief','hollow','empty','lost','melancholy',
];
const JOYFUL = [
  '开心','高兴','快乐','笑','喜欢','爱','希望','温暖','阳光','甜',
  'happy','joy','glad','smile','love','warm','sunny','bright','sweet','delight',
];
const CALM = [
  '安静','平静','放松','慢','呼吸','静','宁静','沉淀',
  'calm','quiet','peace','slow','breathe','still','gentle','soft',
];
const INTENSE = [
  '愤怒','生气','讨厌','怒','恨','狂','爆','崩溃','疯',
  'angry','rage','hate','mad','furious','storm','burn','break','crash',
];

function countHits(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of words) {
    if (!w) continue;
    let idx = 0;
    while (true) {
      const found = lower.indexOf(w, idx);
      if (found === -1) break;
      n++;
      idx = found + w.length;
    }
  }
  return n;
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

// Logistic smoothing so early characters ramp quickly and later chars plateau.
function logistic(x: number, k = 0.015, mid = 120): number {
  return 1 / (1 + Math.exp(-k * (x - mid)));
}

export function mapTextToParams({ text, typingSpeedCps = 0 }: MapInput): MoodParams {
  const len = text.length;

  // Base intensity driven by length
  let intensity = 0.15 + 0.7 * logistic(len);

  // Typing speed drives flow speed (slow → drift, fast → downpour)
  let speed = 0.5 + clamp(typingSpeedCps / 6, 0, 1) * 1.3; // 0.5 .. 1.8

  // Mood from keyword hits
  const mHits = countHits(text, MELANCHOLY);
  const jHits = countHits(text, JOYFUL);
  const cHits = countHits(text, CALM);
  const iHits = countHits(text, INTENSE);

  let fog = 0.3;
  let refraction = 0.65;
  let mood: Mood = 'neutral';

  const scores: Array<[Mood, number]> = [
    ['melancholy', mHits],
    ['joyful', jHits],
    ['calm', cHits],
    ['intense', iHits],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [topMood, topScore] = scores[0];
  if (topScore > 0) mood = topMood;

  // Apply mood modifiers
  if (mHits > 0) {
    fog += 0.12 * Math.min(mHits, 3);
    refraction += 0.15 * Math.min(mHits, 3);
    intensity += 0.05 * Math.min(mHits, 3);
  }
  if (jHits > 0) {
    fog -= 0.1 * Math.min(jHits, 3);
    intensity -= 0.08 * Math.min(jHits, 3);
  }
  if (cHits > 0) {
    speed *= Math.max(0.4, 1 - 0.2 * Math.min(cHits, 3));
    fog += 0.05 * Math.min(cHits, 3);
  }
  if (iHits > 0) {
    intensity += 0.12 * Math.min(iHits, 3);
    speed += 0.2 * Math.min(iHits, 3);
    refraction += 0.1 * Math.min(iHits, 3);
  }

  return {
    intensity: clamp(intensity, 0, 1),
    fog: clamp(fog, 0, 1),
    refraction: clamp(refraction, 0, 2),
    speed: clamp(speed, 0, 2),
    mood,
  };
}
