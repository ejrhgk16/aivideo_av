import AsyncStorage from '@react-native-async-storage/async-storage';
import { readExperience, type Experience } from '../features/drama/experience';

const STORAGE_KEY = 'ai-drama-native-experience-v1';
let pendingWrite: Promise<void> = Promise.resolve();

export async function loadExperience(): Promise<Experience> {
  await pendingWrite.catch(() => undefined);
  return readExperience(await AsyncStorage.getItem(STORAGE_KEY));
}

export function saveExperience(state: Experience): Promise<void> {
  const snapshot = JSON.stringify(state);
  // Preserve write order even when an earlier storage request fails.
  pendingWrite = pendingWrite
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(STORAGE_KEY, snapshot));
  return pendingWrite;
}
