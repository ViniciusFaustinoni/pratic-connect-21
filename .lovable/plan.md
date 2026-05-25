## Diagnóstico — ALESSANDRA PAULA KLEIZ (profile `f794f9e0…`)

### O que está certo no banco
- `profiles.tipo = 'funcionario'` ✓
- `user_module_visibility` tem `monitoramento` e `vendas` com `visible = true`, gravados pelo card "Acesso a Módulos" às 15:12 do dia 25/05. O save funcionou.
- `user_module_item_visibility` está vazio (semântica: nenhum filtro de item → todos os itens dos módulos extras devem aparecer).

### Por que ela ainda não vê os módulos
O perfil de acesso dela é `analista_cadastro`. Os grupos `vendas` e `monitoramento` no `menuConfig` exigem `canManageLeads` / `canManageInstalacoes`, que ela não tem pelo perfil — portanto eles **só aparecem na sidebar pelo bloco "extras" do `AppSidebar.tsx` (linhas 645–661)**, que injeta os grupos a partir de `additionalModules` retornado por `useModuleVisibility`.

Esse hook (`src/hooks/useModuleVisibility.ts`) tem:
```ts
staleTime: 5 * 60 * 1000   // 5 minutos
// sem refetchOnWindowFocus
// sem subscription realtime
```
e o mesmo se aplica a `useModuleItemVisibility`. O `UsuarioForm.tsx` quando salva chama `queryClient.invalidateQueries(['user-module-visibility'])` — **só na sessão do admin** (cache do React Query é por aba). A sessão da Alessandra continua servindo o snapshot antigo (sem `monitoramento`/`vendas`) por até 5 min, e como não há `refetchOnWindowFocus` nem realtime, ela pode ficar horas vendo a sidebar antiga até forçar um reload.

Confirmação operacional: peço para a Alessandra dar **Ctrl+F5** — se os módulos aparecerem imediatamente, o diagnóstico está fechado. Mesmo que apareçam, isso é um bug de UX: liberações de acesso precisam aparecer em segundos, sem reload manual.

> Observação importante: a tela do CARLOS no print 1 ("Cadastro › Associados") é a tela que ela já abre hoje. A barra lateral à esquerda só mostra Comercial › Cadastro (perfil padrão dela). Vendas e Monitoramento não aparecem porque a sessão dela está com cache antigo.

## Plano de correção

### 1. Tornar a propagação de acessos quase-instantânea (`useModuleVisibility` + `useModuleItemVisibility`)

Em ambos os hooks:
- Adicionar Supabase Realtime na própria sessão do usuário-alvo, filtrado por `user_id=profileId`, invalidando a query quando vier qualquer change (`INSERT`, `UPDATE`, `DELETE`) — assim, no instante em que o admin salva, a sessão da Alessandra recebe e re-busca.
- Reduzir `staleTime` para `30 * 1000` (30 s) como rede de segurança caso a subscription caia.
- Habilitar `refetchOnWindowFocus: true` para garantir refresh quando ela volta à aba.

```ts
// src/hooks/useModuleVisibility.ts (esboço)
useEffect(() => {
  if (!profileId) return;
  const ch = supabase
    .channel(`umv-${profileId}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_module_visibility', filter: `user_id=eq.${profileId}` },
        () => queryClient.invalidateQueries({ queryKey: ['module-visibility', profileId] })
    )
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [profileId, queryClient]);
```
Idem em `useModuleItemVisibility` para a tabela `user_module_item_visibility`.

### 2. Habilitar realtime nas duas tabelas (uma vez)
Migração curta:
```sql
ALTER TABLE public.user_module_visibility       REPLICA IDENTITY FULL;
ALTER TABLE public.user_module_item_visibility  REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_module_visibility;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_module_item_visibility;
```
(Ignora erro "already member" se já estiver na publication.)

### 3. Validação

a. Eu mesmo: como `admin@teste.com`, abro `/configuracoes/usuarios/f794f9e0…`, removo `monitoramento`, salvo, re-adiciono, salvo. Em paralelo, em outra aba/usuário, confirmo que o evento Realtime invalida e a query re-busca (via console / Network).

b. Operacional para a equipe: peço para a Alessandra abrir a sidebar e confirmar que os super-grupos **Comercial › Vendas** e **Relacionamento › Monitoramento** apareceram sem reload, clicar em pelo menos uma página de cada (`/vendas/cotacoes` e `/monitoramento/vistorias-instalacoes-mon`) e confirmar que carregam.

c. Smoke negativo: removo um módulo no admin → confirmo que some na sessão dela em poucos segundos.

### 4. Caso o item permaneça "indisponível" após o reload
(cenário improvável dado o estado do banco, mas conforme princípio "verificar se já existe antes de implementar":)
- Investigar se alguma tela específica que ela clica tem `Navigate to="/acesso-negado"` por checagem de role — hoje varredura em `src/pages/vendas` e `src/pages/monitoramento` **não encontra nenhum** redirect desse tipo, logo a hipótese A (cache stale) cobre o sintoma. Se aparecer caso novo, abro task separada.

### 5. Memória
Atualizo `mem://logic/access/usuario-form-save-unificado` (já existente) com nota:
- "Propagação para a sessão do usuário liberado é via Realtime em `user_module_visibility` + `user_module_item_visibility` (`useModuleVisibility` / `useModuleItemVisibility` assinam canais filtrados por `user_id`). Não depender de `staleTime` ou reload manual."

## Arquivos a alterar
- `src/hooks/useModuleVisibility.ts` — subscription realtime + staleTime/refetchOnWindowFocus.
- `src/hooks/useModuleItemVisibility.ts` — idem para a tabela de itens.
- Migração SQL — habilitar realtime nas duas tabelas.
- Memória `mem://logic/access/usuario-form-save-unificado`.

## Fora de escopo
- Mudar `UsuarioForm.tsx` — o save já está unificado, queryClient.invalidate já está lá.
- Mudar guards de páginas (não há guard restritivo nas páginas envolvidas hoje).
