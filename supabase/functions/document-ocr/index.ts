import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
- cor (ex: PRATA, PRETO, BRANCO)
- combustivel (ex: FLEX, GASOLINA, DIESEL)
- nome_proprietario (nome completo do proprietário)

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
- Se o endereço estiver completo e legível, SEMPRE sugerir "aprovar"
- Para correspondências/cartas, extrair o destinatário como nome_titular
- CLASSIFIQUE como "comprovante_residencia" qualquer documento que contenha endereço residencial claro

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, cpfEsperado, nomeEsperado } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      userPrompt += ` Nome esperado no cadastro: ${nomeEsperado}. Verifique se confere.`;
    }

    console.log('Calling Lovable AI Gateway for document OCR:', url);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Modelo mais potente para melhor OCR
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url } },
            ],
          },
        ],
        max_tokens: 2500,
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da IA' }),
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
      console.error('Failed to parse OCR result:', content);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao interpretar resultado da análise',
          rawResponse: content,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
            model: 'google/gemini-2.5-pro',
            messages: [
              { role: 'system', content: cpfRetryPrompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'Extraia o CPF desta CNH.' },
                  { type: 'image_url', image_url: { url } },
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
