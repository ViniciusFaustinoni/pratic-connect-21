

# Restringir planos Especial/Select por faixa de ano

## Diagnóstico

É um problema **de código E de configuração** combinados:

1. **O campo `ano_fabricacao_maximo` existe no banco** (tabela `planos`) mas o motor de cotação (`usePlanosCotacao.ts`) **nunca o consulta** — só verifica ano mínimo
2. **Os planos Especial não têm ano máximo configurado** — `ano_fabricacao_maximo` está NULL, então mesmo que o código verificasse, não filtraria nada

Resultado: um veículo 2020 passa no `ano_minimo: 2002` do Especial e no `ano_minimo: 2005` do Select — ambos aparecem.

## Regra de negócio esperada

| Linha | Faixa de ano |
|---|---|
| Select / Select One | 2005 em diante |
| Especial | 2002 – 2004 |
| Especial Plus | 2002 – 2004 |
| Lançamento | 2024 em diante |

## Alterações

### 1. `src/hooks/usePlanosCotacao.ts` — Respeitar `ano_fabricacao_maximo`

Na linha ~444 onde já verifica `anoMinimo`, adicionar verificação do campo `ano_fabricacao_maximo`:

```
const anoMaximo = plano.ano_fabricacao_maximo || null;
if (anoMaximo && anoVeiculoNum > anoMaximo) continue;
```

Isso já resolve para qualquer plano que tenha o campo preenchido.

### 2. Configuração no banco — Definir teto dos planos Especial

Executar UPDATE para definir `ano_fabricacao_maximo = 2004` nos planos Especial e Especial Plus:

```sql
UPDATE planos SET ano_fabricacao_maximo = 2004 
WHERE codigo IN ('especial', 'especial-plus');
```

### 3. Admin UI — Expor campo "Ano Máximo" no formulário de planos

Verificar se o `PlanFormModal` já exibe o campo `ano_fabricacao_maximo`. Se não, adicionar input numérico ao lado do campo "Ano Mínimo" para que a diretoria possa configurar essa restrição sem SQL.

## Resultado

- Veículos 2005+ verão apenas Select, Select One, Lançamento (se 2024+)
- Veículos 2002-2004 verão apenas Especial e Especial Plus
- Qualquer futura linha com faixa restrita poderá usar o mesmo campo

2 arquivos de código + 1 UPDATE no banco.

