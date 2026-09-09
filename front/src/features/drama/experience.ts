import { getDrama } from './catalog';

export type Entry = {
  id: string;
  label: string;
  amount: number;
  at: string;
};

export type History = { id: string; ep: number; time: number };

// Device-local demo data, never proof of a real purchase or viewing entitlement.
export type Experience = {
  balance: number;
  saved: string[];
  opened: string[];
  history: History[];
  ledger: Entry[];
  ads: number;
  adDay: string;
  captions: boolean;
  autoNext: boolean;
};

export const EPISODE_PRICE = 10;
export const AD_REWARD = 10;
export const DAILY_AD_LIMIT = 5;
export const POINT_PACKS = [100, 300, 600] as const;

export function today(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function initialExperience(now = new Date()): Experience {
  return {
    balance: 4,
    saved: [],
    opened: [],
    history: [],
    ledger: [],
    ads: 0,
    adDay: today(now),
    captions: true,
    autoNext: true,
  };
}

export const episodeKey = (id: string, ep: number): string => `${id}:${ep}`;

function validEpisode(id: unknown, ep: unknown): boolean {
  if (typeof id !== 'string' || typeof ep !== 'number') return false;
  const drama = getDrama(id);
  return Boolean(drama && Number.isInteger(ep) && ep >= 1 && ep <= drama.total);
}

export function isEpisodeOpen(state: Experience, id: string, ep: number): boolean {
  const drama = getDrama(id);
  if (!drama || !validEpisode(id, ep)) return false;
  return ep <= drama.free || state.opened.includes(episodeKey(id, ep));
}

export function remainingAds(state: Experience, now = new Date()): number {
  return state.adDay === today(now) ? Math.max(0, DAILY_AD_LIMIT - state.ads) : DAILY_AD_LIMIT;
}

function ledgerEntry(state: Experience, label: string, amount: number, now: Date): Entry {
  return {
    id: `${now.getTime()}-${state.ledger.length + 1}`,
    label,
    amount,
    at: now.toISOString(),
  };
}

export function unlock(
  state: Experience,
  id: string,
  ep: number,
  now = new Date(),
): { state: Experience; ok: boolean } {
  const drama = getDrama(id);
  if (!drama || !validEpisode(id, ep)) return { state, ok: false };
  if (isEpisodeOpen(state, id, ep)) return { state, ok: true };
  if (state.balance < EPISODE_PRICE) return { state, ok: false };

  return {
    ok: true,
    state: {
      ...state,
      balance: state.balance - EPISODE_PRICE,
      opened: [...state.opened, episodeKey(id, ep)],
      ledger: [
        ledgerEntry(state, `${drama.title} ${ep}화 열기`, -EPISODE_PRICE, now),
        ...state.ledger,
      ],
    },
  };
}

export function credit(
  state: Experience,
  kind: 'ad' | 'pack',
  amount: number,
  now = new Date(),
): Experience {
  if (kind === 'ad' && (amount !== AD_REWARD || remainingAds(state, now) === 0)) return state;
  if (kind === 'pack' && !POINT_PACKS.some((points) => points === amount)) return state;
  if (!Number.isSafeInteger(state.balance + amount)) return state;

  const ads = state.adDay === today(now) ? state.ads : 0;
  return {
    ...state,
    balance: state.balance + amount,
    ads: kind === 'ad' ? ads + 1 : ads,
    adDay: today(now),
    ledger: [
      ledgerEntry(state, kind === 'ad' ? '광고 보상 체험' : '포인트 충전 체험', amount, now),
      ...state.ledger,
    ],
  };
}

export function toggleSaved(state: Experience, id: string): Experience {
  if (!getDrama(id)) return state;
  return {
    ...state,
    saved: state.saved.includes(id)
      ? state.saved.filter((savedId) => savedId !== id)
      : [...state.saved, id],
  };
}

export function recordProgress(state: Experience, id: string, ep: number, time: number): Experience {
  if (!isEpisodeOpen(state, id, ep) || !Number.isFinite(time)) return state;
  const position = Math.min(60, Math.max(0, time));
  const last = state.history[0];
  if (last?.id === id && last.ep === ep && last.time === position) return state;
  return {
    ...state,
    history: [{ id, ep, time: position }, ...state.history.filter((entry) => entry.id !== id)],
  };
}

export function setPreference(
  state: Experience,
  key: 'captions' | 'autoNext',
  value: boolean,
): Experience {
  return state[key] === value ? state : { ...state, [key]: value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOpenedKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const [id, rawEpisode, extra] = value.split(':');
  const ep = Number(rawEpisode);
  return extra === undefined && rawEpisode === String(ep) && validEpisode(id, ep);
}

function isEntry(value: unknown): value is Entry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    Number.isSafeInteger(value.amount) &&
    typeof value.at === 'string' &&
    !Number.isNaN(Date.parse(value.at))
  );
}

export function readExperience(raw: string | null, now = new Date()): Experience {
  const base = initialExperience(now);
  if (raw === null) return base;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      !Number.isSafeInteger(value.balance) ||
      typeof value.balance !== 'number' ||
      value.balance < 0 ||
      !Array.isArray(value.saved) ||
      !Array.isArray(value.opened) ||
      !Array.isArray(value.history) ||
      !Array.isArray(value.ledger)
    ) {
      return base;
    }

    const saved = value.saved.filter(
      (id): id is string => typeof id === 'string' && Boolean(getDrama(id)),
    );

    const state: Experience = {
      ...base,
      balance: value.balance,
      saved: [...new Set(saved)],
      opened: [...new Set(value.opened.filter(isOpenedKey))],
      ledger: value.ledger
        .filter(isEntry)
        .map(({ id, label, amount, at }) => ({ id, label, amount, at })),
      ads:
        value.adDay === today(now) && typeof value.ads === 'number' && Number.isInteger(value.ads)
          ? Math.min(DAILY_AD_LIMIT, Math.max(0, value.ads))
          : 0,
      captions: typeof value.captions === 'boolean' ? value.captions : base.captions,
      autoNext: typeof value.autoNext === 'boolean' ? value.autoNext : base.autoNext,
    };
    const seen = new Set<string>();
    for (const entry of value.history) {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.ep !== 'number' ||
        !isEpisodeOpen(state, entry.id, entry.ep) ||
        typeof entry.time !== 'number' ||
        !Number.isFinite(entry.time) ||
        entry.time < 0 ||
        entry.time > 60 ||
        seen.has(entry.id)
      ) {
        continue;
      }
      seen.add(entry.id);
      state.history.push({ id: entry.id, ep: entry.ep, time: entry.time });
    }
    return state;
  } catch {
    return base;
  }
}
