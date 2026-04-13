

## Plano: Corrigir erro "invalid input syntax for type uuid: undefined"

### Problema
Ao clicar em um template anexo na aba "Documento Completo", a navegação usa `t.id` que pode ser `undefined`, resultando na rota `/documentos/templates/undefined`. Isso causa queries e PATCHs com `id=eq.undefined`, gerando o erro 22P02.

### Correções

**1. `src/hooks/useDocumentoTemplates.ts` (~linha 130)**
- Adicionar validação de UUID no `useDocumentoTemplate`: se `id` não for um UUID válido, tratar como `undefined` (não disparar query)

**2. `src/pages/documentos/TemplateForm.tsx` (~linha 48-50)**
- Validar o `id` do `useParams()` — se não for UUID válido, redirecionar para `/documentos/templates`

**3. `src/components/documentos/TemplateEditor.tsx` (~linha 530)**
- Guard no onClick: só navegar se `t.id` existir

### Escopo
- 3 arquivos modificados, sem redeploy
