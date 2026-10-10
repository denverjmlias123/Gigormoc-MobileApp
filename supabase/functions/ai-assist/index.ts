// Supabase Edge Function: ai-assist
// Runtime: Deno
// Strictly adheres to docs/REAL_LOGIC_V5.md section 5 and AGENTS.md

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const ALLOWED_TASKS = ['suggest_skills', 'draft_bio', 'polish_gig_description'] as const;
type TaskType = typeof ALLOWED_TASKS[number];

// Bad words / phone / url sanitizers
function sanitizeText(input: string): string {
  // Strip URLs
  let cleaned = input.replace(/https?:\/\/[^\s]+/gi, '[link removed]');
  // Strip phone numbers / sequences of 7+ digits
  cleaned = cleaned.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[contact removed]');
  cleaned = cleaned.replace(/\b\d{7,15}\b/g, '[number removed]');
  return cleaned.trim();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };

  try {
    // 1. Authenticate Caller JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token.' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 2. Verify Profile Status is Active
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('status, active_mode')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.status !== 'active') {
      return new Response(JSON.stringify({ error: 'User profile is not active.' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 3. Rate Limit Check (e.g. 10 calls/hour, 30 calls/day via rate_limit_events)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: hourCount } = await supabase
      .from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action', 'ai_assist')
      .gte('created_at', oneHourAgo);

    if ((hourCount || 0) >= 10) {
      return new Response(JSON.stringify({ error: 'Rate limit reached (maximum 10 AI assists per hour). Please try again later.' }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    const { count: dayCount } = await supabase
      .from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('action', 'ai_assist')
      .gte('created_at', oneDayAgo);

    if ((dayCount || 0) >= 30) {
      return new Response(JSON.stringify({ error: 'Daily AI assist limit reached (maximum 30 per day). Please try again tomorrow.' }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    // 4. Validate Input Payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const task = body?.task as TaskType;
    if (!task || !ALLOWED_TASKS.includes(task)) {
      return new Response(JSON.stringify({ error: `Invalid task. Allowed tasks: ${ALLOWED_TASKS.join(', ')}` }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Bounded fields check (each input field max 600 chars)
    for (const [key, val] of Object.entries(body)) {
      if (typeof val === 'string' && val.length > 600) {
        return new Response(JSON.stringify({ error: `Field '${key}' exceeds maximum length of 600 characters.` }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }

    // 5. Server-Built Prompts (Strictly No Client System Prompt)
    let promptText = '';
    if (task === 'suggest_skills') {
      const workDesc = sanitizeText(String(body.work_description || ''));
      if (!workDesc || workDesc.length < 3) {
        return new Response(JSON.stringify({ error: 'work_description is required (at least 3 characters).' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      promptText = `You are a local job marketplace assistant in Ormoc City, Philippines.
Based on the following work description from a user, return a JSON object with a "skills" array containing between 3 and 8 concise, standard freelance skill names (each skill 2 to 30 characters).
Do not invent unrequested skills. Do not include phone numbers or prices. Return ONLY a valid JSON object matching this schema:
{"skills": ["Skill 1", "Skill 2"]}

User work description: "${workDesc}"`;
    } else if (task === 'draft_bio') {
      const mode = String(body.mode || profile.active_mode || 'freelancer');
      const skills = Array.isArray(body.skills) ? body.skills.join(', ') : String(body.skills || '');
      const area = sanitizeText(String(body.area || 'Ormoc City'));
      const roughBio = sanitizeText(String(body.rough_bio || ''));

      promptText = `You are an honest profile writing assistant for Gigormoc, a local freelance marketplace in Ormoc City, Philippines.
Draft 2 short, honest bio options for this user.
Rules:
- Length: strictly between 30 and 200 characters per draft.
- Plain, friendly English or natural Taglish.
- NEVER make up claims of certifications, years of experience, or ratings.
- NEVER use words like "verified", "guaranteed", or "certified".
- Return ONLY a valid JSON object matching this schema:
{"drafts": ["Draft 1 text...", "Draft 2 text..."]}

User details:
- Mode: ${mode}
- Skills: ${skills || 'General local services'}
- Location: ${area}
- Rough notes from user: "${roughBio}"`;
    } else if (task === 'polish_gig_description') {
      const currentDesc = sanitizeText(String(body.description || ''));
      if (!currentDesc || currentDesc.length < 10) {
        return new Response(JSON.stringify({ error: 'description is required (at least 10 characters).' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      promptText = `You are a gig posting assistant for Gigormoc in Ormoc City.
Rewrite the following gig description to make it clear, concise, and structured (scope, requirements, deliverables).
Rules:
- Length: strictly between 50 and 500 characters.
- Plain, direct English.
- Do not promise escrow, guarantees, or verifications.
- Return ONLY a valid JSON object matching this schema:
{"polished_description": "Clean, structured description text..."}

Current description: "${currentDesc}"`;
    }

    // 6. Call AI API (Google Gemini or Anthropic Claude)
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI provider is not configured on this server.' }), {
        status: 503,
        headers: corsHeaders,
      });
    }

    let content = '';

    if (apiKey.startsWith('sk-ant-')) {
      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 300,
          messages: [{ role: 'user', content: promptText }],
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('Anthropic API error:', errText);
        return new Response(JSON.stringify({ error: 'AI assist service currently unavailable. Please try again.' }), {
          status: 502,
          headers: corsHeaders,
        });
      }

      const aiData = await aiResponse.json();
      content = aiData?.content?.[0]?.text || '';
    } else {
      // Google Gemini API call
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
      const aiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 500,
            temperature: 0.2,
          },
        }),
      });

      if (!aiResponse.ok) {
        // Fallback to gemini-3.8-flash
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
        const fallbackResp = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 500,
              temperature: 0.2,
            },
          }),
        });

        if (!fallbackResp.ok) {
          const errText = await fallbackResp.text();
          console.error('Gemini API error:', errText);
          return new Response(JSON.stringify({ error: 'Gemini AI service currently unavailable. Please check API key.' }), {
            status: 502,
            headers: corsHeaders,
          });
        }

        const fallbackData = await fallbackResp.json();
        content = fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        const aiData = await aiResponse.json();
        content = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    }

    // 7. Parse and Validate JSON Output Strict Schema
    let parsed: any;
    try {
      // Find JSON block if wrapped in markdown
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned malformed output format. Please retry.' }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    // Task-specific output schema validation & sanitization
    let resultPayload: any = {};
    if (task === 'suggest_skills') {
      if (!Array.isArray(parsed?.skills)) {
        return new Response(JSON.stringify({ error: 'AI response missing skills array.' }), {
          status: 502,
          headers: corsHeaders,
        });
      }
      const cleanedSkills = parsed.skills
        .map((s: any) => sanitizeText(String(s)))
        .filter((s: string) => s.length >= 2 && s.length <= 40)
        .slice(0, 8);
      resultPayload = { skills: cleanedSkills };
    } else if (task === 'draft_bio') {
      if (!Array.isArray(parsed?.drafts)) {
        return new Response(JSON.stringify({ error: 'AI response missing drafts array.' }), {
          status: 502,
          headers: corsHeaders,
        });
      }
      const cleanedDrafts = parsed.drafts
        .map((d: any) => sanitizeText(String(d)))
        .filter((d: string) => d.length >= 20 && d.length <= 300)
        .slice(0, 2);
      resultPayload = { drafts: cleanedDrafts };
    } else if (task === 'polish_gig_description') {
      const cleanDesc = sanitizeText(String(parsed?.polished_description || ''));
      resultPayload = { polished_description: cleanDesc };
    }

    // 8. Record Rate Limit & Audit Event in Background
    await Promise.all([
      supabase.from('rate_limit_events').insert({
        user_id: user.id,
        action: 'ai_assist',
      }),
      supabase.from('audit_events').insert({
        actor_id: user.id,
        action: 'ai_assist',
        entity_type: 'profiles',
        entity_id: user.id,
        metadata: {
          task,
          success: true,
        },
      }),
    ]);

    return new Response(JSON.stringify(resultPayload), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    console.error('Unhandled AI assist error:', err);
    return new Response(JSON.stringify({ error: 'Internal AI service error.' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
