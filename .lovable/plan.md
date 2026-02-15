

# Corrigir texto do banner e garantir navegacao

## Problema

1. O banner na pagina de Sinistros exibe "aguardando aprovacao via IA" -- deveria exibir **"aguardando analise"**
2. O subtexto diz "precisam ser aprovadas" -- deveria dizer algo como **"precisam ser analisadas"**

A rota `/eventos/solicitacoes-ia` ja existe e funciona corretamente (confirmado via teste). O erro 404 pode ter ocorrido antes da rota ser adicionada no plano anterior. Caso persista, sera investigado apos a publicacao.

## Alteracao

### Arquivo: `src/pages/eventos/SinistrosList.tsx` (linhas 201-206)

Atualizar os textos do banner:

| De | Para |
|----|------|
| `aguardando aprovacao via IA` | `aguardando analise` |
| `Solicitacoes geradas via WhatsApp/App precisam ser aprovadas` | `Solicitacoes geradas via WhatsApp/App precisam ser analisadas` |

### Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/eventos/SinistrosList.tsx` | Trocar textos "aprovacao via IA" por "analise" no banner de pendencias |

