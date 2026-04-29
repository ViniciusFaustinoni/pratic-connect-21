
# Envio ao SGA sempre como pendente + atualização final para ativo

## Regra de negócio

1. Toda vez que um associado/veículo for enviado ao SGA pela primeira vez, deve ir como **pendente** — independente do plano ter Roubo/Furto, Auto-Vistoria ou ser apenas Assistência.
2. Somente na **ativação completa** (última aprovação, depois de instalação + monitoramento + vistoria OK) o sistema deve **reenviar/atualizar** o registro no SGA mudando a situação de pendente → ativo.
3. Se o associado/veículo ainda não tiver sido enviado nenhuma vez, a ativação completa cadastra direto. Mas mesmo o cadastro inicial dispara como pendente; quem promove para ativo é a etapa final.

Hoje o sistema já envia como pendente quando o veículo precisa de rastreador, mas envia direto como **ativo** quando o plano não tem Roubo/Furto, ou quando a vistoria sem rastreador conclui antes. Isso quebra a regra acima.

## Mudanças

### 1) `supabase/functions/aprovar-proposta/index.ts`
- Forçar `statusSgaDestino = 'pendente'` em todos os caminhos do primeiro envio.
- Remover o ramo que define `'ativo'` quando não há rastreador / quando já tem instalação concluída.
- Manter o restante do fluxo (ativação local de associado/contrato/veículo via `ativar-associado`) inalterado: a ativação interna continua acontecendo, mas o envio ao SGA dessa etapa entra como pendente.
- Após a ativação atômica concluída com sucesso, **disparar um segundo job SGA** com `status_sga_destino: 'ativo'` para promover o veículo no Hinova (será ignorado se ainda não estiver sincronizado e a etapa final cuidará dele).

### 2) `supabase/functions/concluir-instalacao-prestador/index.ts`
- Hoje envia `'ativo'` quando `cobertura_total === true`. Trocar por sempre `'pendente'` neste ponto. A promoção para `'ativo'` só ocorre na etapa final de ativação (item 3).

### 3) Etapa de "ativação completa" — promover para ativo
A "última aprovação" no fluxo é o ponto onde associado/contrato/veículo viram `ativo` via edge `ativar-associado`. Vou adicionar, logo após o `ativar-associado` retornar sucesso (em `aprovar-proposta` quando `!deveAguardarInstalacao`, e também ao final do fluxo de instalação/vistoria que dispara a ativação), o disparo de `sga-hinova-sync` com:
```
status_sga_destino: 'ativo'
etapa_origem: 'ativacao-completa'
motivo_decisao: 'Ativação completa do associado — promover veículo para ativo no SGA.'
```

### 4) `supabase/functions/sga-hinova-sync/index.ts` — suportar promoção pendente → ativo
Hoje o guard de idempotência (linhas 281-288) faz:
```
if (!force_resync_media && já sincronizado && (statusDestino !== 'ativo' || status_sga === 'ativado_sga'))
  → skip
```
Isto já permite re-executar quando `statusDestino === 'ativo'` e `status_sga !== 'ativado_sga'`. **Mas** o restante do fluxo, ao reencontrar o veículo já cadastrado no Hinova (`codigoVeiculoHinova` veio do `buscarVeiculoPorPlaca`), pula o `cadastrarVeiculoHinova` e nunca chama nada que altere a `codigo_situacao` do veículo no SGA. Resultado: a coluna `status_sga` local vira `ativado_sga`, mas no Hinova a situação continua pendente.

Correção:
- Adicionar no client `_shared/hinova-client.ts` uma função `atualizarSituacaoVeiculoHinova(session, codigo_veiculo, codigo_situacao)` apontando para o endpoint Hinova de alteração de situação do veículo (a definir junto à doc Hinova já em uso — provavelmente `/veiculo/alterar` ou `/veiculo/atualizar-situacao`).
- Em `sga-hinova-sync`, depois de obter `codigoVeiculoHinova` (seja por reuso ou cadastro), se `statusDestino === 'ativo'` e o veículo já existia no Hinova, chamar a nova função para promover a situação. Logar `promover_situacao_veiculo`.
- Manter o `update` local de `status_sga` apenas após confirmar promoção bem sucedida.

> Observação: se o endpoint exato de atualização não estiver disponível no client atual, a etapa de implementação consulta a doc Hinova já mapeada no projeto antes de criar a função. Caso a Hinova não exponha alteração isolada de situação, a alternativa é re-`cadastrar_veiculo` reutilizando `codigo_veiculo` (idempotente do lado deles).

### 5) `motivoDecisaoSga` — atualizar mensagens
Refletir nas mensagens:
- "Primeiro envio ao SGA — sempre pendente por política."
- "Ativação completa — promovendo veículo para situação ativo no SGA."

## Arquivos afetados

- `supabase/functions/aprovar-proposta/index.ts`
- `supabase/functions/concluir-instalacao-prestador/index.ts`
- `supabase/functions/sga-hinova-sync/index.ts`
- `supabase/functions/_shared/hinova-client.ts` (nova função de atualização de situação)

## Validação

- Caso A — plano só Assistência (sem R/F): aprovar proposta → SGA recebe pendente. Após ativação completa → SGA recebe ativo.
- Caso B — plano com R/F + auto-vistoria sem rastreador: aprovar proposta → pendente. Vistoria aprovada e ativação completa → promove para ativo.
- Caso C — plano com R/F + rastreador: aprovar proposta → pendente. Instalação concluída → continua pendente. Ativação completa final → promove para ativo.
- Caso D — associado já estava ativo no SGA (re-disparo): guard atual mantém skip; sem regressão.

## Memória

Após implementação, atualizar `mem://features/integrations/sga-hinova-sync-and-pre-check-v3` com a nova política: "primeiro envio sempre pendente; promoção para ativo só na ativação completa, via atualização de situação do veículo no Hinova".
