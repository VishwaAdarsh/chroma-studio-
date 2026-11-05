// Chroma Studio - Supabase Edge Function: AI Photo Editing Assistant
// Provides trusted server-side execution with Gemini / OpenAI / Semantic fallback.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are Chroma Studio's professional AI Photo Editing Assistant.
Your mission is to translate natural language editing requests into precise, bounded color-grading and tone adjustments.

ALLOWED PARAMETERS & LIMITS:
- exposure: -2.00 to +2.00 (EV, step 0.05)
- brightness: -100 to +100
- contrast: -100 to +100
- highlights: -100 to +100
- shadows: -100 to +100
- whites: -100 to +100
- blacks: -100 to +100
- temperature: -100 to +100
- tint: -100 to +100
- saturation: -100 to +100
- vibrance: -100 to +100
- hue: -180 to +180
- clarity: -100 to +100
- sharpen: 0 to 100
- blur: 0 to 100
- noiseReduction: 0 to 100
- vignette: 0 to 100
- grain: 0 to 100
- fade: 0 to 100

AVAILABLE PRESETS:
- "cine-teal-orange" (Cinematic Teal & Orange)
- "cine-gold500t" (Midnight Cinema)
- "vintage-kodak-gold" (Vintage Kodak Gold)
- "bw-classic" (Classic Black & White)
- "golden-sunset" (Golden Hour Sunset)
- "moody-forest" (Moody Pacific Northwest)
- "pastel-dream" (Soft Pastel Dream)

RULES:
1. ONLY return supported parameter names with numerical values inside valid ranges.
2. Structure your JSON response as:
   {
     "explanation": "Concise 1-2 sentence description explaining the visual look achieved and why.",
     "parameters": {
       "temperature": 25,
       "contrast": 15
     },
     "presetId": "optional-preset-id-if-fitting",
     "presetIntensity": 100,
     "supported": true
   }
3. If the user asks for generative inpainting, object insertion/removal (e.g., "remove person", "add car"), return:
   { "supported": false, "explanation": "Generative object replacement is not supported.", "unsupportedReason": "Chroma Studio specializes in photographic grading, tone, and cutout.", "suggestedAlternatives": ["Use Cutout tool", "Use HSL Color Lab"] }
