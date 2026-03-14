

# Plano: Garantir Fluxo Completo do Vendedor Externo

## Gaps Identificados (4 problemas críticos)

### Gap 1 — Propostas de autovistoria nunca aparecem no cadastro
**Arquivo:** `src/hooks/usePropostasPendentes.ts` L523-524

O filtro `if (!instalacaoInfo) return null` descarta toda proposta sem instalação. Para autovistoria, a instalação só é criada **após** aprovação do cadastro, então a proposta nunca chega lá. As variáveis `temAutovistoria` e `temVistoriaBaseRealizada` são calculadas mas ignoradas.

### Gap 2 — Race condition na isenção de adesão
**Arquivo:** `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` L238-247

Na isenção, o código faz `UPDATE adesao_paga = true` (anon role) e imediatamente chama `criar-instalacao-pos-pagamento` (service_role). A Edge Function verifica `adesao_paga` no banco e pode ler o valor antigo. Resultado: erro silencioso "Pagamento não confirmado".

### Gap 3 — Edge Function falha para autovistoria sem data de agendamento
**Arquivo:** `supabase/functions/criar-instalacao-pos-pagamento/index.ts` L286-296

Na Etapa 4, o cliente ainda **não preencheu** a preferência de data para instalação do rastreador (isso acontece na Etapa 5). A Edge Function exige `dataAgendada` e retorna erro 400. Consequência: **lançamentos CC do vendedor externo nunca são gerados**.

### Gap 4 — Aprovação ignora preferências de agendamento do cliente
**Arquivo:** `src/hooks/usePropostasPendentes.ts` L1538-1590

Ao aprovar, a instalação é criada com `data_agendada = new Date()` e endereço do associado. Os dados de preferência preenchidos pelo cliente na Etapa 5 (`vistoria_completa_data_agendada`, `vistoria_completa_endereco_*`) são completamente ignorados.

---

## Correções (4 arquivos)

### 1. `src/hooks/usePropostasPendentes.ts` — Filtro L523

Alterar de:
```typescript
if (!instalacaoInfo) {
  return null;
}
```
Para:
```typescript
if (!instalacaoInfo && !temAutovistoria && !temVistoriaBaseRealizada) {
  return null;
}
```

### 2. `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` — L245

Passar flag `skipPaymentCheck: true` no body:
```typescript
await publicSupabase.functions.invoke('criar-instalacao-pos-pagamento', {
  body: { cotacaoId, skipPaymentCheck: true },
});
```

### 3. `supabase/functions/criar-instalacao-pos-pagamento/index.ts` — 3 ajustes

- **L27:** Aceitar `skipPaymentCheck` no body
- **L114:** Se `skipPaymentCheck === true`, pular verificação de `adesao_paga`
- **L286-296:** Se `tipo_vistoria === 'autovistoria'` e `dataAgendada` é null: **pular criação da instalação** (o cadastro criará depois com os dados do cliente), mas **continuar para gerar lançamentos CC** do vendedor externo (seção 6.1). Reestruturar o código para que a seção 6.1 rode independente da criação da instalação.

### 4. `src/hooks/usePropostasPendentes.ts` — `useAprovarProposta` L1538-1590

Antes de criar a instalação, buscar a cotação vinculada e usar os dados `vistoria_completa_*` do cliente quando disponíveis:

```typescript
// Buscar preferências de agendamento da cotação
let dataPreferida = new Date().toISOString().split('T')[0];
let periodoPreferido = 'manha';
let enderecoInstalacao = { /* dados do associado como fallback */ };

if (contrato.cotacao_id) {
  const { data: cotacaoDados } = await supabase
    .from('cotacoes')
    .select('vistoria_completa_data_agendada, vistoria_completa_horario_agendado, vistoria_completa_periodo, vistoria_completa_endereco_*, vistoria_permite_encaixe')
    .eq('id', contrato.cotacao_id)
    .single();
  
  if (cotacaoDados?.vistoria_completa_data_agendada) {
    dataPreferida = cotacaoDados.vistoria_completa_data_agendada;
    periodoPreferido = cotacaoDados.vistoria_completa_periodo || 'manha';
    // usar endereço da cotação ao invés do associado
  }
}
```

---

## Resumo do fluxo corrigido

```text
Vendedor externo cria cotação (4 cenários)
  → Cliente abre link público
    → Plano → Dados/Docs → Assinatura → Vistoria → Pagamento/Isenção
       ↓
    Edge Function: gera lançamentos CC (mesmo sem data de instalação)
       ↓
    Etapa 5: Cliente preenche preferência de agendamento
       ↓
    Tela "Em Análise Cadastral"
       ↓
    Proposta aparece no cadastro (filtro corrigido)
       ↓
    Analista aprova → cobertura_roubo_furto = true
       ↓
    Instalação criada COM dados de preferência do cliente
       ↓
    Atribuição automática → Instalador instala rastreador
       ↓
    Proteção 360° ativada
```

