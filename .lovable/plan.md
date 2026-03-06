

# Correção: Persistência do Fluxo de Ressalva do Instalador

## Problemas

1. **Reatribuição prematura**: Em `useServicos.ts` (linhas 1324-1341), `atribuir-proxima-tarefa` é chamado no `onSuccess` de `useEnviarParaMonitoramento`, tirando o instalador do serviço antes da decisão.

2. **Estado `aguardandoMonitoramento` não persiste**: É um `useState(false)` — ao recarregar a página, o instalador perde a tela de espera mesmo com o serviço ainda `em_analise` + `pendente_monitoramento` no banco.

## Alterações

### 1. Remover `atribuir-proxima-tarefa` do envio para monitoramento

**Arquivo**: `src/hooks/useServicos.ts` (linhas 1324-1341)

Remover todo o bloco `navigator.geolocation / atribuir-proxima-tarefa` do `onSuccess` de `useEnviarParaMonitoramento`. O instalador deve permanecer no serviço aguardando a decisão.

### 2. Detectar estado pendente ao carregar o componente

**Arquivo**: `src/pages/instalador/InstaladorChecklist.tsx`

Adicionar um `useEffect` após a linha 198 que verifica os dados do serviço ao carregar:

- Se `servico.decisao_instalador === 'pendente_monitoramento'` e `servico.status === 'em_analise'` → ativar `setAguardandoMonitoramento(true)` para retomar polling
- Se `servico.decisao_instalador === 'aprovado_ressalva'` e `servico.status === 'em_andamento'` → não fazer nada especial, o fluxo normal do checklist continua

Isso garante que:
- Recarregar a página durante espera → volta à tela de espera com polling
- Voltar ao serviço após aprovação → continua normalmente o checklist

## Resumo

| Arquivo | Ação |
|---|---|
| `src/hooks/useServicos.ts` | Remover bloco `atribuir-proxima-tarefa` (linhas 1324-1341) |
| `src/pages/instalador/InstaladorChecklist.tsx` | Adicionar useEffect para detectar estado pendente/aprovado ao carregar |

2 arquivos, alterações pontuais e seguras.

