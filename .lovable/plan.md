

# Adicionar opcao "Usar como padrao para Termo de Entrada de Evento" no formulario de templates

## Resumo

Adicionar uma nova opcao (checkbox) no formulario de criacao/edicao de templates, similar ao existente "Usar como template padrao para Autentique" (afiliacao), mas para marcar o template como padrao do **Termo de Entrada de Evento** enviado quando um sinistro e aprovado.

## Alteracoes

| Arquivo / Recurso | Descricao |
|---|---|
| **SQL (Migration)** | Adicionar coluna `is_default_evento` (boolean, default false) na tabela `documento_templates` com unique index parcial |
| **`src/pages/documentos/TemplateForm.tsx`** | Adicionar campo `is_default_evento` no schema Zod e novo checkbox no formulario |
| **`src/hooks/useDocumentoTemplates.ts`** | Adicionar `is_default_evento` nos tipos e nas mutations de create/update |
| **`supabase/functions/autentique-evento-create/index.ts`** | Priorizar template marcado com `is_default_evento = true` ao buscar template para o termo |

## Detalhes tecnicos

### 1. Migration SQL

```sql
ALTER TABLE public.documento_templates
  ADD COLUMN IF NOT EXISTS is_default_evento BOOLEAN DEFAULT false;

-- Garantir que apenas um template pode ser padrao para evento
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_default_evento
  ON public.documento_templates (is_default_evento)
  WHERE is_default_evento = true AND ativo = true;
```

### 2. TemplateForm.tsx

- Adicionar `is_default_evento: z.boolean().default(false)` ao schema Zod
- Adicionar nos defaultValues e no carregamento do template existente
- Incluir no `onSubmit` (tanto create quanto update)
- Adicionar novo checkbox abaixo do existente, com icone `Shield` e texto:
  - Titulo: "Usar como padrao para Termo de Entrada de Evento"
  - Descricao: "Este template sera usado para gerar o Termo de Entrada de Evento enviado ao associado quando um sinistro for aprovado. Apenas um template pode ser marcado."

### 3. useDocumentoTemplates.ts

- Adicionar `is_default_evento?: boolean` nas interfaces `DocumentoTemplate`, `CreateTemplateInput` e `UpdateTemplateInput`
- Incluir no mapeamento de dados e nas mutations

### 4. Edge function autentique-evento-create

Alterar a busca do template (linhas 97-104) para priorizar `is_default_evento = true`:

```typescript
// Primeiro tenta pelo novo campo is_default_evento
const { data: templateEvento } = await supabase
  .from("documento_templates")
  .select("id, codigo, nome, conteudo")
  .eq("is_default_evento", true)
  .eq("ativo", true)
  .maybeSingle();

if (templateEvento?.conteudo) {
  templateConteudo = templateEvento.conteudo;
  templateNome = templateEvento.nome;
} else if (docType) {
  // Fallback: buscar por document_type_id + is_default (comportamento atual)
  const { data: templateDB } = await supabase
    .from("documento_templates")
    .select("id, codigo, nome, conteudo")
    .eq("document_type_id", docType.id)
    .eq("is_default", true)
    .eq("ativo", true)
    .maybeSingle();
  // ...
}
```

Isso garante retrocompatibilidade: se nenhum template tiver `is_default_evento`, o sistema usa o fallback atual.
