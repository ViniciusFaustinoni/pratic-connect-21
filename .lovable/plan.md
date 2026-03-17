

## Plano: Nova aba "Autorizações e Exceções" em Regras de Venda

### Estado atual

- A página `RegrasVenda.tsx` já tem 4 abas (Pontuação, Repasse Maior, Migração, Taxas e Adesão) — ~879 linhas.
- Configurações existentes no banco relevantes: `fipe_limite_autorizacao` (120000), `aceitar_blindado` (autorizar), `perfil_veiculo_fipe_maximo` (500000).
- Não existem chaves para: faixas de vendas/exceções, limite FIPE motos, exceção zero km, exceção histórico boletos, mudança de linha, depreciação 100%.
- A tabela `aprovacoes_elegibilidade` já existe para aprovações de planos — o sistema de verificação de limite de solicitações se integrará a ela.

### Alterações

#### 1. Inserir novas chaves em `configuracoes` (via insert tool)

| Chave | Valor | Descrição |
|---|---|---|
| `excecao_faixas_vendas` | `[{"min":0,"max":9,"permitidas":0},{"min":10,"max":19,"permitidas":1},{"min":20,"max":29,"permitidas":2},{"min":30,"max":null,"permitidas":3}]` | Faixas de vendas e solicitações de exceção permitidas por mês |
| `excecao_fipe_max_carro` | `120000` | Valor máximo FIPE para carros em exceções |
| `excecao_fipe_max_moto` | `27000` | Valor máximo FIPE para motos em exceções |
| `excecao_historico_boletos_ativo` | `true` | Permitir exceção para associado ativo com histórico |
| `excecao_historico_boletos_minimo` | `6` | Quantidade mínima de boletos para exceção |
| `excecao_zero_km_ativo` | `true` | Permitir exceção para veículo 0km com NF |
| `restricao_mudanca_linha` | `true` | Bloquear mudança de linha de produto |
| `restricao_depreciacao_cobertura_100` | `true` | Bloquear depreciado em plano 100% |
| `restricao_blindado_absoluta` | `true` | Bloquear blindados em qualquer hipótese |

O campo `excecao_faixas_vendas` armazena JSON com as faixas editáveis. Isso evita criar uma tabela separada para poucas linhas fixas.

#### 2. Adicionar 5ª aba em `RegrasVenda.tsx`

Nova tab "Autorizações e Exceções" com ícone `ShieldCheck`:

- **BLOCO 1** — Tabela editável inline com colunas: Vendas Mín, Vendas Máx, Solicitações Permitidas. Dados vêm do JSON `excecao_faixas_vendas`. Linhas fixas (não adiciona/remove), apenas edita valores.
- **BLOCO 2** — Campo monetário: `excecao_fipe_max_carro`
- **BLOCO 3** — Campo monetário: `excecao_fipe_max_moto`
- **BLOCO 4** — 2 toggles (`excecao_historico_boletos_ativo`, `excecao_zero_km_ativo`) + campo condicional `excecao_historico_boletos_minimo`
- **BLOCO 5** — 3 toggles (restrições absolutas), todos iniciam ativados
- Botão "Salvar configurações"

Estado local + fetch das 9 chaves via `useQuery` (mesmo padrão das taxas).

#### 3. Hooks em `useConteudosSistema.ts`

Adicionar hooks para consumo nos motores de cotação/validação:
```typescript
export function useExcecaoFipeLimites()
export function useRestricoesAbsolutas()
export function useExcecaoFaixasVendas()
```

#### 4. Validação no fluxo de exceção existente (`useAprovacaoElegibilidade.ts`)

Na mutation `solicitarExcecao`, antes de inserir em `aprovacoes_elegibilidade`:
1. Contar solicitações do consultor no mês corrente
2. Buscar vendas confirmadas do mês anterior
3. Ler `excecao_faixas_vendas` e encontrar a faixa correspondente
4. Bloquear se limite atingido
5. Verificar restrições absolutas (blindado, depreciação, mudança de linha) e bloquear antes de qualquer solicitação

### Arquivos alterados

1. **`configuracoes`** — 9 novas chaves (insert tool)
2. **`src/pages/diretoria/RegrasVenda.tsx`** — nova aba com 5 blocos
3. **`src/hooks/useConteudosSistema.ts`** — 3 novos hooks
4. **`src/hooks/useAprovacaoElegibilidade.ts`** — validação de limites na mutation

