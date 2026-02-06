
# Plano: Corrigir Atualização Automática do Status do Associado na Lista de Cotações

## Problema Identificado

Na página de Cotações, o status do associado mostra "Assinando Contrato" mesmo quando o cliente já está na fase de aprovação do cadastro. Dois problemas foram identificados:

1. **Lógica incorreta de determinação de etapa**: A função `getEtapaVenda` retorna `'assinando_contrato'` quando `status_contratacao = 'pagamento_ok'`, mas isso está errado pois o pagamento já foi confirmado e o cliente está aguardando a vistoria/aprovação
2. **Falta de atualização em tempo real**: O hook `useCotacoesRealtime` não escuta mudanças na tabela `associados`, então quando o status do associado muda, a lista não é atualizada automaticamente

## Evidência no Banco de Dados

```text
Associado: MARCUS VINICIUS FAUSTINONI DE FREITAS
- Status do associado: pendente_vistoria
- Status do contrato: assinado  
- Status_contratacao da cotação: pagamento_ok
```

A interface mostra "Assinando Contrato" quando deveria mostrar "Vistoria Agendada" ou "Em Análise".

## Solução Proposta

### Correção 1: Adicionar etapa "em_analise" e corrigir lógica de `getEtapaVenda`

**Arquivos a modificar:**
- `src/components/cotacoes/CotacoesTable.tsx`
- `src/components/cotacoes/CotacaoCard.tsx`
- `src/components/cotacoes/CotacaoDetalhesModal.tsx`

**Mudanças:**

1. Adicionar nova etapa `'em_analise'` ao tipo `EtapaVenda`:
```text
type EtapaVenda = 
  | 'cotacao_realizada'
  | ...
  | 'vistoria_realizada'
  | 'em_analise'       // NOVA ETAPA
  | 'associado_ativo';
```

2. Adicionar configuração visual para a nova etapa:
```text
em_analise: {
  label: 'Em Análise',
  color: 'text-yellow-600 dark:text-yellow-400',
  bgColor: 'bg-yellow-500/20',
}
```

3. Corrigir a lógica de `getEtapaVenda`:
```text
ANTES (linha 165):
if (statusContratacao === 'pagamento_ok') return 'assinando_contrato';

DEPOIS:
// Verificar status do associado para em_analise
if (associadoStatus === 'em_analise') return 'em_analise';
if (associadoStatus === 'pendente_vistoria') return 'vistoria_agendada';

// Se pagamento_ok e sem vistoria agendada ainda, aguardar vistoria
if (statusContratacao === 'pagamento_ok') return 'vistoria_agendada';
```

### Correção 2: Adicionar listener realtime para tabela `associados`

**Arquivo a modificar:**
- `src/hooks/useCotacoesRealtime.ts`

**Mudança:**
Adicionar novo listener para a tabela `associados`:

```text
// Escutar mudanças em associados (afeta etapa de análise e ativação)
.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'associados',
  },
  (payload) => {
    console.log('[useCotacoesRealtime] Associado alterado:', payload.eventType);
    
    // Invalidar cotações pois a etapa de venda depende do status do associado
    queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
    queryClient.invalidateQueries({ queryKey: ['ativacoes'] });
    queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
    
    // Toast para associado ativado
    const newData = payload.new as { status?: string };
    const oldData = payload.old as { status?: string };
    
    if (newData.status === 'ativo' && oldData?.status !== 'ativo') {
      toast.success('🎉 Associado ativado!', { duration: 5000 });
    }
  }
)
```

## Detalhes Técnicos

### Arquivos a Modificar

1. **`src/components/cotacoes/CotacoesTable.tsx`**
   - Adicionar `'em_analise'` ao tipo `EtapaVenda` (linha 24-35)
   - Adicionar config visual para `em_analise` no objeto `etapaVendaConfig` (linha 81-137)
   - Corrigir lógica em `getEtapaVenda`:
     - Após verificar `associadoStatus === 'ativo'`, verificar também `'em_analise'` e `'pendente_vistoria'`
     - Mudar retorno de `'assinando_contrato'` para `'vistoria_agendada'` quando `pagamento_ok`

2. **`src/components/cotacoes/CotacaoCard.tsx`**
   - Mesmas mudanças do arquivo anterior (tipo, config e lógica)

3. **`src/components/cotacoes/CotacaoDetalhesModal.tsx`**
   - Adicionar `em_analise` ao objeto `etapaVendaConfig`

4. **`src/hooks/useCotacoesRealtime.ts`**
   - Adicionar listener para a tabela `associados` no canal existente

## Fluxo Corrigido

```text
1. Cliente escolhe plano           → escolhendo_plano
2. Cliente preenche dados          → enviando_documentos
3. Cliente envia documentos        → escolha_vistoria
4. Cliente escolhe vistoria        → realizando_pagamento (ou assinando_contrato se precisa assinar)
5. Cliente faz pagamento           → vistoria_agendada (CORRIGIDO - antes: assinando_contrato)
6. Vistoria em andamento           → realizando_vistoria
7. Vistoria concluída              → vistoria_realizada
8. Associado em análise            → em_analise (NOVA ETAPA)
9. Associado aprovado              → associado_ativo
```

## Comportamento Esperado Após Correção

1. Quando `status_contratacao = 'pagamento_ok'`, exibir "Vistoria Agendada"
2. Quando associado está em `'em_analise'`, exibir "Em Análise"
3. Quando associado está em `'pendente_vistoria'`, exibir "Vistoria Agendada"
4. A lista de cotações será atualizada automaticamente quando o status do associado mudar

## Impacto
- Correção visual imediata do status exibido
- Atualização em tempo real quando operadores alterarem status de associados
- Sem alteração em banco de dados
- Sem alteração na lógica de negócio do backend
