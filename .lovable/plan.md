

# Modal Completo de Detalhes do Veículo

## Situação Atual

A página `Veiculos.tsx` ao clicar numa linha navega para o detalhe do associado. Existe um `VeiculoDetalhesModal` mas tem apenas 3 abas (Info, Fotos, Documentos) e falta muita informação.

## Solução

Expandir o `VeiculoDetalhesModal` e conectá-lo à tabela de veículos na página `Veiculos.tsx`. O modal terá 6 abas com todas as informações pertinentes.

### Estrutura de Abas

1. **Resumo** - Dados do veículo + dados do associado vinculado + status coberturas
2. **Financeiro** - Cobranças/boletos do associado (via `useCobrancasAssociado`)
3. **Rastreador** - Dados do rastreador vinculado + botão "Ver no Mapa" com `MapaRastreador`
4. **Eventos** - Sinistros e chamados de assistência do veículo
5. **Fotos/Docs** - Fotos de vistoria + documentos (já existente, consolidado)
6. **Histórico** - Timeline de ações/mudanças (via `useAssociadoHistoricoCompleto`)

### Arquivos Alterados

**1. `src/pages/cadastro/Veiculos.tsx`**
- Adicionar state para modal (`selectedVeiculoId`, `showModal`)
- Trocar o `onClick` da `TableRow` de navegar para associado para abrir o modal
- Importar e renderizar o modal expandido

**2. `src/components/cadastro/VeiculoDetalhesModal.tsx`** (reescrever)
- Receber apenas `veiculoId` e `open/onClose`
- Buscar internamente: veículo, associado, rastreador, cobranças, sinistros, assistências
- 6 abas conforme descrito acima
- Botão "Ver Associado" que navega para `/cadastro/associados/:id`
- Botão "Ver no Mapa" que abre o `MapaRastreador` inline

**3. `src/hooks/useVeiculoDetalhes.ts`** (expandir)
- Adicionar `useVeiculoCompleto(veiculoId)` que busca veículo + associado + rastreador num único hook
- Adicionar `useEventosVeiculo(veiculoId)` que busca sinistros + assistências do veículo

### Dados por Aba

| Aba | Fonte | Campos |
|---|---|---|
| Resumo | `veiculos` + `associados` | Marca, modelo, placa, chassi, FIPE, cor, status, coberturas, nome/CPF/telefone do associado |
| Financeiro | `asaas_cobrancas` via `useCobrancasAssociado` | Lista de boletos, status, valores, vencimento |
| Rastreador | `rastreadores` join `veiculos` | IMEI, plataforma, status, último sinal, mapa |
| Eventos | `sinistros` + `chamados_assistencia` | Protocolo, tipo, status, data |
| Fotos/Docs | hooks existentes | Fotos de vistoria categorizadas + documentos |
| Histórico | `useAssociadoHistoricoCompleto` | Timeline de ações |

### Impacto
- 3 arquivos alterados
- Modal rico e completo ao clicar em qualquer veículo na listagem
- Reutiliza hooks e componentes já existentes no projeto

