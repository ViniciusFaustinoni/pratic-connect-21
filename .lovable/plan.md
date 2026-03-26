
# Fix: Erro ao salvar cobertura — CHECK constraint no campo `tipo`

## Problema

A tabela `coberturas` tem um CHECK constraint que restringe o campo `tipo` a valores especificos:
`colisao`, `roubo_furto`, `incendio`, `alagamento`, `vidros`, `terceiros`, `app`, `assistencia`, `carro_reserva`, `protecao_financeira`, `rastreamento`, `morte_acidental`, `granizo`, `perda_total`.

O codigo em `CatalogoCoberturasBeneficios.tsx` tenta inserir com `tipo: 'cobertura'` (para coberturas) e `tipo: 'beneficio'` (para beneficios), ambos rejeitados pelo CHECK.

## Solucao

1. **Migration**: Alterar o CHECK constraint para incluir `'cobertura'` e `'beneficio'` como valores validos (ou remover o constraint e usar apenas a logica de aplicacao)

2. **Sem mudanca no frontend** — o codigo ja esta correto conceitualmente

### Migration SQL
```sql
ALTER TABLE coberturas DROP CONSTRAINT coberturas_tipo_check;
ALTER TABLE coberturas ADD CONSTRAINT coberturas_tipo_check 
  CHECK (tipo IN ('colisao','roubo_furto','incendio','alagamento','vidros','terceiros','app','assistencia','carro_reserva','protecao_financeira','rastreamento','morte_acidental','granizo','perda_total','cobertura','beneficio'));
```

## Arquivos
| Arquivo | Acao |
|---|---|
| Migration SQL | Atualizar CHECK constraint |

Nenhuma alteracao de codigo frontend necessaria.
