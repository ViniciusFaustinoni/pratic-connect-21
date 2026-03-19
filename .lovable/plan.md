

# Leads — Flag "Em Desenvolvimento" + Restrição de Acesso

## Resumo

Restringir a página de Leads (`/vendas/leads` e sub-rotas) para que apenas **Diretor** e **Admin Master** (+ Desenvolvedor) possam visualizar o conteúdo. Todos os outros usuários verão uma tela de "Em Desenvolvimento" com badge visual.

## Implementação

### 1. Proteger a rota em `LeadsUnificado.tsx`

No topo do componente, verificar `isDiretor`, `isAdminMaster` e `isDesenvolvedor` via `usePermissions()`. Se nenhum desses for true, renderizar um card de "Em Desenvolvimento" com:
- Badge amarelo "Em Desenvolvimento"
- Ícone de construção (Wrench ou Construction)
- Mensagem: "Este módulo está em desenvolvimento e será disponibilizado em breve."
- Botão "Voltar" para `/vendas`

### 2. Sidebar — badge visual na aba Leads

No componente do sidebar de vendas (onde "Leads" aparece como item de menu), adicionar um badge pequeno "Dev" ou "Em breve" ao lado do label "Leads", visível para todos os perfis — apenas como indicador visual.

### 3. Sub-rotas protegidas

Aplicar a mesma verificação em `LeadDetalhe.tsx` e `LeadEditar.tsx` (ou alternativamente, envolver as rotas `/vendas/leads/*` em `App.tsx` com um wrapper que faz o check uma vez só).

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/vendas/LeadsUnificado.tsx` | Adicionar guard de permissão + tela "Em Desenvolvimento" |
| `src/pages/vendas/LeadDetalhe.tsx` | Adicionar mesmo guard |
| `src/pages/vendas/LeadEditar.tsx` | Adicionar mesmo guard |
| Componente sidebar (menu Vendas) | Badge "Dev" no item Leads |

