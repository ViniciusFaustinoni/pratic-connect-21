## Diagnóstico

Confirmei no banco que **COT-…-742 (Alan, Chevrolet Prisma, FIPE R$48k)** e **COT-…-877 (Fiesta, FIPE R$30k)** estão no estado idêntico ao caso anterior:

| Campo | Valor |
|---|---|
| `status_contratacao` | `pagamento_ok` |
| `tipo_vistoria` | `null` |
| `vistoria_concluida_em` | `null` |
| `instalacoes` / `agendamentos_base` / `servicos` / `vistorias` | **0 registros** |

Ou seja: o cliente pagou, e por estar acima do mínimo FIPE a autovistoria é opcional — mas a tela não exibe o seletor "Autovistoria × Técnico × Base", mostra o loader "Verificando status…" (caso 877) ou um card de "Vistoria concluída" em readOnly (relato anterior).

### Por que voltou a acontecer mesmo após a fix anterior

As três redes que adicionei no último ciclo (`etapaDoStatus → 4`, `useEffect emLimboEtapa5`, render de etapa 5 com `<EtapaVistoria>`) **dependem de `etapaAtual` ou do branch render correto**. Ainda existem combinações onde:

1. `cotacao.tipo_vistoria === 'autovistoria'` é false (OK), mas o cliente está em **etapa 4** com `readOnly` calculado por outra rota; ou
2. O componente já montou em etapa 5 com `vistoria_concluida_em` setado por trigger lateral, caindo no `Card "VISTORIA CONCLUÍDA"` da linha 1077; ou
3. Hot-reload/cache do bundle antigo no celular do cliente faz a fix anterior não rodar.

Resumo: **a fix anterior corrige o estado, mas o render ainda tem múltiplos caminhos onde "limbo pós-pagamento" pode escapar**. Precisa de um curto-circuito antes de qualquer outra branch decidir.

---

## Plano de correção (raiz)

### 1. Curto-circuito único no topo da Etapa 4 e Etapa 5 (`src/pages/public/CotacaoContratacao.tsx`)

Centralizar um único guard `emLimboPosPagamento`:

```text
emLimboPosPagamento =
  !isTrocaTitularidade
  && status_contratacao === 'pagamento_ok'
  && !tipo_vistoria
  && !vistoria_concluida_em
  && !hasInstalacaoAgendada
  && !hasAgendamentoBase
  && !agendamentoConcluido
```

Quando `emLimboPosPagamento === true`, **forçar render de `<EtapaVistoria readOnly={false}>` no TOPO** do bloco de etapa 4 e do bloco de etapa 5 (early return dentro do JSX condicional, antes de qualquer outro branch — inclusive antes do branch `vistoria_concluida_em` e antes do branch `tipo_vistoria === 'autovistoria'`). Isso elimina qualquer ordem de avaliação que ainda mostre loader/readOnly.

### 2. Reforço em `etapaDoStatus` e `useEffect` de sincronização

- Adicionar `!cotacao?.vistoria_concluida_em` ao guard `emLimboEtapa5` do `useEffect` (atual só checa `tipo_vistoria` e agendamentos).
- Em `etapaDoStatus`, quando `emLimboPosPagamento` for true, sempre retornar 4 (já é, mas adicionar o mesmo termo `!vistoria_concluida_em` no condicional para alinhar).

### 3. Telemetria para identificar lotes futuros

Adicionar `console.warn` + `track` quando o componente detectar `emLimboPosPagamento`:

```text
[CotacaoContratacao] LIMBO_POS_PAGAMENTO detectado
  cotacao_id=… numero=… valor_fipe=… etapaAtual=… navegacaoManual=…
```

Permite filtrar nos logs do navegador / Sentry quando o usuário reportar "mesma coisa aconteceu".

### 4. Destravar as 2 cotações afetadas

**Nenhuma migração é necessária** — os registros estão consistentes. Após o deploy da fix, basta o cliente recarregar a página (Ctrl+Shift+R / fechar e reabrir o link) e o seletor de vistoria aparecerá. Os campos de banco não precisam ser alterados.

Se quiser, podemos enviar via WhatsApp/email o mesmo link público para Alan (742) e o cliente do Fiesta (877) com instrução "abra novamente o link e escolha como deseja fazer a vistoria".

### 5. Verificação pós-deploy

- Abrir o link público de COT-…-742 em janela anônima (sem cache) → deve mostrar `EtapaVistoria` com 2/3 cards (Autovistoria, Técnico, Base se aplicável).
- Abrir COT-…-877 idem.
- Conferir console: deve aparecer `LIMBO_POS_PAGAMENTO detectado` no primeiro render (esperado) e desaparecer assim que o cliente escolhe a modalidade.

---

## Arquivos a editar

- `src/pages/public/CotacaoContratacao.tsx` — único arquivo, sem dependências de banco.

## Riscos

- Mínimos. O curto-circuito só ativa em estado bem específico (`pagamento_ok` + sem vistoria + sem agendamento) que hoje já é tratado como "limbo". A diferença é garantir o early-return antes de qualquer branch concorrente.

## Não inclui

- Mudança de schema, edge function ou regra de negócio. O fluxo canônico (pagamento → escolha de vistoria → cadastro → monitoramento) está correto; o problema é puramente de render condicional na UI pública.
