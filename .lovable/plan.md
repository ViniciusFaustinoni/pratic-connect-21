
# Plano: Corrigir Lógica de Etapa da Venda na Lista de Cotações

## Problema Identificado

O status exibido na lista de cotações não reflete a etapa real do associado. No caso do Marcus Vinicius:

| Campo | Valor Atual |
|-------|-------------|
| `status_contratacao` | `contrato_assinado` |
| `contrato.status` | `assinado` |
| `contrato.adesao_paga` | `false` ← **Não pagou!** |
| `associado.status` | `pendente_vistoria` |
| **Etapa exibida** | `Vistoria Agendada` ← **Errado!** |
| **Etapa correta** | `Realizando Pagamento` |

## Causa Raiz

A função `getEtapaVenda` em `CotacoesTable.tsx` verifica o status do associado **antes** de verificar se o pagamento foi efetuado:

```typescript
// PRIORIDADE 1: Verificar status do associado (LINHA 166-169)
const associadoStatus = cotacao.contrato?.associados?.status;
if (associadoStatus === 'ativo') return 'associado_ativo';
if (associadoStatus === 'em_analise') return 'em_analise';
if (associadoStatus === 'pendente_vistoria') return 'vistoria_agendada'; // ← Retorna aqui!
```

O problema é que o status do associado é definido como `'pendente_vistoria'` no momento da geração do contrato, **antes** do pagamento ser efetuado. Isso faz com que a etapa "Vistoria Agendada" seja exibida prematuramente.

## Solução

Ajustar a ordem de prioridade na função `getEtapaVenda` para verificar:

1. **Primeiro**: Se há contrato assinado mas pagamento pendente → `'realizando_pagamento'`
2. **Depois**: Status do associado (apenas para etapas pós-pagamento)

---

## Arquivo a Modificar

**`src/components/cotacoes/CotacoesTable.tsx`** - Função `getEtapaVenda` (linhas 152-223)

### Nova Lógica de Prioridades

```typescript
export const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  // PRIORIDADE MÁXIMA: Se veículo foi recusado
  if (cotacao.status === 'recusada' || cotacao.status_contratacao === 'veiculo_recusado') {
    return 'veiculo_recusado';
  }
  
  const statusContratacao = cotacao.status_contratacao;
  const temContratacaoAtiva = statusContratacao && 
    statusContratacao !== 'aguardando' && 
    statusContratacao !== null;
  
  if (cotacao.status === 'rascunho' && !temContratacaoAtiva && !cotacao.contrato) return null;
  
  // PRIORIDADE 1: Verificar status do associado APENAS para etapas pós-vistoria
  const associadoStatus = cotacao.contrato?.associados?.status;
  if (associadoStatus === 'ativo') return 'associado_ativo';
  if (associadoStatus === 'em_analise') return 'em_analise';
  
  // PRIORIDADE 2: Verificar status da instalação/vistoria (apenas se vistoria em andamento/concluída)
  const instalacao = cotacao.instalacoes?.[0];
  if (instalacao) {
    if (instalacao.status === 'concluida') return 'vistoria_realizada';
    if (instalacao.status === 'em_andamento' || instalacao.status === 'em_rota') return 'realizando_vistoria';
  }
  
  // PRIORIDADE 3: Verificar se pagamento foi feito antes de considerar vistoria agendada
  const adesaoPaga = cotacao.contrato?.adesao_paga;
  const contratoStatus = cotacao.contrato?.status;
  
  // Se contrato existe e foi assinado, verificar pagamento
  if (contratoStatus === 'assinado' || contratoStatus === 'ativo') {
    if (adesaoPaga === false) {
      return 'realizando_pagamento';
    }
  }
  
  // Agora sim verificar vistoria agendada (somente se pagamento OK)
  if (instalacao && (instalacao.status === 'agendada' || instalacao.status === 'reagendada')) {
    const tipoVistoria = cotacao.tipo_vistoria;
    if (tipoVistoria === 'autovistoria') return 'instalacao_agendada';
    return 'vistoria_agendada';
  }
  
  // Se associado pendente_vistoria E pagamento OK, mostrar vistoria agendada
  if (associadoStatus === 'pendente_vistoria' && adesaoPaga !== false) {
    return 'vistoria_agendada';
  }
  
  // PRIORIDADE 4: Verificar status_contratacao
  if (statusContratacao === 'pagamento_ok') return 'vistoria_agendada';
  
  if (statusContratacao === 'vistoria_ok') {
    const tipoVistoria = cotacao.tipo_vistoria;
    if (tipoVistoria === 'agendada' && cotacao.vistoria_data_agendada) {
      return 'vistoria_agendada';
    }
    return 'realizando_pagamento';
  }
  
  if (statusContratacao === 'contrato_assinado' || statusContratacao === 'contrato_gerado') {
    if (adesaoPaga === false) return 'realizando_pagamento';
    return 'vistoria_agendada';
  }
  
  if (statusContratacao === 'documentos_ok') return 'escolha_vistoria';
  if (statusContratacao === 'dados_preenchidos') return 'enviando_documentos';
  if (statusContratacao === 'plano_escolhido') return 'escolhendo_plano';
  
  // PRIORIDADE 5: Status do contrato (fallback)
  if (contratoStatus === 'assinado' && adesaoPaga === false) {
    return 'realizando_pagamento';
  }
  
  if (contratoStatus === 'assinado' || contratoStatus === 'ativo') {
    return 'vistoria_agendada';
  }
  
  if (cotacao.status === 'enviada' || cotacao.status === 'aceita') {
    return 'cotacao_realizada';
  }
  
  if (temContratacaoAtiva) return 'cotacao_realizada';
  
  return null;
};
```

