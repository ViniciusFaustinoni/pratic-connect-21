
# Plano: Corrigir erro ao salvar Agência — enum `tipo_usuario`

## Problema

O enum `tipo_usuario` no banco tem apenas 3 valores: `funcionario`, `associado`, `prestador`. O formulário envia `tipo: 'agencia'` que o Postgres rejeita com erro 400.

## Solução

### 1. Migration — Adicionar `agencia` ao enum

```sql
ALTER TYPE public.tipo_usuario ADD VALUE IF NOT EXISTS 'agencia';
```

Isso é tudo. Nenhuma alteração de código necessária — o formulário já envia o valor correto, só falta o banco aceitar.

## Arquivo afetado

| Arquivo | Alteração |
|---|---|
| Migration SQL | Adicionar valor `agencia` ao enum `tipo_usuario` |
