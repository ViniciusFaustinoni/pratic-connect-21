

# Duplicar Template Meta

## O que será feito

Adicionar um botão "Duplicar" na tabela de templates Meta. Ao clicar, o sistema abre o drawer de criação já preenchido com os dados do template original, alterando apenas o nome (adicionando sufixo `_copia`). O template duplicado é salvo como DRAFT, permitindo editar antes de enviar para aprovação.

## Alterações

### 1. `src/components/integracoes/WhatsAppMetaTemplates.tsx`
- Importar ícone `Copy` do lucide-react
- Adicionar botão de duplicar na coluna de ações (disponível para qualquer status)
- Ao clicar, montar objeto com dados do template original mas com `nome: t.nome + '_copia'`, `id: undefined`, `status: 'DRAFT'`, `meta_id: null`
- Abrir o drawer em modo criação com esses dados pré-preenchidos

### 2. `src/components/integracoes/WhatsAppMetaTemplateDrawer.tsx`
- Nenhuma alteração necessária — o drawer já aceita um `template` para pré-preencher campos e salva como novo quando não há `id`

## Comportamento
- Botão com ícone de cópia aparece em **todos** os templates (aprovados, rejeitados, etc.)
- O nome recebe sufixo `_copia` (o usuário pode alterar antes de salvar)
- O novo template é salvo como DRAFT independente do status do original
- Campos copiados: nome, categoria, corpo, header, rodapé, botões, variáveis de exemplo

