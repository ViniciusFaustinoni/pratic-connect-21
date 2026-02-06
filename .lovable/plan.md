
# Plano: Atualização Global de Status Após Recusa de Vistoria

## Problema Identificado

Após a recusa de um veículo na vistoria, os status globais não foram atualizados corretamente:

| Tela | Status Atual | Status Esperado |
|------|--------------|-----------------|
| **Cotações** | "ACEITA" + "Realizando Vistoria" | "RECUSADA" + "Veículo Recusado" |
| **Ativações** | "Pendente" | Não deveria aparecer |
| **Contratos** | "Cancelado" | OK |
| **Blacklist** | Presente | OK |

### Causa Raiz

O hook `useRecusarVeiculoServico` (linhas 1172-1178):
- Atualiza apenas `cotacoes.status_contratacao` para `'veiculo_recusado'`
- Não atualiza o campo `cotacoes.status` para `'recusada'`

A UI da página de Cotações exibe o campo `status` (não `status_contratacao`), então continua mostrando "ACEITA".

A página de Ativações não filtra contratos com status `'cancelado'`, então o contrato cancelado ainda aparece na lista.

A função `getEtapaVenda` não reconhece `status_contratacao = 'veiculo_recusado'`, então continua mostrando a etapa de vistoria.

---

## Solução Proposta

### 1. Atualizar Hook useRecusarVeiculoServico

**Arquivo:** `src/hooks/useServicos.ts`

Modificar a linha que atualiza a cotação para também mudar o campo `status`:

```typescript
// 8. ATUALIZADO: Atualizar cotação - status E status_contratacao
if (cotacaoId) {
  await supabase
    .from('cotacoes')
    .update({ 
      status: 'recusada',                    // NOVO: mudar status principal
      status_contratacao: 'veiculo_recusado' 
    })
    .eq('id', cotacaoId);
}
```

### 2. Atualizar Hook useAtivacoes - Filtrar Contratos Cancelados

**Arquivo:** `src/hooks/useAtivacoes.ts`

Modificar o filtro para excluir contratos cancelados da lista de ativações:

```typescript
// Filtrar por status - EXCLUIR CANCELADOS
let filteredContratos = (contratos || []).filter(c => 
  c.status !== 'cancelado'  // NOVO: nunca mostrar contratos cancelados
);

if (filtro === 'ativados') {
  filteredContratos = filteredContratos.filter(c => c.status === 'ativo');
} else if (filtro !== 'todos') {
  filteredContratos = filteredContratos.filter(c => 
    ['rascunho', 'assinado', 'pendente', 'pendente_assinatura', 'enviado'].includes(c.status)
  );
}
```

### 3. Atualizar getEtapaVenda - Reconhecer Veículo Recusado

**Arquivo:** `src/components/cotacoes/CotacoesTable.tsx`

Adicionar nova etapa e tratamento para `veiculo_recusado`:

```typescript
// Adicionar ao tipo EtapaVenda
type EtapaVenda = 
  | 'cotacao_realizada'
  | ...
  | 'veiculo_recusado';  // NOVO

// Adicionar ao etapaVendaConfig
veiculo_recusado: {
  label: 'Veículo Recusado',
  color: 'text-red-600 dark:text-red-400',
  bgColor: 'bg-red-500/20',
},

// Adicionar na função getEtapaVenda, NO INÍCIO (máxima prioridade)
export const getEtapaVenda = (cotacao: CotacaoWithRelations): EtapaVenda | null => {
  // NOVO: Se veículo foi recusado, mostrar imediatamente
  if (cotacao.status === 'recusada' || cotacao.status_contratacao === 'veiculo_recusado') {
    return 'veiculo_recusado';
  }
  
  // ... resto da função
};
```

### 4. Corrigir Dados Existentes

Executar SQL para corrigir a cotação específica (LTB4J74):

```sql
UPDATE cotacoes 
SET status = 'recusada'
WHERE id = 'f7091946-4f10-423b-bc96-93520ed045ad';
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useServicos.ts` | Adicionar `status: 'recusada'` ao update da cotação |
| `src/hooks/useAtivacoes.ts` | Excluir contratos com `status = 'cancelado'` |
| `src/components/cotacoes/CotacoesTable.tsx` | Adicionar etapa "Veículo Recusado" |
| **Migração SQL** | Corrigir cotação LTB4J74 para `status = 'recusada'` |

---

## Fluxo Completo Esperado

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Técnico recusa veículo na vistoria                      │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Serviço → status = 'cancelada'                          │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Veículo → status = 'recusado'                           │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Vistoria → status = 'reprovada'                         │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Blacklist → veículo inserido                            │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Associado → status = 'suspenso'                         │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Contrato → status = 'cancelado'                         │
└─────────────────────────────────┬───────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│  8. Cotação → status = 'recusada' +                         │
│              status_contratacao = 'veiculo_recusado'        │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultados Esperados

| Tela | Antes | Depois |
|------|-------|--------|
| **Cotações - Status** | "ACEITA" | "RECUSADA" (badge vermelho) |
| **Cotações - Etapa** | "Realizando Vistoria" | "Veículo Recusado" (badge vermelho) |
| **Ativações** | Aparece como "Pendente" | Não aparece (contrato cancelado) |
| **Contratos** | "Cancelado" | OK (sem mudança) |
| **Blacklist** | Presente | OK (sem mudança) |

---

## Testes Recomendados

1. Verificar se a cotação LTB4J74 agora mostra status "RECUSADA"
2. Verificar se a cotação mostra etapa "Veículo Recusado" em vermelho
3. Verificar se o contrato cancelado NÃO aparece mais na página de Ativações
4. Recusar uma nova vistoria e confirmar que todos os status são atualizados corretamente
