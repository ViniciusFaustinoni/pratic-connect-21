

# Ajustar Decisao do Instalador: Fotos Obrigatorias e Fluxo de Negacao

## Estado Atual

O sistema ja possui a maior parte da logica implementada:

- **3 opcoes de decisao** (aprovado, aprovado_ressalva, negado) -- OK
- **Descricao obrigatoria** para ressalva e negado -- OK
- **Fotos para ressalva** -- marcadas como "opcional" (correto, pois sao "quando aplicavel")
- **Modal de recusa** com motivo + descricao obrigatoria -- OK
- **Backend** salva `decisao_instalador`, `ressalvas_instalador`, `fotos_ressalva` na tabela `servicos` -- OK

## Gaps Identificados

### Gap 1: Fotos OBRIGATORIAS para "Negado"

**Arquivo**: `src/components/instalador/ModalRecusaVeiculoComFotos.tsx`

Atualmente, no modal de recusa, as fotos estao marcadas como "opcional" (linha 168) e a validacao `isValid` (linha 106) nao exige fotos. A regra de negocio diz que fotos sao **obrigatorias** quando o instalador nega a instalacao.

**Correcao**:
- Alterar label de "Fotos de Evidencia (opcional, ate 5)" para "Fotos de Evidencia (obrigatorio, ate 5)"
- Adicionar validacao: `fotos.length > 0` na condicao `isValid` (linha 106)
- Adicionar mensagem de erro quando nenhuma foto foi adicionada

### Gap 2: Fluxo de Negacao -- Encaminhar para Analise Interna

**Arquivo**: `src/hooks/useServicos.ts` (funcao `useRecusarVeiculoServico`, linhas 1139-1308)

Atualmente, quando o instalador nega, o sistema executa acoes destrutivas imediatas:
- Cancela o servico
- Marca veiculo como "recusado"
- Adiciona a blacklist
- Cancela associado, contrato e cotacao

A regra de negocio diz: **"Encaminhar automaticamente para analise interna"**. Ou seja, a negacao do instalador nao deve ser uma decisao final -- deve gerar um encaminhamento para que a equipe interna avalie.

**Correcao proposta**:
- Ao inves de cancelar tudo, mudar o status do servico para `pendente_analise` (ou similar)
- Salvar os dados da recusa (motivo, descricao, fotos) no servico para consulta
- Registrar no historico como "veiculo_negado_instalador" (diferente de recusa definitiva)
- A equipe interna (diretor/analista) entao decide se confirma a recusa ou solicita nova avaliacao
- Somente apos confirmacao interna, executar as acoes destrutivas (blacklist, cancelamento)

Isso requer:
1. Ajustar `useRecusarVeiculoServico` para salvar em modo "pendente" ao inves de cancelar
2. Salvar fotos de evidencia no storage (atualmente o modal retorna `File[]` mas o hook nao faz upload)
3. Criar uma visualizacao para a equipe interna ver recusas pendentes (pode ser uma aba no painel existente)

## Plano de Implementacao

### Etapa 1 -- Fotos obrigatorias no modal de recusa

| Arquivo | Alteracao |
|---|---|
| `src/components/instalador/ModalRecusaVeiculoComFotos.tsx` | Tornar fotos obrigatorias: label, validacao e mensagem de erro |

Detalhes:
- Linha 106: adicionar `&& fotos.length > 0` na condicao `isValid`
- Linha 168: alterar texto do label para indicar obrigatoriedade
- Adicionar texto de erro condicional similar ao das observacoes (linha 159)

### Etapa 2 -- Upload de fotos de recusa no storage

Atualmente, o `ModalRecusaVeiculoComFotos` retorna `fotos: File[]` no callback `onConfirm`, mas o `handleRecusarVeiculo` em `InstaladorChecklist.tsx` (linha 525) **nao faz upload** dessas fotos -- apenas passa o `motivoCompleto` ao hook.

| Arquivo | Alteracao |
|---|---|
| `src/pages/instalador/InstaladorChecklist.tsx` | No `handleRecusarVeiculo`, fazer upload das fotos para o storage e passar URLs ao hook |
| `src/hooks/useServicos.ts` | No `useRecusarVeiculoServico`, aceitar e salvar `fotos_recusa` no campo do servico |

### Etapa 3 -- Fluxo de analise interna para negacoes

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useServicos.ts` | Alterar `useRecusarVeiculoServico` para usar status intermediario em vez de cancelamento imediato |
| `src/integrations/supabase/types.ts` | Verificar se status `pendente_analise_recusa` existe ou precisa ser adicionado |

Comportamento novo:
- Servico muda para status `pendente_analise` (com campo `decisao_instalador: 'negado'`)
- Veiculo NAO e marcado como recusado imediatamente
- NAO adiciona a blacklist imediatamente
- Associado/contrato/cotacao NAO sao cancelados
- Registra historico como "negado_pelo_instalador_pendente_analise"
- Equipe interna ve na fila e decide confirmar ou reverter

## Resumo de Risco

- **Gap 1 (fotos obrigatorias)**: Correcao simples, sem risco
- **Gap 2 (upload das fotos)**: Medio -- precisa garantir que o bucket `instalacoes` aceita uploads na pasta de recusas
- **Gap 3 (fluxo de analise)**: Maior impacto -- muda o comportamento atual de cancelamento imediato. Requer decisao sobre como a equipe interna vai visualizar e resolver essas pendencias

