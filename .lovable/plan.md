## Investigação — Chassi divergente entre CRLV e Sistema

### Caso real
- **Veículo:** Fiat Palio Elx Flex 2008 — Placa `KNO3F78` (associada Maria Amelia Balbi de Castro)
- **Chassi no CRLV (correto):** `9BD17104G85241143` — 17 caracteres
- **Chassi no sistema:** `9BD17104G8524113` — **16 caracteres** (faltou o dígito `4` antes do `3` final)

### Como o erro entrou no banco
1. A cotação `1036666f-5de5-461d-a330-061b265d6040` foi criada **manualmente pelo vendedor**, sem lead, sem CRLV anexado (`doc_crlv = null`) e sem vistoria associada (`vistoria_id = null`).
2. Na tela `Cadastro → Propostas Pendentes → Análise da Proposta` (`src/pages/cadastro/PropostaAnalise.tsx`), o analista digita/edita o chassi no campo de `PropostaDetalhesTabs.tsx` (linha 274):
   ```tsx
   <Input
     value={veiculoChassi}
     onChange={(e) => setVeiculoChassi(
       e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
     )}
     maxLength={17}
   />
   ```
3. **O input só limita o máximo (17), não exige o mínimo.** Qualquer string de 1–17 caracteres é aceita.
4. `handleConfirmarAprovacao` chama `aprovarMutation` enviando `veiculoChassi` direto, sem qualquer validação.
5. `useAprovarProposta` (`src/hooks/usePropostasPendentes.ts`) faz `update veiculos set chassi = params.veiculoChassi` — grava 16 caracteres no banco.
6. O caractere omitido (`4`) está no meio de uma sequência repetitiva (`...241143` → digitado `...24113`), exatamente o tipo de erro que validação de comprimento pegaria imediatamente.

### Por que o caso anterior (KRX9802) "subiu" e este não
Não há relação direta com o bug do FIPE×ano da investigação anterior. Aqui a falha é puramente **qualidade do dado de entrada**: chassi com 16 chars será reprovado em qualquer validação SGA/Hinova futura, em qualquer integração de rastreador, e cria divergência permanente com o CRLV oficial.

### Raiz do problema
- **Ausência de validação de comprimento mínimo (17) e charset do chassi** em **todos** os pontos onde o usuário interno digita chassi:
  - `PropostaDetalhesTabs.tsx` (aprovação da proposta) — sem validação
  - `VeiculoEditDialog.tsx` — `chassi: z.string().optional()` sem regex/length
  - `ChassiOcrEditor.tsx` — só exige `>= 5` chars
- **Ausência de cruzamento automático** entre o chassi digitado e o chassi extraído do OCR do CRLV quando o documento existe.
- **Ausência de bloqueio de I, O, Q** (caracteres proibidos pela ISO 3779 / VIN), hoje só barrados parcialmente no fluxo público.

---

## Plano de correção

### 1. Utilitário central de validação de chassi
Criar `src/lib/chassi.ts`:
- `normalizeChassi(input)` — uppercase + remove tudo que não for `A-HJ-NPR-Z0-9` (bloqueia I/O/Q, padrão VIN).
- `isValidChassi(input)` — deve ter exatamente 17 caracteres válidos.
- `chassiHelperText(input)` — mensagem de erro padronizada para UI.

### 2. Validação obrigatória nos formulários (camada de UI)
Aplicar a todos os inputs de chassi internos:
- `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx` — bloquear envio se `!isValidChassi`, exibir contador `X/17` e mensagem de erro inline.
- `src/components/veiculos/VeiculoEditDialog.tsx` — substituir `z.string().optional()` por schema Zod com regex `/^[A-HJ-NPR-Z0-9]{17}$/`.
- `src/components/ocr/ChassiOcrEditor.tsx` — exigir 17 caracteres antes do `Save`.
- Demais inputs de chassi do sistema (rastreadores, instalador checklist) — aplicar `normalizeChassi` + validação 17 chars.

### 3. Bloqueio na aprovação da proposta
Em `src/pages/cadastro/PropostaAnalise.tsx → handleConfirmarAprovacao`:
- Antes de chamar `aprovarMutation`, validar:
  - Se há `veiculoChassi` digitado: deve ter 17 chars válidos, senão `toast.error` e abortar.
  - Se a proposta tem `doc_crlv` com OCR processado, comparar `chassi digitado` vs `chassi_ocr` e exigir confirmação explícita do analista quando divergem (modal "Os chassis não coincidem — confirmar mesmo assim?").

### 4. Defesa em profundidade no banco (migration)
Criar migration adicionando:
```sql
ALTER TABLE veiculos
  ADD CONSTRAINT veiculos_chassi_format
  CHECK (chassi IS NULL OR chassi ~ '^[A-HJ-NPR-Z0-9]{17}$');

ALTER TABLE cotacoes
  ADD CONSTRAINT cotacoes_chassi_format
  CHECK (veiculo_chassi IS NULL OR veiculo_chassi ~ '^[A-HJ-NPR-Z0-9]{17}$');
```
Antes de aplicar, rodar `SELECT id, placa, chassi FROM veiculos WHERE chassi IS NOT NULL AND chassi !~ '^[A-HJ-NPR-Z0-9]{17}$'` para listar os registros legados que precisam ser corrigidos manualmente (provavelmente uma dezena).

### 5. Correção imediata do caso atual
- `UPDATE veiculos SET chassi = '9BD17104G85241143' WHERE id = '6915f219-0d34-4169-89b1-758e982aa51e'` (via migration auditável).
- `UPDATE cotacoes SET veiculo_chassi = '9BD17104G85241143' WHERE id = '1036666f-5de5-461d-a330-061b265d6040'`.
- Reenfileirar sincronização SGA/Hinova do associado `38575c0f-...` para atualizar lá também.

### 6. Auditoria retroativa
- Listar todos os veículos com `LENGTH(chassi) <> 17` ou contendo `I/O/Q` e gerar relatório para a equipe de cadastro corrigir antes da migration de constraint entrar em produção.

---

## Arquivos que serão alterados
- **novo:** `src/lib/chassi.ts`
- **edit:** `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx`
- **edit:** `src/pages/cadastro/PropostaAnalise.tsx`
- **edit:** `src/components/veiculos/VeiculoEditDialog.tsx`
- **edit:** `src/components/ocr/ChassiOcrEditor.tsx`
- **edit:** demais inputs de chassi (rastreadores/instalador) para reutilizar o util
- **nova migration:** check constraints + correção dos dois registros do caso

## Resultado esperado
Impossível salvar veículo/cotação/proposta com chassi diferente de 17 caracteres VIN-válidos. Quando houver CRLV com OCR, o sistema avisa proativamente sobre divergências antes de aprovar.
