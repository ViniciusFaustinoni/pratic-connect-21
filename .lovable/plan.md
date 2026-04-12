

## Plano: Preview completo do documento final no editor de template

### Problema
O editor de template mostra apenas o campo `conteudo` do template (~14k caracteres), mas o documento final enviado ao Autentique tem ~30 páginas porque a Edge Function monta dinamicamente:
- Cabeçalho da empresa (`generateHeader`)
- Conteúdo do template (o que o editor mostra)
- Tabela de coberturas e benefícios (injetada automaticamente)
- Aditivos dinâmicos (baseados no veículo)
- Seção de rastreador (quando obrigatório)
- Seção de indicador
- Templates anexos (Regulamento, Manual 24h, etc.)
- Rodapé

O usuário não consegue visualizar ou editar a estrutura completa do documento.

### Solução
Adicionar um botão **"Preview Completo"** no editor de template que simula a montagem completa do documento, mostrando todos os blocos que serão incluídos no PDF final.

### Alterações

**1. Nova Edge Function `preview-termo-completo`**
- Recebe o `template_id` (ou o HTML do template sendo editado)
- Reutiliza a mesma lógica de montagem do `autentique-create`:
  - `generateHeader`, `generateFooter`, `generateStyles`
  - Dados fictícios/exemplo para substituição de variáveis
  - Busca coberturas/benefícios de um plano exemplo
  - Gera aditivos com veículo exemplo
  - Busca templates anexos (regulamento, manual)
- Retorna o HTML completo montado
- Não envia ao Autentique — apenas retorna para preview

**2. Atualizar `src/components/documentos/TemplateEditor.tsx`**
- Adicionar uma 3ª aba: **"Preview Completo"** (além de Editor e Preview)
- Ao clicar, chama a Edge Function com o conteúdo atual do editor
- Renderiza o HTML retornado num iframe ou div com estilo A4
- Mostra indicadores visuais dos blocos injetados automaticamente (coberturas, aditivos, anexos)
- Badge mostrando estimativa de páginas

**3. Alternativa mais leve (recomendada)**
Em vez de criar uma Edge Function, montar o preview no frontend:
- Após o conteúdo do template, adicionar seções placeholder sinalizadas:
  - `📋 COBERTURAS E BENEFÍCIOS DO PLANO` — com tabela exemplo
  - `📎 ADITIVOS DINÂMICOS` — lista dos aditivos ativos no sistema
  - `📄 TEMPLATES ANEXOS` — lista dos templates com `anexar_proposta=true`
- Cada seção com borda tracejada e badge "Gerado automaticamente"
- Buscar do banco: templates anexos ativos, aditivos ativos, coberturas/benefícios de exemplo

### Detalhes técnicos

**Arquivo principal**: `src/components/documentos/TemplateEditor.tsx`
- Nova aba "Documento Completo" no TabsList
- Hook para buscar templates anexos: `supabase.from('documento_templates').select('nome, codigo').eq('anexar_proposta', true).eq('ativo', true)`
- Hook para buscar aditivos ativos: similar query
- Renderizar seções placeholder após o `previewConteudo`

**Estrutura do preview completo**:
```text
┌──────────────────────────┐
│    CABEÇALHO EMPRESA     │
├──────────────────────────┤
│                          │
│  Conteúdo do Template    │
│  (com variáveis dummy)   │
│                          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ ⚡ COBERTURAS E BENEFÍCIOS│ ← "Injetado automaticamente"
│  [tabela exemplo]        │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ ⚡ ADITIVOS DINÂMICOS     │ ← "Baseado no veículo"
│  • Aditivo Rastreador    │
│  • Aditivo Vidros        │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ 📎 REGULAMENTO GERAL     │ ← "Anexo automático"
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ 📎 MANUAL 24H            │ ← "Anexo automático"
├──────────────────────────┤
│      RODAPÉ              │
└──────────────────────────┘
```

### Escopo
- 1 arquivo modificado: `TemplateEditor.tsx`
- Queries simples ao Supabase para listar anexos/aditivos ativos
- Sem nova Edge Function (abordagem frontend)
- Sem alteração na lógica de geração real do documento

