const STORAGE_KEY = 'login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

interface LoginAttempt {
  count: number;
  lockedUntil: number | null;
}

interface AttemptsStorage {
  [email: string]: LoginAttempt;
}

const getStorage = (): AttemptsStorage => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const setStorage = (data: AttemptsStorage): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently fail if localStorage is not available
  }
};

export const getAttempts = (email: string): LoginAttempt => {
  const storage = getStorage();
  return storage[email.toLowerCase()] || { count: 0, lockedUntil: null };
};

export const isLocked = (email: string): boolean => {
  const attempts = getAttempts(email.toLowerCase());
  if (!attempts.lockedUntil) return false;
  
  if (Date.now() >= attempts.lockedUntil) {
    // Lockout expired, reset
    resetAttempts(email);
    return false;
  }
  
  return true;
};

export const getRemainingLockTime = (email: string): number => {
  const attempts = getAttempts(email.toLowerCase());
  if (!attempts.lockedUntil) return 0;
  
  const remaining = attempts.lockedUntil - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000 / 60)); // Return minutes
};

export const getRemainingLockTimeSeconds = (email: string): number => {
  const attempts = getAttempts(email.toLowerCase());
  if (!attempts.lockedUntil) return 0;
  
  const remaining = attempts.lockedUntil - Date.now();
  return Math.max(0, Math.ceil(remaining / 1000)); // Return seconds
};

export const recordFailedAttempt = (email: string): { isNowLocked: boolean; attemptsRemaining: number } => {
  const storage = getStorage();
  const normalizedEmail = email.toLowerCase();
  const current = storage[normalizedEmail] || { count: 0, lockedUntil: null };
  
  current.count += 1;
  
  if (current.count >= MAX_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  
  storage[normalizedEmail] = current;
  setStorage(storage);
  
  return {
    isNowLocked: current.count >= MAX_ATTEMPTS,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - current.count),
  };
};

export const resetAttempts = (email: string): void => {
  const storage = getStorage();
  delete storage[email.toLowerCase()];
  setStorage(storage);
};

export const getAttemptsRemaining = (email: string): number => {
  const attempts = getAttempts(email.toLowerCase());
  return Math.max(0, MAX_ATTEMPTS - attempts.count);
};
