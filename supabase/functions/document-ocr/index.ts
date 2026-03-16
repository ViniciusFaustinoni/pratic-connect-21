import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const systemPrompt = `Analista de documentos brasileiros. Detecte o tipo e extraia dados.

## Tipos e campos obrigatórios:

### CNH
nome, cpf (XXX.XXX.XXX-XX - PRIORIDADE MÁXIMA), rg, numero_registro (11 dígitos), data_nascimento (YYYY-MM-DD), validade (YYYY-MM-DD), categoria
- CPF SEMPRE existe na CNH: campo "CPF"/"CPF/MF", próximo ao nome/foto. Procure sequências de 11 dígitos.
- NÃO confunda com RENACH (tem letras), registro CNH ou RG.
- NUNCA retorne cpf:null. Se ilegível: cpf:"ilegivel"

### RG
nome, rg, cpf (se presente), data_nascimento, data_expedicao

### CRLV
placa (ABC1234/ABC1D23), renavam (11 dígitos), chassi (17 chars), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor (campo "COR"/"COR PREDOMINANTE" - leia literalmente), combustivel, motor, nome_proprietario, blindado (bool)
- "ANO FAB/MOD: 2013/2014" → ano_fabricacao:2013, ano_modelo:2014
- Blindado: procure em OBS/TIPO por "BLINDADO/BLINDAGEM/PROTEÇÃO BALÍSTICA". Sempre inclua campo blindado.

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
{"tipo_detectado":"cnh"|"rg"|"crlv"|"comprovante_residencia"|"outro","sucesso":bool,"dados":{...},"legivel":bool,"valido":bool,"sugestao":"aprovar"|"reprovar"|"revisar","motivo":"...","confianca":0.0-1.0}`;

// Prompt específico para retry de extração de CPF
const cpfRetryPrompt = `TAREFA ÚNICA: Extraia o CPF desta CNH brasileira.

O CPF é um número de 11 dígitos no formato XXX.XXX.XXX-XX.

Locais comuns do CPF na CNH:
- Próximo ao nome do condutor
- Abaixo da foto
- Campo rotulado "CPF" ou "CPF/MF"

IMPORTANTE:
- Ignore todos os outros campos (nome, RG, validade, etc.)
- Foque APENAS em encontrar a sequência de 11 dígitos do CPF
- Se encontrar, retorne APENAS: {"cpf": "XXX.XXX.XXX-XX"}
- Se realmente não conseguir ler, retorne: {"cpf": "ilegivel"}`;

/**
 * Tenta reparar um JSON truncado pela IA (max_tokens atingido).
 * Estratégia: remover string incompleta no final, fechar chaves/colchetes pendentes.
 */
