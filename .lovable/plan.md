
# Corrigir Erro 400 no Agendamento de Vistoria de Evento

## Problema

O agendamento de vistoria de evento retorna **400 Bad Request** porque a Edge Function `agendar-vistoria-evento` exige que `etapa_atual >= 3`, porem o fluxo de etapas (`salvar-etapa-evento`) so vai ate a **etapa 2**:

- Etapa 1: Fotos e videos do veiculo
- Etapa 2: Boletim de Ocorrencia
- Agendamento: e o proximo passo (nao e uma "etapa" salva)

Quando a etapa 2 e concluida, `etapa_atual` fica como **2** e o status muda para **"completado"**. Ao tentar agendar, a validacao `if (link.etapa_atual < 3)` sempre falha.

## Solucao

### Arquivo: `supabase/functions/agendar-vistoria-evento/index.ts`

Alterar a validacao de `etapa_atual < 3` para `etapa_atual < 2`, pois o agendamento so requer que as etapas 1 e 2 estejam concluidas.

```text
// ANTES (linha 98):
if (link.etapa_atual < 3)

// DEPOIS:
if (link.etapa_atual < 2)
```

Tambem atualizar a mensagem de erro para refletir corretamente:

```text
// ANTES:
"As 3 etapas devem ser completadas antes do agendamento"

// DEPOIS:
"As etapas 1 e 2 devem ser completadas antes do agendamento"
```

### Deploy

Redeployar a Edge Function `agendar-vistoria-evento` apos a alteracao.

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/agendar-vistoria-evento/index.ts` | Corrigir validacao de `etapa_atual` de `< 3` para `< 2` |
