function getApiKeys() {
  const multi = process.env.GROQ_API_KEYS;
  const list = multi ? multi.split(',') : [process.env.GROQ_API_KEY];
  return list.map((k) => (k || '').trim()).filter(Boolean);
}

let nextKeyIndex = 0;

async function askGroq(messages) {
  const keys = getApiKeys();
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  if (keys.length === 0) {
    throw new Error('No Groq API key is set');
  }

  let lastStatus = null;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (nextKeyIndex + attempt) % keys.length;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${keys[idx]}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    if (response.ok) {
      // next request starts from the following key, so load is spread
      nextKeyIndex = (idx + 1) % keys.length;

      const data = await response.json();
      const choice = data?.choices?.[0];
      const text = choice?.message?.content;
      if (!text) {
        throw new Error('Empty response from Groq');
      }

      let out = text.trim();
      if (choice.finish_reason === 'length') {
        out += '\n\n*(Answer was cut short. Ask me to continue.)*';
      }
      return out;
    }

    lastStatus = response.status;
    // bad key, forbidden, or rate limited: try the next key
    if ([401, 403, 429].includes(response.status)) continue;
    break;
  }

  throw new Error(`Groq request failed with status ${lastStatus}`);
}

module.exports = { askGroq };