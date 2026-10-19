"use client";
import { useSyncExternalStore } from "react";
let initialSeed: number | undefined;
export const newFlashcardSeed = () => window.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
const getSeed = () => initialSeed ??= newFlashcardSeed();
const serverSeed = () => 0;
const subscribe = () => () => {};
// Browser-only initialization, stable across renders; server and hydration start at zero.
export const useFlashcardShuffleSeed = () => useSyncExternalStore(subscribe, getSeed, serverSeed);
