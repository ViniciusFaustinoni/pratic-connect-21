

# Mensagem de Cobertura 360 com coberturas/benefícios dinâmicos

## Problema
O template `cobertura_360_ativada` tem a lista de coberturas e benefícios fixa no texto aprovado pela Meta. Associados com planos diferentes recebem a mesma lista genérica.

## Solução

### Passo 1 — Novo template Meta com variável de lista
Criar um novo template na Meta Business Manager (ex: `cobertura_360_ativada_v2`) com uma 4ª variável para a lista dinâmica:

```
🛡️ Cobertura 360 Ativada!

Parabéns {{1}}! Seu veículo {{2}} ({{3}}) agora está com COBERTURA 360 ativa! ✅

O que está incluso na sua cobertura:

{{4}}

Acesse o App PRATIC para acompanhar seu veículo e solicitar assistência quando precisar.

Bem-vindo à família PRATIC! 💙
```

A variável `{{4}}` receberá o bloco completo de coberturas/benefícios formatado pelo backend.

### Passo 2 — Edge function: buscar coberturas e benefícios reais

No `notificar-cliente/index.ts`, quando `tipo === 'cobertura_total_ativada'`:

1. Receber `contrato_id` nos `dados` (já temos `associado_id`)
2. Buscar o `plano_id` do contrato/associado
3. Buscar coberturas do plano via `planos_coberturas` + `coberturas`
4. Buscar benefícios do plano via `planos_beneficios` + `benefits`
5. Montar string formatada:
```
🔐 Roubo e Furto
💥 Colisão
🔥 Incêndio
🚗 Assistência 24h
📍 Rastreamento
```
6. Passar como 4º parâmetro do template

### Passo 3 — Atualizar chamadas no frontend

Nos 3 pontos que invocam `cobertura_total_ativada`, adicionar `contrato_id` nos dados:
- `useAprovacaoMonitoramento.ts` (linha 194)
- `usePropostasPendentes.ts` (linhas 1554 e 1690)

### Passo 4 — Fallback Evolution (já funciona)

Atualizar a mensagem fallback (linhas 46-61) para também montar a lista dinâmica em vez de hardcoded.

## Detalhes técnicos (edge function)

```typescript
// Dentro do bloco cobertura_total_ativada no mapeamento Meta:
cobertura_total_ativada: {
  template_name: 'cobertura_360_ativada_v2',
  getParams: async () => {
    const placa = dados?.placa || 'N/A';
    const marcaModelo = [dados?.marca, dados?.modelo].filter(Boolean).join(' ');
    
    // Buscar plano do associado
    const { data: assoc } = await supabase
      .from('associados')
      .select('plano_id')
      .eq('id', associadoId)
      .single();
    
    let listaItens = '';
    if (assoc?.plano_id) {
      // Coberturas
      const { data: cobs } = await supabase
        .from('planos_coberturas')
        .select('coberturas(nome, icone)')
        .eq('plano_id', assoc.plano_id);
      
      // Benefícios
      const { data: bens } = await supabase
        .from('planos_beneficios')
        .select('benefits(name, category)')
        .eq('plano_id', assoc.plano_id);
      
      const linhas = [];
      for (const c of cobs || []) {
        if (c.coberturas) linhas.push(`✓ ${c.coberturas.nome}`);
      }
      for (const b of bens || []) {
        if (b.benefits) linhas.push(`✓ ${b.benefits.name}`);
      }
      listaItens = linhas.join('\n');
    }
    
    if (!listaItens) {
      listaItens = '✓ Proteção completa conforme seu plano';
    }
    
    return [primeiroNome, placa, marcaModelo, listaItens];
  },
},
```

## Sequência de execução
1. Você cria e aprova o template `cobertura_360_ativada_v2` na Meta com 4 variáveis
2. Eu atualizo o código da edge function + frontend
3. Deploy e teste

## Impacto
- 1 edge function alterada (notificar-cliente)
- 3 hooks atualizados para passar `contrato_id`
- Cada associado recebe a lista real do seu plano

