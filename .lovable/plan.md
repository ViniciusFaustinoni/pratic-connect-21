## Problema

Na cotação **COT-20260428-105230565-852** (HONDA PCX 160, FIPE R$ 21.315, pagamento já efetuado), o link público renderiza o conteúdo correto da etapa de **Vistoria** ("Vistoria do Veículo / Escolha como deseja realizar a vistoria"), mas o **Stepper no topo destaca "4 Pagamento" como etapa ativa** e mostra "Vistoria" como próxima (5). Há dessincronia entre o conteúdo renderizado e o indicador visual de etapa.

## Causa raiz

`src/pages/public/CotacaoContratacao.tsx:841` declara:

```ts
const internalIds = ['plano','documentos','contrato','vistoria','pagamento','instalacao'] as const;
```

Mas o restante do arquivo e o `determinarEtapa` em `src/hooks/useCotacaoContratacao.ts:427` usam a ordem canônica:

```
0 plano · 1 documentos · 2 contrato · 3 pagamento · 4 vistoria · 5 instalacao
```

`pagamento` e `vistoria` estão **trocados** no array `internalIds`. Com `etapaAtual = 4` (vistoria), `internalToVisible(4)` busca `internalIds[4] = 'pagamento'`, encontra o índice visível de "Pagamento" e o destaca como etapa atual — enquanto o `etapaAtual === 4` renderiza o conteúdo de Vistoria mais abaixo. Mesma inversão afeta `visibleToInternal` (clique no Stepper).

`STEPS_BASE` (linha 55) já está na ordem correta (plano, documentos, contrato, pagamento, vistoria), reforçando que o defeito está só no array `internalIds`.

## Correção

Trocar a ordem em `internalIds` para alinhar com a ordem canônica:

```ts
const internalIds = ['plano','documentos','contrato','pagamento','vistoria','instalacao'] as const;
```

E remover o fallback redundante em `internalToVisible` ("vistoria não existe no STEPS visível → pagamento"), que só fazia sentido com a ordem antiga; com a ordem corrigida, `vistoria` está sempre presente em `STEPS_BASE`.

## Fora do escopo

- Nada nos dados da cotação/contrato — o estado é o esperado pós-pagamento.
- Nenhuma mudança em `EtapaVistoria`, regras de autovistoria opcional, `exigeRastreador` ou no fluxo de instalação.
- Nenhuma mudança na função `determinarEtapa` nem em `STEPS_BASE`.

## Validação

1. Abrir o link da cotação como admin → Stepper destaca **"5 Vistoria"** ativo, conteúdo "Vistoria do Veículo" abaixo bate.
2. Clicar em "Pagamento" no Stepper → volta para conteúdo de Pagamento (etapa 3 interna).
3. Conferir uma cotação em etapa anterior (ex.: `documentos_ok`) — etapa "Contrato" continua destacada corretamente.
