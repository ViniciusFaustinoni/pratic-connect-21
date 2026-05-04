## Diagnóstico revisado (sem migration)

A estrutura para endereço de instalação **já existe e está correta**:

- A edge `agendar-vistoria-presencial` cria a `instalacoes` com seus próprios `logradouro/numero/bairro/cidade/uf/cep/data_agendada/periodo/permite_encaixe`.
- Para o caso da Hayssa (placa TDC6E30), o banco confirma:
  - `cotacoes.vistoria_*` = ESTRADA INTENDENTE MAGALHÃES, 05/05, tarde (vistoria base — snapshot)
  - `instalacoes` ativa = R INACIA GERTRUDES 310, PARQUE ANCHIETA, 04/05, manhã (instalação real reagendada)

Portanto **não há perda de dado, não falta coluna, não precisa migração**. O bug é só de leitura: três telas estão mostrando os campos antigos `vistoria_*` da cotação em vez de ler da `instalacoes` ativa.

## Correções

### 1. `src/hooks/usePropostasPendentes.ts` + `src/pages/cadastro/PropostasPendentes.tsx`
Carregar a `instalacoes` ativa (status diferente de `cancelada`/`concluida`) por contrato/cotação e expor `instalacao_endereco`, `instalacao_data`, `instalacao_periodo`. No card, adicionar uma linha:
`📍 Instalação: {logradouro}, {numero} — {bairro}/{cidade} · {data} {periodo}`.

### 2. `src/pages/monitoramento/AcionamentosRouboFurto.tsx` (aba Aprovação) e `ServicoDetalheModal`
Na aba "Aprovação de Associados" do monitoramento, exibir dois blocos:
- **Endereço cadastral** (do associado/contrato)
- **Endereço de instalação** (da `instalacoes` ativa) com data e período corretos.

### 3. Portal público — `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx` e `src/pages/public/AcompanhamentoProposta.tsx`
Hierarquia de leitura:
1. `instalacoes` ativa da cotação (preferencial)
2. `servicos` ativo do tipo instalação
3. fallback `cotacoes.vistoria_*` (apenas se não houver instalação criada)

Card "Instalação do Rastreador" mostra endereço completo + data + período vindos da instalação ativa.

## Arquivos a editar

- `src/hooks/usePropostasPendentes.ts`
- `src/pages/cadastro/PropostasPendentes.tsx`
- `src/pages/monitoramento/AcionamentosRouboFurto.tsx` (e modal de detalhe usado lá)
- `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`
- `src/pages/public/AcompanhamentoProposta.tsx`

## Não faremos

- Nenhuma migração de schema (estrutura já suficiente).
- Nenhuma alteração no fluxo de coleta do endereço (já coleta corretamente em `AgendamentoVistoria.tsx` e persiste via `agendar-vistoria-presencial`).
- Nenhuma alteração na edge `criar-instalacao-pos-pagamento` para este bug (ela já é fallback quando não houve agendamento prévio).

## Validação

Reabrir a proposta da Hayssa (TDC6E30) após o deploy e confirmar que:
- PropostasPendentes mostra `R INACIA GERTRUDES 310 · 04/05 manhã`.
- Aba Aprovação no monitoramento mostra os dois endereços distintos.
- Portal público da cotação mostra a data/período/endereço da instalação real (não mais Intendente Magalhães 05/05 tarde).
