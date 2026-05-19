# Plano — Confirmação de dados extraídos da CNH antes de seguir

## Objetivo
Impedir que erros do OCR (ex.: `LOPWS` em vez de `LOPES`) cheguem ao contrato Autentique e ao cadastro do associado. Toda extração de CNH passa a exigir uma etapa de **revisão e confirmação humana** com os campos editáveis, lado a lado com a imagem enviada.

## Onde isso entra no fluxo
A etapa é inserida **imediatamente após o retorno do OCR**, antes de qualquer:
- gravação em `associados` / `contratos`,
- chamada à `contrato-gerar`,
- avanço de step no link público.

Vale para os dois pontos de entrada de CNH:
1. **Link público** (cotação nova, inclusão, troca de titularidade) — etapa de documentos pessoais.
2. **Modal interno** (Cadastro / Vendedor lançando manualmente) — mesmo passo dentro do `CotacaoFormDialog` / fluxos correlatos.

## Comportamento da tela
- Layout em duas colunas:
  - **Esquerda:** preview da foto da CNH enviada (frente + verso quando houver), com zoom.
  - **Direita:** formulário editável com os campos extraídos pelo OCR — **Nome, CPF, RG, Data de nascimento, CNH (número), Categoria, Validade, Nome da mãe** (quando vier).
- Cada campo mostra um pequeno indicador de "confiança" do OCR (quando o provedor retorna `confidence`):
  - alto (≥0.9): borda neutra,
  - médio (0.7–0.9): borda âmbar + tooltip "Revise",
  - baixo (<0.7) ou caractere improvável detectado: borda vermelha + foco automático.
- Heurística de "caractere improvável" no nome: regex que sinaliza combinações praticamente inexistentes em PT-BR (`PW`, `WX`, `KQ`, `ZX`, dois consoantes raras seguidas, etc.) e força revisão.
- Validações antes de habilitar "Confirmar":
  - Nome: mínimo 2 palavras, só letras/espaços/acentos/hífen/apóstrofo.
  - CPF: dígito verificador válido.
  - Data nasc: idade entre 18 e 100.
  - CNH: 11 dígitos; validade ≥ hoje.
- Botões: **Voltar** (re-tirar foto / re-upload) e **Confirmar e continuar**.

## Cross-check com SGA (complemento barato)
Quando o CPF informado já existir no SGA / `associados`, o nome canônico do SGA é exibido como sugestão acima do campo Nome ("Cadastro existente: EDER LOPES SOARES — usar este"). Um clique substitui. Reduz drasticamente o erro nos fluxos de inclusão/troca.

## Auditoria
Nova tabela leve `ocr_revisoes` (ou coluna JSONB em `contratos_documentos.metadata`) gravando:
- `valores_ocr` (bruto retornado),
- `valores_confirmados` (o que o usuário salvou),
- `campos_alterados` (diff),
- `revisado_por`, `revisado_em`, `origem` (link_publico / interno).

Serve para medir taxa real de erro do OCR e priorizar melhorias futuras (pré-processamento de imagem, troca de provedor, etc.).

## Arquivos previstos
- **Novo componente:** `src/components/ocr/ConfirmarDadosCNHDialog.tsx` (compartilhado entre link público e interno).
- **Novo hook:** `src/hooks/useConfirmarDadosCNH.ts` (validações + diff + heurística de plausibilidade).
- **Integração no link público:** ajustar o step de documentos pessoais (provavelmente em `src/pages/publico/...` — confirmar no momento da implementação) para abrir o dialog antes de avançar.
- **Integração interna:** ajustar `CotacaoFormDialog.tsx` / fluxos de inclusão e troca para chamar o mesmo dialog após OCR.
- **Edge function:** pequeno ajuste em `ocr-cnh` (ou equivalente) para devolver `confidence` por campo quando o provedor suportar.
- **Migration:** criar `ocr_revisoes` com RLS (insert restrito a authenticated/anon do link público, select para Cadastro/Diretoria).
- **Memória:** novo `mem://logic/operations/ocr-cnh-confirmacao-obrigatoria` documentando a regra.

## Fora de escopo (proposta para depois)
- Pré-processamento de imagem (deskew, threshold) — melhoria de acurácia do OCR em si.
- Troca/benchmark de provedor de OCR.
- Confirmação equivalente para CRLV (pode vir num plano separado seguindo o mesmo padrão).

## Resultado esperado
- Zero contrato gerado com nome corrompido por OCR.
- Erros tipo `LOPWS` ficam visíveis e corrigíveis em segundos, com 1 clique quando o CPF já existe no SGA.
- Histórico mensurável de qualidade do OCR para decidir próximos investimentos.
