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
- cpf (formato 000.000.000-00) - SEMPRE presente na CNH, geralmente abaixo da foto ou próximo ao nome. Procure por "CPF", "CPF/MF", "CPF Nº" ou sequência de 11 dígitos
- rg (número do RG)
- data_nascimento (formato YYYY-MM-DD)
- validade (formato YYYY-MM-DD)
- categoria (A, B, AB, etc.)

IMPORTANTE para CNH:
- O CPF SEMPRE está impresso na CNH brasileira
- Se não encontrar com label "CPF", procure sequência de 11 dígitos numéricos no formato XXX.XXX.XXX-XX
- NÃO confunda CPF com RENACH (número de registro da CNH que tem letras)
- Se a imagem estiver inclinada ou parcialmente cortada, ainda tente extrair o CPF
- NUNCA retorne cpf: null para uma CNH brasileira válida

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
IMPORTANTE: Considere como comprovante de residência QUALQUER documento que contenha nome e endereço completo de uma pessoa, incluindo:

CONTAS DE SERVIÇOS (até 3 meses):
- Conta de energia/luz (ENEL, Light, CPFL, Cemig, Energisa, etc.)
- Conta de água/saneamento (Sabesp, Cedae, Copasa, Sanepar, etc.)
- Conta de gás (Comgás, Naturgy, CEG, etc.)
- Conta de telefone fixo ou celular (Vivo, Claro, TIM, Oi)
- Conta de internet ou TV por assinatura (NET, Sky, Claro, etc.)

BOLETOS E FATURAS:
- Boletos de cobrança (qualquer boleto bancário com nome e endereço do pagador)
- Fatura de cartão de crédito
- Boleto de plano de saúde (Unimed, Amil, SulAmérica, Bradesco Saúde, etc.)
- Boleto de condomínio
- Boleto de mensalidade escolar/faculdade
- Boleto de financiamento (veículo, imobiliário)
- Carnê de pagamento

DOCUMENTOS DE IMPOSTOS:
- Carnê/Guia de IPTU (Imposto Predial e Territorial Urbano)
- Carnê/Guia de IPVA
- Declaração de Imposto de Renda (IRPF)
- Extrato do FGTS
- CRLV (Certificado de Registro e Licenciamento de Veículos) - contém endereço

DOCUMENTOS FINANCEIROS:
- Extratos bancários (conta corrente, poupança)
- Correspondência de banco com endereço
- Comprovante de pagamento com endereço

DOCUMENTOS PÚBLICOS E OFICIAIS:
- Correspondência do INSS
- Correspondência da Receita Federal
- Contracheque de órgão público com endereço
- Termo de Rescisão de Contrato de Trabalho (TRCT)

CONTRATOS:
- Contrato de aluguel
- Contrato de financiamento imobiliário
- Escritura ou certidão de imóvel

CRITÉRIOS PARA IDENTIFICAÇÃO:
- Se o documento contém NOME + ENDEREÇO COMPLETO (logradouro, número, bairro, cidade, UF, CEP) → É comprovante de residência
- Documentos com campos "Pagador", "Sacado", "Cliente", "Titular", "Beneficiário" + endereço → É comprovante de residência
- Boletos bancários com dados do pagador/sacado → É comprovante de residência
- Fichas de cadastro com endereço → É comprovante de residência
- Se aparecer "Nome Pagador" ou "Sacado" junto com endereço, CLASSIFIQUE como comprovante_residencia

Extrair OBRIGATORIAMENTE:
- logradouro (nome da rua/avenida/travessa SEM o número)
- numero (apenas o número do endereço)
- complemento (apto, bloco, casa, etc. ou null se não houver)
- bairro (nome do bairro)
- cidade (nome da cidade)
- uf (sigla do estado com 2 letras, ex: SP, RJ, MG)
- cep (formato 00000-000 ou 00000000)
- nome_titular (nome da pessoa responsável/pagador/sacado na conta/boleto)

### Outro documento
ATENÇÃO: Só classifique como "outro" se NÃO for possível identificar como nenhum dos tipos acima.
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
        model: 'google/gemini-2.5-flash',
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
        max_tokens: 1000,
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
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
