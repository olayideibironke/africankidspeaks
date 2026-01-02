// app/data/audiomap.ts
// Stable import path for the rest of the app: import { audiomap } from "../data/audiomap"
// This file re-exports the generated map.

export type AudioLang = "yo" | "ig" | "pg";
export type AudioMap = Record<string, any>;

// IMPORTANT: this file is overwritten by scripts/generate_audiomap.mjs
export { audiomap } from "./audiomap.generated";
