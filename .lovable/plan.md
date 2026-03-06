

# Fluxo de Ressalva em Tempo Real (Instalador Aguarda no Local)

## Conceito

Quando o instalador envia para o monitoramento, em vez de ser redirecionado para a tela inicial, ele permanece em uma **tela de espera** aguardando a decisao do coordenador em tempo real. O coordenador recebe a solicitacao na tela existente de Ressalvas Pendentes (que passa a ser tratada como fila de **prioridade**). Quando o coordenador decide, o instalador recebe o resultado instantaneamente.

```text
INSTALADOR                          COORDENADOR
    |                                    |
    |-- Envia para monitoramento ------->|
    |                                    |
    |   [Tela de Espera - polling 10s]   |  [Ressalvas Pendentes - ve nova entrada]
    |                                    |
    |<--- Decisao (aprovar/declinar) ----|
    |                                    |
    |-- Tela de resultado: proximo passo |
```

## Alteracoes

### 1. Tela de espera do instalador (`InstaladorChecklist.tsx`)

Apos enviar para monitoramento, em vez de `navigate('/instalador')`, mostrar uma tela de espera dentro do proprio componente:
- Estado `aguardandoMonitoramento = true`
- Animacao de loading com texto "Aguardando decisao do monitoramento..."
- Timer visual mostrando quanto tempo esta esperando
- Polling a cada 10 segundos consultando `servicos.decisao_instalador` do servico atual
- Quando `decisao_instalador` mudar de `pendente_monitoramento` para outro valor:
  - `aprovado_ressalva` → tela verde "Aprovado! Prossiga com a instalacao." com botao para continuar o checklist normalmente
  - `declinado_monitoramento` → tela vermelha "Servico declinado pelo monitoramento. Nao instale o equipamento." com botao para voltar ao inicio
- Timeout de 30 minutos: exibir opcao "O monitoramento ainda nao respondeu. Deseja continuar aguardando?"

### 2. Hook de polling (`src/hooks/useAguardarDecisaoMonitoramento.ts`)

Novo hook que:
- Recebe o `servicoId`
- Faz query a cada 10 segundos em `servicos` buscando `decisao_instalador`
- Retorna o status atual: `'aguardando' | 'aprovado' | 'declinado'`
- Para o polling quando recebe decisao final

### 3. Logica de aprovacao no hook existente (`useDecidirRessalva`)

Ajuste na logica de **aprovar**: em vez de marcar o servico como `concluida`, manter como `em_andamento` para que o instalador possa continuar a instalacao no local. O servico so sera concluido quando o instalador finalizar o checklist completo.

Mudancas:
- `status`: de `'concluida'` para `'em_andamento'`
- `decisao_instalador`: manter `'aprovado_ressalva'` (ja esta correto)
- Remover ativacao prematura do veiculo (sera feita na conclusao real da instalacao)

### 4. Retorno do instalador ao fluxo apos aprovacao

Quando o polling detecta aprovacao:
- O instalador ve a tela de sucesso
- Botao "Continuar Instalacao" leva de volta ao checklist onde parou
- O instalador conclui normalmente o servico (fluxo existente de finalizacao)

## Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useAguardarDecisaoMonitoramento.ts` | Novo — hook de polling 10s para checar decisao |
| `src/pages/instalador/InstaladorChecklist.tsx` | Substituir redirect por tela de espera + tela de resultado |
| `src/hooks/useRessalvasMonitoramento.ts` | Ajustar logica de aprovacao (status em_andamento, nao concluida) |

3 arquivos.

