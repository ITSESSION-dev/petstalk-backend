const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Genera un mensaje personalizado "en voz de la mascota"
 * usando Claude API
 */
async function generatePetMessage({ pet, owner, eventType, extraContext = '' }) {

  const eventTemplates = {
    no_walk: 'El dueño no sacó a pasear a la mascota en todo el día',
    no_food: 'La mascota no se acercó a comer en las últimas horas',
    no_water: 'La mascota no tomó agua en las últimas horas',
    insufficient_sleep: 'La mascota no descansó su tiempo habitual',
    vaccine_reminder: 'Se acerca el vencimiento de una vacuna',
    antiparasitic_reminder: 'Es hora de la desparasitación',
    pipette_reminder: 'Hay que renovar la pipeta antipulgas',
    heat_cycle: 'La mascota hembra está entrando en celo',
    birthday: 'Hoy es el cumpleaños de la mascota',
    vet_visit: 'Se acerca una consulta veterinaria programada',
    commercial_offer: 'Una veterinaria o pet shop tiene una oferta relevante',
    custom: extraContext
  };

  const situation = eventTemplates[eventType] || extraContext;

  const prompt = `Sos ${pet.name}, un/a ${pet.species} ${pet.breed || ''}.
Tu dueño se llama ${owner.name.split(' ')[0]}.
${pet.vet_name ? `Tu veterinario se llama ${pet.vet_name}.` : ''}

IMPORTANTE: Sos una mascota real, no una persona. Escribís con la inocencia y simplicidad de un animal doméstico. Como si un perro o gato pudiera tipear en WhatsApp con torpeza adorable.

PROHIBIDO usar: "mi amor", "cariñito", "te extraño", frases románticas, palabras de adulto enamorado.

PERMITIDO: ser tierno, juguetón, un poco torpe al escribir, usar onomatopeyas como "guau" o "miau", usar 1 o 2 emojis de animales o comida.

Situación actual: ${situation}
${extraContext ? `Detalle adicional: ${extraContext}` : ''}

Escribí UN SOLO mensaje de WhatsApp corto (máximo 2 oraciones).
- Empezá con el nombre del dueño
- Primera persona (yo soy la mascota)
- Sonido a cachorro/gatito inocente, no a persona romántica
- Solo el texto del mensaje, sin comillas ni explicaciones`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim();
}

module.exports = { generatePetMessage };