

## Corrigir classificação Instaladores vs Administrativo + incluir Vistoriadores Base

### Diagnóstico
Na tela `/monitoramento/equipe`:

1. **Todos caem em "Administrativo"**: o hook `useProfissionaisEquipe` mapeia roles num objeto `roleByUserId` e usa `prof.role === 'instalador_vistoriador'` para classificar. A lógica hoje é frágil (depende de fallback `|| 'analista_monitoramento'`) e está classificando os 8 instaladores reais como administrativo.
2. **Vistoriadores base não aparecem**: a query `.in('role', ['instalador_vistoriador','analista_monitoramento'])` no hook **não inclui** a role `vistoriador_base`. Os 2 profissionais que possuem **apenas** `vistoriador_base` (Kleytonn, Wallace) são silenciosamente excluídos.

Confirmado no banco: existem 16 profissionais elegíveis (8 instalador_vistoriador, 6 analista_monitoramento, 2 vistoriador_base puros, 1 Rafael com dupla role). Screenshot mostra 14 em Administrativo, 0 em Instaladores.

### Solução

**Arquivo: `src/hooks/useEquipe.ts`**

1. Adicionar `'vistoriador_base'` na lista do `.in('role', [...])` (linha 52).
2. Substituir o `roleByUserId` (que guarda apenas 1 role por usuário) por um `rolesByUserId: Record<string, Set<string>>` que guarda **todas** as roles do usuário.
3. Adicionar tipo derivado `categoria: 'instalador' | 'administrativo'` no objeto `ProfissionalEquipe`, calculado assim:
   - Se o conjunto de roles contém `instalador_vistoriador` **ou** `vistoriador_base` → `'instalador'`.
   - Caso contrário → `'administrativo'`.
4. Manter o campo `role` existente (para retrocompatibilidade — usar a "role principal" priorizando instalador_vistoriador > vistoriador_base > analista_monitoramento).
5. Atualizar interface `ProfissionalEquipe` adicionando `categoria` e ampliando `RoleEquipe` para incluir `'vistoriador_base'`.

**Arquivo: `src/pages/monitoramento/Equipe.tsx`**

6. Linha 121: substituir o split por `prof.categoria === 'instalador'` (em vez de `prof.role === 'instalador_vistoriador'`).
7. Linha 74 (`handleVerServicos`): também atualizar para usar `prof.categoria === 'instalador'`.

### Critérios de aceitação

1. Aba **Instaladores** mostra os 8 `instalador_vistoriador` + 2 `vistoriador_base` puros + Rafael (que tem ambos) = **11 cards**.
2. Aba **Administrativo** mostra apenas os 5 `analista_monitoramento` puros = **5 cards** (Rafael não duplica; vai para Instaladores).
3. Total geral = 16 (antes: 14, com 2 vistoriadores base sumindo).
4. Cards renderizam normalmente; nenhum filtro/região/status quebra.
5. Modais que usam `useProfissionaisEquipe` (AgendarRetiradaModal, AgendarManutencaoUnificadoModal) continuam funcionais — ganham o campo extra `categoria` mas o `role` permanece.

### Fora de escopo
- Criar UI para gestão da role `vistoriador_base` no modal de novo profissional (hoje só permite escolher entre instalador_vistoriador e analista_monitoramento). Pode ser feito numa fase separada se necessário.
- Alterar permissões/RLS da role `vistoriador_base`.

