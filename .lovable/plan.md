

## Filtros e Exportar dos Associados não abrem

### Diagnóstico

Em `src/pages/cadastro/Associados.tsx` os botões disparam `setFiltersSheetOpen(true)` / `setExportDialogOpen(true)` corretamente — o estado abre. O problema está nos componentes filhos:

- `AssociadoFilters.tsx` (linha 134): `<Sheet open={open} onOpenChange={onClose}>`
- `ExportAssociadosDialog.tsx`: mesmo padrão `<Dialog open={open} onOpenChange={onClose}>`

O Radix UI chama `onOpenChange(boolean)` em **toda** mudança de estado interno, inclusive ao abrir (`true`). Como `onClose` é `() => void` e ignora o argumento, ele dispara `setFiltersSheetOpen(false)` no mesmo ciclo que abriu — o painel pisca e fecha. Para o usuário parece que o botão "não faz nada".

Esse bug afeta os dois botões pelo mesmo motivo.

### Correção

**A. `src/components/cadastro/AssociadoFilters.tsx`**
- Trocar `onOpenChange={onClose}` por `onOpenChange={(o) => { if (!o) onClose(); }}`.

**B. `src/components/cadastro/ExportAssociadosDialog.tsx`**
- Mesma correção no `Dialog`: `onOpenChange={(o) => { if (!o) onClose(); }}`.

Sem mudar a assinatura `onClose: () => void` (compatível com a página atual e qualquer outro consumidor).

### Validação

Após a correção, vou logar como `admin@teste.com / 123456789`, ir em **Cadastro → Associados** e:
1. Clicar em **Filtros** → confirmar que o Sheet lateral abre, aplicar um filtro de status e validar que a lista responde.
2. Clicar em **Exportar** → confirmar que o Dialog abre e que consigo gerar um XLSX de teste.
3. Capturar screenshots dos dois painéis abertos para anexar como prova.

### Riscos

- Nenhum: a correção é idempotente e não muda contratos de props. Outros lugares do app que usam esses componentes (se houver) continuam funcionando exatamente igual — só pararemos de fechar o painel no instante em que ele abre.

