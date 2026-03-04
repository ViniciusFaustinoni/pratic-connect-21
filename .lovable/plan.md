
# Corrigir Erro MARCA na Sincronizacao SGA Hinova

## Diagnostico (baseado em dados reais do banco)

Comparei os payloads de sucesso vs erro nos logs `sga_sync_logs`:

**Payload que FUNCIONOU:**
```json
{ "codigo_associado": 29204, "chassi": "...", "placa": "LTB4J74", "renavam": "...", 
  "codigo_fipe": "002111-3", "codigo_cor": 6, "codigo_tipo_veiculo": 1, ... }
```
- SEM campo `marca`, SEM campo `modelo`

**Payload que FALHOU:**
```json
{ "codigo_associado": 29293, "marca": "Toyota", "modelo": "corolla Xei Flex", 
  "chassi": "...", "placa": "LTB4J74", ... }
```
- COM `marca` e `modelo` como texto = API Hinova rejeita

**Conclusao:** A API Hinova NAO aceita `marca` e `modelo` como campos texto. Ela infere essas informacoes a partir do `codigo_fipe`. A adicao recente desses campos ao payload e a validacao obrigatoria deles esta causando o erro.

## Correcao

### `supabase/functions/sga-hinova-sync/index.ts`

1. **Remover `marca` e `modelo` do `veiculoPayload`** (linhas 882-883)
   - Remover `marca: veiculo.marca || ''`
   - Remover `modelo: veiculo.modelo || ''`

2. **Remover `marca` e `modelo` da validacao de campos obrigatorios** (linhas ~847-850)
   - Manter apenas `placa`, `renavam`, `chassi` na validacao

3. **Manter a logica de `isValidationError`** da correcao anterior como protecao contra futuros erros de parametros

Impacto: apenas 2 blocos de codigo alterados no mesmo arquivo. Deploy automatico.
