# Plano — Etapa da Venda errada e opções de Vistoria sumindo

Dois bugs independentes na jornada pública de contratação.

---

## Bug 1 — Badge "Realizando Pagamento" durante a etapa Vistoria

### Causa raiz
`src/lib/cotacaoEtapa.ts` (regra 6, linhas 196-201) decide a etapa apenas pela combinação `contrato.status='assinado' + adesao_paga=false`. No link público, porém, a ordem é:

```
Plano → Documentos → Contrato → Vistoria → Pagamento
```

Logo, durante a Step 4 (Vistoria), o contrato JÁ está assinado mas o pagamento AINDA não foi feito — o que casa com a regra 6 e força o badge "Realizando Pagamento", mesmo que o cliente esteja escolhendo/agendando vistoria.

Caso real: cotação `f68f63d3` (Vinicius) — `contrato.status='assinado'`, `tipo_vistoria='agendada_base'`, `tipo_instalacao='base'`, `agendamentos_base` criado hoje 12:28, `adesao_paga` ainda `false` no momento da captura → badge "Realizando Pagamento" embora a etapa real seja agendamento de vistoria.

### Correção
Reordenar a lógica em `getEtapaVenda` para que, quando contrato esteja assinado e pagamento ainda não confirmado, a etapa de vistoria tenha prioridade sobre "Realizando Pagamento":

1. Se `tipo_vistoria='autovistoria'` e a autovistoria ainda não foi concluída → `realizando_autovistoria`.
2. Se `tipo_vistoria` ∈ {`agendada`, `agendada_base`} → `vistoria_agendada` (com `instalacao_agendada` quando houver instalação concreta).
3. Se já existe `agendamentos_base` ativo para a cotação (mesmo sem `instalacoes` materializada) → `vistoria_agendada`.
4. Se contrato assinado, sem `tipo_vistoria` definido e sem agendamento → `escolha_vistoria`.
5. Só cair em `realizando_pagamento` quando `status_contratacao='vistoria_ok'` / `autovistoria_ok` ou quando o link público tiver passado para a Step 5 explicitamente.

Isso elimina o falso "Realizando Pagamento" e dá visibilidade real do funil.

---

## Bug 2 — Faltando o card "Quero que o técnico venha até mim"

### Causa raiz
`src/components/cotacao-publica/EtapaVistoria.tsx`:
- Linha 175: `{tipoInstalacao !== 'base' && (...)}` esconde "Técnico vem até mim" sempre que a cotação foi marcada como `base`.
- Linha 201: `{tipoInstalacao !== 'rota' && (...)}` esconde "Levar à Base" quando marcada como `rota`.

A cotação do Vinicius tem `tipo_instalacao='base'` (escolha do vendedor no Cotador) → só sobram 2 cards (Autovistoria + Base), faltando o terceiro.

O mesmo gate existe em `EscolhaLocalVistoria.tsx` (linhas 35 e 63) — corrigir nos dois lugares.

### Correção
Sempre renderizar os 3 cards no link público:
1. Autovistoria — Roubo & Furto (já condicionado por elegibilidade do plano, manter).
2. Quero que o técnico venha até mim.
3. Quero levar meu veículo à Base.

`tipo_instalacao` da cotação deixa de ser um filtro restritivo e passa a ser apenas uma sugestão/pré-seleção visual (badge "Sugerido" no card correspondente, sem esconder os outros).

Aplicar a mesma mudança em `EscolhaLocalVistoria.tsx` para manter paridade.

---

## Hotfix de dados (Vinicius / SIO3C68)

A cotação `f68f63d3-f5c2-48c5-9155-f7f035f436ee` está num limbo separado (sem `instalacoes` nem `servicos` mesmo com `agendamentos_base` criado). Esse é o bug do agendamento órfão já identificado na conversa anterior — fora do escopo destes dois bugs, mas precisa do hotfix para o card aparecer em "Serviços de Campo".

Invocar `criar-instalacao-pos-pagamento` com `cotacaoId=f68f63d3…` e `skipPaymentCheck=true`, depois fazer back-link `agendamentos_base.instalacao_id`.

---

## Pergunta antes de implementar

**Bug 2** — confirma que a regra desejada é "sempre 3 opções, sem importar `tipo_instalacao`"? Ou prefere manter a restrição mas adicionar uma opção "trocar tipo de instalação" para o cliente?

## Arquivos afetados
- `src/lib/cotacaoEtapa.ts` (Bug 1).
- `src/components/cotacao-publica/EtapaVistoria.tsx` (Bug 2).
- `src/components/cotacao-publica/EscolhaLocalVistoria.tsx` (Bug 2 — paridade).
- Hotfix Vinicius via edge function `criar-instalacao-pos-pagamento` (operacional, sem código).
