

# Análise: Integração Rede Veículos na Conclusão de Instalação

## Resumo da Análise

Após investigar o codebase, identifiquei que **a integração já está implementada** de forma mais robusta do que o PRD sugere.

## Comparação: PRD vs. Implementação Atual

| Aspecto | PRD Sugere | Já Implementado |
|---------|-----------|-----------------|
| Edge Function | `rede-veiculos-ativar` (nova) | `rede-veiculos-vincular-cliente` ✅ |
| Endpoint API | `/preCadastroAgendamento/` | `/vincularClienteVeiculo/` ✅ |
| Dados enviados | CPF + Chassi + Placa + IMEI | Cliente + Veículo + Equipamento + Permissões ✅ |
| Gatilho | Conclusão de instalação | Conclusão de instalação ✅ |
| Tabela de log | `rastreadores_ativacoes` (não existe) | `rastreadores_logs` ✅ |

## O que já funciona

### 1. Hook `useAprovarVeiculoServico` (src/hooks/useServicos.ts)

Linhas 952-961 já chamam a integração Rede Veículos:

```typescript
} else if (rastreadorInfo?.plataforma === 'rede_veiculos') {
  await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
    body: {
      imei: data.imeiRastreador,
      veiculoId: data.veiculoId,
      associadoId: data.associadoId,
    },
  });
  console.log('[useAprovarVeiculoServico] Rastreador vinculado na Rede Veículos com sucesso');
}
```

### 2. Edge Function `rede-veiculos-vincular-cliente`

Faz o fluxo completo:
- Busca dados do associado, veículo e rastreador
- Autentica na API Rede Veículos via `rastreador-auth`
- Chama endpoint `/vincularClienteVeiculo/` com payload completo
- Atualiza IDs da plataforma no banco local
- Chama `/ativarVeiculo/` automaticamente após vinculação
- Registra logs em `rastreadores_logs`

### 3. Tabela de Logs

`rastreadores_logs` já existe com campos:
- `rastreador_id`, `plataforma`, `operacao`, `request`, `response`, `status`, `erro_mensagem`, `created_at`

## Diferença entre Endpoints da API Rede Veículos

| Endpoint | Propósito |
|----------|-----------|
| `/preCadastroAgendamento/` | Pré-cadastro simplificado (sem vincular) |
| `/vincularClienteVeiculo/` | **Cadastro completo** (cliente + veículo + equipamento vinculados) ✅ |

## Recomendação

**Não criar nova Edge Function**. O sistema já está implementado corretamente com uma abordagem mais robusta.

## Ajustes Necessários

Apenas pequenos ajustes para garantir funcionamento correto:

### 1. Garantir que a chamada não está bloqueada pelo if

**Problema identificado**: O código só chama a integração **se** o veículo já tinha `cobertura_roubo_furto` (linha 913):

```typescript
if (veiculoAtual?.cobertura_roubo_furto && !veiculoAtual?.cobertura_total) {
  // ... chama integração Rede Veículos
}
```

Isso significa que se a vistoria não foi aprovada previamente, a integração **não é chamada**.

**Solução**: Sempre tentar chamar a integração quando o rastreador for Rede Veículos, independente do status de cobertura.

### 2. Não bloquear fluxo em caso de erro

Já está implementado com try/catch (linha 962-965).

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useServicos.ts` | Mover chamada da integração para FORA do if de cobertura |

## Código Proposto

```typescript
// Linha ~891 - Após vincular rastreador ao veículo
// SEMPRE tentar ativar na plataforma, independente de cobertura
try {
  const { data: rastreadorInfo } = await supabase
    .from('rastreadores')
    .select('plataforma')
    .eq('imei', data.imeiRastreador)
    .single();

  if (rastreadorInfo?.plataforma === 'rede_veiculos') {
    console.log('[useAprovarVeiculoServico] Ativando rastreador na Rede Veículos...');
    await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
      body: {
        imei: data.imeiRastreador,
        veiculoId: data.veiculoId,
        associadoId: data.associadoId,
      },
    });
    console.log('[useAprovarVeiculoServico] Rastreador vinculado na Rede Veículos com sucesso');
  } else if (rastreadorInfo?.plataforma === 'softruck') {
    // ... código softruck existente ...
  }
} catch (err) {
  console.warn('[useAprovarVeiculoServico] Ativação na plataforma falhou:', err);
  // Não bloquear fluxo
}
```

## Por que NÃO criar Edge Function nova?

1. **Redundância** - Já existe `rede-veiculos-vincular-cliente` funcionando
2. **Endpoint inferior** - `/preCadastroAgendamento/` é mais limitado que `/vincularClienteVeiculo/`
3. **Tabela inexistente** - PRD menciona `rastreadores_ativacoes` que não existe
4. **Manutenção** - Ter duas funções fazendo coisas similares complica manutenção

## Resumo da Implementação

```text
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO ATUAL (CORRETO)                                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Instalador conclui checklist                                │
│  2. handleConcluirInstalacao() é chamado                        │
│  3. aprovarVeiculoMutation.mutateAsync() executa                │
│  4. Verifica se plataforma === 'rede_veiculos'                  │
│  5. Chama rede-veiculos-vincular-cliente                        │ ← JÁ EXISTE
│  6. Edge Function faz cadastro completo na API                  │
│  7. Registra log em rastreadores_logs                           │
│  8. Atualiza rastreador com status 'instalado'                  │
└─────────────────────────────────────────────────────────────────┘
```

## Única Modificação Necessária

Mover a chamada da integração Rede Veículos para **sempre executar** quando o rastreador for dessa plataforma, não apenas quando há cobertura prévia.

Isso garante que:
- ✅ Rastreador é cadastrado na plataforma
- ✅ Logs são registrados
- ✅ IDs da plataforma são salvos localmente
- ✅ Fluxo não é bloqueado em caso de erro

