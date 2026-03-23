

# Plano: Corrigir Template `prestador_nova_instalacao_v1` Rejeitado

## Problema

O template foi rejeitado pela Meta por dois motivos:
1. **Sem `variaveis_exemplo`** — a Meta exige exemplos para cada variavel
2. **Corpo termina com texto fixo generico** — a Meta rejeita textos que parecem spam ou que nao identificam a empresa

## Correcao

### Migration SQL

Atualizar o template no banco com:

**Corpo revisado** — adicionar identificacao da empresa antes do rodape, e mover o aviso de mensagem automatica para o campo `rodape` (que e o campo correto para isso):

```
Olá {{1}}! Nova instalação atribuída pela Praticcar.

Associado: {{2}}
Município: {{3}}
Endereço: {{4}}
Data prevista: {{5}}

Acesse os detalhes e confirme pelo link:
{{6}}

Equipe Praticcar.
```

**Rodape**: `Pratic Car - Proteção Veicular` (mesmo padrao dos templates aprovados)

**Variaveis exemplo**:
```json
{
  "1": "Auto Elétrica Silva",
  "2": "João Carlos",
  "3": "Araruama",
  "4": "Rua das Flores, nº 123, Centro, Araruama, RJ",
  "5": "25/03/2026",
  "6": "https://pratic-connect-21.lovable.app/prestador/instalacao/abc123token"
}
```

**Status**: voltar para `DRAFT` para reenvio

### Arquivo afetado

| Arquivo | Alteracao |
|---|---|
| DB migration | UPDATE corpo, rodape, variaveis_exemplo, status do template |

Nenhuma alteracao de codigo — apenas correcao do template no banco. Apos a migration, o operador reenvia pelo painel existente.

