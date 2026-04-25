## Exportação inteligente de usuários

Adicionar um botão **"Exportar"** ao lado de **"Novo usuário"** na tela `/configuracoes/usuarios-acessos` que abre um diálogo onde o diretor escolhe **quais perfis** e **quais campos** exportar, gerando um arquivo CSV ou XLSX.

### Comportamento

1. Botão **Exportar** (ícone Download) abre um `Dialog`.
2. Diálogo dividido em 3 seções:
   - **Perfis a exportar** (multi-seleção, agrupados por área — Comercial, Operações, Administração etc., reaproveitando `useAppRoles().getRolesByArea()`). Inclui atalhos: "Selecionar todos", "Limpar", e checkboxes por área (ex.: marca todos os perfis Comerciais de uma vez — útil para "todos os consultores externos e internos").
   - **Filtros adicionais**:
     - Status: Ativos / Inativos / Todos (default Ativos)
     - Tipo: Funcionário / Prestador / Agência / Todos
   - **Campos a exportar** (checkboxes, todos marcados por padrão): Nome, Email, Telefone, CPF, Tipo, Perfis (lista), Código SGA voluntário, Status (ativo/inativo), Data de cadastro, Último acesso.
3. Seleção de **formato**: CSV (UTF-8 com BOM, separador `;` para Excel BR) ou XLSX.
4. Pré-visualização: mostra "X usuário(s) serão exportados" antes de confirmar (executa COUNT rápido reativo).
5. Ao confirmar:
   - Busca todos os usuários sem paginação (rompe o limite de 1000 usando `.range()` em chunks de 1000 e concatenando — implementação no hook).
   - Resolve perfis (roles) por usuário em uma única consulta `user_roles.in(user_id, [...])`.
   - Gera o arquivo no cliente e dispara download com nome `usuarios_<YYYY-MM-DD_HHmm>.<ext>`.
6. Toast de sucesso com contagem ("142 usuários exportados").

### Inteligência da exportação

- **Agrupamento por área** torna trivial selecionar "todos os consultores" (marca a área Comercial inteira) ou "todos os supervisores" (1 clique no role).
- **Multi-role**: usuários com mais de 1 role aparecem uma única vez; coluna "Perfis" lista todos separados por `;`.
- **Filtragem combinada**: perfis selecionados ∩ tipo ∩ status. Se nenhum perfil for marcado, exporta todos os perfis (exceto associado).
- **Exclusão de associados** mantida (regra atual da tela).
- **Sanitização CSV**: prefixar células iniciadas com `=`, `+`, `-`, `@` com `'` para prevenir CSV injection.

### Arquivos

**Novo:**
- `src/components/configuracoes/ExportarUsuariosDialog.tsx` — diálogo + lógica de geração CSV/XLSX (usa `xlsx` lib se já instalada; senão CSV puro). Verifica primeiro se `xlsx` está em `package.json`; se não, oferece apenas CSV nesta versão.
- `src/hooks/useUsuariosExport.ts` — função `fetchUsuariosForExport(filters)` que pagina em chunks de 1000 e junta com roles.

**Editado:**
- `src/pages/configuracoes/UsuariosAcessos.tsx` — adiciona botão "Exportar" no header e renderiza o diálogo.

### Detalhes técnicos

- Reaproveita `useAppRoles` para listar/agrupar roles e respeita `app_roles_config` (fonte dinâmica de perfis).
- Consulta direta a `profiles` + `user_roles` via cliente Supabase (RLS já protege — só diretor/admin acessa a tela conforme `mem://constraints/access/usuarios-acessos-sem-associados.md`).
- Sem mudanças em banco, sem novas edge functions, sem novos secrets.
- Progress UX: botão "Exportar" mostra spinner durante a geração; bloqueia fechamento do dialog enquanto roda.

### Fora de escopo

- Exportação assíncrona via edge function (não necessária para o volume atual de usuários internos).
- PDF (formato não pedido).
- Importação reversa.