
# Correção de Bugs: Sobreposição do Header e Edição de Propostas Finalizadas

## Problemas Identificados

### 1. Menu Superior se Sobrepõe ao Drawer
O header do painel administrativo usa `z-index: 1001` (`z-[1001]`), enquanto o componente Sheet (drawer) usa `z-index: 50` (`z-50`). Isso causa a sobreposição visível na imagem, onde o header cobre o topo do drawer quando ele é aberto.

### 2. Impossibilidade de Editar Dados Após Finalização
O `ContratoDetailDrawer` atualmente apenas **exibe** dados - não possui funcionalidade de edição. Após a proposta ser enviada/assinada, não há como corrigir dados incorretos de cliente ou veículo.

## Solução

### Parte 1: Corrigir Sobreposição do Header

Aumentar o `z-index` do Sheet no arquivo `src/components/ui/sheet.tsx` para garantir que ele fique acima do header quando aberto.

**Arquivo:** `src/components/ui/sheet.tsx`

```text
ANTES:
- SheetOverlay: z-50
- SheetContent: z-50

DEPOIS:
- SheetOverlay: z-[1100]
- SheetContent: z-[1100]
```

### Parte 2: Adicionar Funcionalidade de Edição no Drawer

Implementar modo de edição no `ContratoDetailDrawer` com campos editáveis para:

**Dados do Cliente:**
- Nome
- Telefone
- Email
- CPF

**Dados do Veículo:**
- Marca
- Modelo
- Ano
- Placa
- Cor
- Renavam

**Regras de Negócio:**
- Apenas usuários com permissão (Diretor, Desenvolvedor, Admin) podem editar
- Contratos já ativos ou cancelados podem ter apenas correções cadastrais
- Alterações são registradas no histórico do contrato

## Detalhamento Técnico

### Arquivo 1: `src/components/ui/sheet.tsx`

Alterar o z-index do SheetOverlay e SheetContent:

```typescript
// Linha 22 - SheetOverlay
"fixed inset-0 z-[1100] bg-black/80..."

// Linha 32 - sheetVariants
"fixed z-[1100] gap-4 bg-background p-6..."
```

### Arquivo 2: `src/components/contratos/ContratoDetailDrawer.tsx`

Adicionar:
1. Estado `editMode` para alternar entre visualização e edição
2. Campos de formulário editáveis nas seções Cliente e Veículo
3. Botão "Editar" no header (visível para usuários com permissão)
4. Botões "Salvar" e "Cancelar" no modo de edição
5. Lógica para atualizar dados via `useUpdateContrato`

### Arquivo 3: `src/hooks/useContratos.ts` (se necessário)

Verificar se o hook `useUpdateContrato` suporta todos os campos necessários (já suporta via tipo `ContratoUpdate`).

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ui/sheet.tsx` | Aumentar z-index de 50 para 1100 |
| `src/components/contratos/ContratoDetailDrawer.tsx` | Adicionar modo de edição com formulários inline |

## Resultado Esperado

1. O drawer abrirá **acima** do header, sem sobreposição
2. Usuários autorizados verão um botão "Editar" no drawer
3. Ao clicar em "Editar", os campos de cliente e veículo se tornam editáveis
4. Após salvar, as alterações são persistidas e registradas no histórico
