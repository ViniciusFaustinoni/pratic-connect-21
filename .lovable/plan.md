

# Limpar Dados Duplicados em Benefícios

## Situacao Atual

A tabela `benefits` contem 8 itens com `category = 'cobertura'` (Alagamento, Chuva de Granizo, Colisao, Danos a Terceiros, Incendio, Perda Total, Roubo e Furto, Vidros e Farois) que sao duplicatas dos registros ja existentes na tabela `coberturas`. Nenhum desses itens esta vinculado a nenhum plano via `planos_beneficios` — portanto podem ser removidos com seguranca.

Alem disso, ha 2 itens com `category = 'assistencia'` que tambem existem na tabela `coberturas` (Assistencia 24h, Rastreador). Estes devem permanecer em `benefits` porque sao beneficios de marketing (servicos oferecidos), nao coberturas contratuais de eventos.

## Plano

### 1. Deletar beneficios duplicados
Remover da tabela `benefits` os 8 registros com `category = 'cobertura'`:

```sql
DELETE FROM benefits WHERE category = 'cobertura';
```

IDs: f957ef92, 5a9139dd, 05c7d281, 374ce067, c032f5a1, 0c2aac0a, a8a8f296, 22c15d8a

Nenhum vinculo em `planos_beneficios` sera afetado (verificado: zero links).

### 2. Nenhuma alteracao de codigo
A pagina `BeneficiosCoberturas.tsx` ja separa corretamente as abas: Coberturas le de `coberturas` e Beneficios le de `benefits`. Apos a limpeza, a aba Beneficios mostrara apenas os 8 itens reais (assistencia + extras), sem os itens de cobertura misturados.

## Resultado
- Aba Coberturas: 11 itens (da tabela `coberturas`)
- Aba Beneficios: 8 itens (4 assistencia + 4 extras, sem duplicatas)

| Acao | Tipo |
|---|---|
| `DELETE FROM benefits WHERE category = 'cobertura'` | Dado (insert tool) |

