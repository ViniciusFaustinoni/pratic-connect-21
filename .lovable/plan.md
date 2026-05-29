# Limpeza: MOTO_KEYWORDS órfão em `aprovar-proposta`

## Contexto

Auditoria confirmou que `MOTO_KEYWORDS` (linhas 16–27) e `detectarTipoVeiculo` (linhas 29–43) em `supabase/functions/aprovar-proposta/index.ts` são código morto funcional. A decisão real (precisa rastreador? qual cobertura? qual checklist?) já é tomada pela RPC `fn_veiculo_precisa_rastreador` (linha 524), que é a fonte canônica compartilhada com triggers e UI.

O único uso restante do `tipoVeiculo` local é a interpolação `${tipoVeiculo}` na string do `console.log` da linha 545. Nada consulta esse texto:

- Não vai pra `logs_auditoria`
- Não vai pra `ocr_execution_logs` (o `tipo_detectado` daquela tabela é de documentos, não de veículo)
- Não é retornado na resposta da edge
- Não alimenta nenhuma tela/relatório

## Mudanças

Arquivo único: `supabase/functions/aprovar-proposta/index.ts`

1. **Deletar** o array `MOTO_KEYWORDS` (linhas 16–27).
2. **Deletar** a função `detectarTipoVeiculo` local (linhas 29–43).
3. **Deletar** o bloco `const tipoVeiculo = detectarTipoVeiculo(...)` (linhas 531–533).
4. **Ajustar** o `console.log` da linha 545: trocar `(${tipoVeiculo}, FIPE R$${valorFipe})` por `(FIPE R$${valorFipe})`. Mantém placa, flag `precisaRastreador`, `instalacaoJaConcluida` e `statusVeiculo` — que são os campos com valor operacional real.
5. **Remover** menção a `detectarTipoVeiculo` no comentário da linha 516 (`A heurística local (detectarTipoVeiculo + precisaRastreador)...`) para refletir que a heurística local não existe mais — manter a justificativa histórica do caso Honda ADV 150 que motivou a migração para a RPC.

## Fora de escopo

- `src/data/vistoriaConfigCompleta.ts` — `MOTO_KEYWORDS` e `detectarTipoVeiculo` do **front** seguem em uso ativo por ~10 consumidores (hooks de aprovação, vistoria pública, instalador, contratação). Não tocar.
- Qualquer outra edge function. A auditoria mostrou `MOTO_KEYWORDS` apenas em `aprovar-proposta` no diretório `supabase/functions/`.
- RPC `fn_veiculo_precisa_rastreador` e `marcasExclusivasMoto` — permanecem como estão.

## Validação pós-mudança

- `rg "MOTO_KEYWORDS|detectarTipoVeiculo" supabase/functions/aprovar-proposta/` deve retornar vazio.
- Edge continua compilando (sem referências pendentes ao símbolo removido).
- Log da linha 545 continua legível e contém placa + FIPE + flags de decisão.
