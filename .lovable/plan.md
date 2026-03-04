
# Analise: Atribuicao de Oficinas e Confirmacao de Orcamento

## Requisitos vs. Estado Atual

| Requisito | Status | Implementacao |
|-----------|--------|---------------|
| Modal para selecionar oficina em evento aprovado | Implementado | `EnviarParaOficinaDialog.tsx` |
| Pergunta Pacote Fechado vs Servico Comum | Implementado | Radio buttons no dialog |
| Pacote Fechado abre campo de valor total | Implementado | Campo R$ com alerta visual |
| Servico Comum calcula valor do orcamento do regulador | Implementado | `ConfirmacaoOrcamentoAnalista.tsx` com totais automaticos |
| Analista confirma/corrige valores item a item | Implementado | Botao Editar por item com campo de valor editavel |
| Analista atribui Auto Center por peca | Implementado | Select de Auto Center por peca na tabela de confirmacao |
| Registrar toda alteracao para auditoria | Implementado | `orcamento_reparo_historico` com `dados_anteriores`, `dados_novos`, `motivo`, `usuario_id` em cada mutacao |
| Custo real somente na conclusao | Implementado | `useConsolidarOrcamento` seta `custo_real_total` apenas na consolidacao |

## Conclusao

Todas as funcionalidades descritas ja estao implementadas. Nao ha mudancas necessarias.

Se houver algum comportamento especifico que nao esta funcionando como esperado, descreva o cenario para investigacao.
