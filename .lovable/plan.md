

# Plano: Relatório por Plano no Modal de Exportação

## Resumo

Adicionar aba "Por plano" ao modal existente `ExportarRelatorioVendaExternaModal`, com filtros próprios, geração de PDF e CSV agrupando comissões por plano e nível de beneficiário.

## Arquivo a modificar

| Arquivo | Alteração |
|---|---|
| `src/components/financeiro/ExportarRelatorioVendaExternaModal.tsx` | Adicionar abas, nova lógica de relatório por plano, exportação CSV |

## Detalhamento

### 1. Abas no modal

Usar `Tabs` do Radix com duas abas:
- `"beneficiario"` — conteúdo atual (filtros + botão existente), sem alteração
- `"plano"` — novo conteúdo descrito abaixo

O `DialogContent` passa de `max-w-md` para `max-w-lg` para acomodar.

### 2. Filtros da aba "Por plano"

- **Período**: data início e data fim (mesmo padrão do existente)
- **Plano**: Select buscando `planos` ativos (`supabase.from('planos').select('id, nome').eq('ativo', true).order('nome')`), com opção "Todos os planos" como padrão
- **Status**: Select com "Todos" / "Pendente" (`a_pagar`) / "Pago" (`pago`)

### 3. Query de dados

Ao exportar, executar:

1. Buscar lançamentos do período (tipo `credito`, excluindo `cancelado` se status=Todos) com join para obter `associado_id`
2. Para cada `associado_id` encontrado, buscar `plano_id` dos associados via query separada (`associados.id, plano_id`)
3. Buscar nomes dos planos via query aos `planos`
4. Para cada `vendedor_id`, buscar role via `profiles.user_id → user_roles.role` (mesma lógica já implementada no dashboard)
5. Agrupar: `plano_nome + nível → { qtd, bruto, abatimento, líquido }`

### 4. PDF por plano

Usando jsPDF + autoTable:
- Cabeçalho: "Relatório de Comissões por Plano" + período
- Para cada plano: título com nome + total, seguido de tabela com colunas: Nível, Qtd Comissões, Total Bruto, Total Abatimentos, Total Líquido
- Rodapé com totais gerais (quando "Todos os planos")
- Paginação no rodapé

### 5. CSV por plano

Gerar CSV com separador `;` e BOM, colunas: Plano, Nível, Qtd Comissões, Bruto, Abatimento, Líquido. Uma linha por combinação plano+nível. Linha final de totais.

### 6. Botões de exportação

Na aba "Por plano", dois botões:
- "Exportar PDF" (ícone FileDown)
- "Exportar CSV" (ícone FileSpreadsheet)

Ambos compartilham a mesma lógica de busca de dados, diferindo apenas na geração do arquivo.

