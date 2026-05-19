# Corrigir consulta de inadimplência por veículo (Hinova)

## Contexto

A doc oficial confirma um **único** endpoint para a situação financeira do veículo:

```
GET /buscar/situacao-financeira-veiculo/{codigo_ou_placa}
→ 200 { ..., "situacao_financeira": "ADIMPLENTE" | "INADIMPLENTE" }
```

O exemplo oficial usa placa com hífen (`AAA-1111`). O parâmetro aceita código numérico **ou** placa.

Hoje, em `supabase/functions/_shared/hinova-client.ts`, a função `buscarSituacaoFinanceiraVeiculo`:
- Inclui dois caminhos alternativos que **não existem** na API.
- Só consulta por `codigo_veiculo` — sem fallback para placa.
- Trata 404 silenciosamente sem distinguir "veículo não cadastrado" de "permissão do token".

## Mudanças

### 1. `supabase/functions/_shared/hinova-client.ts`
- Manter **apenas** o endpoint canônico `/buscar/situacao-financeira-veiculo/{param}`.
- Mudar assinatura para aceitar `{ codigoVeiculo?, placa? }`. Ordem de tentativa:
  1. `codigo_veiculo` quando truthy (>0).
  2. Placa formatada `AAA-1111` (com hífen, conforme exemplo da doc) quando disponível.
  3. Placa sem hífen como último recurso.
- Em 404 após esgotar as tentativas, retornar `null` e logar `cod`, `placa`, e amostra da resposta (já existe — manter).
- Em 401/403 lançar `HinovaTransientError` com `reason: 'permission'` para sinalizar que o token não tem o endpoint liberado.

### 2. `supabase/functions/sga-listar-boletos-associado/index.ts`
- Passar tanto `codigo_veiculo` quanto `placa` ao chamar `buscarSituacaoFinanceiraVeiculo`.
- Quando o resultado for `null` para todos os veículos do associado **mas existirem placas válidas**, logar warning `[sga-listar-boletos-associado] situacao_financeira indisponivel — verificar permissao do token SGA`.

### 3. Diagnóstico do caso Leonardo
- Após deploy, rodar `verificar-situacao-financeira-cadastro` com `force=true` para o CPF `16007095754` e inspecionar os logs do edge function para confirmar:
  - Se o endpoint retorna `INADIMPLENTE` agora (caso seja problema do parâmetro), **ou**
  - Se persiste 404 — nesse caso a causa é permissão do token e precisamos liberar o endpoint no painel SGA (ação no cliente Hinova, fora do código).

### 4. Documentação
- Atualizar `mem://logic/operations/sga-inadimplencia-veiculo-canonica.md` com:
  - URL canônica e única confirmada na doc.
  - Aceita código OU placa (com hífen).
  - Pré-requisito: endpoint liberado no token SGA.

## Fora de escopo
- Frontend `SituacaoFinanceiraGate.tsx` (já tratado anteriormente).
- Backfill retroativo de contratos antigos.
- Mudanças em `aprovar-proposta`/`aprovar-troca-cadastro`.

## Validação
1. Curl direto do edge function com o CPF do Leonardo e `force=true`.
2. Inspecionar log: deve aparecer `[situacao-financeira] ok ... -> INADIMPLENTE` para pelo menos uma das placas (HHI7F74 / KXW9725).
3. Se vier `null` ainda, abrir ticket de liberação do endpoint no token SGA Hinova.
