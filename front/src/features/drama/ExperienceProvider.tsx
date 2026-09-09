import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { loadExperience, saveExperience } from '../../services/experience-storage';
import {
  AD_REWARD,
  credit,
  initialExperience,
  recordProgress as updateProgress,
  setPreference,
  toggleSaved,
  unlock,
  type Experience,
} from './experience';

type ExperienceContextValue = {
  state: Experience;
  ready: boolean;
  storageError: boolean;
  toggleSave(id: string): void;
  recordProgress(id: string, ep: number, time: number): void;
  unlockEpisode(id: string, ep: number): boolean;
  claimAd(): boolean;
  buyPack(points: number): boolean;
  setSetting(key: 'captions' | 'autoNext', value: boolean): void;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export function ExperienceProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(initialExperience);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const current = useRef(state);
  const readyRef = useRef(false);
  const mounted = useRef(false);
  const canPersist = useRef(false);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    loadExperience().then(
      (saved) => {
        if (cancelled) return;
        current.current = saved;
        canPersist.current = true;
        readyRef.current = true;
        setState(saved);
        setReady(true);
      },
      () => {
        if (cancelled) return;
        // Keep this session usable without overwriting unread device data.
        readyRef.current = true;
        setStorageError(true);
        setReady(true);
      },
    );
    return () => {
      cancelled = true;
      mounted.current = false;
      readyRef.current = false;
    };
  }, []);

  const commit = useCallback((next: Experience) => {
    if (!readyRef.current || next === current.current) return;
    // Update before scheduling React work so rapid taps see the latest balance.
    current.current = next;
    setState(next);
    if (!canPersist.current) return;
    saveExperience(next).then(
      () => { if (mounted.current) setStorageError(false); },
      () => { if (mounted.current) setStorageError(true); },
    );
  }, []);

  const toggleSave = useCallback((id: string) => {
    if (readyRef.current) commit(toggleSaved(current.current, id));
  }, [commit]);

  const recordProgress = useCallback((id: string, ep: number, time: number) => {
    if (readyRef.current) commit(updateProgress(current.current, id, ep, time));
  }, [commit]);

  const unlockEpisode = useCallback((id: string, ep: number): boolean => {
    if (!readyRef.current) return false;
    const result = unlock(current.current, id, ep);
    commit(result.state);
    return result.ok;
  }, [commit]);

  const claimAd = useCallback((): boolean => {
    if (!readyRef.current) return false;
    const next = credit(current.current, 'ad', AD_REWARD);
    if (next === current.current) return false;
    commit(next);
    return true;
  }, [commit]);

  const buyPack = useCallback((points: number): boolean => {
    if (!readyRef.current) return false;
    const next = credit(current.current, 'pack', points);
    if (next === current.current) return false;
    commit(next);
    return true;
  }, [commit]);

  const setSetting = useCallback((key: 'captions' | 'autoNext', value: boolean) => {
    if (readyRef.current) commit(setPreference(current.current, key, value));
  }, [commit]);

  const value = useMemo(() => ({
    state,
    ready,
    storageError,
    toggleSave,
    recordProgress,
    unlockEpisode,
    claimAd,
    buyPack,
    setSetting,
  }), [state, ready, storageError, toggleSave, recordProgress, unlockEpisode, claimAd, buyPack, setSetting]);

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience(): ExperienceContextValue {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error('useExperience must be used inside ExperienceProvider');
  return value;
}
