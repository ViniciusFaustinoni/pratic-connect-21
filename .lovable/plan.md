## Causa raiz

No caso do KOU6D37 (Marcos Vinicius Dativo Machado):

1. Associado escolheu **Autovistoria**, enviou 2 fotos (`frente_centro`, `frente_lateral_esquerda`) → ficaram gravadas em `cotacoes_vistoria_fotos`.
2. Voltou e trocou para **"técnico vai até mim"** → `cotacoes.tipo_vistoria` virou `'agendada'` e `vistoria_data_agendada = 2026-05-14`.
3. As 2 fotos órfãs **continuaram** na tabela legacy.

No Cadastro:
- `usePropostasPendentes.ts` (linha 1035-1064) faz fallback em `cotacoes_vistoria_fotos` **sem checar o `tipo_vistoria` atual da cotação** → devolve `proposta.vistoria.fotos = [2 fotos]`.
- `PropostaAnalise.tsx` (linha 139): `cadastroAvaliaFotos = planoTemRouboFurto && temFotosOuVideo` → `true`.
- Resultado: stepper mostra "Fotos & Vistoria — Concluído" e o botão verde **"Liberar Cobertura Roubo e Furto"**, mesmo sem vistoria completa nem decisão do técnico.

Comportamento esperado (regra do usuário):
- R&F só pode ser liberado quando **todas** as fotos obrigatórias + vídeo 360° foram entregues numa autovistoria de fato concluída.
- Se o associado abandonou a autovistoria e migrou para vistoria com técnico, o Cadastro deve avaliar **apenas documentos** e liberar para o Monitoramento atribuir a instalação. As fotos parciais antigas não contam.

## Correção

### 1. Frontend — ignorar fotos parciais quando tipo_vistoria mudou

`src/hooks/usePropostasPendentes.ts` (ambas as ocorrências do fallback legacy — linhas ~640-665 e ~1035-1064):

- Antes de cair no fallback `cotacoes_vistoria_fotos`, checar `mCotacao.get(contrato.cotacao_id)?.tipo_vistoria` (já buscado no hook).
- Só usar as fotos legacy quando `tipo_vistoria === 'autovistoria'`. Se `'agendada'` ou `'agendada_base'`, devolver `vistoria = null` (técnico ainda vai fazer; partials são lixo).

### 2. Frontend — autovistoria incompleta não libera R&F

`src/pages/cadastro/PropostaAnalise.tsx` (linhas 116-144):

- Adicionar conceito `autovistoriaCompleta`:
  - Para autovistoria, exige `proposta.vistoria.video_360_url` presente **e** quantidade de fotos ≥ mínimo do roteiro (31 carro / 15 moto — usar `useDetectarTipoVeiculo` que já está no escopo).
- `cadastroAvaliaFotos = planoTemRouboFurto && temFotosOuVideo && (não é autovistoria || autovistoriaCompleta)`.
- Quando autovistoria incompleta: tratar como `isVistoriaAgendadaSemFotos` (mostra banner "vistoria pendente — só aprova documentos, instalação fica para Monitoramento").

### 3. Backend — limpeza de fotos órfãs ao trocar tipo_vistoria

Trigger em `cotacoes`: quando `tipo_vistoria` muda de `'autovistoria'` para outro valor, **apagar** rows correspondentes em `cotacoes_vistoria_fotos` da mesma `cotacao_id` (evita lixo crescente e reforça a regra no banco).

Migração também roda DELETE one-shot para limpar órfãs históricas (todas as cotações onde `tipo_vistoria != 'autovistoria'` e ainda têm linhas em `cotacoes_vistoria_fotos`) — o caso do KOU6D37 fica sanado.

### 4. Verificação no caso reportado

Após aplicar:
- Cotação `71d97652-ea80-4aac-9172-2e302a1b575a` perde as 2 fotos órfãs.
- Stepper do contrato `bfa583c8…` passa a mostrar somente Documentos + Aprovação, com o botão "Aprovar para Monitoramento" (sem liberar R&F).
- Após aprovação, fluxo segue para `aguardando_monitoramento` para atribuição da instalação pelo técnico — exatamente como pedido.

## Arquivos afetados

- `src/hooks/usePropostasPendentes.ts` (2 blocos de fallback)
- `src/pages/cadastro/PropostaAnalise.tsx` (lógica `cadastroAvaliaFotos`)
- Nova migration SQL: trigger `tg_cotacoes_limpar_fotos_autovistoria_abandonada` + DELETE one-shot
