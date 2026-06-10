const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Genera un mensaje personalizado "en voz de la mascota"
 * usando Claude API
 */
async function generatePetMessage({ pet, owner, eventType, extraContext = '' }) {
  const toneGuide = {
    'cariñoso': 'muy cariñoso, afectuoso, usa muchos diminutivos y emojis de corazón',
    'juguetón': 'juguetón y divertido, usa emojis animados, exclamaciones y humor',
    'serio': 'directo pero amoroso, sin muchos emojis, mensajes claros y cortos',
    'dramático': 'un poco dramático y exagerado, como si todo fuera urgentísimo'
  };

  const tone = toneGuide[pet.personality_tone] || toneGuide['cariñoso'];

  const eventTemplates = {
    no_walk: `El dueño no sacó a pasear a la mascota en todo el día`,
    no_food: `La mascota no se acercó a comer en las últimas horas`,
    no_water: `La mascota no tomó agua en las últimas horas`,
    insufficient_sleep: `La mascota no descansó su tiempo habitual`,
    vaccine_reminder: `Se acerca el vencimiento de una vacuna`,
    antiparasitic_reminder: `Es hora de la desparasitación`,
    pipette_reminder: `Hay que renovar la pipeta antipulgas`,
    heat_cycle: `La mascota hembra está entrando en celo`,
    birthday: `¡Hoy es el cumpleaños de la mascota!`,
    vet_visit: `Se acerca una consulta veterinaria programada`,
    commercial_offer: `Una veterinaria o pet shop tiene una oferta relevante`,
    custom: extraContext
  };

  const situation = eventTemplates[eventType] || extraContext;

  const prompt = `Sos ${pet.name}, un/a ${pet.species} ${pet.breed || ''} de ${pet.sex || 'indeterminado'} sexo.
Tu dueño se llama ${owner.name.split(' ')[0]}.
${pet.vet_name ? `Tu veterinario de confianza se llama ${pet.vet_name}.` : ''}

Tu personalidad al escribir es: ${tone}.

Situación actual: ${situation}
${extraContext ? `Contexto adicional: ${extraContext}` : ''}

Escribí UN SOLO mensaje de WhatsApp como si fueras vos (la mascota) hablándole directamente a tu dueño.
- Máximo 3 oraciones
- Primera persona (yo soy la mascota)
- Usá el nombre del dueño al principio
- Tono: ${tone}
- Si aplica, mencioná al veterinario por nombre
- No uses asteriscos ni formato markdown
- Solo el texto del mensaje, nada más`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim();
}

module.exports = { generatePetMessage };