4. Return ONLY valid clean JSON without markdown code fences or HTML.
`;

// In-memory IP rate limiter for abuse protection
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string, maxPerWindow = 30, windowMs = 60000): boolean {
  const now = Date.now();
  // Occasional cleanup of expired records
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= maxPerWindow) {
    return false;
  }
  record.count++;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous';
  if (!checkRateLimit(clientIp, 30, 60000)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute before making more AI requests.' }),
      { status: 429, headers: { ...corsHeaders, 'Retry-After': '60', 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { prompt, currentAdjustments } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Prompt is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prompt.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Prompt exceeds maximum length of 1000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('[ai-assistant] Request received. GEMINI_API_KEY present:', Boolean(geminiKey));

    // 1. Google Gemini API Call (if key configured)
    if (geminiKey) {
      const candidateModels = [
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-2.5-pro',
        'gemini-flash-lite-latest',
      ];

      for (const model of candidateModels) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: `${SYSTEM_PROMPT}\n\nCurrent Adjustments: ${JSON.stringify(
                          currentAdjustments || {}
                        )}\nUser Prompt: "${prompt}"\n\nGenerate structured JSON edit plan:`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.3,
                },
              }),
            }
          );
          clearTimeout(timer);

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                let planObj = parsed;
                if (!parsed.parameters && typeof parsed === 'object') {
                  const params: Record<string, number> = {};
                  for (const [k, v] of Object.entries(parsed)) {
                    if (typeof v === 'number') {
                      params[k] = v;
                    }
                  }
                  planObj = {
                    explanation:
                      typeof parsed.explanation === 'string'
                        ? parsed.explanation
                        : 'Applied adjustments for your request.',
                    parameters: params,
                    presetId: parsed.presetId,
                    presetIntensity: parsed.presetIntensity,
                    supported: parsed.supported !== false,
                    unsupportedReason: parsed.unsupportedReason,
                    suggestedAlternatives: parsed.suggestedAlternatives,
                  };
                }
                console.log(`[ai-assistant] Successfully generated plan via Gemini API (${model})`);
                return new Response(JSON.stringify({ plan: planObj, provider: 'gemini', model }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
              }
            }
          } else {
            const errBody = await geminiRes.text();
            console.warn(`[ai-assistant] Model ${model} returned status ${geminiRes.status}:`, errBody);
          }
        } catch (err) {
          console.warn(`[ai-assistant] Exception with model ${model}:`, err);
        }
      }
    }

    // 2. OpenAI API Call (if key configured)
    if (openAiKey) {
      try {
        const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Current: ${JSON.stringify(
                  currentAdjustments || {}
                )}\nPrompt: "${prompt}"`,
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });

        if (openAiRes.ok) {
          const data = await openAiRes.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            const parsed = JSON.parse(text);
            return new Response(JSON.stringify({ plan: parsed, provider: 'openai' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (err) {
        console.warn('OpenAI API call failed, falling back to semantic planner', err);
      }
    }

    // 3. Fallback: Server-side semantic intent translation
    const lower = prompt.toLowerCase();
    const isUnsupported =
      /\b(remove|erase|replace|insert|draw|generate)\s+(person|face|car|animal|cat|dog|tree)\b/i.test(
        lower
      );

    if (isUnsupported) {
      return new Response(
        JSON.stringify({
          plan: {
            explanation: 'Object inpainting is not supported by photographic grading engines.',
            parameters: {},
            supported: false,
            unsupportedReason:
              'Chroma Studio specializes in non-destructive color, tone, and cutout workflows.',
            suggestedAlternatives: ['Use the Cutout tool for subject isolation', 'Use Color Lab HSL'],
          },
          provider: 'server-semantic-fallback',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const proposed: Record<string, number> = { ...(currentAdjustments || {}) };
    let explanation = 'Applied adjustments for your request.';

    if (lower.includes('warm') || lower.includes('sunset') || lower.includes('golden')) {
      proposed.temperature = Math.min(100, (proposed.temperature || 0) + 30);
      proposed.vibrance = Math.min(100, (proposed.vibrance || 0) + 15);
      explanation = 'Increased color temperature (+30%) and lifted vibrance for golden warmth.';
    } else if (lower.includes('cool') || lower.includes('blue') || lower.includes('cold')) {
      proposed.temperature = Math.max(-100, (proposed.temperature || 0) - 25);
      explanation = 'Shifted color balance cooler (-25%) for a crisp modern look.';
    }

    if (/\b(reduce|pull|lower|recover|mute|muted)\s*(the\s*)?highlights\b/i.test(lower)) {
      proposed.highlights = Math.min(-25, (proposed.highlights || 0) - 25);
      explanation += ' Softened highlights.';
    } else if (/\b(boost|increase|more)\s*(the\s*)?highlights\b/i.test(lower)) {
      proposed.highlights = Math.max(25, (proposed.highlights || 0) + 25);
      explanation += ' Boosted highlights.';
    }

    if (/\b(lift|raise|open|brighten)\s*(the\s*)?shadows\b/i.test(lower)) {
      proposed.shadows = Math.max(25, (proposed.shadows || 0) + 25);
      explanation += ' Lifted shadows.';
    } else if (/\b(crush|deepen|darker)\s*(the\s*)?shadows\b/i.test(lower)) {
      proposed.shadows = Math.min(-25, (proposed.shadows || 0) - 25);
      explanation += ' Deepened shadows.';
    }

    if (/\b(preserve|protect)\s*(the\s*)?skin\s*tones?\b/i.test(lower)) {
      proposed.vibrance = Math.min(100, (proposed.vibrance || 0) + 8);
      proposed.temperature = Math.min(100, (proposed.temperature || 0) + 4);
      explanation += ' Preserved skin tones.';
    }

    if (/\b(reduce|lower|less|subdued)\s*(the\s*)?saturation\b/i.test(lower)) {
      const step = /\b(slightly|subtly|a\s*bit|little)\b/i.test(lower) ? -15 : -25;
      proposed.saturation = Math.max(-100, (proposed.saturation || 0) + step);
      explanation += ` Reduced saturation (${step}%).`;
    }

    if (/\b(bright|brighter|lighten|more\s*exposure)\b/i.test(lower) && !/\b(highlights|shadows)\b/i.test(lower)) {
      proposed.exposure = Math.min(2.0, (proposed.exposure || 0) + 0.35);
      proposed.brightness = Math.min(100, (proposed.brightness || 0) + 10);
      explanation += ' Brightened exposure (+0.35 EV).';
    } else if (/\b(dark|darker|dim|less\s*exposure)\b/i.test(lower) && !/\b(shadows)\b/i.test(lower)) {
      proposed.exposure = Math.max(-2.0, (proposed.exposure || 0) - 0.35);
      explanation += ' Deepened exposure (-0.35 EV).';
    }

    if (lower.includes('contrast') || lower.includes('punchy')) {
      proposed.contrast = Math.min(100, (proposed.contrast || 0) + 24);
      explanation += ' Boosted dynamic contrast (+24%).';
    }

    if (lower.includes('cinematic')) {
      proposed.contrast = Math.min(100, (proposed.contrast || 0) + 20);
      proposed.highlights = Math.max(-100, (proposed.highlights || 0) - 15);
      proposed.shadows = Math.min(100, (proposed.shadows || 0) + 12);
      proposed.vignette = Math.max(proposed.vignette || 0, 18);
      explanation = 'Crafted cinematic tone curve with softened highlights and vignette.';
    }

    return new Response(
      JSON.stringify({
        plan: {
          explanation,
          parameters: proposed,
          supported: true,
        },
        provider: 'server-semantic-fallback',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
