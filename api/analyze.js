export const config = { runtime: 'edge' }

const SYSTEM_PROMPT = `Você é um assistente de raciocínio clínico especializado em psicologia, treinado nos protocolos DSM-5 e CID-11.

Sua função é APOIAR o raciocínio clínico do psicólogo — nunca substituir. O diagnóstico é responsabilidade exclusiva do profissional.

Analise o conteúdo da sessão (texto e/ou imagem das anotações) e responda SOMENTE com JSON válido, sem texto adicional, neste formato exato:

{
  "summary": "Resumo clínico da sessão em 2–3 frases objetivas",
  "hypotheses": [
    { "code": "F43.1", "name": "Transtorno de Estresse Pós-Traumático", "probability": 72, "reasoning": "Justificativa clínica breve" }
  ],
  "patterns": ["Padrão identificado 1", "Padrão identificado 2"],
  "connections": ["Conexão com sessão ou histórico anterior"],
  "suggestions": ["Sugestão para próxima sessão 1", "Sugestão 2"],
  "riskLevel": "low|moderate|high",
  "riskNote": "Observação sobre risco se relevante, null caso contrário",
  "emotions": [
    { "label": "Ansiedade", "intensity": 8 },
    { "label": "Evitação", "intensity": 7 }
  ]
}`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key não configurada' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const { patient, textContent, imageBase64 } = body

  // Montar contexto do paciente
  const patientCtx = patient
    ? `PACIENTE: ${patient.name}, ${patient.age || '?'} anos\nSessão: ${(patient.sessions || 1) + 1}\nCID atual: ${patient.cid || 'Em avaliação'}\nMeses em acompanhamento: ${patient.months || '?'}`
    : 'PACIENTE: Dados não disponíveis'

  // Montar conteúdo da mensagem para o Claude
  const userContent = []

  // Texto das anotações
  const textPart = [
    patientCtx,
    '',
    'CONTEÚDO DA SESSÃO:',
    textContent?.trim() || '(Sessão registrada apenas em anotações visuais)',
  ].join('\n')

  if (imageBase64) {
    // Com imagem do canvas
    userContent.push({ type: 'text', text: textPart + '\n\nAnalise também as anotações visuais do psicólogo abaixo:' })
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: imageBase64 }
    })
  } else {
    userContent.push({ type: 'text', text: textPart })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: `Anthropic: ${err}` }), {
        status: 500, headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await response.json()
    const raw = data.content?.[0]?.text || '{}'

    // Extrair JSON da resposta
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Resposta inesperada da IA' }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
