/**
 * Parse a TavernAI / SillyTavern / Chub.ai character card (JSON or PNG).
 *
 * Supports V1 (flat fields), V2 (`spec: "chara_card_v2"` with nested
 * `data` object + `character_book`), and V3 (`spec: "chara_card_v3"`,
 * superset of V2 — extra fields like nickname, source, group_only_greetings,
 * creator_notes_multilingual, assets are preserved in the raw card and
 * forwarded to the LLM refiner on import).
 *
 * PNG cards embed the card JSON inside a tEXt or iTXt chunk. The key is
 * "ccv3" for V3, "ccv2" for V2 (base64-encoded UTF-8 JSON), "chara" for V1.
 * We read "ccv3" first, fall back to "ccv2", then "chara".
 */

export type TavernV1Card = {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creatorcomment?: string;
  avatar?: string;
  tags?: string[];
  talkativeness?: string;
};

export type CharacterBookEntry = {
  keys: string[];
  content: string;
  enabled?: boolean;
  insertion_order?: number;
  name?: string;
};

export type CharacterBook = {
  name?: string;
  description?: string;
  entries?: CharacterBookEntry[];
};

export type CharacterCardV2Data = {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  character_book?: CharacterBook;
  tags?: string[];
  creator?: string;
  character_version?: string;
  extensions?: Record<string, unknown>;
};

export type CharacterCardV2 = {
  spec: "chara_card_v2";
  spec_version?: string;
  data: CharacterCardV2Data;
};

// V3 is a strict superset of V2 for the fields we consume — extra keys are
// preserved and forwarded to the LLM refiner via the raw card payload.
export type CharacterCardV3Data = CharacterCardV2Data & {
  nickname?: string;
  creator_notes_multilingual?: Record<string, string>;
  source?: string[];
  group_only_greetings?: string[];
  creation_date?: number;
  modification_date?: number;
  assets?: unknown;
};

export type CharacterCardV3 = {
  spec: "chara_card_v3";
  spec_version?: string;
  data: CharacterCardV3Data;
};

export type ParsedCard =
  | { format: "v1"; card: TavernV1Card; avatarBlob: Blob | null; filename: string }
  | { format: "v2"; card: CharacterCardV2Data; avatarBlob: Blob | null; filename: string }
  | { format: "v3"; card: CharacterCardV3Data; avatarBlob: Blob | null; filename: string };

export class InvalidFormatError extends Error { constructor(msg: string) { super(msg); this.name = "InvalidFormatError"; } }
export class UnsupportedVersionError extends Error { constructor(msg: string) { super(msg); this.name = "UnsupportedVersionError"; } }
export class CorruptCardError extends Error { constructor(msg: string) { super(msg); this.name = "CorruptCardError"; } }

export async function parseCharacterCard(file: File): Promise<ParsedCard> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".json")) return parseJsonCard(await file.text(), file.name);
  if (lower.endsWith(".png")) return parsePngCard(await file.arrayBuffer(), file);
  throw new InvalidFormatError("File must be .json or .png");
}

function parseJsonCard(text: string, filename: string): ParsedCard {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new CorruptCardError("Not valid JSON"); }
  return interpret(data, filename, null);
}

async function parsePngCard(buf: ArrayBuffer, file: File): Promise<ParsedCard> {
  const chunks = readPngTextChunks(new Uint8Array(buf));
  if (!chunks.size) throw new CorruptCardError("PNG has no tEXt / iTXt metadata");
  // ccv3 > ccv2 > chara — V3 cards often include a legacy ccv2 chunk for
  // back-compat; V2 cards sometimes include a legacy `chara` chunk.
  const raw = chunks.get("ccv3") ?? chunks.get("ccv2") ?? chunks.get("chara");
  if (!raw) throw new CorruptCardError("PNG has no `chara`, `ccv2`, or `ccv3` chunk");
  let decoded: string;
  try { decoded = decodeBase64Utf8(raw); } catch { throw new CorruptCardError("Card chunk is not base64 UTF-8"); }
  let data: unknown;
  try { data = JSON.parse(decoded); } catch { throw new CorruptCardError("Card chunk is not valid JSON"); }
  return interpret(data, file.name, file);
}

