

# Mostrar todas as cidades do Brasil agrupadas por estado no modal de Prestador

## Resumo

Substituir a query atual (que busca apenas municípios tipo "prestador" da tabela `municipios_atendimento`) por uma chamada à API pública do IBGE para listar todas as cidades do Brasil, agrupadas por estado, com busca/filtro e seleção por estado inteiro.

## Arquivo

| Arquivo | Acao |
|---------|------|
| `src/components/monitoramento/NovoPrestadorInstalacaoModal.tsx` | **Editar** |

## Detalhes

1. **Buscar cidades do IBGE**: Substituir a query ao Supabase por um fetch à API `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome` (cachear com `staleTime` longo). Agrupar o resultado por UF.

2. **Campo de busca**: Adicionar um `Input` de filtro acima da lista para buscar cidades por nome.

3. **Agrupamento por estado**: Renderizar as cidades em seções colapsáveis por UF (ex: "RJ", "SP"), com um checkbox "Selecionar todos" por estado. Cada estado aparece como um accordion/collapsible com suas cidades dentro.

4. **Badges dos selecionados**: Manter o comportamento atual de exibir badges clicáveis para remover municípios selecionados.

5. **Armazenamento**: Continuar salvando como `municipios_atuacao: string[]` no formato `"Nome da Cidade - UF"`.

6. **UX**: Aumentar a altura do ScrollArea para `h-60` dado o volume de dados. Expandir o modal para `sm:max-w-lg`.

