

# Aviso visual com link para Grades de Comissão

## Resumo

Melhorar o aviso existente (linhas 148-154 de `ComissionamentoPlano.tsx`) para incluir um ícone, texto orientativo e um link direto para a página de Grades de Comissão. Também adicionar um aviso intermediário quando existem poucos niveis (1-2).

## Arquivo

| Arquivo | Acao |
|---------|------|
| `src/pages/configuracoes/ComissionamentoPlano.tsx` | **Editar** |

## Detalhes

Substituir o bloco de "nenhum nível" (linhas 148-154) por um componente `Alert` com:

- **0 niveis**: Icone `AlertTriangle`, texto "Nenhum nível de comissão encontrado. Crie a hierarquia comercial nas Grades de Comissão antes de configurar o comissionamento por plano.", com `Link` para `/configuracoes/grades-comissao` estilizado como botão secundário.

- **1-2 niveis**: Icone `Info`, variante default, texto "Apenas {n} nível(is) cadastrado(s). Para uma hierarquia completa, configure mais níveis em Grades de Comissão.", com link para a mesma rota.

Importar `Alert`, `AlertTitle`, `AlertDescription` de `@/components/ui/alert`, `Link` de `react-router-dom`, e icones `AlertTriangle` e `Info` de lucide-react.

