
# Adicionar Template Padrao para Rastreador

## Resumo

Adicionar uma nova regra "Usar como padrao para Termo de Rastreador" nos templates de documentos, seguindo o mesmo padrao ja existente para Autentique, Entrada de Evento e Saida de Evento.

## O que sera feito

### 1. Migration: nova coluna `is_default_rastreador`

Adicionar coluna `is_default_rastreador` (boolean, default false) na tabela `documento_templates`, seguindo o padrao das colunas `is_default_autentique`, `is_default_evento` e `is_default_saida`.

### 2. Atualizar `src/pages/documentos/TemplateForm.tsx`

- Adicionar `is_default_rastreador: z.boolean().default(false)` no schema Zod
- Adicionar campo no form default e no reset ao carregar template existente
- Passar `is_default_rastreador` no submit (create e update)
- Adicionar checkbox com icone `Radio` (ou `MapPin`), borda azul-ciano, com texto:
  - Label: "Usar como padrao para Termo de Rastreador"
  - Descricao: "Este template sera usado para gerar o Termo de Instalacao de Rastreador quando houver necessidade. Apenas um template pode ser marcado."

### 3. Atualizar `src/hooks/useDocumentoTemplates.ts`

- Adicionar `is_default_rastreador` nas interfaces `CreateTemplateInput`, `UpdateTemplateInput`, `TemplateData`
- Incluir no `mapTemplateData` (parse do banco)
- Incluir no `mutationFn` de create e update

### 4. Garantir exclusividade (apenas 1 padrao)

Ao salvar um template com `is_default_rastreador = true`, limpar o flag dos demais templates. Isso sera feito no hook de update/create com uma chamada extra ao Supabase antes de salvar (mesmo padrao que poderia ser feito para os outros flags -- atualmente nao ha essa protecao, mas vou adicionar para o rastreador).

## Arquivos a modificar

- `documento_templates` (migration) -- nova coluna
- `src/pages/documentos/TemplateForm.tsx` -- checkbox no formulario
- `src/hooks/useDocumentoTemplates.ts` -- interfaces e logica de persistencia
