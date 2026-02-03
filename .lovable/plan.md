

# Plano: Corrigir Ativação de Cobertura Total Após Instalação

## Diagnóstico do Problema

### Evidências Coletadas

**Veículo LTB4J74 (ID: a15a1745-bc59-4f18-9f0e-53ecdf966c9c):**
- `cobertura_roubo_furto: true` - Autovistoria aprovada
- `cobertura_total: false` - NÃO foi ativado após instalação
- `status: em_analise` - Incorreto (deveria ser `ativo`)
- Instalação: `concluida` com rastreador vinculado

**Timeline do Problema:**

| Evento | Horário | O que deveria acontecer |
|--------|---------|------------------------|
| Instalação concluída | 16:25:11 | Setar `cobertura_total: true` |
| Proposta aprovada | 16:25:54 | Manter `cobertura_total: true` |

### Causa Raiz Identificada

O bug está na função `useAprovarProposta` no arquivo `src/hooks/usePropostasPendentes.ts` (linhas 1401-1407):

```typescript
// CÓDIGO ATUAL (BUG)
const { error: veiculoError } = await supabase
  .from('veiculos')
  .update({
    status: statusVeiculo,
    cobertura_roubo_furto: true,
    cobertura_total: false, // ← SEMPRE SETA FALSE!
  })
  .eq('id', veiculoId);
```

**O problema:** Quando a instalação é concluída ANTES da aprovação do analista, a aprovação sobrescreve `cobertura_total` para `false`, desfazendo a ativação que deveria ter ocorrido na conclusão da instalação.

---

## Fluxo do Bug

```text
┌─────────────────────────────────────────────────────────────────────┐
│  INSTALAÇÃO CONCLUÍDA (16:25:11)                                    │
│  useAprovarVeiculoServico                                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. Verifica cobertura_roubo_furto = true                          │
│  2. Verifica cobertura_total = false                               │
│  3. Tenta setar cobertura_total = true                             │
│  ✅ Sucesso (mas será sobrescrito!)                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (43 segundos depois)
┌─────────────────────────────────────────────────────────────────────┐
│  PROPOSTA APROVADA (16:25:54)                                       │
│  useAprovarProposta                                                 │
├─────────────────────────────────────────────────────────────────────┤
│  1. Atualiza contrato para 'ativo'                                 │
│  2. Atualiza associado para 'ativo'                                │
│  3. Atualiza veículo:                                              │
│     - cobertura_roubo_furto: true                                  │
│     - cobertura_total: false  ← SOBRESCREVE!                       │
│  ❌ Bug: Ignora que instalação já foi concluída                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Solução

### 1. Corrigir `useAprovarProposta` (PRINCIPAL)

**Arquivo:** `src/hooks/usePropostasPendentes.ts`
**Linhas:** 1394-1412

Modificar a lógica para:
- Se instalação já foi concluída (`jaTemInstalacaoConcluida = true`), setar `cobertura_total: true`
- Caso contrário, manter `cobertura_total: false` (aguardando instalação)

```typescript
// CÓDIGO CORRIGIDO
// Status do veículo depende se instalação foi concluída
const statusVeiculo = jaTemInstalacaoConcluida ? 'ativo' : 'instalacao_pendente';

// Se instalação já está concluída, ativar cobertura total imediatamente
const coberturaTotal = jaTemInstalacaoConcluida;

const { error: veiculoError } = await supabase
  .from('veiculos')
  .update({
    status: statusVeiculo,
    cobertura_roubo_furto: true,
    cobertura_total: coberturaTotal, // ← DINÂMICO!
  })
  .eq('id', veiculoId);
```

### 2. Adicionar Ativação do Rastreador na Plataforma (COMPLEMENTAR)

Quando a instalação já está concluída, a aprovação deve também:
1. Chamar a ativação na plataforma do rastreador (Softruck/Rede Veículos)
2. Criar acesso do associado via `ativar-associado`

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/usePropostasPendentes.ts` | Editar | Corrigir lógica de `cobertura_total` na aprovação |

---

## Lógica de Decisão Corrigida

