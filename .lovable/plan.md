

# Plano: Atalhos rápidos para Agente IA e Landing Page no Dashboard da Diretoria

## Resumo

Adicionar dois novos botões na seção "Ações Rápidas" do `DiretoriaDashboard.tsx`, direcionando para a configuração do Agente IA e para a Landing Page.

## Alteração em `src/pages/diretoria/DiretoriaDashboard.tsx`

Na seção "Ações Rápidas" (linhas 966-1017), adicionar dois botões após os existentes:

1. **Agente Consultor IA** — ícone `Bot`, navega para `/configuracoes/agente-consultor-ia`
2. **Landing Page (Planos)** — ícone `Globe`, navega para `/planos` em nova aba (`window.open`)

Importar `Bot` e `Globe` de `lucide-react`.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/diretoria/DiretoriaDashboard.tsx` | 2 novos botões na seção Ações Rápidas + imports |

