

# Plano: Anexar Template à Proposta de Filiação

## O que existe hoje
- A tabela `documento_templates` tem flags booleanas para marcar templates como padrão: `is_default_autentique`, `is_default_evento`, `is_default_saida`, `is_default_rastreador`
- **Não existe** flag para anexar template à proposta de filiação
- O formulário `TemplateForm.tsx` já renderiza checkboxes para cada flag — basta adicionar mais um
- A proposta é gerada via `useGerarProposta.ts` usando `pdf-lib` (PDF programático em A4)
- O contrato/assinatura é gerado via Edge Functions `autentique-create` e `autentique-create-by-token` usando HTML dinâmico

## Implementação

### 1. Migration: adicionar coluna `anexar_proposta`
```sql
ALTER TABLE documento_templates 
  ADD COLUMN IF NOT EXISTS anexar_proposta boolean DEFAULT false;
```

### 2. Formulário de template (`TemplateForm.tsx`)
- Adicionar campo `anexar_proposta` no schema Zod e default values
- Adicionar checkbox com estilo consistente (cor roxa/violeta para diferenciar):
  - Label: "Anexar à Proposta de Filiação"
  - Descrição: "Este termo será automaticamente anexado como página adicional em todas as propostas de filiação geradas. Múltiplos templates podem ser marcados."
- Gravar no insert/update

### 3. Hook de templates (`useDocumentoTemplates.ts`)
- Adicionar `anexar_proposta` nas interfaces e nos creates/updates

### 4. Geração da proposta (`useGerarProposta.ts`)
- Antes de gerar o PDF, buscar todos os templates com `anexar_proposta = true` e `ativo = true`
- Para cada template encontrado, renderizar o HTML do template como página(s) adicional(is) no PDF após as páginas da proposta
- Usar a mesma lógica de renderização HTML→PDF que já existe no sistema (converter o `conteudo` HTML do template em páginas do pdf-lib)

### 5. Geração do contrato Autentique (`autentique-create`)
- Mesma lógica: buscar templates com `anexar_proposta = true` e concatenar o HTML ao final do documento antes de enviar para assinatura
- Assim o associado assina a proposta + termos anexados de uma vez

## Arquivos afetados
- Migration SQL (nova coluna)
- `src/pages/documentos/TemplateForm.tsx` — novo checkbox
- `src/hooks/useDocumentoTemplates.ts` — campo nas interfaces
- `src/hooks/useGerarProposta.ts` — buscar e anexar templates marcados
- `supabase/functions/autentique-create/index.ts` — concatenar termos ao HTML
- `supabase/functions/autentique-create-by-token/index.ts` — idem

## Diferença em relação aos outros checkboxes
Os checkboxes existentes são mutuamente exclusivos (apenas 1 template padrão por tipo). O `anexar_proposta` permite **múltiplos templates** marcados simultaneamente — todos serão anexados à proposta.

