

# Adicionar Botões de Ação ao Editor de Templates Meta

## Contexto

O backend já suporta botões:
- A tabela `whatsapp_meta_templates` tem coluna `botoes` (JSONB)
- A Edge Function `whatsapp-meta-templates` já monta o payload correto para a Meta API (URL, PHONE_NUMBER, QUICK_REPLY) — linhas 146-159
- O que falta é **apenas a UI no drawer de criação/edição** e a **preview dos botões**

## Alterações

### 1. `WhatsAppMetaTemplateDrawer.tsx` — Seção de Botões

Adicionar entre o campo "Rodapé" e o separador:

- Estado `botoes` como array de objetos `{ tipo: 'url' | 'telefone' | 'resposta_rapida', texto: string, url?: string, telefone?: string }`
- Limite de 3 botões (regra da Meta)
- Botão "+ Adicionar botão" que abre um mini-form inline com:
  - Select para tipo (URL, Telefone, Resposta Rápida)
  - Input para texto do botão (máx 25 chars)
  - Input condicional para URL (se tipo=url) ou telefone (se tipo=telefone)
  - Botão remover (X) por botão
- Carregar `template.botoes` no `useEffect` de edição
- Incluir `botoes` no `handleSalvarRascunho` e `handleEnviarAprovacao`
- Incluir `botoes` na chamada de validação IA

### 2. Preview dos Botões no WhatsApp

Na seção de preview (coluna direita), após o rodapé e timestamp, renderizar os botões como aparecem no WhatsApp real:
- Separador fino
- Botões empilhados com ícone (🔗 para URL, 📞 para telefone, ↩️ para resposta rápida) e texto centralizado
- Estilo visual similar ao WhatsApp (texto azul clicável)

### 3. Preview na visualização (dialog de "Ver")

Adicionar seção de botões no `AlertDialog` de visualização em `WhatsAppMetaTemplates.tsx`, mostrando os botões configurados do template.

### Nenhuma alteração no backend

A Edge Function e a tabela já estão prontas — apenas o frontend precisa ser atualizado.

