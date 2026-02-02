
# Plano: Reformular Ativações para Layout de Tabela com Ícones de Progresso

## Objetivo

Transformar a visualização de ativações de cards (grid) para uma tabela com linhas, incluindo 4 ícones de progresso com tooltips explicativos.

## Design Proposto

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ Cliente              │ Veículo           │ Vendedor    │ Progresso           │ Ações    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Marcus Vinicius      │ Toyota Corolla    │ João Silva  │ ✍️  💳  🔍  📡       │ [Ativar] │
│ 21992593830          │ LTB4J74           │             │ 🟢  🟡  🟢  🟡       │ [...]    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Ana Costa            │ Honda Civic       │ Maria       │ ✍️  💳  🔍  📡       │ [Ativar] │
│ 21999888777          │ ABC1D23           │             │ 🟢  🟢  🟢  🟢       │          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Ícones de Progresso

| Ícone | Campo | Descrição | Condição para Verde |
|-------|-------|-----------|---------------------|
| `FileSignature` | Assinatura | Proposta assinada pelo cliente | `contrato.data_assinatura != null` |
| `CreditCard` | Pagamento | Adesão paga | `contrato.adesao_paga === true` |
| `ClipboardCheck` | Vistoria | Vistoria realizada | Status `em_analise` ou `aprovada` |
| `Radio` | SGA | Sincronizado com SGA Hinova | `veiculo.sincronizado_hinova === true` |

## Cores

- **Amarelo** (`text-amber-500`): Pendente
- **Verde** (`text-emerald-500`): Concluído

## Arquivos a Modificar

### 1. `src/hooks/useAtivacoes.ts`

**Alterações:**
- Adicionar campo `adesao_paga` à interface `AtivacaoContrato`
- Buscar `adesao_paga` na query de contratos
- Incluir no mapeamento de resultado

```typescript
// Interface - adicionar linha 18
adesao_paga: boolean;

// No mapeamento (linha ~157)
adesao_paga: contrato.adesao_paga ?? false,
```

### 2. `src/components/ativacao/AtivacaoProgressIcons.tsx` (NOVO)

Criar componente reutilizável para os 4 ícones de progresso:

```typescript
interface ProgressIconsProps {
  assinaturaOk: boolean;
  pagamentoOk: boolean;
  vistoriaOk: boolean;
  sgaOk: boolean;
}

// Cada ícone com Tooltip que aparece ao passar o mouse
// Exemplo: "Assinatura pendente" ou "Assinatura realizada em 31/01/2026"
```

**Ícones do Lucide:**
- `FileSignature` para Assinatura
- `CreditCard` para Pagamento
- `ClipboardCheck` para Vistoria
- `Radio` para SGA

### 3. `src/components/ativacao/AtivacaoTableRow.tsx` (NOVO)

Criar componente para cada linha da tabela:

- Coluna Cliente: Nome + Telefone
- Coluna Veículo: Marca/Modelo + Placa
- Coluna Vendedor: Nome do vendedor
- Coluna Progresso: Componente `AtivacaoProgressIcons`
- Coluna Ações: Badge de status + Botões (Ativar, SGA, Excluir)

### 4. `src/pages/vendas/AtivacoesList.tsx`

**Alterações:**
- Substituir grid de cards por tabela
- Usar componentes `Table`, `TableHeader`, `TableBody`, etc.
- Renderizar `AtivacaoTableRow` para cada item
- Manter header com métricas e filtros
- Manter responsividade (em mobile, pode usar scroll horizontal)

```typescript
// Substituir linhas 236-249
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Cliente</TableHead>
      <TableHead>Veículo</TableHead>
      <TableHead>Vendedor</TableHead>
      <TableHead className="text-center">Progresso</TableHead>
      <TableHead>Ações</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {filteredItems.map((contrato) => (
      <AtivacaoTableRow key={contrato.id} contrato={contrato} ... />
    ))}
  </TableBody>
</Table>
```

### 5. `src/App.tsx`

**Alteração:**
- Adicionar `TooltipProvider` no root da aplicação (se não existir)

## Tooltips Explicativos

| Ícone | Pendente (Amarelo) | Concluído (Verde) |
|-------|-------------------|-------------------|
| Assinatura | "Assinatura pendente" | "Assinado em DD/MM/YYYY" |
| Pagamento | "Pagamento de adesão pendente" | "Adesão paga" |
| Vistoria | "Vistoria não realizada" | "Vistoria em análise" ou "Vistoria aprovada" |
| SGA | "Aguardando envio ao SGA" | "Sincronizado - Código #XXXX" |

## Estrutura Visual da Linha

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  [Avatar]  Nome Cliente         Toyota Corolla      Vendedor   [✍️][💳][🔍][📡]  [Badge] [Btns] │
│            📞 Telefone          🚗 Placa                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Responsividade

- Desktop: Tabela completa
- Mobile: Scroll horizontal ou layout empilhado

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAtivacoes.ts` | Modificar - adicionar `adesao_paga` |
| `src/components/ativacao/AtivacaoProgressIcons.tsx` | Criar - ícones com tooltips |
| `src/components/ativacao/AtivacaoTableRow.tsx` | Criar - linha da tabela |
| `src/pages/vendas/AtivacoesList.tsx` | Modificar - substituir grid por tabela |
| `src/App.tsx` | Verificar/adicionar `TooltipProvider` |
