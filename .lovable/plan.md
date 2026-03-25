

# Verificar veículo no SGA (Hinova) antes de cotação

## Objetivo
Antes de qualquer cotação (automática via placa ou manual), consultar o endpoint `GET /veiculo/buscar/{placa}` da API Hinova para verificar se o veículo já existe no SGA. Se existir, bloquear a cotação com aviso. O modo manual também passa a exigir placa obrigatória.

## Alterações

### 1. Nova Edge Function `sga-verificar-veiculo/index.ts`

Cria uma edge function dedicada que:
- Recebe `{ placa }` no body
- Busca credenciais Hinova (env vars + fallback banco, mesmo padrão do `sga-hinova-sync`)
- Faz `GET https://api.hinova.com.br/api/sga/v2/veiculo/buscar/{placa}` com `Authorization: Bearer {token}`
- Se retornar array com dados (HTTP 200 + veículo encontrado) → `{ existe: true, mensagem: "Veículo já cadastrado no SGA" }`
- Se retornar vazio ou 404 → `{ existe: false }`
- Não retorna dados do veículo (apenas o flag)

### 2. `src/hooks/useVerificarVeiculoSGA.ts` — Novo hook

Hook simples com `useMutation` que invoca `sga-verificar-veiculo` e retorna `{ existe: boolean, mensagem?: string }`.

### 3. `src/pages/vendas/Cotador.tsx` — Integrar verificação SGA

No `handleBuscarPlaca` (linha ~567), após as verificações de blacklist e placa duplicada (antes de chamar `getByPlaca`):
- Chamar `sga-verificar-veiculo` com a placa
- Se `existe === true`, exibir modal de bloqueio e interromper o fluxo

### 4. `src/pages/vendas/Cotador.tsx` — Exigir placa no modo manual

Atualmente o modo manual permite cotação sem placa. Alterar para:
- Tornar o campo placa obrigatório no formulário manual
- No `handleCalcular`, validar que a placa foi informada
- Antes de calcular, executar a mesma verificação SGA com a placa informada

### 5. `src/components/cotacoes/CotacaoFormDialog.tsx` — Mesma verificação

No `handleBuscarPlaca` do dialog de cotação (linha ~600), adicionar a mesma chamada ao SGA antes do `getByPlaca`.

### 6. `src/components/cotacoes/VeiculoSGAModal.tsx` — Modal de bloqueio

Modal simples (estilo similar ao `PlacaBlacklistModal`) informando:
- "Veículo já cadastrado no sistema SGA"
- "Não é possível realizar cotação para este veículo"
- Botão "Entendido"

## Fluxo resultante

```text
Vendedor digita placa → Blacklist? → Placa duplicada 48h? → Existe no SGA? → Busca FIPE
                         ↓ SIM         ↓ SIM                  ↓ SIM
                         BLOQUEIO      BLOQUEIO                BLOQUEIO (modal SGA)
```

## Observação sobre modo manual
Hoje é possível fazer cotação sem placa (selecionando marca/modelo manualmente). Com esta mudança, a placa passa a ser obrigatória em todos os cenários, pois é necessária para a verificação no SGA.

