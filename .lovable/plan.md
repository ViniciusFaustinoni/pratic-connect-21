
# Plano: Envio Automático para SGA na Aprovação da Proposta

## Contexto

Atualmente, o fluxo de aprovação de proposta e o envio para o SGA Hinova são ações separadas:
1. Analista clica em "Aprovar Proposta" → proposta aprovada
2. Analista clica em "Enviar para SGA" → dados enviados para Hinova

O usuário deseja que o envio para o SGA seja **automático** ao aprovar, eliminando o botão separado.

---

## Alterações

### 1. Hook `useAprovarProposta` (src/hooks/usePropostasPendentes.ts)

**Adicionar chamada automática para SGA após aprovação bem-sucedida:**

Na mutation `useAprovarProposta`, após a etapa 9 (notificação WhatsApp), adicionar uma nova etapa:

```typescript
// 10. ENVIAR AUTOMATICAMENTE PARA SGA HINOVA
// Executar sincronização em background (não bloqueia fluxo principal)
try {
  const { data: veiculoParaSGA } = await supabase
    .from('veiculos')
    .select('id')
    .eq('associado_id', associadoId)
    .limit(1)
    .single();

  if (veiculoParaSGA?.id) {
    console.log('[useAprovarProposta] Iniciando envio automático para SGA...');
    const { data: sgaResult, error: sgaError } = await supabase.functions.invoke('sga-hinova-sync', {
      body: { 
        veiculo_id: veiculoParaSGA.id, 
        associado_id: associadoId 
      }
    });
    
    if (sgaError) {
      console.warn('[useAprovarProposta] Erro no envio SGA (não crítico):', sgaError);
    } else if (sgaResult?.success) {
      console.log('[useAprovarProposta] Enviado para SGA com sucesso:', sgaResult);
    } else {
      console.warn('[useAprovarProposta] SGA retornou falha:', sgaResult?.error);
    }
  }
} catch (sgaErr) {
  console.warn('[useAprovarProposta] Erro ao enviar para SGA (não crítico):', sgaErr);
}
```

| Aspecto | Decisão |
|---------|---------|
| Tratamento de erro | **Não-bloqueante** - Se falhar, loga warning mas não impede aprovação |
| Feedback ao usuário | Sucesso no toast principal; erro apenas no console |
| Retry | Pode ser feito manualmente via banco se necessário |

---

### 2. Página PropostaAnalise.tsx

**Remover:**
- Estado `enviandoSGA` (linha ~147)
- Função `handleEnviarSGA` (linhas 254-286)
- Botão "Enviar para SGA" (linhas 779-800)

---

## Fluxo Atualizado

```text
┌──────────────────────────────────────────────────────────────┐
│  ANALISTA DE CADASTRO                                        │
│                                                              │
│  [Analisar Proposta] ──▶ Revisar dados                       │
│                           │                                  │
│                           ▼                                  │
│                      [✓ Aprovar]                             │
│                           │                                  │
│        ┌──────────────────┼──────────────────┐               │
│        ▼                  ▼                  ▼               │
│   1. Ativar         2. Atualizar       3. Notificar          │
│      Contrato          Docs               WhatsApp           │
│        │                                     │               │
│        └─────────────────┬───────────────────┘               │
│                          ▼                                   │
│              4. ENVIAR PARA SGA (automático)                 │
│                          │                                   │
│                          ▼                                   │
│                 ✅ Aprovação Completa                        │
│                 (Navega para próxima proposta)               │
└──────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/usePropostasPendentes.ts` | Adicionar etapa 10 (envio SGA automático) na mutation |
| `src/pages/cadastro/PropostaAnalise.tsx` | Remover botão, estado e função do envio SGA manual |

---

## Resultado Esperado

1. Ao clicar em **"Aprovar Proposta"**, o sistema automaticamente envia para o SGA Hinova
2. O botão **"Enviar para SGA"** não aparece mais na interface
3. Se o envio SGA falhar, a aprovação **não é bloqueada** (apenas logado no console)
4. A flag `sincronizado_hinova` é atualizada automaticamente pelo edge function
