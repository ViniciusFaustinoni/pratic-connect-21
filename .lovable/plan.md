# Diagnóstico: etapas puladas em cotações sub-FIPE

Investigação confirmada por código (file:line) **e** dados reais do banco (últimos 14 dias). Sem suposições — todos os pontos abaixo têm rastro concreto.

---

## Resumo executivo

Existem **5 pontos de ruptura** que, combinados, deixam cotações sub-FIPE avançarem sem ter cumprido o caminho canônico. Todos os casos reais que encontrei envolvem `cenario_adesao = isenta_rota` (adesão zerada), o que explica a correlação que você sentiu entre "sub-FIPE" e "cenário de adesão" — a isenção dispara automação extra que descobre os buracos do gate.

**Evidências no banco (últimas 2 semanas, autovistoria + isenta_rota):**

| Cotação | n_fotos | Vídeo | Status atingido | Esperado canônico |
|---|---|---|---|---|
| `0e685fc0` | **3** | sim | **ativo** | bloqueado em autovistoria (faltam ~28 fotos) |
| `b8704b27` | **0** | **não** | aguardando_aprovacao_cadastro | bloqueado no link público |
| `534dd759` | **1** | sim | aguardando_aprovacao_cadastro | bloqueado em autovistoria |
| `d3126a85` | 3 | sim | pagamento_ok + vistoria_concluida_em setado | bloqueado em autovistoria |
| `c735c5e6` | 3 | sim | pagamento_ok + vistoria_concluida_em setado | bloqueado em autovistoria |

Ou seja: o sistema **está aprovando vistorias com 0, 1 ou 3 fotos** em veículos que exigem 31 (carro) / 15 (moto) + vídeo.

---

## Os 5 conflitos confirmados

### Conflito A — Gate de completude sub-FIPE bypassável por idempotência
**`supabase/functions/finalizar-autovistoria-cotacao/index.ts:188`**

O gate `checarCompletudeAutovistoriaSubFipe` só roda quando `!vistoriaExistente`. Em qualquer segunda chamada da edge (idempotência), o gate é pulado — explica os casos com 1 ou 3 fotos materializadas.

### Conflito B — `gateCaminhoPublicoCompleto` aceita autovistoria enxuta em sub-FIPE
**`supabase/functions/aprovar-proposta/index.ts:412-417`**

O gate aceita `≥2 fotos + vídeo 360°` como suficiente para **qualquer** veículo. Sub-FIPE deveria exigir o roteiro completo (31/15). É o caminho pelo qual `0e685fc0` (3 fotos) virou `ativo`.

### Conflito C — Branch sub-FIPE em `aprovar-proposta` não bloqueia ausência de vistoria materializada
**`supabase/functions/aprovar-proposta/index.ts:977-1068`**

Se `vistAuto` vier `null`, o branch sub-FIPE silencia (sem `else`/guard). `cadastro_aprovado` pode virar `true` sem vistoria — exatamente o que aconteceu com `b8704b27` (0 fotos, sem vídeo, chegou ao Cadastro).

### Conflito D — `cenario_adesao isenta_*` automatiza pagamento e dispara `criar-instalacao-pos-pagamento` antes da autovistoria estar completa
**`src/components/cotacao-publica/EtapaPagamentoCotacao.tsx:357-372`** + **`supabase/functions/criar-instalacao-pos-pagamento/index.ts:445-458`**

Quando `valor_adesao=0`, o frontend chama `confirmar-adesao-zerada` automaticamente → seta `status_contratacao='pagamento_ok'`. Para sub-FIPE + autovistoria sem data agendada, `criar-instalacao-pos-pagamento` **silencia sem criar instalação** (correto pela memória `sub-fipe-sem-instalacao`), mas deixa a cotação num estado em que `etapaDoStatus` confunde o próximo passo. É por isso que o problema "acende" no cenário de adesão zerada.

### Conflito E — `getEtapaVenda` desconhece sub-FIPE
**`src/lib/cotacaoEtapa.ts:214-219`**

Sem branch para sub-FIPE: após `autovistoria_ok` com `adesao_paga=true`, retorna `aguardando_vistoria` → mapeia para `aguardando_agendamento_instalacao`. Mas sub-FIPE **nunca** tem instalação — o operador vê um label semanticamente errado, o que mascara o problema.

---

## Pontos verificados que **não** são bug

