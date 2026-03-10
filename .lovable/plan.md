

# Execução: Bloco 2 — Adicionar COB-GRA e COB-PT

## Verificação feita
- Confirmado: `COB-GRA` e `COB-PT` **não existem** na tabela `coberturas`
- 9 coberturas existentes confirmadas

## Migração a executar

```sql
INSERT INTO coberturas (codigo, nome, tipo, percentual_cobertura, carencia_dias)
VALUES 
  ('COB-GRA', 'Chuva de Granizo', 'granizo', 100, 30),
  ('COB-PT',  'Perda Total',      'perda_total', 100, 30)
ON CONFLICT (codigo) DO NOTHING;
```

## Resultado esperado
- Tabela `coberturas` passará de 9 para **11 registros**
- Novos códigos: `COB-GRA` (Chuva de Granizo) e `COB-PT` (Perda Total)

## Próximo passo
Após confirmação, executar Bloco 3 (popular `planos_coberturas`) com nomes corrigidos (APLICATIVO em vez de APP).

