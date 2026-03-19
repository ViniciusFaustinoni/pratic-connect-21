

# Aba "Adicionais" — Flag Em Desenvolvimento

## Mudança

Envolver o conteúdo da aba "Adicionais" com o `LeadsDevGuard` já existente, que restringe acesso a Diretor, Admin Master e Desenvolvedor. Adicionar badge "Dev" no trigger da tab.

## Implementação em `src/pages/vendas/PlanosBeneficios.tsx`

### 1. Importar `LeadsDevGuard`
Adicionar import do componente existente.

### 2. Badge "Dev" no TabsTrigger
Adicionar badge amarelo "Dev" ao lado do texto "Adicionais" no trigger (linha 256).

### 3. Envolver conteúdo com guard
Dentro do `TabsContent value="adicionais"` (linha 437), envolver todo o conteúdo com `<LeadsDevGuard>`. Usuários sem permissão verão a tela "Módulo em Desenvolvimento" ao clicar na aba.

A aba continua visível para quem tem `podeVerConfigAvancada` (Gerente, Supervisor inclusos), mas o **conteúdo** só aparece para Diretor/Admin Master/Desenvolvedor — os demais veem o fallback.

| Arquivo | Ação |
|---------|------|
| `src/pages/vendas/PlanosBeneficios.tsx` | Import guard, badge no trigger, wrap conteúdo |

