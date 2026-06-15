const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Usa Claude para interpretar un mensaje del dueño y detectar
 * si confirma alguna actividad (paseo, comida, agua) para su mascota.
 *
 * Devuelve un objeto como:
 * { walked: true, fed: false, watered: false, reply: "..." }
 */
async function interpretOwnerMessage({ messageText, petName }) {
  const prompt = `Un dueño de mascota le escribió este mensaje por WhatsApp a una app que representa a su mascota llamada ${petName}:

"${messageText}"

Analizá el mensaje y determiná si el dueño está confirmando que:
- Ya paseó/sacó a pasear a la mascota (walked)
- Ya le dio de comer (fed)
- Ya le dio agua / le cambió el agua (watered)

Respondé SOLO con un JSON válido, sin texto adicional, sin markdown, con este formato exacto:
{"walked": true/false, "fed": true/false, "watered": true/false, "reply": "mensaje corto de agradecimiento en voz de ${petName}, máximo 1 oración, con 1 emoji de animal"}

Si el mensaje no confirma ninguna actividad (es solo un saludo, una pregunta, charla casual, etc.), poné los tres campos en false y "reply" como un saludo corto y simpático en voz de la mascota.

Ejemplos de mensajes que SÍ confirman:
"ya la paseé" -> walked: true
"dale, ya comió" -> fed: true
"le cambié el agua y la saqué" -> walked: true, watered: true
"sisi ya le di de comer y agua" -> fed: true, watered: true

Recordá: responder ÚNICAMENTE el JSON, nada más.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = response.content[0].text.trim();

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      walked: !!parsed.walked,
      fed: !!parsed.fed,
      watered: !!parsed.watered,
      reply: parsed.reply || '¡Gracias! 🐾'
    };
  } catch (err) {
    console.error('⚠️ No se pudo parsear respuesta de Claude:', raw);
    return { walked: false, fed: false, watered: false, reply: '¡Gracias! 🐾' };
  }
}

module.exports = { interpretOwnerMessage };
