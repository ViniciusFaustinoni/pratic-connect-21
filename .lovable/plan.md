

# Fix: Variáveis de template com valores errados (data no lugar de minutos)

## Problema Identificado

O template `assistencia_confirmada` espera 3 parâmetros: `{{1}}` nome, `{{2}}` prestador, `{{3}}` minutos. O associado recebeu `2026-03-12` no lugar de `30` (minutos) — uma data crua sendo passada onde deveria ter um número.

Há **2 bugs relacionados** encontrados:

### Bug 1: `notificar-status-assistencia` — template único para todos os status
A função usa `assistencia_confirmada` (que diz "prestador está a caminho") para **todos** os status (aberto, concluido, etc). Além disso, o param `tempo` nunca é populado no `dadosTemplate` (linhas 200-211 não incluem `tempo`), resultando no fallback `'30'`. Se alguma versão anterior ou caller externo passou um campo `tempo` com data, isso explicaria o `2026-03-12`.

### Bug 2: `instalacao_agendada` — data sem formatação
A mensagem armazenada para Marcus mostra "agendada para 2026-03-12" em vez de "12/03/2026" — `dados?.data` é passado cru sem formatação.

## Correções

### 1. `notificar-status-assistencia/index.ts`
- Mapear cada status para o template Meta **correto** em vez de usar `assistencia_confirmada` para tudo
- `prestador_a_caminho` → `assistencia_confirmada` (único uso correto)
- `aberto`, `aguardando_prestador`, `prestador_despachado`, `em_atendimento`, `concluido`, `cancelado_*` → `sinistro_atualizado` (3 params genéricos)
- Adicionar validação: se `tempo` parece uma data ISO, substituir por `'30'`

### 2. `notificar-cliente/index.ts`
- Na mapping `instalacao_agendada` (linha 372): formatar `dados?.data` de `2026-03-12` para `12/03/2026`
- Na mapping `assistencia_prestador_acionado` (linha 380): validar que `previsao` é numérico, senão usar `'30'`

### 3. `disparar-notificacao/index.ts`
- Linha 395: validar que `dados.tempo` é numérico antes de passar como param

### Resumo de alterações
- **3 edge functions** editadas e redeployadas
- **0 migrations SQL**

