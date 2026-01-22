import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PowField, PowMode, PowRecord, User } from '@/types';

interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  totalPausedSeconds: number;
  lastPausedAt: number | null;
}

interface CurrentPow {
  id: string | null;
  field: PowField | null;
  goalContent: string;
  goalTime: number; // seconds
  targetSats: number;
  mode: PowMode;
  startedAt: number | null;
}

interface PowStore {
  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // Timer
  timer: TimerState;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  tickTimer: () => void;
  resetTimer: () => void;

  // Current POW
  currentPow: CurrentPow;
  setCurrentPow: (pow: Partial<CurrentPow>) => void;
  clearCurrentPow: () => void;

  // Completed POW (for certification)
  completedPow: PowRecord | null;
  setCompletedPow: (pow: PowRecord | null) => void;

  // Active Tab
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const initialTimerState: TimerState = {
  isRunning: false,
  isPaused: false,
  elapsedSeconds: 0,
  totalPausedSeconds: 0,
  lastPausedAt: null,
};

const initialCurrentPow: CurrentPow = {
  id: null,
  field: null,
  goalContent: '',
  goalTime: 0,
  targetSats: 0,
  mode: 'immediate',
  startedAt: null,
};

export const usePowStore = create<PowStore>()(
  persist(
    (set, get) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),

      // Timer
      timer: initialTimerState,

      startTimer: () => {
        const now = Date.now();
        set({
          timer: {
            isRunning: true,
            isPaused: false,
            elapsedSeconds: 0,
            totalPausedSeconds: 0,
            lastPausedAt: null,
          },
          currentPow: {
            ...get().currentPow,
            startedAt: now,
          },
        });
      },

      pauseTimer: () => {
        set({
          timer: {
            ...get().timer,
            isPaused: true,
            lastPausedAt: Date.now(),
          },
        });
      },

      resumeTimer: () => {
        const { timer } = get();
        const pausedDuration = timer.lastPausedAt
          ? Math.floor((Date.now() - timer.lastPausedAt) / 1000)
          : 0;

        set({
          timer: {
            ...timer,
            isPaused: false,
            totalPausedSeconds: timer.totalPausedSeconds + pausedDuration,
            lastPausedAt: null,
          },
        });
      },

      stopTimer: () => {
        set({
          timer: {
            ...get().timer,
            isRunning: false,
            isPaused: false,
          },
        });
      },

      tickTimer: () => {
        const { timer, currentPow } = get();
        if (!timer.isRunning || timer.isPaused || !currentPow.startedAt) return;

        const now = Date.now();
        const totalElapsed = Math.floor((now - currentPow.startedAt) / 1000);
        const actualElapsed = totalElapsed - timer.totalPausedSeconds;

        set({
          timer: {
            ...timer,
            elapsedSeconds: Math.max(0, actualElapsed),
          },
        });
      },

      resetTimer: () => {
        set({ timer: initialTimerState });
      },

      // Current POW
      currentPow: initialCurrentPow,

      setCurrentPow: (pow) => {
        set({
          currentPow: {
            ...get().currentPow,
            ...pow,
          },
        });
      },

      clearCurrentPow: () => {
        set({
          currentPow: initialCurrentPow,
          timer: initialTimerState,
        });
      },

      // Completed POW
      completedPow: null,
      setCompletedPow: (pow) => set({ completedPow: pow }),

      // Active Tab
      activeTab: 'my-pow',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'pow-storage',
      partialize: (state) => ({
        user: state.user,
        timer: state.timer,
        currentPow: state.currentPow,
        completedPow: state.completedPow,
      }),
    }
  )
);
