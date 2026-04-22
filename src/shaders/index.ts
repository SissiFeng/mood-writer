import { heartfelt } from './heartfelt';
import { iqWarp } from './iqWarp';
import { rainyStreet } from './rainyStreet';
import { ripples } from './ripples';

export type { Scene } from './types';

export const SCENES = [heartfelt, rainyStreet, ripples, iqWarp] as const;
export const DEFAULT_SCENE_ID = 'heartfelt';

export function findScene(id: string) {
  return SCENES.find(s => s.id === id) ?? SCENES[0];
}