---

## Lógica de Prioridades (Diagrama)

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Veículo recusado? → veiculo_recusado                    │
└─────────────────────────────────────────────────────────────┘
                              ↓ não
┌─────────────────────────────────────────────────────────────┐
│  2. Associado ativo ou em_analise?                          │
│     - ativo → associado_ativo                               │
│     - em_analise → em_analise                               │
└─────────────────────────────────────────────────────────────┘
                              ↓ não
┌─────────────────────────────────────────────────────────────┐
│  3. Vistoria concluída ou em andamento?                     │
│     - concluida → vistoria_realizada                        │
│     - em_andamento → realizando_vistoria                    │
└─────────────────────────────────────────────────────────────┘
                              ↓ não
┌─────────────────────────────────────────────────────────────┐
│  4. Contrato assinado MAS pagamento pendente?               │
│     - adesao_paga = false → realizando_pagamento    ← FIX   │
└─────────────────────────────────────────────────────────────┘
                              ↓ não (pagamento OK)
┌─────────────────────────────────────────────────────────────┐
│  5. Vistoria agendada OU associado pendente_vistoria?       │
│     → vistoria_agendada                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Verificar status_contratacao para etapas anteriores     │
└─────────────────────────────────────────────────────────────┘
```

---

## Arquivos Adicionais

Além de `CotacoesTable.tsx`, a mesma função `getEtapaVenda` é duplicada em:

- `src/components/cotacoes/CotacaoCard.tsx` (linhas ~135-200)
- `src/components/cotacoes/CotacaoDetalhesModal.tsx` (usa via import ou duplicada)

A correção deve ser aplicada em **todos** os locais para garantir consistência.

---

## Resultado Esperado

| Campo | Marcus Vinicius |
|-------|-----------------|
| `contrato.status` | `assinado` |
| `contrato.adesao_paga` | `false` |
| `associado.status` | `pendente_vistoria` |
| **Etapa exibida ANTES** | `Vistoria Agendada` ❌ |
| **Etapa exibida DEPOIS** | `Realizando Pagamento` ✓ |

---

## Testes Recomendados

1. Verificar o Marcus Vinicius (LTB4374) na lista de cotações
2. Confirmar que mostra "Realizando Pagamento" em vez de "Vistoria Agendada"
3. Após simular pagamento, confirmar transição para "Vistoria Agendada"
4. Testar outros cenários:
   - Contrato não assinado → deve mostrar etapa do status_contratacao
   - Pagamento efetuado + vistoria agendada → deve mostrar "Vistoria Agendada"
   - Associado ativo → deve mostrar "Associado Ativo"
