

# Plano: Upload de PDF do Orcamento com Extracao Automatica por IA

## Contexto
O regulador recebe um PDF de orcamento (ex: do sistema Cilia) contendo tabelas com pecas (troca, R&I), servicos (funilaria, pintura, reparacao) e valores. Hoje ele precisa digitar tudo manualmente. A proposta e que ele faca upload do PDF e a IA extraia automaticamente os itens.

## Estrutura do PDF (analisado)
O PDF contem:
- **Pecas (Troca/R&I):** tabela com operacao (T, R&I), horas, codigo, titulo da peca, fornecimento, preco, desconto, preco liquido
- **Servicos (Mao de Obra):** reparacao (R) com horas, pintura (P) com horas, por peca
- **Resumo:** totais de pintura, reparacao, servicos, fornecimento oficina/associacao
- **Mao de obra por tipo:** funilaria, vidracaria, tapecaria, eletrica, mecanica, pintura, reparacao com valores e horas

## Solucao

### 1. Nova Edge Function: `extract-orcamento-pdf`
Recebe o PDF via URL do storage, usa Lovable AI (Gemini) com prompt especializado para extrair:
- Array de pecas: `{descricao, quantidade, valor_unitario, valor_total, operacao}`
- Array de servicos/mao de obra: `{descricao, horas, valor_unitario, valor_total, tipo_servico}`
- Resumo geral: `{total_pecas, total_mao_obra, total_geral}`

Usara tool calling (structured output) para garantir JSON valido.

### 2. Novo componente: `ImportarOrcamentoPDFModal`
Modal com:
- Dropzone para upload do PDF (aceita .pdf)
- Upload para bucket `documentos` no storage
- Chama edge function → recebe itens extraidos
- Exibe preview dos itens em tabela editavel (regulador pode revisar/ajustar antes de confirmar)
- Botao "Confirmar e Importar" que chama `useAdicionarItem` em batch para todos os itens

### 3. Integracao no `CardOrcamentoReparo`
Adicionar botao "📄 Importar PDF" ao lado dos botoes "Adicionar Peca" e "Adicionar Servico", visivel quando `canEdit` e orcamento em `elaboracao`.

### 4. Etapas manuais preservadas
O regulador continua informando etapas necessarias manualmente — essa feature so automatiza a importacao de pecas/servicos/valores.

## Arquivos

| Acao | Arquivo |
|------|---------|
| Criar | `supabase/functions/extract-orcamento-pdf/index.ts` |
| Criar | `src/components/orcamento/ImportarOrcamentoPDFModal.tsx` |
| Editar | `src/components/orcamento/CardOrcamentoReparo.tsx` (botao importar) |
| Editar | `supabase/config.toml` (registrar funcao) |

## Fluxo

```text
Regulador abre orcamento (cotacao_separada)
  └── Clica "Importar PDF"
        └── Upload do PDF → storage bucket "documentos"
              └── Chama extract-orcamento-pdf (Lovable AI)
                    └── IA extrai pecas + servicos + valores
                          └── Preview editavel no modal
                                └── Regulador revisa e confirma
                                      └── Batch insert via useAdicionarItem
                                            └── Itens aparecem na tabela normalmente
```

