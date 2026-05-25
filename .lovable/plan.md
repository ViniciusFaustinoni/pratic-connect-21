# Escolha de escopo na atribuição de Prestador

## Problema

Hoje, ao atribuir um serviço de campo a um técnico tipo PRESTADOR, o sistema decide sozinho qual link público gerar:

- Se `servicos.tipo='instalacao'` → chama `gerar-link-prestador` (link com etapas de instalação de rastreador)
- Se `servicos.tipo='vistoria_*'` → chama `gerar-link-vistoriador-prestador` (link só fotos)

O coordenador de Monitoramento não tem controle. Em casos como Troca de Titularidade (onde ele pode querer aproveitar a visita para instalar rastreador novo) ou sub-FIPE com suspeita técnica (onde quer vistoria só fotos mesmo havendo instalação prevista), o caminho está travado pelo `tipo` do serviço.

## Objetivo

No momento da atribuição ao prestador, o coordenador escolhe explicitamente o escopo, e essa escolha define o link público que o prestador receberá.

## Comportamento desejado

### UI — `AtribuirPrestadorPopover` (mapa) e equivalente em Atribuição Manual

Após selecionar o prestador, antes do botão "Gerar Link", aparecem dois cartões de escolha (radio):

- **Somente Fotos** — vistoria sem mexer no rastreador. Link público mostra apenas o roteiro de fotos + vídeo 360°.
- **Fotos + Instalação** — vistoria + instalação/troca de rastreador. Link público inclui etapas de cadastro de IMEI, teste de comunicação e fotos do equipamento instalado.

Default sugerido pelo serviço atual (sem travar):

| Origem | Default |
|---|---|
| `servicos.tipo='instalacao'` | Fotos + Instalação |
| `servicos.tipo='vistoria_entrada'` (sub-FIPE / autovistoria materializada) | Somente Fotos |
| `servicos.tipo='vistoria_manutencao'` ou outras vistorias | Somente Fotos |
| Veículo exige rastreador (Diesel / Carro≥30k / Moto≥9k) E ainda sem rastreador vinculado | Fotos + Instalação |

O coordenador pode trocar livremente — o default é só sugestão. Quando o veículo exige rastreador e ele escolhe "Somente Fotos", exibir aviso amarelo "Este veículo exige rastreador; a instalação precisará ser agendada depois" (não bloqueia).

### Backend

`useAtribuirServicoPrestador` passa a receber `escopo: 'somente_fotos' | 'fotos_instalacao'` e roteia direto, ignorando `servico.tipo`:

- `escopo='fotos_instalacao'` → `gerar-link-prestador` (precisa de `instalacao_id`; se serviço não tem, materializa/busca instalação ativa para o par associado+veículo — lógica que já existe no fallback de hoje).
- `escopo='somente_fotos'` → `gerar-link-vistoriador-prestador` (link de vistoria pura, sem etapas de IMEI/instalação).

Persistir a escolha em campo novo no link gerado (`instalacao_prestador_links.escopo` ou tabela equivalente de `vistoria_prestador_links`) para que:

1. A página pública (`PrestadorInstalacao.tsx` / equivalente vistoria-só) renderize as etapas corretas a partir do registro do link, não de heurística.
2. Aprovação de Associados saiba se aquele evento conclui instalação física (guard `trg_guard_instalacao_concluida_exige_rastreador`) ou é só vistoria (sem reabrir cobertura).

### Regras canônicas preservadas

- Autovistoria do cliente continua independente — esta escolha vale só para atribuição a prestador externo.
- `vistoria_entrada ≡ instalacao` continua: se escolher "Fotos + Instalação" sobre um serviço `vistoria_entrada`, o sistema garante que o registro `instalacoes` exista (já é o comportamento do fallback atual).
- Guards de rastreador obrigatório (DB triggers) seguem como última linha de defesa — só vão acionar se o coordenador escolher "Somente Fotos" indevidamente.

## Arquivos afetados

- `src/components/mapa/AtribuirPrestadorPopover.tsx` — adicionar seletor de escopo + aviso
- `src/components/monitoramento/AtribuicaoManualTab.tsx` — mesmo seletor onde houver botão de atribuir prestador
- `src/hooks/useAtribuicaoManual.ts` — `AtribuirPrestadorParams` ganha `escopo`; roteamento por escopo em vez de `servico.tipo`
- `supabase/functions/gerar-link-prestador/index.ts` — gravar `escopo='fotos_instalacao'` no link
- `supabase/functions/gerar-link-vistoriador-prestador/index.ts` — gravar `escopo='somente_fotos'` no link
- `src/pages/public/PrestadorInstalacao.tsx` — ler escopo do link e renderizar etapas correspondentes (esconder bloco de IMEI/instalação quando `somente_fotos`)
- Migration: adicionar coluna `escopo text` em `instalacao_prestador_links` e `vistoria_prestador_links` (default mapeado do estado atual por backfill)

## Validação

1. Atribuir prestador a um serviço `vistoria_entrada` de sub-FIPE com escopo "Somente Fotos" → link público mostra só fotos + vídeo.
2. Atribuir o mesmo tipo de serviço com escopo "Fotos + Instalação" → link público mostra fotos + etapas de IMEI/instalação; ao concluir, `instalacoes` fecha.
3. Atribuir Troca de Titularidade com "Fotos + Instalação" → instalação física é registrada e rastreador novo é vinculado.
4. Atribuir veículo que exige rastreador escolhendo "Somente Fotos" → aviso aparece, link gera, mas o veículo não pode ser ativado (guard DB) até instalação posterior.
