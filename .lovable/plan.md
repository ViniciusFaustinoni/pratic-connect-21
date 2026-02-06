

# Plano: Resetar Processo de Contratação ao Reverter Recusa

## Contexto

Quando um diretor remove um veículo da blacklist e reverte a recusa, o associado precisa **começar do zero** o processo de contratação. Isso é necessário porque:

- Podem ter ocorrido mudanças nos documentos
- O veículo pode ter sofrido sinistros durante o período
- Condições do plano podem ter sido alteradas
- Nova assinatura de contrato é obrigatória para validade jurídica

## Situação Atual

O hook `useRemoverBlacklist` atualmente:
1. Desativa a entrada na blacklist
2. Reverte o veículo para `'em_analise'`
3. Reverte o associado para `'pendente_vistoria'`

**Problema:** Não reseta o contrato nem a cotação, deixando registros antigos que podem causar confusão.

## Solução Proposta

### O que precisa ser resetado

| Entidade | Status Atual | Status Novo | Campos a Limpar |
|----------|-------------|-------------|-----------------|
| Blacklist | `ativo: true` | `ativo: false` | - |
| Veículo | `recusado` | `em_analise` | `motivo_recusa_veiculo` |
| Associado | `recusado/suspenso` | `pendente_vistoria` | `bloqueado`, `motivo_bloqueio` |
| Contrato | `cancelado` | `rascunho` | Dados de assinatura e pagamento |
| Cotação | `recusada` | `aceita` | `status_contratacao` |

### Campos do Contrato a Resetar

```typescript
{
  status: 'rascunho',
  // Limpar dados do Autentique (assinatura)
  autentique_documento_id: null,
  autentique_url: null,
  autentique_status: null,
  pdf_url: null,
  pdf_assinado_url: null,
  data_envio: null,
  data_visualizacao: null,
  data_assinatura: null,
  // Limpar dados de pagamento
  adesao_paga: false,
  adesao_paga_em: null,
  adesao_cobranca_id: null,
  // Limpar dados de aprovação
  aprovado_por: null,
  aprovado_em: null,
  observacao_aprovacao: null,
  // Limpar dados de vistoria
  vistoria_concluida_em: null,
  vistoria_id: null,
}
```

### Campos da Cotação a Resetar

```typescript
{
  status: 'aceita',
  status_contratacao: 'aguardando_vistoria',
  vistoria_concluida_em: null,
  vistoria_id: null,
}
```

---

## Arquivos a Modificar

### 1. `src/hooks/useBlacklist.ts`

Expandir a lógica de reversão para incluir reset do contrato e cotação:

```typescript
// Se solicitado reverter status do veículo
if (reverterVeiculo && blacklistItem?.veiculo_id) {
  // 1. Reverter veículo para 'em_analise'
  await supabase
    .from('veiculos')
    .update({ 
      status: 'em_analise',
      motivo_recusa_veiculo: null,
    })
    .eq('id', blacklistItem.veiculo_id);

  // 2. Reverter associado para 'pendente_vistoria'
  if (blacklistItem.associado_id) {
    await supabase
      .from('associados')
      .update({ 
        status: 'pendente_vistoria',
        bloqueado: false,
        motivo_bloqueio: null,
      })
      .eq('id', blacklistItem.associado_id);
  }

  // 3. NOVO: Resetar contrato para rascunho (precisa nova assinatura e pagamento)
  if (blacklistItem.contrato_id) {
    await supabase
      .from('contratos')
      .update({
        status: 'rascunho',
        // Limpar assinatura digital
        autentique_documento_id: null,
        autentique_url: null,
        autentique_status: null,
        pdf_url: null,
        pdf_assinado_url: null,
        data_envio: null,
        data_visualizacao: null,
        data_assinatura: null,
        // Limpar pagamento
        adesao_paga: false,
        adesao_paga_em: null,
        adesao_cobranca_id: null,
        // Limpar aprovação
        aprovado_por: null,
        aprovado_em: null,
        observacao_aprovacao: null,
        // Limpar vistoria
        vistoria_concluida_em: null,
        vistoria_id: null,
      })
      .eq('id', blacklistItem.contrato_id);
  }

  // 4. NOVO: Resetar cotação para aceita
  if (blacklistItem.cotacao_id) {
    await supabase
      .from('cotacoes')
      .update({
        status: 'aceita',
        status_contratacao: 'aguardando_vistoria',
        vistoria_concluida_em: null,
        vistoria_id: null,
      })
      .eq('id', blacklistItem.cotacao_id);
  }

  // 5. NOVO: Excluir vistorias antigas do veículo (para nova vistoria limpa)
  await supabase
    .from('vistorias')
    .delete()
    .eq('veiculo_id', blacklistItem.veiculo_id);
}
```

### 2. `src/hooks/useBlacklist.ts` - Buscar mais dados

Atualizar a query inicial para buscar também `contrato_id` e `cotacao_id`:

```typescript
const { data: blacklistItem, error: fetchError } = await supabase
  .from('blacklist_veiculos')
  .select('veiculo_id, associado_id, contrato_id, cotacao_id')  // Adicionar campos
  .eq('id', id)
  .single();
```

### 3. `src/pages/diretoria/Blacklist.tsx` - Atualizar UI

Atualizar a descrição no dialog para informar sobre o reset completo:

```tsx
<label htmlFor="reverter-status" className="cursor-pointer">
  <p className="text-sm font-medium">Reverter recusa e permitir nova contratação</p>
  <p className="text-xs text-muted-foreground mt-1">
    O associado precisará <strong>assinar novamente o contrato</strong> e <strong>efetuar novo pagamento</strong>. 
    O contrato atual será resetado para rascunho e uma nova vistoria será necessária.
  </p>
</label>
```

---

## Fluxo Após Reversão

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Diretor clica em "Remover e Reverter"                   │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Blacklist → ativo = false                               │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Veículo → status = 'em_analise'                         │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Associado → status = 'pendente_vistoria'                │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Contrato → status = 'rascunho'                          │
│     (assinatura e pagamento resetados)                      │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Cotação → status = 'aceita'                             │
│              status_contratacao = 'aguardando_vistoria'     │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Vistorias antigas excluídas                             │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Resultado: Associado pode recomeçar o processo             │
│  - Nova vistoria será agendada                              │
│  - Novo contrato será gerado para assinatura                │
│  - Novo pagamento será necessário                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

| Item | Antes | Depois da Reversão |
|------|-------|-------------------|
| Blacklist | Ativo | Inativo (histórico) |
| Veículo | Recusado | Em Análise |
| Associado | Recusado/Suspenso | Pendente de Vistoria |
| Contrato | Cancelado | Rascunho (sem assinatura/pagamento) |
| Cotação | Recusada | Aceita - Aguardando Vistoria |
| Vistorias | Reprovada | Excluídas (nova será criada) |

---

## Testes Recomendados

1. Reverter a recusa do associado "Marcus Vinicius" (LTB4J74)
2. Verificar se o contrato volta para status "Rascunho"
3. Verificar se a cotação volta para status "Aceita" com etapa "Aguardando Vistoria"
4. Verificar se o associado aparece na lista de pendentes de vistoria
5. Verificar se é possível agendar nova vistoria para o veículo