function tryRepairTruncatedJSON(raw: string): object | null {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Corrigir placeholders
  s = s.replace(/_CONFIDENCE_/g, '0.95');
  s = s.replace(/:\s*_[A-Z_]+_/g, ': null');

  // Tentar parse direto primeiro (caso já funcione)
  try { return JSON.parse(s); } catch { /* continue */ }

  // Remover trailing comma antes de tentar fechar
  s = s.replace(/,\s*$/, '');

  // Se termina no meio de uma string (aspas não fechadas), truncar a última string
  // Contar aspas (ignorando escaped)
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
    // Estamos dentro de uma string não fechada - truncar no início dessa string
    // Encontrar o início do valor da string (a aspas de abertura)
    // Precisamos remover desde a última key:value incompleta
    // Estratégia: cortar tudo após a última aspas de abertura e fechar com aspas
    s = s.substring(0, lastQuoteIndex + 1);
    // Agora s termina com uma aspas de abertura - precisamos adicionar conteúdo vazio + fechar
    // Voltar mais: remover a key incompleta
    // Encontrar a última vírgula ou { ou [ antes dessa posição
    const beforeKey = s.lastIndexOf(',', lastQuoteIndex - 1);
    const beforeBrace = s.lastIndexOf('{', lastQuoteIndex - 1);
    const beforeBracket = s.lastIndexOf('[', lastQuoteIndex - 1);
    const cutPoint = Math.max(beforeKey, beforeBrace, beforeBracket);
    
    if (cutPoint >= 0) {
      if (s[cutPoint] === ',') {
        s = s.substring(0, cutPoint); // remover a vírgula e tudo depois
      } else {
        s = s.substring(0, cutPoint + 1); // manter o { ou [
      }
    }
  }

  // Remover trailing comma novamente
  s = s.replace(/,\s*$/, '');

  // Contar chaves e colchetes abertos
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

  // Fechar pendentes
  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';

  try {
    return JSON.parse(s);
  } catch {
    console.error('[OCR] Reparo de JSON falhou. Tentando extração via regex...');
  }

  // Fallback: extrair campos básicos via regex
  try {
    const tipoMatch = raw.match(/"tipo_detectado"\s*:\s*"([^"]+)"/);
    const sugestaoMatch = raw.match(/"sugestao"\s*:\s*"([^"]+)"/);
    const motivoMatch = raw.match(/"motivo"\s*:\s*"([^"]+)"/);
    const confiancaMatch = raw.match(/"confianca"\s*:\s*([\d.]+)/);
    const legivelMatch = raw.match(/"legivel"\s*:\s*(true|false)/);
    const validoMatch = raw.match(/"valido"\s*:\s*(true|false)/);
    const sucessoMatch = raw.match(/"sucesso"\s*:\s*(true|false)/);

    if (tipoMatch) {
      // Extrair dados básicos também
      const dados: Record<string, string | null> = {};
      const dadosFields = ['nome', 'cpf', 'rg', 'placa', 'renavam', 'chassi', 'marca', 'modelo', 'cor', 'combustivel', 'motor', 'nome_proprietario', 'categoria', 'numero_registro', 'validade'];
      for (const field of dadosFields) {
        const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
        if (m) dados[field] = m[1];
      }
      // Extrair anos
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

    const { url, cpfEsperado, nomeEsperado } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação de segurança para requisições públicas
    // URLs devem ser do storage do próprio projeto
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

    console.log('Processing OCR for URL:', url, '| Authenticated:', isAuthenticated);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de OCR não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Adicionar contexto extra ao prompt se tivermos dados esperados
    let userPrompt = 'Analise este documento e extraia todas as informações. DETECTE AUTOMATICAMENTE o tipo do documento.';
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

    // Sempre baixar o arquivo e enviar como base64 para evitar problemas de acesso à URL pelo gateway
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
    const isDataUri = url.startsWith('data:');
    let contentParts: any[];

    if (isDataUri) {
      // Já é base64 data URI, enviar direto
      console.log('Data URI detected, sending directly...');
      contentParts = [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url } },
      ];
    } else {
      // Baixar arquivo (PDF ou imagem) e converter para base64
      const fileType = isPdfUrl ? 'PDF' : 'image';
      console.log(`${fileType} detected, downloading and converting to base64...`);
      try {
        const fileResponse = await fetch(url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${fileType}: ${fileResponse.status}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);
        
        // Converter para base64 em chunks para evitar stack overflow em arquivos grandes
        let base64 = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);
        
        // Detectar MIME type
        const mimeType = isPdfUrl 
          ? 'application/pdf' 
          : (fileResponse.headers.get('content-type') || 'image/jpeg');
        const dataUri = `data:${mimeType};base64,${base64}`;
        console.log(`${fileType} downloaded: ${fileBuffer.byteLength} bytes, mime: ${mimeType}`);
        
        contentParts = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ];
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
        model: 'google/gemini-3-flash-preview',
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

    // Ler resposta com tratamento robusto de erro
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

    // Tentar parsear o JSON da resposta
    let result;
    try {
      // Remover possíveis backticks de markdown
      let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Corrigir placeholders que a IA pode retornar ao invés de valores reais
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

    // Se for CNH e CPF veio null, fazer uma segunda tentativa focada apenas no CPF
    if (result.tipo_detectado === 'cnh' && (!result.dados?.cpf || result.dados?.cpf === null)) {
      console.log('CPF não encontrado na CNH, tentando extração específica...');
      
      try {
        const retryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-pro', // Pro apenas para retry de CPF
            messages: [
              { role: 'system', content: cpfRetryPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extraia o CPF desta CNH.' },
                  contentParts[1],
                ],
              },
            ],
            max_tokens: 200,
            temperature: 0.1,
          }),
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryContent = retryData.choices?.[0]?.message?.content;
          
          if (retryContent) {
            try {
              const cleanRetryContent = retryContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const cpfResult = JSON.parse(cleanRetryContent);
              
              if (cpfResult.cpf && cpfResult.cpf !== 'ilegivel') {
                console.log('CPF extraído na segunda tentativa:', cpfResult.cpf);
                result.dados = result.dados || {};
                result.dados.cpf = cpfResult.cpf;
              } else if (cpfResult.cpf === 'ilegivel') {
                console.log('CPF marcado como ilegível na segunda tentativa');
                result.dados = result.dados || {};
                result.dados.cpf = 'ilegivel';
                result.motivo = (result.motivo || '') + ' CPF não pôde ser lido (documento danificado ou cortado).';
              }
            } catch (retryParseError) {
              console.error('Falha ao parsear resultado do retry de CPF:', retryContent);
            }
          }
        }
      } catch (retryError) {
        console.error('Erro no retry de extração de CPF:', retryError);
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
