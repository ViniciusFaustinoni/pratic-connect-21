
# Plano: Corrigir Histórico para Mostrar Etapas do Associado

## Problema Identificado

O histórico da cotação mostra apenas "Cotação criada" e "Cliente aceitou a cotação", mas não mostra as etapas intermediárias do fluxo de contratação como:
- Plano escolhido
- Dados preenchidos  
- Documentos enviados
- Contrato assinado
- Vistoria agendada/concluída
- Pagamento confirmado

## Causa Raiz

1. **Tabela `cotacoes_historico` vazia**: Nenhum evento está sendo persistido
2. **RLS restritiva**: A tabela só permite INSERT/SELECT para usuários `authenticated`, mas o fluxo público usa `publicSupabase` (anon)
3. **Timeline apenas infere do campo `status`**: O componente `CotacaoTimeline` só cria eventos inferidos baseados no campo `status` (enviada, aceita, recusada, expirada), mas ignora o campo `status_contratacao` que contém todas as etapas do fluxo

## Solução Proposta

Modificar o componente `CotacaoTimeline` para **inferir eventos a partir do `status_contratacao`** quando não há histórico persistido. Isso resolverá o problema imediatamente sem necessidade de alterar banco de dados ou lógicas de RLS.

### Arquivo a Modificar

**`src/components/cotacoes/CotacaoTimeline.tsx`**

### Mudanças

1. **Atualizar a interface** para receber `status_contratacao`:
```text
interface CotacaoTimelineProps {
  cotacao: {
    id: string;
    created_at: string;
    updated_at?: string;
    status: string;
    status_contratacao?: string | null;   // NOVO
    vendedor?: { nome?: string } | null;
  };
  ...
}
```

2. **Adicionar novos tipos de evento**:
```text
tipo: 'criacao' | 'pdf' | 'envio' | 'visualizacao' | 'aceite' | ... 
    | 'plano_escolhido'    // existente
    | 'dados_preenchidos'  // NOVO
    | 'documentos_ok'      // NOVO
    | 'contrato_assinado'  // NOVO
    | 'vistoria_ok'        // NOVO
    | 'pagamento_ok'       // NOVO
```

3. **Adicionar configurações visuais** para os novos tipos de evento

4. **Modificar a lógica do useMemo** para inferir eventos do `status_contratacao`:

```text
// Ordem das etapas do status_contratacao
const ETAPAS_CONTRATACAO = [
  'plano_escolhido',
  'dados_preenchidos', 
  'documentos_ok',
  'contrato_assinado',
  'vistoria_ok',
  'pagamento_ok'
];

// Se não há histórico real, inferir etapas do status_contratacao
if (historico.length === 0 && cotacao.status_contratacao) {
  const etapaAtualIndex = ETAPAS_CONTRATACAO.indexOf(cotacao.status_contratacao);
  
  // Adicionar todas as etapas até a atual (inclusive)
  ETAPAS_CONTRATACAO.slice(0, etapaAtualIndex + 1).forEach((etapa, idx) => {
    lista.push({
      id: `infer-${etapa}`,
      tipo: etapa,
      titulo: getTituloEtapaContratacao(etapa),
      data: cotacao.updated_at || cotacao.created_at,
    });
  });
}
```

5. **Adicionar função de mapeamento de títulos**:
```text
const getTituloEtapaContratacao = (etapa: string): string => {
  const titulos: Record<string, string> = {
    'plano_escolhido': 'Cliente escolheu o plano',
    'dados_preenchidos': 'Dados pessoais preenchidos',
    'documentos_ok': 'Documentos enviados',
    'contrato_assinado': 'Contrato assinado',
    'vistoria_ok': 'Vistoria realizada',
    'pagamento_ok': 'Pagamento confirmado',
  };
  return titulos[etapa] || etapa;
};
```

### Arquivos a Modificar

1. **`src/components/cotacoes/CotacaoTimeline.tsx`**
   - Adicionar novos tipos de evento ao tipo `TimelineEvent`
   - Adicionar configurações visuais em `getEventoConfig`
   - Atualizar lógica de inferência no `useMemo` para usar `status_contratacao`
   - Adicionar função `getTituloEtapaContratacao`

2. **`src/components/cotacoes/CotacaoDetalhesModal.tsx`**
   - Garantir que `cotacao.status_contratacao` seja passado para o `CotacaoTimeline`
   (Verificar se CotacaoWithRelations já inclui esse campo)

### Comportamento Esperado Após Correção

| Status Contratação | Eventos Exibidos na Timeline |
|-------------------|------------------------------|
| `aguardando` | Apenas "Cotação criada" |
| `plano_escolhido` | Cotação criada → Cliente escolheu o plano |
| `dados_preenchidos` | ... → Dados pessoais preenchidos |
| `documentos_ok` | ... → Documentos enviados |
| `contrato_assinado` | ... → Contrato assinado |
| `vistoria_ok` | ... → Vistoria realizada |
| `pagamento_ok` | ... → Pagamento confirmado |

### Vantagens da Solução

1. **Sem alteração de banco de dados** - não precisa criar triggers ou alterar RLS
2. **Atualização em tempo real** - o realtime já está ativo na tabela `cotacoes`
3. **Retrocompatível** - se algum dia houver histórico real, ele será usado
4. **Simples e eficiente** - apenas alterações no frontend

### Impacto

- Correção visual imediata do histórico
- As etapas serão mostradas mesmo sem persistência na tabela `cotacoes_historico`
- O realtime já invalida a query de cotações quando `status_contratacao` muda
