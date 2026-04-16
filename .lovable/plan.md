

## Problema

A tabela `chat_solicitacoes_ia` tem uma política de INSERT que só permite **associados** criarem solicitações (verifica se `associado_id` pertence ao `auth.uid()`). Quando um vendedor ou funcionário tenta criar uma solicitação de troca de titularidade pelo painel, o RLS bloqueia o INSERT.

**Política atual (INSERT):**
```sql
with_check: associado_id IN (SELECT id FROM associados WHERE user_id = auth.uid())
```

Isso foi pensado para o chatbot do associado, não para o painel interno.

## Correção

Uma **migração SQL** que adiciona uma nova política de INSERT para funcionários autorizados:

```sql
CREATE POLICY "Funcionarios podem criar solicitacoes"
ON public.chat_solicitacoes_ia
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'vendedor_interno'::app_role)
  OR has_role(auth.uid(), 'vendedor_externo'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
  OR has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
);
```

Nenhuma alteração de código é necessária — o `TrocaTitularidadeDialog.tsx` já grava `criado_por: user.id` corretamente.

## Fluxo completo de Troca de Titularidade

1. **Vendedor/Funcionário** abre o dialog no painel do associado → preenche dados do novo titular → clica "Solicitar Troca"
2. Insert em `chat_solicitacoes_ia` com `tipo='troca_titularidade'`, `status='pendente'`
3. **Diretor** aprova em `/diretoria/solicitacoes` → status muda para `aprovada`
4. Sistema cria novo associado com os dados do novo titular, transfere veículo, gera contrato com `tipo_entrada='troca_titularidade'`

## Escopo

- 1 migração SQL (nova RLS policy)
- 0 arquivos de código alterados

