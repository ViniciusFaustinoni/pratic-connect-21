
# Corrigir acesso do Analista de Eventos aos dados da vistoria do regulador

## Problema identificado

A tabela `vistorias_evento` possui uma politica RLS (Row Level Security) que nao inclui o perfil `analista_eventos` na lista de roles com permissao de SELECT. Os roles permitidos atualmente sao:

- regulador
- diretor
- gerente_comercial
- analista_cadastro
- coordenador_monitoramento

O `analista_eventos` precisa ler esses dados para realizar a analise final do sinistro (orcamento, parecer, observacoes do regulador).

## Evidencia

A query HTTP para `vistorias_evento?sinistro_id=eq.cc55af17...` retorna `[]` (array vazio) quando logado como analista de eventos, mesmo existindo um registro concluido para esse sinistro no banco.

## Alteracao necessaria

### Migration SQL

Atualizar a politica RLS de SELECT na tabela `vistorias_evento` para incluir o role `analista_eventos`:

```sql
DROP POLICY "Reguladores e gestores podem ver vistorias" ON vistorias_evento;

CREATE POLICY "Reguladores gestores e analistas podem ver vistorias"
ON vistorias_evento
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'regulador'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'gerente_comercial'::app_role)
  OR has_role(auth.uid(), 'analista_cadastro'::app_role)
  OR has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR has_role(auth.uid(), 'analista_eventos'::app_role)
);
```

Nenhuma alteracao de codigo e necessaria -- o frontend ja possui toda a logica de exibicao dos dados da vistoria (diagnostico, etapas de reparo, itens do orcamento, parecer do regulador e observacoes de perda total). O problema e exclusivamente de permissao de acesso ao banco.

## Resultado esperado

Apos a alteracao da politica RLS, o analista de eventos vera no card "Anexos do Regulador":

1. Fotos do regulador (galeria)
2. Video do regulador (se existir)
3. Diagnostico com tipo de dano e descricao tecnica
4. Etapas de reparo selecionadas
5. Itens do orcamento (pecas e servicos)
6. Parecer tecnico e recomendacao
7. Observacoes de perda total (se aplicavel)
