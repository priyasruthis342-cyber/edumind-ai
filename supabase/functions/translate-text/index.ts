const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ALLOWED_TARGETS = new Set(["en", "ta", "te", "ml", "kn", "hi"]);
const MAX_INPUT_CHARS = 8000;
const MAX_CHUNK_CHARS = 400;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function splitIntoChunks(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK_CHARS) {
      if (current.trim()) chunks.push(current.trim());
      current = "";
      for (let i = 0; i < sentence.length; i += MAX_CHUNK_CHARS) {
        chunks.push(sentence.slice(i, i + MAX_CHUNK_CHARS));
      }
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > MAX_CHUNK_CHARS) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function translateChunk(chunk: string, target: string): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t" +
    `&tl=${encodeURIComponent(target)}&q=${encodeURIComponent(chunk)}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  } catch {
    throw new Error("Translation service is unreachable right now. Please try again.");
  }
  if (!response.ok) {
    throw new Error(`Translation service returned status ${response.status}. Please try again.`);
  }

  const body = await response.json();
  const segments = Array.isArray(body?.[0]) ? body[0] : null;
  if (!segments) throw new Error("Translation service returned an unexpected response.");

  const translated = segments
    .map((segment: unknown) => (Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : ""))
    .join("");
  if (!translated.trim()) throw new Error("Translation service returned no text.");
  return translated;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { text, target } = await req.json();

    if (typeof text !== "string" || text.trim().length === 0) {
      return jsonResponse({ error: "Text is required" }, 400);
    }
    if (text.length > MAX_INPUT_CHARS) {
      return jsonResponse({ error: "Text is too long to translate at once" }, 413);
    }
    if (typeof target !== "string" || !ALLOWED_TARGETS.has(target)) {
      return jsonResponse({ error: "Unsupported language" }, 400);
    }

    if (target === "en") {
      return jsonResponse({ translated: text });
    }

    const translated: string[] = [];
    for (const chunk of splitIntoChunks(text)) {
      translated.push(await translateChunk(chunk, target));
    }

    return jsonResponse({ translated: translated.join(" ") });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
