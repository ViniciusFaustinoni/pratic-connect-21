

# Plano: Aditivo de Blindados com Detecção Automática via CRLV OCR

## O que será feito

1. **OCR do CRLV detecta blindagem** — O campo "Observações" do CRLV frequentemente contém "BLINDADO" ou "BLINDAGEM". O prompt do `document-ocr` será atualizado para extrair esse dado como `blindado: true/false`.

2. **Nova regra de aditivo: `veiculo_blindado`** — Adicionada ao sistema de regras dos aditivos, ao lado de `veiculo_0km`, `fipe_acima_de` e `evento_vidros`. O motor de avaliação (`avaliarRegraEdge`) verificará `veiculo.blindado === true`.

3. **Criar o registro do aditivo no banco** — Inserir o "Termo Aditivo de Veículo Blindado" na tabela `termos_aditivos` com o conteúdo HTML extraído do PDF enviado, com a regra `veiculo_blindado` ativa.

4. **Propagar `blindado` do OCR para o veículo** — Quando o CRLV for processado e `blindado: true`, o campo `blindado` do veículo será marcado automaticamente.

## Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/document-ocr/index.ts` | Adicionar `blindado` ao prompt de extração do CRLV |
| `supabase/functions/_shared/template-utils.ts` | Adicionar case `veiculo_blindado` em `avaliarRegraEdge` |
| `src/hooks/useAditivos.ts` | Adicionar `veiculo_blindado` ao tipo `RegraAditivo` |
| `src/pages/documentos/AditivoForm.tsx` | Adicionar `veiculo_blindado` aos `TIPOS_REGRA` |
| `src/pages/documentos/Aditivos.tsx` | Adicionar label no `REGRA_LABELS` |
| `src/hooks/useNewLeadFlow.ts` | Propagar `blindado` do OCR para dados do veículo |
| Inserção no banco (`termos_aditivos`) | Conteúdo HTML do aditivo blindado com regra ativa |

## Conteúdo do aditivo (extraído do PDF)

As 6 cláusulas do documento serão convertidas em HTML estruturado com variáveis dinâmicas para dados do associado/veículo/empresa (usando `{{variavel}}`), mantendo a formatação do documento original.

## Fluxo resultante

```text
CRLV Upload → OCR detecta "BLINDADO" nas observações
  → veiculo.blindado = true
  → Na geração do Autentique (Proposta de Filiação):
     buscarEGerarAditivos() avalia regra veiculo_blindado
     → Aditivo de Blindados é anexado automaticamente ao documento
```

