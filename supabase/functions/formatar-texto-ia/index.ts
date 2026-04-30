import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { aiGatewayFetch } from "../_shared/ai-client.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VARIAVEIS_DISPONIVEIS = `
GRUPOS E VARIÁVEIS DISPONÍVEIS:

**associado**: {{associado.nome}}, {{associado.cpf}}, {{associado.rg}}, {{associado.rg_orgao}}, {{associado.telefone}}, {{associado.whatsapp}}, {{associado.telefone_secundario}}, {{associado.email}}, {{associado.data_nascimento}}, {{associado.endereco_completo}}, {{associado.logradouro}}, {{associado.numero}}, {{associado.complemento}}, {{associado.bairro}}, {{associado.cidade}}, {{associado.uf}}, {{associado.cep}}, {{associado.profissao}}, {{associado.estado_civil}}, {{associado.cnh}}, {{associado.cnh_validade}}, {{associado.cnh_categoria}}

**veiculo**: {{veiculo.marca}}, {{veiculo.modelo}}, {{veiculo.ano}}, {{veiculo.ano_fabricacao}}, {{veiculo.cor}}, {{veiculo.placa}}, {{veiculo.chassi}}, {{veiculo.renavam}}, {{veiculo.valor_fipe}}, {{veiculo.codigo_fipe}}, {{veiculo.combustivel}}, {{veiculo.categoria}}, {{veiculo.tipo}}, {{veiculo.tipo_uso}}, {{veiculo.alienado}}, {{veiculo.financeira}}, {{veiculo.procedencia}}, {{veiculo.cambio}}, {{veiculo.portas}}, {{veiculo.leilao}}, {{veiculo.uso_aplicativo}}, {{veiculo.valor_protegido}}

**contrato**: {{contrato.numero}}, {{contrato.valor_adesao}}, {{contrato.valor_mensal}}, {{contrato.dia_vencimento}}, {{contrato.data_inicio}}, {{contrato.forma_pagamento}}, {{contrato.primeira_mensalidade}}

**plano**: {{plano.nome}}, {{plano.tipo}}, {{plano.linha}}, {{plano.coberturas}}, {{plano.valor_base}}, {{plano.cobertura_fipe}}, {{plano.cota_participacao}}, {{plano.cota_participacao_valor}}, {{plano.cota_minima}}

**consultor**: {{consultor.nome}}

**sistema**: {{sistema.data_atual}}, {{sistema.data_extenso}}

**evento**: {{evento.protocolo}}, {{evento.tipo}}, {{evento.data_ocorrencia}}, {{evento.local}}, {{evento.descricao}}, {{evento.parecer}}, {{evento.valor_aprovado}}, {{evento.tipo_dano}}, {{evento.bo_numero}}

**os**: {{os.numero}}, {{os.data_entrada}}, {{os.data_conclusao}}, {{os.data_previsao}}, {{os.valor_orcamento}}, {{os.valor_aprovado}}, {{os.observacoes}}

**oficina**: {{oficina.nome}}, {{oficina.cnpj}}, {{oficina.telefone}}, {{oficina.whatsapp}}, {{oficina.endereco}}

**empresa**: {{empresa.nome}}, {{empresa.cnpj}}, {{empresa.endereco}}, {{empresa.logradouro}}, {{empresa.numero}}, {{empresa.bairro}}, {{empresa.cidade}}, {{empresa.uf}}, {{empresa.cep}}, {{empresa.lgpd_email}}

**regras**: {{regras.taxa_adesao_percentual}}, {{regras.taxa_adesao_minimo_volante}}, {{regras.taxa_adesao_minimo_base}}, {{regras.repasse_volante}}, {{regras.taxa_substituicao_placa}}, {{regras.taxa_troca_titularidade}}, {{regras.taxa_revistoria}}, {{regras.multa_rastreador}}, {{regras.migracao_comprovantes}}, {{regras.migracao_prazo_horas}}, {{regras.migracao_canal}}, {{regras.migracao_carencia_isenta}}, {{regras.prazo_reativacao_dias}}

**operacao**: {{operacao.adesao}}, {{operacao.migracao}}, {{operacao.inclusao}}, {{operacao.troca_titularidade}}, {{operacao.reativacao}}, {{operacao.substituicao_placa}}

**migracao**: {{migracao.aprovada}}, {{migracao.associacao_origem}}, {{migracao.data_aprovacao}}, {{migracao.carencia_status}}

**substituicao**: {{substituicao.placa_anterior}}, {{substituicao.modelo_anterior}}, {{substituicao.fipe_anterior}}, {{substituicao.tipo_operacao}}

**troca**: {{troca.titular_anterior}}, {{troca.cenario}}, {{troca.cenario_label}}
`;

const SYSTEM_PROMPT = `Você é um especialista em documentos jurídicos de proteção veicular (associação de benefícios).

Sua tarefa é receber um texto bruto (que pode ser HTML parcial ou texto simples) e retorná-lo como HTML limpo e bem formatado, inserindo as variáveis dinâmicas nos locais corretos.

REGRAS:
1. Analise o texto e identifique onde dados dinâmicos devem ser inseridos (nomes, CPFs, datas, valores, endereços, etc.)
2. Substitua esses dados ou placeholders por variáveis no formato {{grupo.campo}} — use APENAS variáveis da lista fornecida
3. Formate o HTML com estrutura clara: use <h2>, <h3> para títulos/seções, <p> para parágrafos, <ul>/<ol> para listas, <table> para dados tabulares
4. Mantenha o conteúdo original — NÃO invente cláusulas, parágrafos ou informações que não existem no texto
5. Use text-align: justify nos parágrafos de corpo
6. Se o texto já contém variáveis {{...}}, mantenha-as como estão
7. Se encontrar texto genérico como "NOME DO ASSOCIADO", "CPF", "DATA", substitua pela variável correspondente
8. Retorne APENAS o HTML — sem explicações, sem markdown, sem blocos de código

${VARIAVEIS_DISPONIVEIS}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conteudo } = await req.json();

    if (!conteudo || typeof conteudo !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'conteudo' é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await aiGatewayFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Formate o seguinte texto/HTML e insira as variáveis dinâmicas nos locais apropriados:\n\n${conteudo}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[formatar-texto-ia] AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let htmlFormatado = data.choices?.[0]?.message?.content || "";

    // Limpar possíveis wrappers de markdown
    htmlFormatado = htmlFormatado
      .replace(/^```html?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // Contar variáveis inseridas
    const variaveisEncontradas = htmlFormatado.match(/\{\{[^}]+\}\}/g) || [];
    const totalVariaveis = variaveisEncontradas.length;

    return new Response(JSON.stringify({
      html: htmlFormatado,
      variaveis_inseridas: totalVariaveis,
      variaveis: [...new Set(variaveisEncontradas)],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[formatar-texto-ia] Erro:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
