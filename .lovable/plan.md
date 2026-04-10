

## Plano: Aba Manutenção — Usar serviços criados pelo coordenador + coluna Plataforma

### Problema
A aba "Manutenção" em Serviços de Campo (`ManutencaoRastreadoresTab`) busca veículos da view `view_rastreadores_posicao` com >= 72h sem comunicação. O correto é mostrar apenas os serviços `tipo = 'vistoria_manutencao'` criados pelo coordenador na tabela `servicos` — mesma fonte da página `VistoriasManutencao`. Além disso, falta a coluna "Plataforma" (já disponível no join `rastreadores.plataforma`).

### Correção (1 arquivo)

**`src/components/monitoramento/manutencao-rastreadores/ManutencaoRastreadoresTab.tsx`** — Reescrever para usar o hook `useVistoriasManutencao` (já existente) em vez de `useManutencaoRastreadores`:

1. Trocar o import de `useManutencaoRastreadores` por `useVistoriasManutencao` e `useVistoriasManutencaoMetricas`
2. Usar a mesma estrutura de tabela da `ManutencaoTabela`, mas adaptada para a aba embutida
3. Adicionar coluna **Plataforma** exibindo `vistoria.rastreador?.plataforma`
4. Remover referências a "veículos sem pontuar" / 72h — o subtítulo passa a ser "Serviços de manutenção solicitados pelo monitoramento"
5. Manter filtros de busca e status, usando os filtros do tipo `ManutencaoFiltros`
6. Manter os modais existentes (agendar, registrar resultado, tratar ausência) via `TratativaDrawer` ou os modais já usados em `VistoriasManutencao`

### Resultado
A aba mostrará apenas manutenções criadas pelo coordenador, com coluna de Plataforma visível.

