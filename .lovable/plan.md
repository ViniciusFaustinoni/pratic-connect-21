
# Correção: Analista de Eventos não vê Solicitações IA pendentes

## Problema Identificado

O Analista de Eventos clica no botão "Revisar Solicitações" na listagem de sinistros e é redirecionado para `/diretoria/solicitacoes-ia`. A página carrega corretamente, mas mostra "Nenhuma solicitação pendentes" apesar de existirem 2 solicitações pendentes no banco de dados.

**Causa raiz:** A tabela `chat_solicitacoes_ia` possui RLS (Row Level Security) com políticas SELECT apenas para:
- Associados (veem as próprias)
- Diretores (veem todas)

O papel `analista_eventos` **não possui política SELECT**, então o RLS bloqueia o acesso.

## Dados no banco confirmando o problema

Existem 2 solicitações pendentes:
- 1 sinistro (colisão) criado em 15/02/2026
- 1 assistência (guincho) criado em 15/02/2026

## Solução

### 1. Criar política RLS para analista_eventos

Adicionar uma migração SQL que permita ao analista de eventos visualizar todas as solicitações IA (SELECT) e também atualizá-las (UPDATE) para poder aprovar/rejeitar.

```sql
-- Analistas de eventos podem ver todas as solicitações
CREATE POLICY "Analistas de eventos podem ver solicitacoes"
  ON public.chat_solicitacoes_ia FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'analista_eventos'));

-- Analistas de eventos podem atualizar solicitações (aprovar/rejeitar)
CREATE POLICY "Analistas de eventos podem atualizar solicitacoes"
  ON public.chat_solicitacoes_ia FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'analista_eventos'));
```

### 2. Arquivo a criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/XXXX_add_analista_eventos_solicitacoes_ia_policy.sql` | Migração com as 2 novas políticas RLS |

Nenhum arquivo de código precisa ser alterado -- a página `SolicitacoesIA.tsx` já funciona corretamente, o problema é exclusivamente de permissão no banco de dados.
