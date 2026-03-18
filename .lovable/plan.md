

## Plano: Substituir checkboxes hardcoded por variáveis dinâmicas no template

### Problema
O template "Proposta de Filiação" (código `AF1`, id `eb09759f-...`) armazenado na tabela `documento_templates` tem os checkboxes de tipo de operação **hardcoded como `( )`**:

```
( ) Adesão - ( ) Migração - ( ) Inclusão - ( ) Troca de Titularidade - ( ) Reativação -
() Subs. Placa (o veíc. terá a cob. do PSM cancelada)
```

A lógica de resolução de variáveis `{{operacao.adesao}}`, `{{operacao.migracao}}` etc. já existe em `template-utils.ts` (linhas 120-126) e o `tipo_entrada` do contrato já é mapeado corretamente em `mapearDadosParaTemplate`. O único problema é que o template não usa essas variáveis.

### Alteração

Executar um `UPDATE` na tabela `documento_templates` para substituir os `( )` hardcoded pelas variáveis dinâmicas correspondentes no conteúdo HTML do template `AF1`:

| Texto atual | Variável correta |
|---|---|
| `( ) Adesão` | `{{operacao.adesao}} Adesão` |
| `( ) Migração` | `{{operacao.migracao}} Migração` |
| `( ) Inclusão` | `{{operacao.inclusao}} Inclusão` |
| `( ) Troca de Titularidade` | `{{operacao.troca_titularidade}} Troca de Titularidade` |
| `( ) Reativação` | `{{operacao.reativacao}} Reativação` |
| `() Subs. Placa` | `{{operacao.substituicao_placa}} Subs. Placa` |

Será feito via SQL `UPDATE` diretamente no banco, usando `REPLACE` encadeado no campo `conteudo`.

### Resultado
Ao gerar o documento, o sistema preencherá automaticamente `(X)` no tipo de operação correspondente ao `tipo_entrada` do contrato (ex: adesão, migração, etc.) e `( )` nos demais.

