

# Correção: Rateio não funcional para o Diretor

## Diagnóstico

### Problema 1: RLS errada na tabela `rateios_detalhes_faixas`

A policy de SELECT usa `p.id = auth.uid()` — mas `profiles.id` é um UUID interno, diferente de `auth.uid()`. O campo correto é `p.user_id = auth.uid()`. Isso impede o diretor de ver os detalhes por faixa FIPE.

```text
Atual (ERRADO):  WHERE p.id = auth.uid()
Correto:         WHERE p.user_id = auth.uid()
```

Além disso, essa policy verifica `p.tipo = 'funcionario'`, mas não verifica se é diretor. O ideal é usar `is_gerencia(auth.uid())` como as outras tabelas de rateio.

### Problema 2: Página mostra vazia no mês atual (março 2026)

A query busca rateio pelo mês/ano atual. Só existe 1 registro (fevereiro 2026, com zeros). Como não há rateio de março, a página mostra apenas o alerta "Nenhum rateio calculado" — sem nenhuma informação útil.

A página precisa mostrar o **último rateio disponível** quando não há rateio para o mês atual, e permitir calcular o mês corrente.

### Problema 3: Tabela `configuracoes_historico` não existe

A tela de configuração do rateio (`/configuracoes/rateio`) tenta ler e gravar na tabela `configuracoes_historico` via REST, mas essa tabela nunca foi criada. O histórico de alterações sempre aparece vazio.

## Plano de Correção

### Fase 1: Migration — corrigir RLS e criar tabela de histórico

1. **Corrigir** a policy SELECT de `rateios_detalhes_faixas`: trocar por `is_gerencia(auth.uid())`
2. **Criar** tabela `configuracoes_historico` com RLS para gerência

### Fase 2: Melhorar RateioSinistros.tsx

- Quando não há rateio do mês atual, mostrar o **último rateio disponível** como referência (com indicação visual de que é de outro mês)
- Manter o botão "Calcular Rateio" para o mês corrente
- Mostrar KPIs resumidos mesmo quando o rateio tem valores zerados (em vez de esconder)

### Fase 3: Corrigir RateioConfig.tsx (histórico)

- A lógica de leitura/gravação via REST já funciona — só precisa da tabela existir

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/migrations/` | RLS fix + criar `configuracoes_historico` |
| `src/pages/diretoria/RateioSinistros.tsx` | Mostrar último rateio quando atual não existe |