function interpret(data: unknown, filename: string, avatarBlob: Blob | null): ParsedCard {
  if (!data || typeof data !== "object") throw new InvalidFormatError("Card must be a JSON object");
  const obj = data as Record<string, unknown>;

  // V3: { spec: "chara_card_v3", data: { name, ... } }
  if (obj.spec === "chara_card_v3" && obj.data && typeof obj.data === "object") {
    const d = obj.data as CharacterCardV3Data;
    if (typeof d.name !== "string" || !d.name.trim()) {
      throw new InvalidFormatError("V3 card missing data.name");
    }
    return { format: "v3", card: d, avatarBlob, filename };
  }

  // V2: { spec: "chara_card_v2", data: { name, ... } }
  if (obj.spec === "chara_card_v2" && obj.data && typeof obj.data === "object") {
    const d = obj.data as CharacterCardV2Data;
    if (typeof d.name !== "string" || !d.name.trim()) {
      throw new InvalidFormatError("V2 card missing data.name");
    }
    return { format: "v2", card: d, avatarBlob, filename };
  }

  // Unknown spec (future versions).
  if (typeof obj.spec === "string" && obj.spec !== "chara_card_v2" && obj.spec !== "chara_card_v3") {
    throw new UnsupportedVersionError(`Unsupported spec: ${obj.spec}`);
  }

  // V1: flat card with top-level `name`. Must have at least a name.
  if (typeof obj.name === "string" && obj.name.trim()) {
    return { format: "v1", card: obj as TavernV1Card, avatarBlob, filename };
  }

  throw new InvalidFormatError("Not a recognized TavernAI / SillyTavern card");
}

/** PNG chunk walker — yields decoded tEXt / iTXt keyword → text pairs. */
function readPngTextChunks(bytes: Uint8Array): Map<string, string> {
  const out = new Map<string, string>();
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new CorruptCardError("Not a PNG");

  let offset = 8;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 8 <= bytes.length) {
    const length = dv.getUint32(offset); offset += 4;
    const type = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    offset += 4;
    if (offset + length + 4 > bytes.length) {
      // Malformed chunk length field — don't try to walk further. Throw a
      // precise error rather than silently returning "no metadata" so the
      // user sees the real failure instead of the downstream symptom.
      throw new CorruptCardError(`PNG chunk length (${length}) exceeds file bounds at offset ${offset - 8}`);
    }
    if (type === "tEXt") {
      const { key, value } = readTextChunk(bytes.subarray(offset, offset + length));
      out.set(key, value);
    } else if (type === "iTXt") {
      const itxt = readItxtChunk(bytes.subarray(offset, offset + length));
      if (itxt) out.set(itxt.key, itxt.value);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 4; // skip data + CRC
  }
  return out;
}

function readTextChunk(data: Uint8Array): { key: string; value: string } {
  let nul = data.indexOf(0);
  if (nul < 0) nul = data.length;
  const key = new TextDecoder("latin1").decode(data.subarray(0, nul));
  const value = new TextDecoder("latin1").decode(data.subarray(nul + 1));
  return { key, value };
}

function readItxtChunk(data: Uint8Array): { key: string; value: string } | null {
  // iTXt layout: keyword\0 compression_flag compression_method language_tag\0
  // translated_keyword\0 text
  const k1 = data.indexOf(0); if (k1 < 0) return null;
  const key = new TextDecoder("latin1").decode(data.subarray(0, k1));
  const compressionFlag = data[k1 + 1];
  // We don't support compressed iTXt (would need inflate); skip silently.
  if (compressionFlag !== 0) return null;
  let cursor = k1 + 3;
  const langEnd = data.indexOf(0, cursor); if (langEnd < 0) return null;
  cursor = langEnd + 1;
  const tkEnd = data.indexOf(0, cursor); if (tkEnd < 0) return null;
  cursor = tkEnd + 1;
  const value = new TextDecoder("utf-8").decode(data.subarray(cursor));
  return { key, value };
}

function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}
