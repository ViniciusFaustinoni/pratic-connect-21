## Causa-raiz

Verificado no banco para `MATHEUS TROYACK E SILVA` (`profile.id = 2c5b9ad6-…`):

- `profiles.updated_at = 2026-05-25 14:19:27` → o profile foi salvo (tipo/nome/telefone OK).
- `user_roles` para esse usuário: **vazio** (nenhum perfil — nem Diretor, nem Analista de Monitoramento).
- `user_module_visibility` para esse usuário: **vazio** (nenhum módulo extra concedido).

Por isso ele **sumiu de Monitoramento › Equipe › Administrativo**: a aba lista quem tem `role = analista_monitoramento` em `user_roles` (`useProfissionaisEquipe` → `src/hooks/useEquipe.ts`).

O motivo está no formulário `src/pages/configuracoes/UsuarioForm.tsx`:

1. **Dois saves independentes na mesma tela** (UX-armadilha):
   - Botão principal "**Salvar Alterações**" → roda `saveUser.mutate()` que faz `DELETE FROM user_roles WHERE user_id=…` e depois `INSERT` dos perfis em `formData.perfis`. Se a lista estiver vazia no momento do clique, o usuário fica **sem nenhum perfil** (foi o que aconteceu aqui).
   - Botão interno "**Salvar acessos**" dentro do card `ModuleAccessCard` (linhas 167-172) → único responsável por persistir `user_module_visibility`. Esse card mantém as alterações em `localChanges` (estado React local). Se o usuário clica só no "Salvar Alterações" do form e navega, **as mudanças de módulo são perdidas** sem aviso.

2. **Sem aviso de mudanças não salvas**: nada bloqueia a navegação nem pisca o botão interno quando há `localChanges` pendentes.

Resumo: o "Salvar Alterações" salvou perfil/tipo (com a lista de perfis vazia no momento) e zerou roles; e os toggles de módulo nem chegaram a ser enviados porque dependem de outro botão.

## Plano de correção

### 1. Unificar o save no formulário (`src/pages/configuracoes/UsuarioForm.tsx`)
- Promover o estado interno do `ModuleAccessCard` para o componente pai via prop `onChange(localChanges)` + `ref` (ou lift state).
- Dentro de `saveUser.mutationFn`, após `user_roles`, fazer o `upsert` em `user_module_visibility` no mesmo fluxo transacional do save.
- Remover o botão "Salvar acessos" interno (ou deixá-lo apenas como atalho que dispara o mesmo mutate do form).
- Mensagem de sucesso única: "Usuário, perfis e acessos atualizados".

### 2. Guard anti-acidente
- Se `formData.perfis.length === 0` ao submeter, abrir `confirm()` ("Você está removendo todos os perfis deste usuário. Confirma?") antes do `mutate`.
- Indicador visual no botão Salvar (badge "alterações pendentes") quando houver `localChanges` de módulos OU diff de perfis.
- Bloquear navegação (`useBlocker` do react-router) com diff pendente.

### 3. Restaurar MATHEUS TROYACK E SILVA
Via migration de dados (INSERT idempotente):
- Inserir em `user_roles` a role escolhida (precisa confirmar com você — ver pergunta abaixo).
- Opcional: inserir overrides em `user_module_visibility` para os módulos extras que você quer dar.

### 4. Sanity check de outros casos
Listar profissionais sem nenhuma role para detectar mais usuários afetados pelo mesmo bug e reportar.

## Arquivos afetados
- `src/pages/configuracoes/UsuarioForm.tsx` (unificação do save + guards)
- Migration data-only para repor a role de MATHEUS e (se quiser) os módulos.

## Pergunta antes de implementar
Qual perfil/role você quer realmente atribuir ao MATHEUS?
- **Analista de Monitoramento** (`analista_monitoramento`) — entra na aba Administrativo de Equipe.
- **Coordenador de Monitoramento** (`coordenador_monitoramento`).
- Manter **Diretor** (estava marcado no print) — mas Diretor já libera tudo, não precisa adicionar módulos.
- Outra combinação.

E quais módulos extras (além dos cobertos pelo perfil) você quer liberar para ele? Posso listar os módulos disponíveis se quiser.