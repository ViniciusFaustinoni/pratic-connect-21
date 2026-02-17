

# Corrigir Fotos da Vistoria de Adesao - RLS na tabela `vistorias`

## Problema

A query de fotos faz 3 passos: `contratos` -> `vistorias` -> `vistoria_fotos`. O passo 2 falha porque a tabela `vistorias` tem uma politica SELECT que lista roles especificas e NAO inclui `analista_eventos`.

Roles com acesso atual a `vistorias`: coordenador_monitoramento, diretor, admin_master, desenvolvedor, analista_cadastro, instalador_vistoriador.

As tabelas `contratos` e `vistoria_fotos` ja funcionam (usam `is_funcionario` que retorna true para o analista).

## Solucao

Adicionar `analista_eventos` a politica SELECT existente na tabela `vistorias`. O analista precisa apenas de leitura para consultar as vistorias vinculadas aos veiculos dos sinistros.

## Alteracao

### Politica RLS: `vistorias` - "Staff and own vistoriadores can view vistorias"

Adicionar `has_role(auth.uid(), 'analista_eventos'::app_role)` como mais uma condicao OR na politica existente.

**SQL a executar:**

```sql
DROP POLICY "Staff and own vistoriadores can view vistorias" ON public.vistorias;

CREATE POLICY "Staff and own vistoriadores can view vistorias"
ON public.vistorias
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'admin_master'::app_role)
  OR has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
  OR (has_role(auth.uid(), 'instalador_vistoriador'::app_role) AND (vistoriador_id = get_my_profile_id()))
  OR (associado_id = get_my_associado_id(auth.uid()))
);
```

Nenhuma alteracao de codigo e necessaria. O hook `useSinistroAnalise` ja faz a query corretamente - o problema e exclusivamente de permissao RLS.

