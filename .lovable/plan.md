

# Corrigir sistema de imprevistos — cron crashando por enum inválido

## Diagnóstico

Encontrei a causa raiz nos logs do Supabase:

```text
[cron-reagendamento] Erro: invalid input value for enum tipo_servico: "vistoria_adesao"
```

O cron `cron-reagendamento-automatico` **crasha na Parte 2** porque filtra por tipos de serviço que **não existem no enum** do banco. O enum real é:

| Enum real (`tipo_servico`) | O que o cron usa (errado) |
|---|---|
| `instalacao` | `instalacao` (OK) |
| `vistoria_entrada` | `vistoria_adesao` (ERRADO) |
| `vistoria_saida` | `vistoria_transferencia` (ERRADO) |
| `vistoria_sinistro` | `vistoria_substituicao` (ERRADO) |
| `vistoria_periodica` | `revistoria` (ERRADO) |
| `vistoria_