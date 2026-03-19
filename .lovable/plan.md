

# Painel de Imprevistos no Monitoramento

## O que será construído

Uma nova página `/monitoramento/imprevistos` com tabela listando todos os serviços que tiveram imprevisto registrado, com filtros por motivo, data e instalador, e ações de gestão.

## Arquivos

### 1. Nova página: `src/pages/monitoramento/ImprevistosPainel.tsx`
- Tabela com colunas: Data/Hora, Associado, Instalador, Motivo, Status (pendente/concluído), Duplo Check, Reagendamento enviado
- Filtros:
  - **Motivo**: Select com os 5 motivos do `MOTIVOS_IMPREVISTO` (Associado ausente, Endereço incorreto, etc.)
  - **Data**: DatePickerWithRange para filtrar por período de `imprevisto_registrado_em`
  - **Instalador**: Select alimentado pela lista de profissionais
- Badges coloridos para status (`imprevisto_pendente` vs `nao_compareceu`)
- Indicadores visuais de duplo check e envio de reagendamento
- Query na tabela `servicos` filtrando `imprevisto_registrado_em IS NOT NULL`, com join em `associados` e `profissionais`

### 2. Hook: `src/hooks/useImprevistos.ts`
- Query Supabase: `servicos` where `imprevisto_registrado_em` is not null
- Select: campos de imprevisto + associado nome/telefone + profissional nome
- Filtros aplicados via `.ilike`, `.eq`, `.gte/.lte` conforme parâmetros

### 3. Rota em `src/App.tsx`
- Adicionar `<Route path="/monitoramento/imprevistos" element={<ImprevistosPainel />} />`

### 4. Menu em `src/components/layout/AppSidebar.tsx`
- Adicionar item "Imprevistos" com ícone `AlertTriangle` no grupo Monitoramento

### 5. Breadcrumb em `src/components/layout/GlobalBreadcrumb.tsx`
- Adicionar entrada `/monitoramento/imprevistos: { label: 'Imprevistos' }`

Nenhuma alteração de banco necessária -- todos os campos já existem na tabela `servicos`.

