## Problema

Na **Troca de Titularidade** o campo de busca aceita texto, mas ao digitar uma placa (ex.: `qoo5c17`) o resultado correto fica escondido. A busca por placa **já é executada via SGA**, porém em paralelo o `useAssociadoSearch` extrai os dígitos da placa (`517`) e roda `cpf.ilike.%517%` no banco local, retornando 15 associados aleatórios que aparecem **antes** do resultado real da placa no merge.

## Causa raiz

`src/components/vendas/OutrasEntradasMenu.tsx` chama dois hooks em paralelo (`useAssociadoSearch` + `useBuscaPlaca`) sem distinguir o tipo do termo. Quando o termo é uma placa válida, a busca textual local polui o resultado. Além disso, o merge insere `associadoResults` antes de `placaResults`.

## Mudanças (todas em `src/components/vendas/OutrasEntradasMenu.tsx`)

1. **Detectar formato de placa** (regex Mercosul `AAA0A00` e antiga `AAA0000`) no termo digitado.
2. **Quando o termo for uma placa**, desabilitar `useAssociadoSearch` (passar string vazia), evitando falsos positivos por substring de dígitos.
3. **Inverter a ordem do merge** em `mergedAssociadoResults`: inserir primeiro os resultados do SGA por placa, depois os de associados, para que o veículo encontrado apareça no topo da lista.
4. **Atualizar o placeholder e o texto auxiliar** do input para deixar claro que aceita CPF, placa ou nome (já está implícito, mas o usuário não percebe).

## Detalhes técnicos

- Regex: `/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/` aplicada sobre `searchTerm.replace(/[^A-Za-z0-9]/g, '').toUpperCase()`.
- `useBuscaPlaca` continua igual — já só dispara para placas válidas.
- O fluxo de seleção (`handleSelectAssociado` com `origem_sga` → `importar-associado-sga` → abre `TrocaTitularidadeDialog`) não muda; só o que aparece na lista muda.

## Não muda

- Edge functions
- Schema do banco
- Outros tipos de entrada (Substituição, Migração, Inclusão) — já tratados separadamente.
