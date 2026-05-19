# Plano — Confirmação obrigatória de CNH + cross-check com SGA (opção B)

## Por que esse escopo
Já existe `src/components/ocr/OcrDadosEditor.tsx` editando todos os campos da CNH com badge de confiança e modo de edição forçada. O problema do caso "EDER LOPWS SOARES" é que:

1. O editor **não bloqueia o avanço** — só abre sozinho quando campos essenciais vieram vazios; se o nome veio "preenchido" (mesmo errado), o usuário passa direto.
2. Não há **heurística de plausibilidade** no nome para forçar revisão de combinações improváveis em PT-BR (`PW`, `WX`, etc.).
3. Não há **cross-check com SGA**: quando o CPF já existe em `associados`, deveríamos sugerir o nome canônico com 1 clique.

Esta proposta resolve exatamente esses três pontos, reaproveitando o editor que já existe — sem migration nova, sem nova edge function.

## Mudanças

### 1. Heurística de plausibilidade no nome (frontend puro)
Novo utilitário `src/lib/ocr/nomePlausibilidade.ts`:
- Função `temCombinacaoImprovavel(nome)` que detecta bigramas raríssimos em PT-BR: `PW`, `WX`, `KQ`, `QZ`, `ZX`, `XJ`, dois `W` no interior, `Y` em meio de palavra fora de "Y final", etc.
- Função `validarNomeOCR(nome)` retornando `{ ok, motivo }` com regras: ≥2 palavras, só letras/acentos/hífen/apóstrofo/espaço, sem combinação improvável.

### 2. Ajustes no `OcrDadosEditor.tsx`
- Aceita novo prop opcional `confirmacaoObrigatoria?: boolean` (default `false`).
- Quando `tipoDocumento === 'cnh'` **e** `confirmacaoObrigatoria=true`:
  - Card abre já em modo edição.
  - Mostra estado `confirmado` (gerenciado internamente + reportado via novo prop `onConfirmedChange`).
  - Botão "Salvar" vira "**Confirmar dados**"; ao salvar pela primeira vez vira "✓ Dados confirmados" e libera o pai a avançar.
  - Se `validarNomeOCR(nome)` retornar `!ok`, destaca o campo nome com borda vermelha + mensagem "Revise: caractere atípico detectado" e desabilita "Confirmar" até o usuário editar.
- Aceita novo prop opcional `nomeSugerido?: { nome: string; origem: string }` — se presente e diferente do valor atual, renderiza um aviso âmbar acima do campo Nome: *"Cadastro existente: **{nomeSugerido.nome}** — {origem}"* com botão "Usar este nome".

### 3. Cross-check com SGA / associados
Novo hook `src/hooks/useNomeCanonicoPorCpf.ts`:
- Recebe CPF normalizado; se válido (11 dígitos + DV), faz `select nome from associados where cpf=? limit 1` (RLS já cobre).
- Cache via react-query por 5 min, key `['nome-canonico-cpf', cpf]`.
- Retorna `{ nome, fonte: 'associado_existente' } | null`.

### 4. Wire-up nos consumidores que usam CNH
Forçar `confirmacaoObrigatoria` + passar `nomeSugerido` apenas onde a CNH alimenta contrato/associado:
- `src/components/cotacao-publica/DocumentosPendentesPublico.tsx` (link público — cotação nova/inclusão/troca).
- `src/pages/public/CotacaoPublicaCompleta.tsx` (passo de docs pessoais).
- `src/components/contratos/UnifiedDocumentUploader.tsx` e `DocumentUploader.tsx` (cadastro interno).

O componente pai mantém um state `cnhConfirmada` e usa-o como pré-requisito para habilitar o botão "Avançar" / "Continuar" no respectivo step. Onde o avanço hoje já passa pelos validadores do step, basta acrescentar essa flag à condição.

### 5. Memória
Novo `mem://logic/operations/ocr-cnh-confirmacao-obrigatoria` registrando a regra: "Toda CNH lida por OCR exige confirmação explícita antes de gerar contrato; nome com bigrama improvável bloqueia; CPF existente puxa nome canônico do SGA/associados como sugestão."

## Fora de escopo
- Tabela de auditoria `ocr_revisoes` (fica para opção C, se necessário depois).
- Edge function de OCR — sem mudanças.
- Pré-processamento de imagem.
- CRLV — mesma regra pode ser aplicada num próximo passo.

## Resultado esperado
- Impossível avançar no link público / cadastro com CNH sem confirmar explicitamente os dados.
- Caso "LOPWS" sinalizado em vermelho automaticamente.
- Quando o CPF já existe, 1 clique substitui o nome ruim pelo nome correto do SGA.
- Zero migration, zero nova edge function.
