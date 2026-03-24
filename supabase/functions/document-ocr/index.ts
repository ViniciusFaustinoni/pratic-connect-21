import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Validação de CPF por dígito verificador
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cleaned[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cleaned[10]);
}

// Mapa de dígitos comumente confundidos por modelos de visão
const DIGIT_CONFUSIONS: Record<number, number[]> = {
  0: [8, 6],
  1: [7, 4],
  3: [8],
  4: [6, 9],
  5: [6, 8],
  6: [4, 5, 8, 0],
  7: [1],
  8: [3, 0, 6],
  9: [4, 7],
};

function tryFixCPFByPermutation(cpf: string): string | null {
  const digits = cpf.replace(/\D/g, '').split('').map(Number);
  if (digits.length !== 11) return null;

  const validResults: string[] = [];

  for (let pos = 0; pos < 11; pos++) {
    const originalDigit = digits[pos];
    const alternatives = DIGIT_CONFUSIONS[originalDigit];
    if (!alternatives) continue;

    for (const alt of alternatives) {
      const candidate = [...digits];
      candidate[pos] = alt;
      const candidateStr = candidate.join('');
      if (validateCPF(candidateStr)) {
        const formatted = candidateStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (!validResults.includes(formatted)) {
          validResults.push(formatted);
        }
      }
    }
  }

  if (validResults.length === 1) {
    return validResults[0];
  }
  return null;
}

const systemPrompt = `Analista de documentos brasileiros. Detecte o tipo e extraia dados.

## Tipos e campos obrigatórios:

### CNH
nome, cpf (XXX.XXX.XXX-XX - PRIORIDADE MÁXIMA), rg, numero_registro (11 dígitos), data_nascimento (YYYY-MM-DD), validade (YYYY-MM-DD), categoria
- CPF SEMPRE existe na CNH: campo "CPF"/"CPF/MF", próximo ao nome/foto. Procure sequências de 11 dígitos.
- NÃO confunda com RENACH (tem letras), registro CNH ou RG.
- NUNCA retorne cpf:null. Se ilegível: cpf:"ilegivel"
- LEIA CADA DÍGITO DO CPF INDIVIDUALMENTE, DA ESQUERDA PARA A DIREITA. O CPF possui dígitos verificadores matemáticos — se tiver dúvida em qualquer dígito, retorne cpf:"ilegivel" em vez de adivinhar.

### RG
nome, rg, cpf (se presente), data_nascimento, data_expedicao

### CRLV
placa (ABC1234/ABC1D23), renavam (11 dígitos), chassi (17 chars), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor (campo "COR"/"COR PREDOMINANTE" - leia literalmente), combustivel, motor, nome_proprietario, blindado (bool)
- "ANO FAB/MOD: 2013/2014" → ano_fabricacao:2013, ano_modelo:2014
- Blindado: procure em OBS/TIPO por "BLINDADO/BLINDAGEM/PROTEÇÃO BALÍSTICA". Sempre inclua campo blindado.

### Nota Fiscal de Veículo (DANFE / NF-e com dados veiculares)
Detectar quando o documento é uma Nota Fiscal (DANFE/NF-e) que contenha dados de veículo (chassi, motor, valor).
Campos: valor_nota_fiscal (valor numérico da NF), chassi (17 chars), numero_motor, placa (se presente), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor, nome_comprador, cpf_cnpj_comprador
- tipo_detectado deve ser "nota_fiscal_veiculo"
- Este documento substitui o CRLV para veículos zero km ou recém-adquiridos

### Comprovante de Residência
Aceitar: contas (água/luz/gás/telefone/internet), faturas/boletos, IPTU/IPVA, IRPF, extratos, contratos aluguel, escrituras.
Campos: logradouro, numero, complemento, bairro, cidade, uf (2 letras), cep, nome_titular, tipo_comprovante ("conta_luz"|"conta_agua"|"conta_gas"|"conta_telefone"|"conta_internet"|"fatura_cartao"|"boleto_plano_saude"|"boleto_condominio"|"iptu"|"ipva"|"extrato_bancario"|"contrato_aluguel"|"outro"), data_emissao
- Aceitar sem data de emissão. IPTU/IPVA do ano vigente/anterior válidos.

#### Titularidade (quando nomeEsperado fornecido)
Compare nome_titular com nomeEsperado:
- Ignore case/acentos. Aceite abreviações (M.=Mario, D.=Da/De). Sobrenome obrigatório.
- Correspondência OK → aprovar. Não corresponde → reprovar. Ilegível → revisar. Mesmo sobrenome, nome diferente → revisar (cônjuge).
- Inclua campo "validacao_titularidade": {nome_titular_extraido, nome_esperado, correspondencia, tipo_correspondencia, observacao}

## Regras gerais:
- Documento vencido: informar. Campo ilegível: null. Suspeita adulteração: reprovar. Dúvida: revisar.
- CPF: XXX.XXX.XXX-XX. Datas: YYYY-MM-DD. Placa: formato antigo ou Mercosul.

## JSON de resposta:
{"tipo_detectado":"cnh"|"rg"|"crlv"|"nota_fiscal_veiculo"|"comprovante_residencia"|"outro","sucesso":bool,"dados":{...},"legivel":bool,"valido":bool,"sugestao":"aprovar"|"reprovar"|"revisar","motivo":"...","confianca":0.0-1.0}`;

