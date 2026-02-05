

# Plano: Corrigir Bug e Habilitar Rastreamento Rede Veículos

## Problemas Identificados

| Problema | Local | Impacto |
|----------|-------|---------|
| Coluna `cnpj` inexistente | `sync-rastreadores` linha 430 | Edge function falha ao executar |
| `suporta_posicao_tempo_real = false` | Tabela `rastreadores_config_plataformas` | Bloqueia busca de posição em tempo real |
| `suporta_historico_trajeto = false` | Tabela `rastreadores_config_plataformas` | Bloqueia consulta de histórico |

---

## Correção 1: Bug da Coluna `cnpj`

### Arquivo
`supabase/functions/sync-rastreadores/index.ts`

### Problema
```typescript
// Linha 430 - ERRO: coluna 'cnpj' não existe na tabela 'associados'
veiculo:veiculos(
  placa, chassi,
  associado:associados(cpf, cnpj)  // ← cnpj NÃO EXISTE!
)
```

### Solução
```typescript
// Remover 'cnpj' da query - tabela associados só tem 'cpf'
veiculo:veiculos(
  placa, chassi,
  associado:associados(cpf)  // ← Apenas 'cpf'
)
```

### Arquivos a Modificar
Verificar e corrigir em TODAS as edge functions que fazem essa query incorreta:

1. **sync-rastreadores/index.ts** (linha 430)
2. Possivelmente outras funções que fazem joins similares

---

## Correção 2: Habilitar Posição em Tempo Real

### Tabela
`rastreadores_config_plataformas`

### Query SQL
```sql
UPDATE rastreadores_config_plataformas
SET 
  suporta_posicao_tempo_real = true,
  suporta_historico_trajeto = true,
  updated_at = NOW()
WHERE plataforma = 'rede_veiculos';
```

### Impacto
Após esta atualização, as edge functions `rastreador-posicao` e `rastreador-historico` passarão a fazer chamadas à API da Rede Veículos em vez de retornar apenas dados do cache local.

---

## Correção 3: Ajustar Lógica de CPF/CNPJ

### Problema Adicional
Na linha 310 do `sync-rastreadores`, o código tenta acessar `cnpj` que não existe:

```typescript
const cpfCnpj = rast.veiculo?.associado?.cnpj || rast.veiculo?.associado?.cpf || '';
```

### Solução
```typescript
// Apenas CPF existe na tabela associados
const cpfCnpj = rast.veiculo?.associado?.cpf || '';
```

---

## Arquivos a Modificar

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `supabase/functions/sync-rastreadores/index.ts` | Remover `cnpj` da query e da lógica | 430, 310 |
| Tabela `rastreadores_config_plataformas` | UPDATE via SQL | - |

---

## Fluxo Após Correção

```text
1. Edge function sync-rastreadores executa sem erro
2. Busca rastreadores instalados com associados.cpf
3. Para cada rastreador Rede Veículos:
   a. Obtém IMEI/placa do rastreador
   b. Obtém CPF do associado vinculado
   c. Chama POST /obterUltimaPosicaoValida/
   d. Atualiza posição no banco
4. Posição em tempo real funciona para veículos vinculados
```

---

## Teste Após Correção

O rastreador com IMEI `865011031150387` está em **estoque** (sem veículo/associado vinculado), então não retornará posição mesmo após a correção.

**Para testar posição em tempo real:**
1. Vincular o rastreador a um veículo que tenha associado com CPF
2. OU usar outro rastreador Rede Veículos já instalado

---

## Estimativa de Tempo

| Tarefa | Tempo |
|--------|-------|
| Corrigir query sync-rastreadores | 5 min |
| Atualizar configuração plataforma | 2 min |
| Deploy edge function | Automático |
| Testar com rastreador vinculado | 5 min |
| **Total** | **~12 min** |

