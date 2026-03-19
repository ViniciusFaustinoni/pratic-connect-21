

# Migração Sem Consultor + Pontuação + Alerta de Prazo

## PARTE 1 — Entrada Direta de Migração (sem cotação/consultor)

### Problema
A tabela `solicitacoes_migracao` exige `cotacao_id NOT NULL`. Entrada direta não possui cotação. Além disso, o hook `useCriarSolicitacaoMigracao` força `consultor_id` como o perfil logado.

### Mudanças no banco
1. **ALTER `solicitacoes_migracao`**: tornar `cotacao_id` nullable e adicionar coluna `origem_entrada` (text, default `'consultor'`, valores: `'consultor'` | `'direta'`).

### Mudanças no código

**Novo componente: `src/components/cadastro/MigracaoDiretaDialog.tsx`**
- Dialog/Sheet acessível a partir da tela `SolicitacoesMigracao.tsx` (botão "Nova Solicitação" no header).
- Formulário com: CPF (com máscara), Nome, Placa, Associação de Origem, Consultor (Select opcional buscando profiles com role de vendedor).
- Reutiliza o mesmo fluxo de upload de documentos do `MigracaoStepForm` (comprovantes + boleto + OCR).
- Reutiliza `useVerificarBloqueiosMigracao` para bloquear CPFs com débito/vínculo ativo.
- Ao submeter, insere em `solicitacoes_migracao` com `cotacao_id: null`, `origem_entrada: 'direta'`, `consultor_id: opcional`.

**Hook: `src/hooks/useSolicitacaoMigracao.ts`**
- Criar nova mutation `useCriarSolicitacaoMigracaoDireta` que aceita `consultor_id` opcional e `cotacao_id` nulo.

**Tela: `src/pages/cadastro/SolicitacoesMigracao.tsx`**
- Adicionar botão "Nova Solicitação" no header (visível para gerência+).
- Coluna "Origem" na tabela da fila mostrando badge "Consultor" ou "Direta".

**Ficha do associado: `src/components/associados/detalhe/OrigemCadastroCard.tsx`**
- Exibir "Entrada Direta" quando `origem_entrada === 'direta'`.

---

## PARTE 2 — Pontuação do Consultor na Aprovação

### Mudança no hook `useAprovarMigracao`

Após aprovar com sucesso, se a solicitação tem `consultor_id`:
1. Buscar parâmetro de pontuação `pontos_migracao_aprovada` de `comissoes_parametros` (fallback: 1.0).
2. Verificar se já existe evento em `pontuacao_eventos` com `referencia_tipo = 'solicitacao_migracao'` e `referencia_id = solicitacao.id` para evitar duplicata.
3. Se não existe, inserir evento com `tipo_operacao: 'migracao_aprovada'`, `vendedor_id: consultor_id`, `referencia_tipo: 'solicitacao_migracao'`, `referencia_id: solicitacao.id`.

Nenhuma edge function necessária — a lógica roda no client ao aprovar.

---

## PARTE 3 — Alerta de Prazo Vencido

### Novo cron edge function: `supabase/functions/cron-migracao-prazo-vencido/index.ts`
- Executado periodicamente (a cada 15 minutos via cron do Supabase).
- Busca solicitações com `status = 'pendente'` cujo `created_at + prazo_resposta_horas` < `now()`.
- Para cada solicitação vencida, verifica se já existe notificação com `referencia_tipo = 'migracao_prazo_vencido'` e `referencia_id = solicitacao.id` — se sim, ignora (uma única vez por solicitação).
- Busca todos os profiles com roles `diretor` ou `gerente_comercial`.
- Insere notificação para cada um com: título "Migrações em Atraso", mensagem com contagem e tempo da mais antiga, `referencia_tipo: 'migracao_prazo_vencido'`, `referencia_id: solicitação_mais_antiga.id`.

### Auto-resolução
No `useAprovarMigracao` e `useReprovarMigracao`, após decisão, marcar como lida (`lida = true`) as notificações com `referencia_tipo = 'migracao_prazo_vencido'` e `referencia_id = solicitacao.id`.

---

## Resumo de arquivos

| Arquivo | Ação |
|---------|------|
| **Migration SQL** | `cotacao_id` nullable, add `origem_entrada` |
| `src/components/cadastro/MigracaoDiretaDialog.tsx` | Novo — formulário de entrada direta |
| `src/hooks/useSolicitacaoMigracao.ts` | Nova mutation para criação direta |
| `src/pages/cadastro/SolicitacoesMigracao.tsx` | Botão "Nova Solicitação", coluna "Origem" |
| `src/hooks/useSolicitacoesMigracaoAdmin.ts` | Pontuação na aprovação, auto-resolver alertas |
| `src/components/associados/detalhe/OrigemCadastroCard.tsx` | Exibir origem direta |
| `supabase/functions/cron-migracao-prazo-vencido/index.ts` | Novo — alerta automático de prazo |
| `supabase/config.toml` | Registro do cron |