/**
 * Tenta reparar um JSON truncado pela IA (max_tokens atingido).
 */
function tryRepairTruncatedJSON(raw: string): object | null {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  s = s.replace(/_CONFIDENCE_/g, '0.95');
  s = s.replace(/:\s*_[A-Z_]+_/g, ': null');

  try { return JSON.parse(s); } catch { /* continue */ }

  s = s.replace(/,\s*$/, '');

  let inString = false;
  let lastQuoteIndex = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && inString) { i++; continue; }
    if (s[i] === '"') {
      inString = !inString;
      lastQuoteIndex = i;
    }
  }

  if (inString && lastQuoteIndex >= 0) {
    s = s.substring(0, lastQuoteIndex + 1);
    const beforeKey = s.lastIndexOf(',', lastQuoteIndex - 1);
    const beforeBrace = s.lastIndexOf('{', lastQuoteIndex - 1);
    const beforeBracket = s.lastIndexOf('[', lastQuoteIndex - 1);
    const cutPoint = Math.max(beforeKey, beforeBrace, beforeBracket);
    
    if (cutPoint >= 0) {
      if (s[cutPoint] === ',') {
        s = s.substring(0, cutPoint);
      } else {
        s = s.substring(0, cutPoint + 1);
      }
    }
  }

  s = s.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && inString) { i++; continue; }
    if (s[i] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (s[i] === '{') openBraces++;
    if (s[i] === '}') openBraces--;
    if (s[i] === '[') openBrackets++;
    if (s[i] === ']') openBrackets--;
  }

  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';

  try {
    return JSON.parse(s);
  } catch {
    console.error('[OCR] Reparo de JSON falhou. Tentando extração via regex...');
  }

  try {
    const tipoMatch = raw.match(/"tipo_detectado"\s*:\s*"([^"]+)"/);
    const sugestaoMatch = raw.match(/"sugestao"\s*:\s*"([^"]+)"/);
    const motivoMatch = raw.match(/"motivo"\s*:\s*"([^"]+)"/);
    const confiancaMatch = raw.match(/"confianca"\s*:\s*([\d.]+)/);
    const legivelMatch = raw.match(/"legivel"\s*:\s*(true|false)/);
    const validoMatch = raw.match(/"valido"\s*:\s*(true|false)/);
    const sucessoMatch = raw.match(/"sucesso"\s*:\s*(true|false)/);

    if (tipoMatch) {
      const dados: Record<string, string | null> = {};
      const dadosFields = ['nome', 'cpf', 'rg', 'placa', 'renavam', 'chassi', 'marca', 'modelo', 'cor', 'combustivel', 'motor', 'nome_proprietario', 'categoria', 'numero_registro', 'validade'];
      for (const field of dadosFields) {
        const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
        if (m) dados[field] = m[1];
      }
      const anoFabMatch = raw.match(/"ano_fabricacao"\s*:\s*(\d+)/);
      const anoModMatch = raw.match(/"ano_modelo"\s*:\s*(\d+)/);
      if (anoFabMatch) dados['ano_fabricacao'] = anoFabMatch[1];
      if (anoModMatch) dados['ano_modelo'] = anoModMatch[1];

      return {
        tipo_detectado: tipoMatch[1],
        sucesso: sucessoMatch ? sucessoMatch[1] === 'true' : true,
        dados,
        legivel: legivelMatch ? legivelMatch[1] === 'true' : true,
        valido: validoMatch ? validoMatch[1] === 'true' : true,
        sugestao: sugestaoMatch?.[1] || 'revisar',
        motivo: motivoMatch?.[1] || 'Resposta da IA foi truncada - dados parciais recuperados',
        confianca: confiancaMatch ? parseFloat(confiancaMatch[1]) : 0.5,
        _reparado: true,
      };
    }
  } catch {
    // Falhou completamente
  }

  return null;
}

