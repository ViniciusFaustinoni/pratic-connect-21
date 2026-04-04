

# Filtrar Veículos da Base Nova na Aba Veículos

## Problema
A página `Cadastro > Veículos` exibe todos os veículos sem distinção de origem. Veículos da base antiga já aparecem na área "Base Antiga", causando duplicidade.

## Alterações

### 1. `src/hooks/useVeiculos.ts` — Filtrar por associado interno
Na função `useVeiculos`, adicionar join com `associados` e filtro `origem_cadastro = 'interno'`:
- Alterar o select para incluir filtro via inner join: `.select('*, associado:associados!inner(id, nome, cpf, origem_cadastro)')` 
- Adicionar `.eq('associado.origem_cadastro', 'interno')` quando não há `associadoId` específico

### 2. `src/pages/cadastro/Veiculos.tsx` — Filtrar stats
Nas queries de stats (linhas 183-205), adicionar o mesmo filtro de origem interna:
- Usar inner join com associados e filtrar `origem_cadastro = 'interno'` nas 3 queries (total, ativos, valor FIPE)

## Impacto
- 2 arquivos alterados
- Veículos de associados da base antiga deixam de aparecer na listagem principal
- Stats refletem apenas a base nova
- Nenhuma funcionalidade perdida (base antiga continua acessível na seção dedicada)

