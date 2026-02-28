


# Ajustar Decisao do Instalador: Fotos Obrigatorias e Fluxo de Negacao

## Status: IMPLEMENTADO ✅

### Etapa 1 — Fotos obrigatórias no modal de recusa ✅

- `ModalRecusaVeiculoComFotos.tsx`: validação `isValid` agora exige `fotos.length > 0`
- Label alterado para "Fotos de Evidência (obrigatório, até 5) *"
- Mensagem de erro exibida quando nenhuma foto foi adicionada

### Etapa 2 — Upload de fotos de recusa no storage ✅

- `InstaladorChecklist.tsx`: `handleRecusarVeiculo` agora faz upload das fotos para o bucket `instalacoes` na pasta `recusas/{servicoId}/`
- URLs das fotos são passadas ao hook via campo `fotosRecusa`

### Etapa 3 — Fluxo de análise interna para negações ✅

- `useServicos.ts`: `useRecusarVeiculoServico` agora usa status `em_analise` com `decisao_instalador: 'negado'` em vez de cancelamento imediato
- Veículo NÃO é marcado como recusado
- NÃO adiciona à blacklist
- Associado/contrato/cotação NÃO são cancelados
- Histórico registrado como `negado_pelo_instalador_pendente_analise`
- Toast: "Veículo negado. Encaminhado para análise interna."

## Pendências futuras

- Criar tela/aba para equipe interna visualizar serviços com `decisao_instalador = 'negado'` e status `em_analise`
- Criar ação de "confirmar recusa" que executa as ações destrutivas (blacklist, cancelamento)
- Criar ação de "reverter recusa" para solicitar nova avaliação
