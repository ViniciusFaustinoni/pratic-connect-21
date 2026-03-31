

# Corrigir endpoint de busca de veículo no SGA

## Problema
O endpoint `GET /veiculo/buscar/{placa}` não especifica o parâmetro `buscar_por`, o que pode fazer a API Hinova não encontrar o veículo. A documentação mostra que o parâmetro opcional `buscar_por` aceita `placa`, `chassi` ou `codigo`.

## Correção
- **Arquivo**: `supabase/functions/sga-verificar-veiculo/index.ts`
- **Linha ~107**: Alterar de:
  ```
  /veiculo/buscar/${placaLimpa}
  ```
  Para:
  ```
  /veiculo/buscar/${placaLimpa}/placa
  ```

## Impacto
Apenas uma linha alterada. Deploy automático da edge function.