/**
 * Extrai CPF de uma resposta truncada/malformada via regex
 */
function extractCPFFromRaw(raw: string): string | null {
  // Tentar JSON repair primeiro
  const repaired = tryRepairTruncatedJSON(raw);
  if (repaired && typeof repaired === 'object' && 'cpf' in repaired) {
    return (repaired as any).cpf;
  }
  
  // Fallback: regex para CPF formatado
  const cpfMatch = raw.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (cpfMatch) return cpfMatch[1];
  
  // Fallback: regex para 11 dígitos seguidos
  const digitsMatch = raw.match(/(\d{11})/);
  if (digitsMatch) {
    const d = digitsMatch[1];
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  }
  
  // Verificar se contém "ilegivel"
  if (raw.toLowerCase().includes('ilegivel') || raw.toLowerCase().includes('ilegível')) {
    return 'ilegivel';
  }
  
  return null;
}

// Modelo estável para OCR (evitar modelos preview em fluxo crítico)
const OCR_MODEL = 'google/gemini-2.5-flash';
const OCR_RETRY_MODEL = 'google/gemini-2.5-pro';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação OPCIONAL - permite uso público para cotações
    const authHeader = req.headers.get('Authorization');
    let isAuthenticated = false;
    
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        
        if (!claimsError && claimsData?.claims) {
          isAuthenticated = true;
          console.log('Authenticated request from user:', claimsData.claims.sub);
        }
      } catch (authErr) {
        console.warn('Auth validation failed (proceeding as public):', authErr);
      }
    }
    
    console.log('Request mode:', isAuthenticated ? 'authenticated' : 'public');

    const { url, tipoEsperado, cpfEsperado, nomeEsperado, extrairDados } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação de segurança para requisições públicas
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const allowedBuckets = ['cotacoes-docs', 'contratos-documentos', 'documentos'];
    const isAllowedUrl = allowedBuckets.some(bucket => 
      url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/`)
    );

    if (!isAuthenticated && !isAllowedUrl) {
      console.warn('Blocked public request with external URL:', url);
      return new Response(
        JSON.stringify({ 
          error: 'URL não permitida para requisições públicas',
          code: 'INVALID_URL',
          details: 'Apenas URLs do storage do projeto são permitidas sem autenticação'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing OCR for URL:', url, '| Authenticated:', isAuthenticated, '| tipoEsperado:', tipoEsperado || 'auto');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de OCR não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt com contexto de tipo esperado
    let userPrompt = '';
    if (tipoEsperado) {
      const tipoLabels: Record<string, string> = {
        cnh: 'CNH (Carteira Nacional de Habilitação)',
        crlv: 'CRLV (Certificado de Registro e Licenciamento de Veículo)',
        rg: 'RG (Registro Geral)',
        comprovante_residencia: 'Comprovante de Residência',
        laudo_vistoria: 'Laudo de Vistoria',
        nota_fiscal_veiculo: 'Nota Fiscal de Veículo',
      };
      const tipoLabel = tipoLabels[tipoEsperado] || tipoEsperado;
      userPrompt = `Este documento é um(a) ${tipoLabel}. Extraia todas as informações do tipo ${tipoEsperado}. Se o documento não corresponder ao tipo esperado, indique no campo motivo.`;
    } else {
      userPrompt = 'Analise este documento e extraia todas as informações. DETECTE AUTOMATICAMENTE o tipo do documento.';
    }
    
    if (cpfEsperado) {
      userPrompt += ` CPF esperado no cadastro: ${cpfEsperado}. Verifique se confere.`;
    }
    if (nomeEsperado) {
      userPrompt += `

⚠️ VERIFICAÇÃO CRÍTICA DE TITULARIDADE ⚠️
Nome do associado no cadastro: "${nomeEsperado}"
Se for COMPROVANTE DE RESIDÊNCIA: compare OBRIGATORIAMENTE o nome do titular com este nome.
- REPROVE se os nomes não corresponderem (permitindo abreviações válidas como "M. Silva" para "Mario Silva").
- Se mesmo sobrenome mas primeiro nome diferente, sugira REVISAR (possível cônjuge).
- Se nome ilegível, sugira REVISAR.
- Inclua o campo "validacao_titularidade" na resposta com os detalhes da comparação.`;
    }

    console.log('Calling Lovable AI Gateway for document OCR:', url);

    // Baixar arquivo e converter para base64
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?') || url.toLowerCase().includes('.pdf_');
    const isDataUri = url.startsWith('data:');
    let contentParts: any[];
    let extractedPdfText = '';

    if (isDataUri) {
      console.log('Data URI detected, sending directly...');
      contentParts = [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url } },
      ];
    } else {
      const fileType = isPdfUrl ? 'PDF' : 'image';
      console.log(`${fileType} detected, downloading...`);
      try {
        const fileResponse = await fetch(url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${fileType}: ${fileResponse.status}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);
        
        // Converter para base64
        let base64 = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);
        
        const mimeType = isPdfUrl 
          ? 'application/pdf' 
          : (fileResponse.headers.get('content-type') || 'image/jpeg');
        const dataUri = `data:${mimeType};base64,${base64}`;
        console.log(`${fileType} downloaded: ${fileBuffer.byteLength} bytes, mime: ${mimeType}`);
        
        // Para PDFs, tentar extrair texto nativo
        if (isPdfUrl) {
          try {
            // Decodificar o PDF e procurar texto embutido
            const pdfText = extractTextFromPDFBuffer(uint8Array);
            if (pdfText && pdfText.length > 50) {
              extractedPdfText = pdfText;
              console.log(`[OCR] Texto nativo extraído do PDF: ${pdfText.length} chars`);
            } else {
              console.log(`[OCR] PDF sem texto nativo suficiente (${pdfText?.length || 0} chars), usando OCR visual`);
            }
          } catch (pdfErr) {
            console.warn('[OCR] Falha ao extrair texto nativo do PDF:', pdfErr);
          }
        }

        contentParts = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ];

        // Se temos texto nativo do PDF, adicionar ao prompt para melhorar precisão
        if (extractedPdfText) {
          const textHint = extractedPdfText.length > 3000 
            ? extractedPdfText.substring(0, 3000) + '...' 
            : extractedPdfText;
          contentParts = [
            { 
              type: 'text', 
              text: `${userPrompt}\n\n--- TEXTO EXTRAÍDO DO PDF (use como referência principal para dados textuais como CPF, nome, números) ---\n${textHint}\n--- FIM DO TEXTO ---\n\nA imagem do documento também está anexada. Use o texto extraído como fonte primária para campos numéricos (CPF, RG, etc.) e a imagem para confirmar layout e campos visuais.`
            },
            { type: 'image_url', image_url: { url: dataUri } },
          ];
        }
      } catch (downloadError) {
        console.error(`Failed to download ${fileType}:`, downloadError);
        return new Response(
          JSON.stringify({ error: `Erro ao baixar o documento para processamento.` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: contentParts,
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido, tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos esgotados, adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erro ao processar documento com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ler resposta
    let data;
    try {
      const responseText = await response.text();
      if (!responseText || responseText.trim() === '') {
        console.error('Empty response from AI Gateway');
        return new Response(
          JSON.stringify({ error: 'Resposta vazia do gateway de IA. Tente novamente.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI Gateway response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar resposta do gateway de IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response:', JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parsear JSON da resposta
    let result;
    try {
      let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      cleanContent = cleanContent.replace(/_CONFIDENCE_/g, '0.95');
      cleanContent = cleanContent.replace(/:\s*_[A-Z_]+_/g, ': null');
      result = JSON.parse(cleanContent);
    } catch (parseError) {
      console.warn('[OCR] JSON.parse falhou, tentando reparar JSON truncado...');
      const repaired = tryRepairTruncatedJSON(content);
      if (repaired) {
        console.warn('[OCR] JSON reparado com sucesso após truncamento');
        result = repaired;
      } else {
        console.error('[OCR] Reparo falhou. Conteúdo bruto:', content);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao interpretar resultado da análise',
            rawResponse: content,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('OCR result:', result);

    // Se temos texto nativo do PDF e o CPF extraído está em conflito, tentar pegar do texto
    if (result.tipo_detectado === 'cnh' && result.dados && extractedPdfText) {
      const cpfExtraido = result.dados.cpf;
      if (cpfExtraido && cpfExtraido !== 'ilegivel') {
        const cpfClean = cpfExtraido.replace(/\D/g, '');
        if (!validateCPF(cpfClean)) {
          // Tentar encontrar CPF válido no texto nativo do PDF
          const cpfRegex = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
          const matches = extractedPdfText.match(cpfRegex);
          if (matches) {
            for (const match of matches) {
              const cleaned = match.replace(/\D/g, '');
              if (cleaned.length === 11 && validateCPF(cleaned)) {
                const formatted = cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
                console.log(`[OCR] CPF corrigido via texto nativo do PDF: ${cpfExtraido} → ${formatted}`);
                result.dados.cpf = formatted;
                break;
              }
            }
          }
        }
      }
    }

    // Validar CPF extraído por checksum quando for CNH
    if (result.tipo_detectado === 'cnh' && result.dados) {
      const cpfExtraido = result.dados.cpf;
      const precisaRetry = !cpfExtraido || cpfExtraido === null || 
        (cpfExtraido !== 'ilegivel' && !validateCPF(cpfExtraido.replace(/\D/g, '')));
      
      if (precisaRetry) {
        const motivoRetry = !cpfExtraido || cpfExtraido === null 
          ? 'CPF não encontrado na CNH' 
          : `CPF extraído (${cpfExtraido}) falhou na validação de dígito verificador`;
        console.log(`[OCR] ${motivoRetry}, tentando extração específica...`);
        
        // Prompt corretivo com tool calling para resposta estruturada
        const retrySystemPrompt = cpfExtraido && cpfExtraido !== null
          ? `TAREFA ÚNICA: Re-leia o CPF desta CNH brasileira.

A leitura anterior retornou "${cpfExtraido}", mas este CPF é MATEMATICAMENTE INVÁLIDO (falha no dígito verificador).

INSTRUÇÕES:
1. Localize o campo "CPF" ou "CPF/MF" no documento
2. Leia CADA DÍGITO individualmente, da esquerda para a direita
3. Preste atenção especial aos dígitos que podem ser confundidos: 1/7, 3/8, 5/6, 0/8, 4/9
4. Se não tiver certeza absoluta de algum dígito, use a função com cpf="ilegivel"
5. Se tiver certeza, use a função com o CPF no formato XXX.XXX.XXX-XX`
          : `TAREFA ÚNICA: Extraia o CPF desta CNH brasileira.

O CPF é um número de 11 dígitos no formato XXX.XXX.XXX-XX.

Locais comuns do CPF na CNH:
- Próximo ao nome do condutor
- Abaixo da foto
- Campo rotulado "CPF" ou "CPF/MF"

Use a função para retornar o CPF encontrado ou "ilegivel" se não conseguir ler.`;

        // Adicionar texto nativo como contexto extra se disponível
        let retryUserContent: any[] = [
          { type: 'text', text: 'Extraia o CPF desta CNH.' },
          contentParts[1], // imagem
        ];
        
        if (extractedPdfText) {
          retryUserContent = [
            { type: 'text', text: `Extraia o CPF desta CNH.\n\nTexto nativo do PDF:\n${extractedPdfText.substring(0, 2000)}` },
            contentParts[1],
          ];
        }

        try {
          const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: OCR_RETRY_MODEL,
              messages: [
                { role: 'system', content: retrySystemPrompt },
                { role: 'user', content: retryUserContent },
              ],
              max_tokens: 200,
              temperature: 0,
              tools: [{
                type: 'function',
                function: {
                  name: 'report_cpf',
                  description: 'Reportar o CPF extraído da CNH',
                  parameters: {
                    type: 'object',
                    properties: {
                      cpf: { 
                        type: 'string', 
                        description: 'CPF no formato XXX.XXX.XXX-XX ou "ilegivel" se não conseguir ler' 
                      }
                    },
                    required: ['cpf'],
                    additionalProperties: false,
                  }
                }
              }],
              tool_choice: { type: 'function', function: { name: 'report_cpf' } },
            }),
          });

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            
            // Tentar extrair CPF do tool call primeiro
            let retryCpf: string | null = null;
            
            const toolCall = retryData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                retryCpf = args.cpf || null;
                console.log('[OCR] CPF extraído via tool calling:', retryCpf);
              } catch {
                console.warn('[OCR] Falha ao parsear tool call arguments, tentando content...');
              }
            }
            
            // Fallback: tentar extrair do content (caso o modelo não use tool calling)
            if (!retryCpf) {
              const retryContent = retryData.choices?.[0]?.message?.content;
              if (retryContent) {
                retryCpf = extractCPFFromRaw(retryContent);
                console.log('[OCR] CPF extraído via content fallback:', retryCpf);
              }
            }

            if (retryCpf && retryCpf !== 'ilegivel') {
              if (validateCPF(retryCpf.replace(/\D/g, ''))) {
                console.log('[OCR] CPF válido extraído na segunda tentativa:', retryCpf);
                result.dados.cpf = retryCpf;
              } else {
                console.log('[OCR] CPF da segunda tentativa também inválido:', retryCpf, '→ tentando correção por permutação');
                const cpfCorrigido = tryFixCPFByPermutation(retryCpf);
                if (cpfCorrigido) {
                  console.log(`[OCR] CPF corrigido por permutação: ${retryCpf} → ${cpfCorrigido}`);
                  result.dados.cpf = cpfCorrigido;
                } else {
                  const cpfCorrigido1 = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
                  if (cpfCorrigido1) {
                    console.log(`[OCR] CPF corrigido por permutação (1ª tentativa): ${cpfExtraido} → ${cpfCorrigido1}`);
                    result.dados.cpf = cpfCorrigido1;
                  } else {
                    result.dados.cpf = 'ilegivel';
                    result.motivo = (result.motivo || '') + ' CPF não pôde ser lido com precisão (dígito verificador inválido em ambas tentativas).';
                  }
                }
              }
            } else if (retryCpf === 'ilegivel') {
              console.log('[OCR] CPF marcado como ilegível na segunda tentativa');
              // Ainda tentar permutação com CPF da 1ª tentativa
              const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
              if (cpfCorrigido) {
                console.log(`[OCR] CPF corrigido por permutação após ilegível: ${cpfExtraido} → ${cpfCorrigido}`);
                result.dados.cpf = cpfCorrigido;
              } else {
                result.dados.cpf = 'ilegivel';
                result.motivo = (result.motivo || '') + ' CPF não pôde ser lido (documento danificado ou cortado).';
              }
            } else {
              // Nenhum CPF extraído no retry - tentar permutação
              const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
              if (cpfCorrigido) {
                console.log(`[OCR] CPF corrigido por permutação (fallback): ${cpfExtraido} → ${cpfCorrigido}`);
                result.dados.cpf = cpfCorrigido;
              } else {
                result.dados.cpf = 'ilegivel';
              }
            }
          } else {
            console.error('[OCR] Retry response not ok:', retryResponse.status);
            const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
            if (cpfCorrigido) {
              result.dados.cpf = cpfCorrigido;
            } else {
              result.dados.cpf = 'ilegivel';
            }
          }
        } catch (retryError) {
          console.error('[OCR] Erro no retry de extração de CPF:', retryError);
          if (cpfExtraido && cpfExtraido !== 'ilegivel' && !validateCPF(cpfExtraido.replace(/\D/g, ''))) {
            const cpfCorrigido = tryFixCPFByPermutation(cpfExtraido);
            if (cpfCorrigido) {
              console.log(`[OCR] CPF corrigido por permutação após erro de rede: ${cpfExtraido} → ${cpfCorrigido}`);
              result.dados.cpf = cpfCorrigido;
            } else {
              result.dados.cpf = 'ilegivel';
            }
          }
        }
      } else if (cpfExtraido && cpfExtraido !== 'ilegivel') {
        console.log('[OCR] CPF extraído validado com sucesso:', cpfExtraido);
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in document-ocr function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Extrai texto nativo de um buffer PDF (extração simples de strings de texto).
 * Não depende de bibliotecas externas - faz parsing direto dos operadores de texto do PDF.
 */
function extractTextFromPDFBuffer(buffer: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(buffer);
  
  const textParts: string[] = [];
  
  // Extrair texto entre parênteses em operadores de texto PDF (Tj, TJ, ', ")
  // Padrão: (texto) Tj  ou  [(texto1) (texto2)] TJ
  const textRegex = /\(([^)]*)\)/g;
  let match;
  
  while ((match = textRegex.exec(pdfString)) !== null) {
    let text = match[1];
    if (!text || text.length === 0) continue;
    
    // Decodificar escapes do PDF
    text = text
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    
    // Filtrar lixo binário (manter apenas texto legível)
    const cleanText = text.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u024F]/g, '');
    if (cleanText.length > 1) {
      textParts.push(cleanText);
    }
  }
  
  // Também tentar extrair texto de streams descomprimidos
  // Procurar por sequências que parecem texto real
  const unicodeRegex = /<([0-9A-Fa-f]+)>\s*Tj/g;
  while ((match = unicodeRegex.exec(pdfString)) !== null) {
    const hex = match[1];
    if (hex.length < 4) continue;
    let text = '';
    for (let i = 0; i < hex.length; i += 4) {
      const charCode = parseInt(hex.substring(i, i + 4), 16);
      if (charCode > 31 && charCode < 65535) {
        text += String.fromCharCode(charCode);
      }
    }
    if (text.length > 1) {
      textParts.push(text);
    }
  }
  
  const result = textParts.join(' ').replace(/\s+/g, ' ').trim();
  return result;
}
