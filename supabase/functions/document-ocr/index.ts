import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const systemPrompt = `Você é um analista especializado em documentos brasileiros. Analise a imagem do documento e:
1. IDENTIFIQUE AUTOMATICAMENTE o tipo do documento
2. EXTRAIA TODOS os dados relevantes com precisão

## Tipos de Documento que você pode identificar:

### CNH (Carteira Nacional de Habilitação)
Extrair OBRIGATORIAMENTE:
- nome (nome completo do condutor)
- cpf (formato 000.000.000-00) - **PRIORIDADE MÁXIMA**
- rg (número do RG)
- numero_registro (número de registro da CNH, campo "N° Registro" ou "Registro" - geralmente 11 dígitos)
- data_nascimento (formato YYYY-MM-DD)
- validade (formato YYYY-MM-DD)
- categoria (A, B, AB, etc.)

**⚠️ INSTRUÇÕES CRÍTICAS PARA EXTRAÇÃO DE CPF NA CNH ⚠️**

O CPF está SEMPRE presente em TODAS as CNHs brasileiras. Localizações comuns:
1. Na FRENTE da CNH, geralmente:
   - Campo específico rotulado "CPF" ou "CPF/MF"
   - Próximo ao campo de nome do condutor
   - Abaixo ou ao lado da foto 3x4
   - Próximo ao campo "Doc. Identidade/Org. Emissor/UF"
   
2. No VERSO da CNH (se houver), pode aparecer também

**FORMATO DO CPF:**
- 11 dígitos numéricos no padrão: XXX.XXX.XXX-XX
- Exemplos: 123.456.789-00, 987.654.321-12
- Pode aparecer SEM pontos e traço: 12345678900

**O QUE NÃO É CPF (não confundir):**
- RENACH: contém letras (ex: SP123456789)
- Número do Registro da CNH: formato diferente
- RG: geralmente menos dígitos
- Número de série/controle do documento

**REGRAS OBRIGATÓRIAS:**
- VASCULHE toda a imagem em busca do CPF
- Se a imagem estiver inclinada, rotacionada ou com baixa qualidade, AINDA ASSIM extraia o CPF
- Procure por QUALQUER sequência de 11 dígitos numéricos
- Se encontrar múltiplas sequências de 11 dígitos, escolha a que tem formato XXX.XXX.XXX-XX ou está próxima ao label "CPF"
- **NUNCA retorne cpf: null para uma CNH brasileira**
- Se REALMENTE não conseguir ler (documento muito danificado/cortado), retorne cpf: "ilegivel"

### RG (Registro Geral / Identidade)
Extrair OBRIGATORIAMENTE:
- nome (nome completo)
- rg (número do RG)
- cpf (formato 000.000.000-00) - Muitos RGs contêm CPF impresso. Procure por "CPF", "CPF/MF" ou sequência de 11 dígitos
- data_nascimento (formato YYYY-MM-DD)
- data_expedicao (formato YYYY-MM-DD)

IMPORTANTE para RG:
- Alguns RGs incluem o CPF, procure atentamente
- O CPF pode estar em qualquer posição do documento

### CRLV (Certificado de Registro e Licenciamento de Veículo)
Extrair OBRIGATORIAMENTE:
- placa (formato ABC1234 ou ABC1D23)
- renavam (11 dígitos)
- chassi (17 caracteres alfanuméricos)
- marca (ex: TOYOTA, VOLKSWAGEN, HONDA)
- modelo (ex: COROLLA XEI, GOL 1.0, CIVIC)
- ano_fabricacao (APENAS o número do ano de fabricação, ex: 2013)
- ano_modelo (APENAS o número do ano do modelo, ex: 2014)
- cor (ex: PRATA, PRETO, BRANCO, AZUL, VERMELHA, CINZA, BEGE, VERDE, AMARELA, MARROM, DOURADA, VINHO)
  IMPORTANTE: A cor está geralmente no campo rotulado "COR" ou "COR PREDOMINANTE".
  NÃO confunda com outros campos próximos. Leia EXATAMENTE o que está escrito no campo de cor do documento.
  Se houver dúvida, priorize o texto literal do campo "COR" no documento.
- combustivel (ex: FLEX, GASOLINA, DIESEL)
- motor (número do motor, ex: M155966, 1234ABC5678)
- nome_proprietario (nome completo do proprietário)
- blindado (boolean: true ou false)

**⚠️ DETECÇÃO DE VEÍCULO BLINDADO ⚠️**
Verifique OBRIGATORIAMENTE se o veículo é blindado:
1. Procure no campo "OBSERVAÇÕES" ou "OBS" do CRLV por palavras como: "BLINDADO", "BLINDADA", "BLINDAGEM", "BLINDEX", "PROTEÇÃO BALÍSTICA"
2. Procure no campo "TIPO" ou "ESPÉCIE" por menções a blindagem
3. Se encontrar QUALQUER menção a blindagem, retorne blindado: true
4. Se NÃO encontrar nenhuma menção, retorne blindado: false
5. SEMPRE inclua o campo "blindado" na resposta para CRLV

IMPORTANTE para CRLV:
- Se aparecer "ANO FAB/MOD: 2013/2014" ou "ANO: 2013/2014", extraia SEPARADAMENTE:
  - ano_fabricacao: 2013 (primeiro número)
  - ano_modelo: 2014 (segundo número)
- Se aparecer apenas um ano, use-o para ambos os campos
- SEMPRE retorne ano_fabricacao e ano_modelo como números inteiros separados

### Comprovante de Residência
ACEITAR como comprovante de residência válido QUALQUER UM destes documentos:

**Contas de Consumo** (máx. 3 meses):
- Conta de água, luz, energia elétrica, gás
- Conta de telefone fixo, celular, internet, TV por assinatura

**Faturas e Boletos** (máx. 3 meses):
- Fatura de cartão de crédito
- Boleto de plano de saúde
- Boleto de condomínio
- Boleto de mensalidade escolar/faculdade
- Boleto de financiamento (residencial ou veicular)

**Documentos de Impostos e Registros**:
- Carnê/Guia de IPTU (ano vigente ou anterior)
- Carnê/Guia de IPVA (ano vigente ou anterior)
- Declaração de Imposto de Renda (IRPF) com endereço
- Extrato do FGTS
- CRLV (se usado como comprovante de endereço)

**Documentos Financeiros** (máx. 3 meses):
- Extrato bancário (conta corrente, poupança, empréstimo)
- Correspondência bancária oficial

**Documentos Públicos**:
- Correspondência do INSS
- Correspondência da Receita Federal
- Contracheque de órgão público
- Termo de Rescisão de Contrato de Trabalho (TRCT)

**Contratos e Escrituras**:
- Contrato de aluguel (com ou sem firma reconhecida)
- Contrato de financiamento imobiliário
- Escritura do imóvel
- Certidão de registro do imóvel

Extrair OBRIGATORIAMENTE:
- logradouro (nome da rua/avenida/travessa SEM o número)
- numero (apenas o número do endereço)
- complemento (apto, bloco, casa, etc. ou null se não houver)
- bairro (nome do bairro)
- cidade (nome da cidade)
- uf (sigla do estado com 2 letras, ex: SP, RJ, MG)
- cep (formato 00000-000 ou 00000000)
- nome_titular (nome da pessoa responsável/destinatário)
- tipo_comprovante (tipo específico: "conta_luz", "conta_agua", "conta_gas", "conta_telefone", "conta_internet", "fatura_cartao", "boleto_plano_saude", "boleto_condominio", "boleto_escola", "iptu", "ipva", "irpf", "extrato_fgts", "extrato_bancario", "correspondencia_inss", "contrato_aluguel", "escritura", "outro")
- data_emissao (formato YYYY-MM-DD, se disponível)

REGRAS ESPECIAIS para Comprovante de Residência:
- ACEITE como válido mesmo que o documento não tenha data de emissão visível
- Para IPTU/IPVA, aceitar se for do ano vigente ou anterior
- Para contratos de aluguel, NÃO exigir firma reconhecida
- Para correspondências/cartas, extrair o destinatário como nome_titular
- CLASSIFIQUE como "comprovante_residencia" qualquer documento que contenha endereço residencial claro

**⚠️ VERIFICAÇÃO CRÍTICA DE TITULARIDADE ⚠️**

Esta é a verificação MAIS IMPORTANTE para comprovantes de residência quando nomeEsperado for fornecido:

1. COMPARE o nome_titular extraído do comprovante com o nomeEsperado fornecido no contexto

2. REGRAS DE COMPARAÇÃO DE NOMES (permitir abreviações):
   - Ignore diferenças de maiúsculas/minúsculas
   - Ignore acentos e caracteres especiais
   - Aceite abreviações válidas:
     * "M." ou "M " como abreviação de "Mario", "Maria", "Marcos", etc.
     * "D." ou "Da" ou "De" como conectivos abreviados
     * Iniciais seguidas de ponto são válidas para qualquer nome
   - O SOBRENOME deve corresponder (é obrigatório)
   - Pelo menos a primeira letra do primeiro nome deve corresponder

3. EXEMPLOS DE CORRESPONDÊNCIA:
   - "M. SILVA" corresponde a "Mario Silva" ✓
   - "MARIO D. SILVA" corresponde a "Mario da Silva" ✓
   - "M. D. S." corresponde a "Mario da Silva" ✓
   - "MARIO SILVA" corresponde a "Mario da Silva" ✓
   - "MARIA SILVA" NÃO corresponde a "Mario Silva" ✗
   - "JOSE SANTOS" NÃO corresponde a "Mario Silva" ✗

4. DECISÕES BASEADAS NA COMPARAÇÃO:
   - Se nome_titular CORRESPONDE ao nomeEsperado (incluindo abreviações): pode aprovar (se endereço legível)
   - Se nome_titular NÃO CORRESPONDE ao nomeEsperado: 
     * sugestao: "reprovar"
     * motivo: "Titular do comprovante ({nome_titular}) diverge do associado ({nomeEsperado})"
   - Se nome_titular está ILEGÍVEL ou VAZIO:
     * sugestao: "revisar"
     * motivo: "Nome do titular não pôde ser lido no documento"
   - Se MESMO SOBRENOME mas primeiro nome diferente (possível cônjuge):
     * sugestao: "revisar"
     * motivo: "Titular pode ser cônjuge/familiar - verificar manualmente"

5. PRIORIDADE: Esta verificação de titularidade tem PRIORIDADE sobre a regra de "endereço legível = aprovar"
   Se o endereço está perfeito MAS o nome não confere, deve REPROVAR ou REVISAR conforme regras acima.

6. INCLUIR na resposta JSON um campo "validacao_titularidade" com detalhes da comparação:
   {
     "validacao_titularidade": {
       "nome_titular_extraido": "M. DA SILVA",
       "nome_esperado": "Mario da Silva",
       "correspondencia": true | false,
       "tipo_correspondencia": "exata" | "abreviacao" | "nenhuma" | "possivel_conjuge" | "ilegivel",
       "observacao": "Explicação da decisão"
     }
   }

### Outro documento
Identificar e extrair o que for possível

## Regras:
- Verifique se o documento está vencido comparando com a data atual
- Se não conseguir ler algum campo, use null
- Se houver suspeita de adulteração ou documento ilegível, sugira reprovar
- Seja conservador: em caso de dúvida, sugira revisar
- Para CPF, formate como 000.000.000-00
- Para datas, formate como YYYY-MM-DD
- Para placa, aceite formato antigo (ABC-1234) ou Mercosul (ABC1D23)
- EXTRAIA TODOS OS CAMPOS mesmo que alguns estejam parcialmente visíveis

## RETORNE APENAS UM JSON VÁLIDO no formato:
{
  "tipo_detectado": "cnh" | "rg" | "crlv" | "comprovante_residencia" | "outro",
  "sucesso": true | false,
  "dados": {
    // campos extraídos específicos do tipo de documento
  },
  "legivel": true | false,
  "valido": true | false,
  "sugestao": "aprovar" | "reprovar" | "revisar",
  "motivo": "Explicação breve da sugestão",
  "confianca": 0.0 a 1.0
}`;

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

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      
      if (!claimsError && claimsData?.claims) {
        isAuthenticated = true;
        console.log('Authenticated request from user:', claimsData.claims.sub);
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

    // Detectar se é PDF para enviar como base64 (IA processa PDF nativo melhor que imagem convertida)
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
    let contentParts: any[];

    if (isPdfUrl) {
      console.log('PDF detected, downloading and converting to base64...');
      try {
        const pdfResponse = await fetch(url);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
        }
        const pdfBuffer = await pdfResponse.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
        const dataUri = `data:application/pdf;base64,${base64}`;
        console.log(`PDF downloaded: ${pdfBuffer.byteLength} bytes`);
        
        contentParts = [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: dataUri } },
        ];
      } catch (downloadError) {
        console.error('Failed to download PDF:', downloadError);
        return new Response(
          JSON.stringify({ error: 'Erro ao baixar o PDF para processamento.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      contentParts = [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url } },
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: contentParts,
          },
        ],
        max_tokens: 4000,
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
                  ...(isPdfUrl ? [contentParts[1]] : [{ type: 'image_url', image_url: { url } }]),
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
