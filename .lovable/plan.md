

## Plano: Filtrar coberturas globalmente no modal de vincular

### Problema
`VincularCoberturaModal.tsx` (linha 38-39) filtra coberturas vinculadas apenas ao plano atual (`eq('plano_id', planoId)`). Deveria excluir coberturas vinculadas a **qualquer** plano, igual já foi feito no `VincularBeneficioModal.tsx`.

### Alteração

**`src/components/diretoria/VincularCoberturaModal.tsx` (linhas 36-41)**
- Remover `.eq('plano_id', planoId)` da query de coberturas vinculadas
- Buscar todos os `cobertura_id` da tabela `planos_coberturas` (sem filtro de plano)
- Isso garante que apenas coberturas não atribuídas a nenhum plano apareçam no seletor

### Resultado
- Coberturas já vinculadas a qualquer plano não aparecem como opção
- Consistente com o comportamento do modal de benefícios

### Arquivo
- `src/components/diretoria/VincularCoberturaModal.tsx`