- Trigger `fn_materializar_autovistoria_cotacao` materializa vistoria com `status='pendente'` (correto — não bypassa nenhum gate por si só).
- `deveAguardarInstalacao` (linha 1514 do `aprovar-proposta`) está logicamente correto por sorte do operador booleano — não mexer.
- `criar-instalacao-pos-pagamento` está certo em **não** criar instalação para sub-FIPE (regra canônica).

---

## Opções de correção — preciso da sua decisão por conflito

Não vou implementar nada antes de você escolher. Para cada conflito, listo as opções com trade-offs.

### Conflito A — fechar o bypass de idempotência

- **A1 (mínimo invasivo, recomendado):** Mover o `checarCompletudeAutovistoriaSubFipe` para **antes** do branch de idempotência, e bloquear se a vistoria existente ainda estiver `status='pendente'` e incompleta.
- **A2:** Devolver na resposta idempotente a contagem de fotos faltantes, e deixar o front travar avanço. (Mais frágil — depende do cliente.)
- **A3 (estrutural):** Nova coluna `vistorias.autovistoria_completa boolean` setada só quando o gate passa. Todos os consumidores passam a ler essa flag. (Mais robusto, mais migração.)

### Conflito B — `gateCaminhoPublicoCompleto` separar sub-FIPE de ≥FIPE

- **B1 (recomendado):** Dentro do gate, detectar sub-FIPE via `fn_veiculo_precisa_rastreador` e exigir `checarCompletudeAutovistoriaSubFipe` (mesma função do `_shared`).
- **B2:** Apenas contar fotos contra um mínimo configurável (30 carro / 14 moto) sem reusar a função canônica. (Risco de divergir.)
- **B3:** Dois gates separados (`gateSubFipe` + `gateAcimaFipe`). Mais explícito, mais código.

### Conflito C — guard de ausência de vistoria no branch sub-FIPE de `aprovar-proposta`

- **C1 (recomendado):** `else` explícito que retorna **409 `sem_autovistoria_sub_fipe`** e reverte `cadastro_aprovado` se a vistoria não existir. Padrão já usado em outros edges.
- **C2:** Mover a checagem de existência da vistoria para dentro do `gateCaminhoPublicoCompleto`, antes de qualquer mutação. (Mais cedo no fluxo, evita rollback.)

### Conflito D — adesão zerada não pode avançar status enquanto autovistoria sub-FIPE está incompleta

- **D1 (recomendado):** Em `confirmar-adesao-zerada`, antes de setar `status_contratacao='pagamento_ok'`, verificar se a autovistoria está completa (mesma função canônica). Se incompleta, manter `status_contratacao` no estado anterior e devolver `code: 'autovistoria_pendente'`.
- **D2:** Em `EtapaPagamentoCotacao.tsx`, só disparar `confirmarAdesaoIsenta` quando a etapa de autovistoria já tiver sido concluída pela máquina de estados pública. (Frontend-only, mas não cobre chamadas diretas à edge.)
- **D3:** Combinar D1 + D2 (defesa em camadas — padrão que você adota em outros pontos do sistema).

### Conflito E — `getEtapaVenda` reconhecer sub-FIPE

- **E1 (recomendado):** Adicionar parâmetro `isSubFipe` e retornar `aguardando_aprovacao_cadastro` após `autovistoria_ok` em sub-FIPE (em vez de `aguardando_vistoria`). Toca só apresentação no Kanban.
- **E2:** Usar `status_contratacao='aguardando_aprovacao_cadastro'` como sinal canônico no lugar de `autovistoria_ok` para sub-FIPE. Mais limpo, mas mexe na máquina de estados em vários pontos.

---

## Saneamento histórico (separado da correção)

Independente das opções escolhidas, temos **pelo menos 5 cotações** com vistorias incompletas que avançaram. Sugiro um item adicional:

- **S1:** Script de auditoria listando todas as cotações com `tipo_vistoria='autovistoria'` + `cenario_adesao` zerado + `n_fotos < mínimo` + `status_contratacao` ≥ `pagamento_ok` para você decidir caso a caso (cancelar, reabrir, ou aprovar manualmente).

---

## O que eu preciso de você

Para cada conflito (A, B, C, D, E), me diga qual opção implementar (ou se quer combinar). E me diga se faço o **S1** (saneamento de auditoria) junto.

Recomendação minha, se quiser ir no mais seguro: **A1 + B1 + C1 + D3 + E1 + S1**. Pode responder só com "vai na recomendação" que eu sigo.
