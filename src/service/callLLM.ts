import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4.1-mini' as const;
const SYSTEM_PROMPT = 'Du bist ein nüchternes, sachliches Analysemodell.';

interface ChatCompletionMessage {
  content?: string | null;
}

interface ChatCompletionChoice {
  message?: ChatCompletionMessage;
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

/**
 * Nimmt genau EINEN Prompt-String,
 * hängt den System-Prompt dazu
 * und gibt den Antwort-String zurück.
 */
export async function callLLM(prompt: string, model: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY ist nicht gesetzt');
  }

  const body = {
    model: model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`API-Fehler ${res.status} ${res.statusText}\n${txt}`);
  }

  const apiJson = (await res.json()) as ChatCompletionResponse;
  return apiJson?.choices?.[0]?.message?.content ?? '';
}
