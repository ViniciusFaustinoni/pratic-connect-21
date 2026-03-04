

# Tela de Opcoes de Ressalva — Instalador + Fila de Monitoramento

## Resumo

Atualmente, quando o instalador tem itens NOK no checklist, o dialog (linhas 1823-1913 do `InstaladorChecklist.tsx`) oferece apenas 2 opcoes: "Prosseguir mesmo assim" (continua normal) ou "Nao ha condicao - Encerrar" (abre modal de recusa total). O pedido adiciona uma **terceira opcao**: "Enviar para confirmacao do Monitoramento", que cria um estado intermediario (`pendente_monitoramento`) onde o coordenador decide aprovar ou declinar.

## Alteracoes

### 1. Migracao SQL — novo valor para `decisao_instalador`

Nao e necessario alterar enum (campo e `text`). Usaremos o valor `pendente_monitoramento` no campo `decisao_instalador` da tabela `servicos`.

### 2. `InstaladorChecklist.tsx` — Adicionar 3a opcao no dialog de NOK

No dialog de confirmacao (linhas 1883-1911), adicionar um terceiro botao **"Enviar para Monitoramento"** entre os existentes. Ao clicar:
- Salva o checklist no banco
- Atualiza o servico com `decisao_instalador: 'pendente_monitoramento'`, `status: 'em_analise'`, `ressalvas_instalador` com os itens NOK, e `fotos_ressalva` se houver
- Redireciona para a fila do instalador

### 3. Hook `useServicos.ts` — Adicionar mutation `useEnviarParaMonitoramento`

Nova mutation que:
- Atualiza `servicos` com `decisao_instalador = 'pendente_monitoramento'`, `status = 'em_analise'`
- Grava `ressalvas_instalador` e `fotos_ressalva`
- Registra historico em `associados_historico`

### 4. Hook `useRessalvasMonitoramento.ts` — Novo hook

- `useRessalvasPendentesMonitoramento()`: query em `servicos` com `decisao_instalador = 'pendente_monitoramento'` e `status = 'em_analise'`, join com associados/veiculos/profiles
- `useContagemRessalvasPendentes()`: contagem para badge no menu
- `useDecidirRessalva()`: mutation para aprovar ou declinar:
  - **Aprovar**: `decisao_instalador = 'aprovado_ressalva'`, `status = 'concluida'`, segue para analise de cadastro (mesmo fluxo de `aprovado_ressalva` atual)
  - **Declinar**: blacklist + cancelar associado/contrato (reutiliza logica do `useRecusasInstalador`)

### 5. Pagina `src/pages/monitoramento/RessalvasPendentes.tsx` — Nova tela

Lista cards com:
- Associado, veiculo (placa/modelo), instalador, data
- Badge "Pendente Monitoramento"
- Ao clicar: abre modal com detalhes completos (itens NOK, observacoes, fotos de evidencia, dados da vistoria)
- Botoes: "Aprovar (seguir com ressalva)" e "Declinar (blacklist)"

### 6. Rota e menu

- Adicionar rota `/monitoramento/ressalvas-pendentes` no `App.tsx`
- Adicionar item no menu do monitoramento com badge de contagem

## Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| `src/pages/instalador/InstaladorChecklist.tsx` | Adicionar 3o botao no dialog NOK + logica de envio |
| `src/hooks/useServicos.ts` | Adicionar `useEnviarParaMonitoramento` |
| `src/hooks/useRessalvasMonitoramento.ts` | Novo — query + mutation para fila de ressalvas pendentes |
| `src/pages/monitoramento/RessalvasPendentes.tsx` | Nova pagina — lista + modal de detalhes + decisao |
| `src/App.tsx` | Adicionar rota |
| Menu lateral do monitoramento | Adicionar link com badge |

