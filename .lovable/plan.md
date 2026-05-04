## Diagnóstico

Você está certo — minha conclusão anterior estava errada. O fluxo atual está ativando veículos novos cedo demais.

**Estado atual no banco (associado JOAO VICTOR — `e6551c17-…`):**

| Placa     | status   | cobertura_total | cobertura_roubo_furto | observação |
|-----------|----------|-----------------|-----------------------|------------|
| KZF2D20   | ativo    | —               | —                     | veículo antigo, ok |
| KZF8992   | ativo    | —               | —                     | veículo antigo, ok |
| RKL6I08   | **ativo** | true           | true                  | **inclusão nova, instalação ainda `agendada` (05/05) — não deveria estar ativo** |

A instalação `3cbd44ea-…` está com `status='agendada'`, `concluida_em=null`. Mesmo assim, o veículo já está `ativo`.

### Causa raiz

`criar-instalacao-pos-pagamento` (linha 794-824), assim que cria a instalação, encadeia `ativar-associado` passando `veiculo_id`. O `ativar-associado` (linha 292-307) executa incondicionalmente:

```ts
.update({ status: 'ativo', updated_at: agora, ...coberturas })
```

Ou seja: o veículo é promovido a `ativo` **na criação** da instalação, não na **conclusão**. O trigger `fn_reativar_cobertura_pos_instalacao` existe mas só roda quando `servicos.status='concluida'` — e mesmo assim só mexe em coberturas, nunca em `veiculos.status`.

### Regra correta (confirmada por você)

Para veículo **novo** (inclusão / adesão):
- Se cliente optou por **Roubo/Furto**: ativar imediatamente após contrato/pagamento (R/F não depende de instalação física).
- Se **NÃO** optou por R/F (só assistência + rastreador via instalação): veículo fica `instalacao_pendente` com coberturas `false` até a instalação concluir. Aí o trigger religa coberturas **e** status.

Associado e contrato seguem `ativo` normalmente (mensalidade roda) — só o veículo novo aguarda.

## Mudanças

### 1. `supabase/functions/ativar-associado/index.ts` (bloco veículo, ~linha 291-307)

Tornar a atualização de `veiculos.status='ativo'` condicional:

- Se `ativar_cobertura_roubo_furto === true` OU `ativar_cobertura_total === true` → ativar status normalmente (cobertura imediata vale).
- Se nenhuma das duas e há `instalacao_id` (ou flag `aguardar_instalacao`) → setar `status='instalacao_pendente'`, manter coberturas em `false`, **não** marcar ativo.
- Demais campos (cobertura_suspensa, motivo) ficam intocados.

### 2. Trigger `fn_reativar_cobertura_pos_instalacao` (migration nova)

Estender para também promover `veiculos.status` para `'ativo'` quando instalação conclui (`servicos.tipo='instalacao'` AND novo status `'concluida'`), independentemente de `cobertura_suspensa`. Mantém comportamento atual de coberturas.

```sql
UPDATE public.veiculos
   SET status = 'ativo',
       cobertura_suspensa = false,
       cobertura_suspensa_motivo = NULL,
       cobertura_suspensa_em = NULL,
       cobertura_total = COALESCE(cobertura_total, false) OR true,  -- religa se estava suspensa
       cobertura_roubo_furto = COALESCE(cobertura_roubo_furto, false) OR true
 WHERE id = NEW.veiculo_id
   AND status <> 'ativo';
```

(Refinar para não forçar coberturas em planos sem R/F — só religar as que já existiam antes da suspensão. Vou verificar `cobertura_suspensa_motivo` para decidir.)

### 3. Correção pontual (RKL6I08)

Migration de correção: voltar `veiculos.status` de `RKL6I08` (id `1b63e620-…`) para `instalacao_pendente`, manter `cobertura_total` e `cobertura_roubo_furto` conforme escolha do cliente na cotação `d60c6dec-…`. Conferir cotação: `cobertura_total` e `cobertura_roubo_furto` no payload — se ambos `true`, o veículo PODE ficar ativo (regra acima); se ambos `false`, voltar a `instalacao_pendente` + coberturas `false`.

> Vou consultar a cotação no momento da execução para decidir.

### 4. Memória

Atualizar `mem://logic/operations/suspensao-cobertura-nao-instalacao-escopo` (ou criar nova) para documentar:

> Veículo NOVO de inclusão sem R/F só vira `ativo` quando a instalação concluir. Trigger `fn_reativar_cobertura_pos_instalacao` é a única fonte que promove `veiculos.status` nesse caminho.

## Não muda

- Busca por nome/CPF/telefone/placa (já corrigida).
- `ativar-associado` continua ativando associado + contrato + cotação normalmente.
- KZF8992 e KZF2D20 (veículos antigos do associado) permanecem `ativo`.

## Verificação pós-deploy

1. Confirmar RKL6I08 = `instalacao_pendente` (ou conforme R/F escolhido).
2. Concluir manualmente um serviço de instalação de teste e ver o trigger promover `status='ativo'`.
3. Criar nova inclusão sem R/F e validar que o veículo fica `instalacao_pendente` no banco até a instalação concluir.
