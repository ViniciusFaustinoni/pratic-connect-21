

# Corrigir acesso do regulador a vistorias de evento

## Problema

O regulador nao consegue carregar a vistoria porque a tabela `sinistros` nao tem uma policy de SELECT que permita acesso para usuarios com role `regulador`. A query no hook `useVistoriaEventoDetalhe` faz um join de `vistorias_evento` com `sinistros`, mas o RLS de `sinistros` so permite acesso ao proprio associado (via `get_my_associado_id`) ou por `upload_token`. Resultado: o join retorna null e a query falha.

A tabela `sinistro_evento_links` tambem so tem uma policy generica (`true` para anon), que funciona mas nao eh ideal.

## Solucao

Criar uma nova RLS policy na tabela `sinistros` que permita SELECT para reguladores:

```sql
CREATE POLICY "Reguladores podem ver sinistros"
  ON public.sinistros
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'regulador')
    OR has_role(auth.uid(), 'diretor')
    OR has_role(auth.uid(), 'gerente_comercial')
    OR has_role(auth.uid(), 'coordenador_monitoramento')
    OR has_role(auth.uid(), 'analista_cadastro')
  );
```

Isso segue o mesmo padrao de roles ja usado na policy de `vistorias_evento`. Nenhuma alteracao de codigo eh necessaria -- apenas a criacao desta policy no banco de dados.

## Impacto

- Corrige o erro "Erro ao carregar vistoria" para reguladores
- Permite que o join com sinistros funcione corretamente
- Sem alteracao em arquivos de codigo, apenas migracao SQL

