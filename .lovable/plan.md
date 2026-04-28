# Investigação: por que KXD6881 não subiu e KRX9802 subiu

## Diagnóstico definitivo

Consultei `sga_sync_logs` para ambas as placas.

### KRX9802 (Thaís) — SUBIU
- Marca/modelo: Ford Ka SE B 2017/2018
- `codigo_fipe = 003412-6`, `valor_fipe = 40855`
- Hinova aceitou de primeira → `codigo_associado=30137`, `codigo_veiculo=35861`, fotos enviadas, `sincronizado_hinova=true`.

### KXD6881 (Eduardo) — NÃO SUBIU
- Marca/modelo: Citroën C3 Attraction 2014/2014
- `codigo_fipe = 011145-7`, `valor_fipe = 39600`
- Associado já foi criado com sucesso em 18/04 (`codigo_associado=30000`).
- O cadastro do **veículo** falha sistematicamente. As últimas ~6 tentativas (cron de retry a cada 20 min) retornam:

```
HTTP 406 — Não aceitável
"O ano 2014 não foi encontrado para o codigo fipe 011145-7"
```

Validei chamando a API FIPE oficial (parallelum):
- Marca Citroën (id 13) → modelos com "Attraction":
  - 7964 — `C3 Attraction 1.6 Flex 16V 5p Aut.` → anos disponíveis: **2018, 2019, 2020, 2021** (sem 2014)
  - 7585 — `C3 Attraction Pure Tech 1.2 Flex 12V Mec`
- Logo, o código FIPE `011145-7` que o vendedor cadastrou **não existe para o ano 2014** na tabela atual da FIPE. Provavelmente o veículo é um C3 anterior (sem o sufixo "Attraction") e o FIPE selecionado está errado, OU o ano correto é outro.

Há também um log isolado de "Acesso não autorizado" em uma das tentativas, mas é transitório (token rotativo). O erro real e persistente é o ano/FIPE.

### Por que o sistema não se autocorrige

Em `supabase/functions/sga-hinova-sync/index.ts` (linhas 1442-1461) existe `resolverFipePorNome` (consulta parallelum por marca/modelo/ano), **mas só é executado quando `veiculo.codigo_fipe` está vazio**. Quando o Hinova devolve 406 com a mensagem de ano não encontrado, nada acontece — o veículo entra em loop eterno de retry com o mesmo payload errado.

## Plano de correção

### 1. Correção imediata para KXD6881 (one-shot)
- Abrir o veículo `2f162355-b89d-462b-92ce-a76f7e979049` no admin.
- Consultar a FIPE correta para "Citroën C3 2014" (provavelmente outro modelo da família C3, não "Attraction") e atualizar `codigo_fipe`, `valor_fipe`, e se necessário `ano_modelo/ano_fabricacao`.
- Disparar reenvio manual.

### 2. Correção definitiva no edge function `sga-hinova-sync`

Adicionar **auto-recuperação de FIPE/ano** quando Hinova rejeitar o cadastro do veículo com erros conhecidos:

a. Logo após o `cadastrar_veiculo` falhar (bloco que começa na linha 1608), antes de cair em `isDuplicate`/erro final, detectar padrões:
   - `"ano X não foi encontrado para o codigo fipe Y"`
   - `"codigo fipe ... não encontrado"`
   - `"valor fipe inválido"`

b. Quando detectado, executar **uma única tentativa de auto-correção**:
   1. Chamar `resolverFipePorNome(tipoFipe, marca, modelo, ano_modelo)` ignorando o `codigo_fipe` atual.
   2. Se a parallelum não tem o ano exato, varrer os anos retornados e escolher o mais próximo do `ano_modelo` (≤ 1 ano de diferença); caso contrário abortar a auto-correção.
   3. Atualizar em `veiculos` os campos `codigo_fipe`, `valor_fipe` e (se ajustado) `ano_modelo` com log de auditoria (`logSync` action `auto_correcao_fipe`).
   4. Refazer o `POST /veiculo/cadastrar` uma única vez com o payload corrigido.

c. Se a auto-correção falhar (FIPE não resolvida ou Hinova continua rejeitando), marcar `status_sga = 'requer_revisao_manual'` (novo estado) com `error_message` claro e **interromper o cron de retry** para esse veículo, evitando ruído nos logs e gasto de tokens Hinova. Hoje fica em loop indefinido.

### 3. Ajuste no cron de retry
- No retry automático (a cada ~20 min), pular veículos com `status_sga IN ('requer_revisao_manual')` ou com >5 falhas consecutivas com a mesma `error_message` nos últimos 24h.
- Disparar notificação interna (toast/badge) para a equipe de cadastro/operações revisar o veículo.

### 4. Validação preventiva no cadastro/cotação
- No formulário de cadastro de veículo, ao selecionar marca+modelo+ano, validar contra a FIPE (parallelum) antes de gravar. Se o ano selecionado não existir para o `codigo_fipe`, bloquear submissão com mensagem clara. Isso evita o problema na origem.

### 5. UI de "Veículos com erro SGA"
- Painel administrativo já existente de SGA passa a destacar os veículos com `requer_revisao_manual` em uma aba dedicada, exibindo a `error_message` do último log para ação rápida.

## Arquivos impactados
- `supabase/functions/sga-hinova-sync/index.ts` — auto-correção FIPE + novo status.
- `supabase/functions/sga-hinova-sync-cron` (ou equivalente) — filtro de retry.
- `src/components/cadastro/...` veículo — validação FIPE preventiva.
- Painel SGA (componentes em `src/components/ativacao` / `src/pages/...`) — aba de revisão manual.
- Migração: novo valor `'requer_revisao_manual'` no enum/coluna `status_sga` (se for enum) ou apenas string nova.

## Resultado esperado
- Veículos com FIPE/ano divergente do Hinova são auto-corrigidos quando possível.
- Quando não for possível, ficam isolados em uma fila de revisão manual sem ruído.
- KXD6881 sobe assim que o FIPE correto for atribuído.