```text
┌──────────────────────────────────────────────────────────────────────┐
│  APROVAÇÃO DE PROPOSTA                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  jaTemInstalacaoConcluida?                                           │
│         │                                                            │
│    ┌────┴────┐                                                       │
│    │         │                                                       │
│    ▼ SIM     ▼ NÃO                                                   │
│                                                                      │
│  ┌────────────────┐  ┌────────────────────────────┐                  │
│  │ veículo.status │  │ veículo.status             │                  │
│  │ = 'ativo'      │  │ = 'instalacao_pendente'    │                  │
│  │                │  │                            │                  │
│  │ cobertura_total│  │ cobertura_total            │                  │
│  │ = true         │  │ = false                    │                  │
│  │                │  │                            │                  │
│  │ + Ativar na    │  │ (Aguardar instalação)      │                  │
│  │   plataforma   │  │                            │                  │
│  │ + Criar acesso │  │                            │                  │
│  └────────────────┘  └────────────────────────────┘                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Código da Correção

### usePropostasPendentes.ts (linhas 1394-1477)

```typescript
// 6. Atualizar VEÍCULO e criar instalação SE NECESSÁRIO
if (veiculos && veiculos.length > 0) {
  const veiculoId = veiculos[0].id;
  
  // Status do veículo depende se instalação foi concluída
  const statusVeiculo = jaTemInstalacaoConcluida ? 'ativo' : 'instalacao_pendente';
  
  // Se instalação já está concluída, ativar cobertura total imediatamente
  // Caso contrário, aguardar instalação para ativar
  const coberturaTotal = jaTemInstalacaoConcluida;
  
  const { error: veiculoError } = await supabase
    .from('veiculos')
    .update({
      status: statusVeiculo,
      cobertura_roubo_furto: true,
      cobertura_total: coberturaTotal,
    })
    .eq('id', veiculoId);

  if (veiculoError) {
    console.error('Erro ao atualizar veículo:', veiculoError);
  }

  // Se instalação já foi concluída, ativar rastreador na plataforma e criar acesso
  if (jaTemInstalacaoConcluida && instalacaoConcluida?.rastreador_id) {
    try {
      // Buscar dados do rastreador para ativação
      const { data: rastreadorData } = await supabase
        .from('rastreadores')
        .select('imei, plataforma')
        .eq('id', instalacaoConcluida.rastreador_id)
        .single();
      
      if (rastreadorData?.imei) {
        const { data: associadoEmail } = await supabase
          .from('associados')
          .select('email')
          .eq('id', associadoId)
          .single();

        // Ativar na plataforma do rastreador
        if (rastreadorData.plataforma === 'softruck') {
          console.log('[useAprovarProposta] Ativando rastreador na Softruck...');
          await supabase.functions.invoke('softruck-ativar-dispositivo', {
            body: {
              imei: rastreadorData.imei,
              veiculoId: veiculoId,
              associadoId: associadoId,
              associadoEmail: associadoEmail?.email,
            },
          });
        } else if (rastreadorData.plataforma === 'rede_veiculos') {
          console.log('[useAprovarProposta] Ativando rastreador na Rede Veículos...');
          await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
            body: {
              imei: rastreadorData.imei,
              veiculoId: veiculoId,
              associadoId: associadoId,
            },
          });
        }
        
        // Criar acesso do associado
        await supabase.functions.invoke('ativar-associado', {
          body: {
            veiculo_id: veiculoId,
            rastreador_id: instalacaoConcluida.rastreador_id,
            associado_id: associadoId,
          },
        });
        
        console.log('[useAprovarProposta] Cobertura total ativada - instalação já concluída');
      }
    } catch (ativacaoError) {
      console.warn('[useAprovarProposta] Erro na ativação automática:', ativacaoError);
    }
  }
  
  // Criar INSTALAÇÃO APENAS se:
  // - NÃO existir instalação concluída para este contrato
  // - NÃO existir instalação ativa para este veículo (evita duplicatas)
  if (!jaTemInstalacaoConcluida && !jaTemInstalacaoAtiva) {
    // ... código existente de criação de instalação ...
  }
}
```

---

## Validação Pós-Correção

1. Corrigir o veículo afetado manualmente:
```sql
UPDATE veiculos 
SET cobertura_total = true, status = 'ativo'
WHERE id = 'a15a1745-bc59-4f18-9f0e-53ecdf966c9c';
```

2. Testar cenário:
   - Aprovar proposta ANTES da instalação → `cobertura_total = false`
   - Aprovar proposta DEPOIS da instalação → `cobertura_total = true`

---

## Resumo

| Problema | Solução |
|----------|---------|
| `cobertura_total` sempre `false` na aprovação | Verificar `jaTemInstalacaoConcluida` e setar dinamicamente |
| Rastreador não ativado na plataforma | Chamar ativação quando instalação já concluída |
| Acesso do associado não criado | Chamar `ativar-associado` quando apropriado |

