

# Aba Recorrentes em Contas a Pagar + Cron Job

## Resumo

Adicionar uma aba "Recorrentes" na tela de Contas a Pagar para cadastrar despesas fixas que se repetem (aluguel, salarios, sistemas, etc.). Criar uma edge function cron que roda diariamente e gera automaticamente as contas a pagar quando a data configurada chega.

## Etapa 1 -- Criar tabela `despesas_recorrentes`

Nova tabela no banco de dados com os campos:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | uuid (PK) | Identificador |
| fornecedor_nome | text | Nome do fornecedor |
| fornecedor_documento | text | CPF/CNPJ |
| categoria | text | Mesmas categorias de contas_pagar |
| subcategoria | text | Opcional |
| descricao | text | Ex: "Aluguel sede", "Lovable mensal" |
| valor | numeric | Valor fixo da despesa |
| frequencia | text | mensal, quinzenal, semanal, anual |
| dia_vencimento | integer | Dia do mes para gerar (1-28) |
| forma_pagamento | text | PIX, transferencia, boleto |
| banco | text | Dados bancarios opcionais |
| agencia | text | |
| conta | text | |
| pix_chave | text | |
| observacao | text | |
| ativo | boolean | Se esta ativo ou pausado |
| ultimo_lancamento | date | Data do ultimo lancamento gerado |
| proximo_lancamento | date | Proximo vencimento calculado |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: habilitar com policy para usuarios autenticados (perfis financeiro e diretor).

## Etapa 2 -- Componente `DespesaRecorrenteModal`

Novo arquivo: `src/components/financeiro/DespesaRecorrenteModal.tsx`

Modal para criar/editar despesas recorrentes com campos:
- Fornecedor (nome + documento)
- Categoria (select, mesmas opcoes de contas_pagar)
- Descricao
- Valor (R$)
- Frequencia (mensal, quinzenal, semanal, anual)
- Dia do vencimento (1-28)
- Forma de pagamento + dados bancarios/PIX
- Observacao

Segue o mesmo padrao visual do `NovaContaPagarModal.tsx`.

## Etapa 3 -- Adicionar aba "Recorrentes" em `ContasPagar.tsx`

Modificar `src/pages/financeiro/ContasPagar.tsx`:

- Mover as tabs existentes (Todas, Pendentes, Vencidas, Pagas, Canceladas) para ficarem dentro de uma aba "Contas"
- Adicionar nova aba de nivel superior: **Contas** | **Recorrentes**
- Na aba "Recorrentes":
  - Botao "+ Nova Despesa Recorrente"
  - Tabela com colunas: Descricao, Fornecedor, Categoria, Valor, Frequencia, Proximo Vencimento, Status (ativo/inativo), Acoes
  - Acoes: Editar, Pausar/Ativar, Gerar agora (cria conta imediatamente), Excluir
  - Query em `despesas_recorrentes` ordenada por `proximo_lancamento`

## Etapa 4 -- Edge Function `cron-gerar-despesas-recorrentes`

Novo arquivo: `supabase/functions/cron-gerar-despesas-recorrentes/index.ts`

Logica:
1. Buscar todas as despesas recorrentes onde `ativo = true` e `proximo_lancamento <= hoje`
2. Para cada uma, inserir em `contas_pagar`:
   - Copiar fornecedor, categoria, valor, forma de pagamento
   - `data_vencimento` = `proximo_lancamento`
   - `referencia_tipo` = `despesa_recorrente`
   - `referencia_id` = id da despesa recorrente
   - `observacao` = descricao + " (recorrente)"
   - `status` = `pendente`
3. Atualizar `despesas_recorrentes`:
   - `ultimo_lancamento` = hoje
   - `proximo_lancamento` = calcular proximo baseado na frequencia (mensal: +1 mes, quinzenal: +15 dias, semanal: +7 dias, anual: +1 ano)
4. Retornar contagem de contas geradas

Adicionar ao `supabase/config.toml`:
```
[functions.cron-gerar-despesas-recorrentes]
verify_jwt = false
```

## Etapa 5 -- Agendar Cron Job

Executar SQL para agendar a edge function diariamente as 6h (usando `pg_cron` + `pg_net`):

```sql
select cron.schedule(
  'gerar-despesas-recorrentes-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-gerar-despesas-recorrentes',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
```

## Arquivos Criados/Modificados

| Arquivo | Acao |
|---------|------|
| Migracao SQL (tabela `despesas_recorrentes`) | Criar |
| `src/components/financeiro/DespesaRecorrenteModal.tsx` | Criar |
| `src/pages/financeiro/ContasPagar.tsx` | Modificar (adicionar aba) |
| `supabase/functions/cron-gerar-despesas-recorrentes/index.ts` | Criar |
| `supabase/config.toml` | Modificar (adicionar funcao) |
| SQL insert para `cron.schedule` | Executar |

## Detalhes Tecnicos

- A tabela `despesas_recorrentes` e separada de `contas_pagar` porque sao conceitos diferentes: uma e o template, outra e o lancamento real
- O campo `dia_vencimento` e limitado a 28 para evitar problemas com meses de 28/29/30/31 dias
- O cron roda diariamente mas so gera se `proximo_lancamento <= hoje`, entao nao duplica
- A acao "Gerar agora" na UI permite forcar a geracao fora do horario do cron
- Despesas pausadas (`ativo = false`) sao ignoradas pelo cron

