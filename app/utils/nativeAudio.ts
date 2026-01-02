// app/utils/nativeAudio.ts
import { audiomap } from "../data/audiomap.generated";

export type AudioLang = "yo" | "ig" | "pg";

function normEn(s: any) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Your current generated map uses numeric keys like:
 *  - "yo/1", "yo/2", ... and "ig/13"
 *
 * Older/future shapes may use:
 *  - "yo/hello" (en-based)
 *  - "hello": { yo: require(...), ig: require(...) }
 *
 * This helper supports ALL, but prioritizes your CURRENT working ID shape.
 */
export function getNativeAudioSource(args: {
  lang: AudioLang;
  en?: string;
  id?: number;
}) {
  // ✅ 1) CURRENT SHAPE (ID-based): "yo/1"
  if (typeof args.id === "number") {
    const keyById = `${args.lang}/${args.id}`;
    const byId = (audiomap as any)?.[keyById];
    if (byId) return byId;
  }

  // ✅ 2) EN-based: "yo/hello"
  if (args.en) {
    const enN = normEn(args.en);
    const keyByEn = `${args.lang}/${enN}`;
    const byEn = (audiomap as any)?.[keyByEn];
    if (byEn) return byEn;

    // ✅ 3) Word object shape: audiomap["hello"]?.yo
    const objShape = (audiomap as any)?.[enN]?.[args.lang];
    if (objShape) return objShape;
  }

  return null;
}

export function hasNativeAudio(args: { lang: AudioLang; en?: string; id?: number }) {
  return !!getNativeAudioSource(args);
}
