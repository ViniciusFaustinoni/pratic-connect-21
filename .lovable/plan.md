

## Plano: Detecção de blindado via OCR + aditivo + aprovação da diretoria

### Problema atual

O OCR do CRLV já extrai o campo `blindado` (true/false), mas o sistema **ignora** esse dado em dois pontos críticos:
1. **CotacaoPublicaCompleta.tsx** — ao processar o CRLV, salva apenas a cor, descartando o campo `blindado`
2. **autentique-create** — ao buscar dados do veículo no banco, não inclui `blindado` na query, então o aditivo de blindados nunca é anexado

Além disso, a tabela `cotacoes` **não possui** coluna `blindado`, então não há onde persistir a informação durante o fluxo público.

### Alterações

#### 1. Migration: Adicionar coluna `veiculo_blindado` na tabela `cotacoes`
```sql
ALTER TABLE cotacoes ADD COLUMN veiculo_blindado boolean DEFAULT false;
```

#### 2. CotacaoPublicaCompleta.tsx — Salvar `blindado` extraído do CRLV
Quando o OCR do CRLV retorna, além de salvar a cor, salvar `veiculo_blindado`:
```typescript
await atualizarCotacao.mutateAsync({
  token,
  updates: {
    veiculo_cor: dados.cor || undefined,
    veiculo_blindado: dados.blindado === 'true' || dados.blindado === true,
  },
});
```
Se `blindado === true`, exibir alerta informativo ao cliente.

#### 3. Aplicar regra de aprovação da diretoria (mesma regra de FIPE alta)
No fluxo de contratação, quando `veiculo_blindado === true`:
- Verificar se `restricao_blindado_absoluta` está ativa — se sim, bloquear absolutamente
- Se não for absoluta, aplicar a mesma regra de **dupla aprovação da diretoria** (mesmo mecanismo usado para FIPE alta), criando registro em `aprovacoes_excecao` com `motivo_bloqueio: 'Veículo blindado'`

Isso será tratado no mesmo ponto onde o FIPE alto é verificado no fluxo público (etapa de assinatura).

#### 4. autentique-create — Incluir `blindado` na query do veículo
Em **ambos** `autentique-create/index.ts` e `autentique-create-by-token/index.ts`, adicionar `blindado` ao `select` da query de veículos:
```typescript
.select('flag_placa_vermelha, flag_ex_taxi, ..., blindado')
```

#### 5. termo-afiliacao-utils.ts — Mapear `blindado` no objeto veículo
Na função `mapearDadosParaTemplate`, adicionar:
```typescript
blindado: contrato.veiculo_blindado || veiculoDB?.blindado || false,
```

Isso garante que `avaliarRegraEdge` com tipo `veiculo_blindado` retorne `true` e o aditivo de blindados seja anexado automaticamente ao termo.

#### 6. UnifiedDocumentUploader.tsx — Salvar `blindado` no veículo (fluxo interno)
No processamento do CRLV pelo uploader unificado (contratos internos), quando `blindado` for detectado, atualizar o veículo no banco:
```typescript
if (dadosLimpos.blindado === 'true') updateData.blindado = true;
```

### Resumo do fluxo completo após correção
1. Cliente envia CRLV → OCR detecta `blindado: true`
2. Sistema salva `veiculo_blindado = true` na cotação
3. Na etapa de assinatura, sistema verifica:
   - Se `restricao_blindado_absoluta` = true → bloqueia absolutamente
   - Se não → cria aprovação pendente da diretoria (mesma regra de FIPE alta)
4. Após aprovação, ao gerar o documento Autentique, o aditivo de blindados é anexado automaticamente

### Escopo
- 1 migration (1 coluna)
- 6 arquivos editados
- 0 edge functions novas (apenas edição das existentes)

