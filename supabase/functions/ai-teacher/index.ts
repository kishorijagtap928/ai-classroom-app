import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, topic, syllabus_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";

    if (mode === "classroom") {
      systemPrompt = `You are an expert AI teacher in a virtual classroom. You are currently teaching the topic: "${topic || 'General'}".
      
${syllabus_context ? `Context about the syllabus: ${syllabus_context}` : ''}

Follow this structured teaching flow:
1. **Introduction**: Start with a brief, engaging introduction to the topic
2. **Explanation**: Explain the core concepts clearly with analogies
3. **Examples**: Provide 2-3 practical examples
4. **Summary**: Summarize key takeaways
5. **Quiz Preparation**: Mention you can generate a quiz when ready

Rules:
- Teach step-by-step, don't dump all information at once
- Use simple language appropriate for the student's level
- If asked "explain again differently", use completely different analogies
- If asked "teach me like I'm 10", simplify dramatically
- Be encouraging and supportive
- Use markdown formatting for clarity
- Keep responses focused and not too long`;
    } else if (mode === "quiz") {
      systemPrompt = `You are a quiz generator for educational purposes. Generate exactly 5 multiple-choice questions about the topic: "${topic}".

${syllabus_context ? `Context: ${syllabus_context}` : ''}

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks):
[
  {
    "question": "The question text",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correct": 0,
    "explanation": "Brief explanation of why this is correct"
  }
]

The "correct" field is the zero-based index of the correct option. Generate questions of varying difficulty.`;
    } else {
      systemPrompt = `You are a helpful AI teaching assistant. You help students learn and understand their subjects.

${syllabus_context ? `The student is studying: ${syllabus_context}` : ''}

Rules:
- Always be helpful, patient, and encouraging
- Explain concepts step by step
- Use examples and analogies
- If the student seems confused, try a different approach
- Use markdown for formatting`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: mode !== "quiz",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "quiz") {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-teacher error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
