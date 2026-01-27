
# Plano: Corrigir Tela Travada Após Agendamento na Base

## Problema Identificado

Quando o cliente escolhe "Levar até a Base" e confirma o pagamento, a tela fica eternamente em "Verificando status da sua proposta..." porque:

1. **`tipo_vistoria` não é definido**: O hook `useCriarAgendamentoBase` atualiza `status_contratacao` para `vistoria_agendada`, mas **não define** `tipo_vistoria`
2. **`hasAgendamentoBase` é ignorado**: O hook `useAgendamentoExistente` retorna `hasAgendamentoBase: true`, mas o componente `CotacaoContratacao.tsx` não extrai nem usa essa variável
3. **Fallback genérico**: O switch de etapas só reconhece `tipo_vistoria === 'autovistoria'` ou `tipo_vistoria === 'agendada'` - qualquer outro valor (incluindo `null`) cai no fallback de carregamento infinito

### Dados atuais da cotação:
- `status_contratacao`: `pagamento_ok`
- `tipo_vistoria`: `null` (deveria ser `'agendada_base'` ou usar flag `hasAgendamentoBase`)
- Existe registro em `agendamentos_base`: Data 2026-01-28 às 08:30

## Solução

Implementar suporte completo ao fluxo de agendamento na base:

### 1. Hook `useCriarAgendamentoBase` - Definir tipo_vistoria

Atualizar o hook para definir `tipo_vistoria = 'agendada_base'` ao criar o agendamento:

```typescript
// src/hooks/useAgendamentoBase.ts (linha 177-184)
await supabase
  .from('cotacoes')
  .update({ 
    status_contratacao: 'vistoria_agendada',
    tipo_vistoria: 'agendada_base', // NOVO
    updated_at: new Date().toISOString()
  })
  .eq('id', dados.cotacaoId);
```

### 2. Componente `CotacaoContratacao.tsx` - Extrair hasAgendamentoBase

Adicionar extração da variável:

```typescript
// src/pages/public/CotacaoContratacao.tsx (linha 64)
const { hasVistoriaAgendada, hasInstalacaoAgendada, hasAgendamentoBase, isLoading: isLoadingAgendamento } = useAgendamentoExistente(cotacao?.id);
```

### 3. Componente `CotacaoContratacao.tsx` - Adicionar Fluxo de Vistoria na Base

Inserir novo bloco condicional na Etapa 5 para tratar `tipo_vistoria === 'agendada_base'` ou `hasAgendamentoBase`:

```typescript
// Antes do fallback (linha ~826), adicionar:
) : (cotacao?.tipo_vistoria === 'agendada_base' || hasAgendamentoBase) ? (
  // ========== FLUXO AGENDAMENTO NA BASE ==========
  <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
    <CardContent className="py-12 text-center space-y-6">
      <motion.div 
        className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        <Building2 className="h-10 w-10 text-primary" />
      </motion.div>
      
      <div>
        <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">
          Agendamento na Base Confirmado
        </Badge>
        <h2 className="text-2xl font-bold mb-3 text-foreground">
          Vistoria Agendada com Sucesso!
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Compareça à base PRATIC na data e horário agendados 
          com seu veículo para realizar a vistoria.
        </p>
      </div>

      {/* Detalhes do agendamento - buscar de agendamentos_base */}
      <AgendamentoBaseResumo cotacaoId={cotacao.id} />

      {/* Aviso importante */}
      <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-left text-amber-200">
          <strong>Importante:</strong> A cobertura será ativada após a realização 
          da vistoria presencial na base.
        </p>
      </div>
    </CardContent>
  </Card>
) : (
```

### 4. Novo Componente `AgendamentoBaseResumo`

Criar componente para exibir os detalhes do agendamento na base:

```typescript
// src/components/cotacao-publica/AgendamentoBaseResumo.tsx
function AgendamentoBaseResumo({ cotacaoId }: { cotacaoId: string }) {
  // Buscar dados do agendamento e configurações da base
  const { data: agendamento } = useQuery({...});
  const { data: configBase } = useConfiguracaoBase();
  
  // Exibir: Data, Horário, Endereço da base
  return (
    <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
      {/* Data e horário */}
      {/* Endereço da base */}
    </div>
  );
}
```

## Fluxo Corrigido

```text
ANTES:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente agenda  │────►│ tipo_vistoria   │────►│ CotacaoContrat. │
│ na base         │     │ = null          │     │ if tipo = null  │
└─────────────────┘     └─────────────────┘     │ FALLBACK ❌     │
                                                └─────────────────┘

DEPOIS:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Cliente agenda  │────►│ tipo_vistoria   │────►│ CotacaoContrat. │
│ na base         │     │ = agendada_base │     │ if tipo = base  │
└─────────────────┘     └─────────────────┘     │ SUCESSO ✅      │
                               OU                └─────────────────┘
                        ┌─────────────────┐
                        │ hasAgendamento  │
                        │ Base = true     │
                        └─────────────────┘
```

## Alterações Necessárias

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAgendamentoBase.ts` | Definir `tipo_vistoria: 'agendada_base'` ao criar agendamento |
| `src/pages/public/CotacaoContratacao.tsx` | Extrair `hasAgendamentoBase` do hook e adicionar bloco condicional para exibir tela de sucesso |
| `src/components/cotacao-publica/AgendamentoBaseResumo.tsx` | Criar componente para exibir detalhes do agendamento na base |

## Seção Tecnica - Migração de Dados

Para corrigir a cotação já existente (dados retroativos):

```sql
UPDATE cotacoes 
SET tipo_vistoria = 'agendada_base' 
WHERE id IN (
  SELECT DISTINCT cotacao_id 
  FROM agendamentos_base 
  WHERE cotacao_id IS NOT NULL
) AND (tipo_vistoria IS NULL OR tipo_vistoria = '');
```

## Resultado Esperado

Após as alterações:

1. Cliente escolhe "Levar até a Base" na etapa de vistoria
2. Cliente seleciona data/horário e confirma agendamento
3. Hook define `tipo_vistoria = 'agendada_base'` e `status_contratacao = 'vistoria_agendada'`
4. Cliente realiza pagamento
5. Após pagamento confirmado, `status_contratacao = 'pagamento_ok'`
6. Etapa 5 reconhece `tipo_vistoria === 'agendada_base'` e exibe tela de sucesso com detalhes do agendamento na base
