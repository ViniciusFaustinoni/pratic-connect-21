

## Fix: Erro de código duplicado ao criar/editar templates

### Problema
Ao criar ou editar um template, se o campo `codigo` já existe no banco (unique constraint `documento_templates_codigo_key`), o sistema mostra erro genérico "Erro ao criar template" sem explicar que o código está duplicado. O usuário fica sem saber o que corrigir.

### Solução

**1. `src/hooks/useDocumentoTemplates.ts`** — Melhorar tratamento de erro nas mutations:
- No `onError` de `useCreateTemplate` e `useUpdateTemplate`, detectar erro `23505` e mostrar toast específico: "Já existe um template com este código. Escolha outro."
- Relançar o erro para o formulário poder reagir

**2. `src/pages/documentos/TemplateForm.tsx`** — Melhorar UX:
- No `catch` do `onSubmit`, detectar erro `23505` e setar erro no campo `codigo` via `form.setError('codigo', { message: 'Este código já está em uso' })`
- Na geração automática do código (`handleNomeChange`), adicionar sufixo com timestamp curto para reduzir colisões (ex: `CONTRATO_V1_A3F`)
- Permitir edição do código mesmo no modo edição, mas verificar colisão

**3. Verificação prévia (opcional mas recomendada)**:
- Antes de submeter, fazer query rápida para verificar se o código já existe (excluindo o próprio template em edição)
- Mostrar feedback inline no campo de código

### Resultado
- Mensagem clara quando código duplicado: "Este código já está em uso por outro template"
- Geração automática com menor chance de colisão
- Campo código mostra erro inline em vez de toast genérico

