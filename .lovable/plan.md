## Objetivo

Em **Monitoramento › Serviço de Campo › Serviços**, no drawer de detalhe do serviço, exibir o **Local da Instalação** que o técnico preencheu no ato da instalação — tanto na aba **Resumo** quanto na aba **Rastreador**.

## Onde isso vive hoje

O técnico grava três campos canônicos na tabela `rastreadores` durante a instalação:

- `local_instalacao` — texto curto (ex.: "Sob o painel, lado motorista")
- `descricao_instalacao` — descrição/observação livre
- `foto_local_instalacao_url` — foto do local

O `ServicoDetailModal` já carrega o relacionamento `rastreadores:rastreador_id`, mas **não seleciona** esses três campos hoje — por isso a UI não tem como mostrar. A informação existe e é alimentada pelo fluxo do instalador (`InstaladorChecklist`, hook `useServicos` linhas 1062–1068).

## Mudanças

### 1. `src/hooks/useServicos.ts` — incluir campos no select
Adicionar `local_instalacao, descricao_instalacao, foto_local_instalacao_url` nos dois selects de rastreadores (busca primária em `servicos` linha ~796 e fallback em `instalacoes` linha ~817).

### 2. `src/components/servicos-campo/ServicoDetailModal.tsx`

**Aba Resumo (apenas instalação / vistoria de entrada concluída):**
Adicionar nova `<Section title="Local da instalação" icon={MapPin}>` após Agendamento, exibindo:
- `Local` → `rastreadores.local_instalacao`
- `Descrição` → `rastreadores.descricao_instalacao` (quando houver)
- Thumbnail clicável da `foto_local_instalacao_url` (abre em nova aba; sem foto, mostra "—")

A seção só aparece quando `isInstalacao && (servico.rastreadores?.local_instalacao || foto_local_instalacao_url || descricao_instalacao)` — para serviços ainda não concluídos / sem rastreador físico, fica oculta (não aparece "—" vazio para sub-FIPE que dispensa rastreador).

**Aba Rastreador:**
Acrescentar à `<Section title="Rastreador">` existente os mesmos três campos abaixo de Quilometragem, com a thumbnail da foto.

### 3. Sem mudanças em backend
Schema e fluxo de gravação já existem. Não há migração nem edge function envolvida.

## Critério de aceite

1. Abrir um serviço de instalação **concluído** (ex.: o LLF7F07 do print) → aba Resumo mostra "Local da instalação" com o texto e a foto que o técnico enviou.
2. Aba Rastreador exibe ID, IMEI, KM **e** local + descrição + foto.
3. Em serviço sub-FIPE (sem rastreador físico) ou serviço ainda não concluído sem dados preenchidos, a seção/linhas não aparecem (não polui a UI com "—").
4. Foto abre em nova aba ao clicar.

## Fora de escopo

- Não tocar no fluxo do técnico (já grava certo).
- Não mexer em `AprovacaoInstalacaoDetalhe` nem nas outras telas de monitoramento — pedido é específico do `ServicoDetailModal`.
- Não criar nova aba — reaproveita Resumo + Rastreador existentes.
