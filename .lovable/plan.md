

## Aceitar nova Carteira de Identidade Nacional (CIN) como RG no OCR

### Problema
O prompt de OCR (`supabase/functions/document-ocr/index.ts`) descreve apenas o RG antigo, exigindo o campo "REGISTRO GERAL" como número principal. A nova **CIN** (Carteira de Identidade Nacional, válida em todo território nacional desde 2022, obrigatória até fev/2032) usa o **CPF como número único de identificação**, traz QR Code, pode ter validade "INDETERMINADA" e nomeia os campos em PT/EN ("Registro Geral - CPF / Personal Number", "Validade / Expiry"). Hoje o modelo pode:
- Confundir o tipo (detectar como "outro");
- Falhar ao extrair RG (porque o número do RG/CPF agora é o mesmo);
- Reprovar por "validade ilegível" quando está escrito INDETERMINADA;
- Não conseguir validar nome ou CPF esperado.

Caso real: imagem enviada (Marli Silva de Góis – CIN RJ, validade INDETERMINADA, CPF 828.181.187-00).

### Solução

**1. `supabase/functions/document-ocr/index.ts` – Atualizar o prompt da seção RG**
Reescrever a seção `### RG` (linhas 137-143) para cobrir os dois formatos:

```
### RG / CIN (Carteira de Identidade Nacional)
Aceite TANTO o RG antigo (modelo estadual com REGISTRO GERAL próprio)
QUANTO a nova CIN (Carteira de Identidade Nacional - válida em todo território nacional, com QR Code).
Ambos retornam tipo_detectado:"rg".

Campos:
- nome: campo "NOME / Name" no topo. Não confunda com filiação ou nome do expedidor.
- cpf: SEMPRE presente.
  • CIN: aparece como "Registro Geral - CPF / Personal Number" — usa o CPF como número único.
  • RG antigo: aparece em campo CPF separado (frente ou verso).
  • Formato XXX.XXX.XXX-XX. Se ilegível, retorne "ilegivel".
- rg: número do Registro Geral.
  • RG antigo: número estadual (ex.: 12.345.678-9).
  • CIN: o CPF é o número único — use o mesmo valor do CPF.
- data_nascimento: "Data de Nascimento / Date of Birth" (YYYY-MM-DD).
- data_expedicao: "Data de Emissão / Issue Date" (YYYY-MM-DD) — só na CIN.
- validade: "Validade / Expiry" (YYYY-MM-DD).
  • CIN pode trazer "INDETERMINADA" — nesse caso retorne validade:"indeterminada" e considere VÁLIDO.
- orgao_expedidor: "DETRAN-RJ", "SSP-SP", etc. (se visível).
- variante: "cin" se for a nova Carteira de Identidade Nacional (tem QR Code grande, layout verde/amarelo, texto bilíngue, "VÁLIDA EM TODO O TERRITÓRIO NACIONAL"); "rg_antigo" caso contrário.

Regras especiais CIN:
- NÃO reprove por validade ausente/INDETERMINADA — é o padrão da CIN.
- NÃO reprove por RG igual ao CPF — é o comportamento esperado da CIN.
- QR Code presente é indicador forte de CIN.
```

Adicionar `'rg'` continua válido em `tipo_detectado` (já está). Adicionar `data_expedicao`, `orgao_expedidor` e `variante` à lista `dadosFields` do parser de fallback (linha 258).

**2. Atualizar label do `tipoEsperado` (linha 397)**
```ts
rg: 'RG ou CIN (Carteira de Identidade — antiga ou nova Carteira de Identidade Nacional)',
```

**3. `src/components/contratos/UnifiedDocumentUploader.tsx` e `DocumentUploader.tsx`**
Atualizar labels visíveis:
- `rg: { label: 'RG / CIN', ... descricao: 'RG antigo ou nova Carteira de Identidade Nacional (CIN)' }`
- Em `documentosEsperados`: `label: 'CNH, RG ou CIN'`.

Nenhuma mudança estrutural — `'rg'` continua sendo o `tipo_detectado` retornado para ambos os formatos.

**4. `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx` e `src/components/contratos/ContratoWizard.tsx`**
A lógica já trata `tipoDocumento === 'cnh' || tipoDocumento === 'rg'` para preencher dados pessoais — funcionará automaticamente para CIN. Sem alterações necessárias além das labels.

**5. `src/utils/syncCnhData.ts` (já normaliza RG)**
A regex de limpeza já remove sufixos "DETRAN RJ" etc. Validar que `cnh_numero` aceite o formato CIN (CPF puro com pontuação) — sim, é uma string livre, sem alteração.

### Validação
1. Submeter foto da CIN da Marli (validade INDETERMINADA) no link público de envio de documentos → deve detectar `tipo_detectado:"rg"`, `variante:"cin"`, extrair nome, CPF, e marcar como **válido** (não reprovar por validade).
2. Submeter RG antigo padrão SSP → continua sendo detectado como `rg` com número de registro estadual e CPF separado.
3. No fluxo público de cotação, ao subir CIN, os campos nome e CPF devem ser auto-preenchidos como já acontece com CNH/RG.
4. Cadastro/aprovação: card mostra "RG / CIN" ✅ aprovado quando OCR retorna sugestão `aprovar`.
5. Garantir que validações de "documento vencido" não disparem para CIN com validade `indeterminada`.

