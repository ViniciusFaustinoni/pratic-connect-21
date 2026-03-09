

# Consolidar Integrações: Diretoria → Configurações

## Situação Atual

A página `/diretoria/configuracoes` tem uma aba "Integrações" que renderiza o `IntegracoesStatusCard` — um card resumido com status de ASAAS, WhatsApp e Sascar. Já existe uma página completa em `/configuracoes/integracoes` com gestão detalhada (WhatsApp, Serviços, Fontes de Leads, API Keys).

A aba de integrações na diretoria é redundante e deve ser removida, já que o `IntegracoesStatusCard` tem um botão "Gerenciar" que já redireciona para `/configuracoes/integracoes`.

## Alterações

### 1. Remover aba "Integrações" de `diretoria/Configuracoes.tsx`
- Remover `integracoes` do objeto `categoriaConfig`
- Remover o filtro especial que mantém `integracoes` sempre disponível em `availableCategories`
- Remover o bloco condicional `if (cat === 'integracoes')` que renderiza o `IntegracoesStatusCard`
- Remover o import do `IntegracoesStatusCard`

### 2. Nenhuma outra mudança necessária
- `/configuracoes/integracoes` já existe e está completa
- O menu lateral já tem o link para Integrações em Configurações
- O `IntegracoesStatusCard` continua disponível como componente para uso no Dashboard se necessário

