## Problema

`TrocaTitularidadeDialog` entra em loop eterno mostrando "Buscando veículos no SGA…" / "Importando dados do SGA…" quando o SGA retorna veículos mas o import automático **não consegue criar um espelho local com placa que case** com as placas vindas do SGA (diferença de formatação, falha silenciosa do edge, ou veículo já pertencente a outro associado).

Sequência atual:
1. `useBuscaSGA` retorna `veiculos[]` para o CPF antigo.
2. Query local por placa não acha espelho → `veiculos.length === 0`.
3. `useEffect` chama `importar-associado-sga`.
4. `refetchLocais()` ainda não acha espelho com placa correspondente.
5. Como a única trava é `!importando` (e ela cai para `false` no `finally`), o efeito **re-dispara** o import → loop.

## Correção

Arquivo: `src/components/associados/TrocaTitularidadeDialog.tsx`

1. **Guarda de tentativa única por CPF** — substituir o gate `!importando` por um `useRef<Set<string>>` que registra os CPFs já tentados nesta sessão do diálogo. Reset no `onOpenChange(false)`.
2. **Tratamento determinístico do pós-import**: depois do `await refetchLocais()`, se ainda não houver espelho casando, **não tentar de novo** — manter o estado `semEspelhoLocal` que já existe e exibir o `Alert` com mensagem clara ("Veículos do SGA não puderam ser espelhados localmente. Acione o suporte ou tente novamente.") + botão "Tentar novamente" que limpa o `Set` e re-dispara manualmente.
3. **Normalizar placa** na comparação: `placa.replace(/[^A-Z0-9]/gi,'').toUpperCase()` tanto no `placas` enviado para `.in('placa', ...)` quanto no `find` da linha 88, para eliminar falso-negativo por hífen/maiúscula.
4. **Limitar dependências do useEffect** removendo `importando` e `veiculos.length` do array — o gate passa a ser o ref, evitando re-execuções espúrias quando o React reidrata derivados.
5. **Timeout visual**: se `carregando` ficar `true` por > 20s, exibir botão "Cancelar busca" que fecha o spinner e mostra o `SgaTransientAlert` para retry manual (defensivo contra qualquer outro caso de fetch travado).

## Critérios de aceite

- Abrir Troca de Titularidade para `MARCOS VINICIUS DATIVO MACHADO` não fica em spinner indefinido.
- Quando o SGA tem veículos e o espelho local falha de criar, o usuário vê mensagem de erro com botão "Tentar novamente" (sem loop de chamadas no Network).
- Após corrigir o espelho (ex.: placa ajustada), reabrir o diálogo lista os veículos normalmente.
- Nenhuma chamada a `importar-associado-sga` é feita mais de 1× por abertura do diálogo, salvo clique manual em "Tentar novamente".

## Fora de escopo

- Refatorar `importar-associado-sga` (edge function) ou a busca SGA em si.
- Mudar o fluxo de aprovação Cadastro/Monitoramento da troca.
