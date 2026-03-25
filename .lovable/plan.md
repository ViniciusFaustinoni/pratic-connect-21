

# Corrigir BMW como carro e limite FIPE moto

## Problema 1: BMW classificada como moto

A config `marcas_exclusivas_moto` no banco contém `"BMW"`. Como BMW fabrica carros E motos, ela NÃO deveria estar nessa lista. O código detecta "BMW" na lista e retorna `moto` imediatamente, antes de verificar o modelo.

Além disso, `plano_elegibilidade_modelos` só tem BMW nas linhas `advanced` (moto) e `eletricos` — faltam registros para modelos de carro BMW.

## Problema 2: Limite FIPE moto = R$ 30.000

O valor `fipe_limite_autorizacao_moto` está configurado como R$ 30.000 no banco. Se a tabela de motos vai até R$ 50.000, esse valor precisa ser atualizado.

## Alterações

### 1. Migration — Remover BMW da lista de marcas exclusivas de moto

```sql
UPDATE configuracoes 
SET valor = '["HAOJUE", "SHINERAY", "SUZUKI", "KAWASAKI", "TRIUMPH", "DUCATI", "HARLEY-DAVIDSON"]'
WHERE chave = 'marcas_exclusivas_moto';
```

BMW é marca mista (carros + motos). Ao removê-la da lista, o sistema passará para a Regra 2 que consulta `plano_elegibilidade_modelos` pelo modelo específico.

### 2. Migration — Atualizar limite FIPE moto para R$ 50.000

```sql
UPDATE configuracoes 
SET valor = '50000'
WHERE chave = 'fipe_limite_autorizacao_moto';
```

### 3. `src/hooks/useDetectarTipoVeiculo.ts` — Melhorar detecção para marcas mistas

O código da Regra 1 usa `includes()` que pode dar falso positivo (ex: "BMW" dentro de "BMW Motorrad"). Ajustar para comparação exata:

```typescript
if (marcasList.some(m => marcaNorm === m)) {
  return 'moto';
}
```

Em vez do atual `marcaNorm.includes(m) || m.includes(marcaNorm)` que é muito permissivo.

### 4. Cadastrar modelos BMW carro em `plano_elegibilidade_modelos`

A Regra 2 consulta essa tabela. Hoje BMW só tem registros em `advanced` (moto) e `eletricos`. Para que modelos como "116iA" sejam corretamente identificados como carro, é necessário adicionar registros BMW nas linhas de carro (select, etc.) — ou adicionar um registro genérico:

```sql
INSERT INTO plano_elegibilidade_modelos (marca, modelo, linha_slug, is_active)
VALUES ('BMW', 'TODOS OS MODELOS NACIONAIS', 'select', true);
```

Isso garante que BMW + modelo de carro caia na linha `select` (carro) em vez de `advanced` (moto).

## Resultado

- BMW 116iA → detectado como **carro** (Regra 2 encontra registro em `select`)
- BMW G 310 GS → detectado como **moto** (Regra 2 encontra registro em `advanced`)
- Limite FIPE moto passa de R$ 30.000 para R$ 50.000
- Alerta de autorização só aparece para motos acima de R$ 50.000

