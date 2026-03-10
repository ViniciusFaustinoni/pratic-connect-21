

# Plano: Corrigir planos elétricos na Gestão de Planos

## Diagnóstico

Existem **3 problemas** que impedem os planos elétricos de aparecer:

| Problema | Estado atual | Correção |
|---|---|---|
| Sem entrada em `product_lines` | Não existe "Linha Elétrico" | Criar registro |
| Plano desativado e sem vínculo | `ativo=false`, `product_line_id=NULL` | Ativar e vincular |
| Sem `plano_preco_map` | Nenhum mapeamento de preço | Criar vínculo com `linha_slug='eletrico'` |
| Sem benefícios vinculados | 0 registros em `planos_beneficios` | Vincular os benefícios listados no campo `coberturas` |

O plano "ELÉTRICOS" já existe no banco (`ab31c6c6...`) com coberturas definidas no campo texto, mas está inativo, sem product_line e sem benefícios na tabela relacional. Os 60 registros de preço já estão corretos em `tabelas_preco_mensalidade`.

## Correção (Migration SQL única)

1. **Inserir** "Linha Elétrico" em `product_lines` com `slug='eletrico'`, `vehicle_type='car'`
2. **Ativar** o plano existente (`ativo=true`) e setar seu `product_line_id` para a nova linha
3. **Inserir** entrada em `plano_preco_map` vinculando o plano ao `linha_slug='eletrico'`
4. **Inserir** benefícios em `planos_beneficios` para os 11 itens listados no campo `coberturas` do plano (Roubo e Furto, Colisão, Perda Total, etc.)

Nenhuma alteração de código frontend necessária -- a UI já renderiza dinamicamente baseada em `product_lines` e `planos`.

