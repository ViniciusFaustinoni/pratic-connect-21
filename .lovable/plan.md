

# Corrigir Fotos do Instalador e Espaços Vazios

## Causa raiz das fotos (0 fotos)

O hook `useInstaladorData` busca `vistorias` onde `instalacao_id = X`. Porém, quando o instalador tira fotos, a vistoria é criada via `useVistoriaCompletaPorServico` com `contrato_id`, `cotacao_id`, `associado_id` e `veiculo_id` — **sem `instalacao_id`**. A vistoria fica vinculada ao serviço via `servicos.vistoria_origem_id`.

**Caminho correto**: `instalacoes.id` → `servicos.instalacao_origem_id` → `servicos.vistoria_origem_id` → `vistorias` → `vistoria_fotos`.

## Causa dos espaços vazios

Cards de Quilometragem, Assinatura, Local de Instalação, e Observações são condicionais mas ocupam espaço mesmo quando alguns dados existem e outros não (grid 2 colunas com um slot vazio).

## Correções

### `src/hooks/useVistoriaCompletaAnalise.ts` — `useInstaladorData`

Mudar a lógica de busca da vistoria do instalador:

1. Buscar `servicos` onde `instalacao_origem_id = instalacaoId` e `tipo = 'instalacao'` (já faz isso para o serviço, mas separadamente)
2. Se o serviço tiver `vistoria_origem_id`, buscar a `vistorias` por esse ID
3. Fallback: buscar `vistorias` onde `instalacao_id = instalacaoId` (caso antigo)
4. Com a vistoria encontrada, buscar `vistoria_fotos`

Simplificar removendo a query separada de serviço (já é buscada para achar a vistoria) e unificando.

### `src/pages/cadastro/VistoriaCompletaAnalise.tsx` — Espaços vazios

- Substituir grid fixo `sm:grid-cols-2` por layout flexível que só renderiza os cards que existem, sem deixar espaço vazio
- Usar `flex flex-wrap gap-4` com cards de tamanho `flex-1 min-w-[250px]` em vez de grid rígido

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/useVistoriaCompletaAnalise.ts` | Corrigir busca da vistoria do instalador via `servicos.vistoria_origem_id` |
| `src/pages/cadastro/VistoriaCompletaAnalise.tsx` | Eliminar espaços vazios no layout dos cards condicionais |

