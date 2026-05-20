## 🔎 Diagnóstico — TIB8F32 (GUSTAVO AFONSO DE CARVALHO)

**Dados no banco**
- Contrato `5ca55b9f…` criado **19/05 15:25** com `cadastro_aprovado=true` (assinado antes das migrações D1 do dia 20/05).
- FIPE R$ 107.271 → **acima do mínimo**, rastreador obrigatório.
- Vistoria `5f9c56b0…` `modalidade='autovistoria'`, `status='aprovada'` (autovistoria opcional enxuta).
- Instalação `79613c9a…` `status='agendada'` para 20/05 → instalação técnica **ainda não aconteceu**.
- Serviço `8a6f3676…` `tipo='instalacao'` `status='agendada'`, `modalidade='presencial'`.
- Veículo `instalacao_pendente`, associado `aguardando_instalacao`. **Nenhum rastreador vinculado.**

**Como caiu contaminado (root cause histórica)**
1. Pré-D1, `aprovar-proposta` da autovistoria opcional acima-FIPE chamava `cadastro_aprovado=true` no contrato (efeito colateral que a memória `autovistoria-nao-promove-cadastro` agora proíbe via filtro `modalidade='autovistoria'` nos triggers).
2. TIB8F32 é exatamente um dos 5 fantasmas (KNO3F78, KZK1I95, LLF7F07, TIB8F32, KOA4D63) que a diretoria decidiu **não sanear** no banco.

**Por que o botão aparece**
- As filas (`useInstalacoesAguardandoAprovacao`, `useInstalacoesAguardandoAtivacao`) exigem `status='concluida'`. TIB8F32 **não aparece nas listas**.
- Mas a rota `/monitoramento/aprovacao-associados/:id` (componente `AprovacaoInstalacaoDetalhe.tsx`) é alcançável por link direto/breadcrumb/histórico e **não tem nenhum guard**: ela sempre exibe "Aprovar — Ativar Proteção 360", mesmo quando:
  - O serviço/instalação ainda está `agendada` (instalação física não ocorreu);
  - Não há rastreador vinculado em veículo que exige rastreador;
  - A única evidência é autovistoria opcional acima-FIPE (que não substitui a instalação técnica).

---

## 🎯 Objetivo

Bloquear, na UI, qualquer aprovação prematura por essa rota — sem mexer nos 5 fantasmas e sem regredir o D1. Casos novos já caem corretos; o que falta é a porta dos fundos.

---

## 🛠️ Mudanças propostas (frontend-only)

### 1. Hard guard em `AprovacaoInstalacaoDetalhe.tsx` (bloco de Ações, linhas 912-971)

Bloquear render do botão **"Aprovar — Ativar Proteção 360"** e exibir banner explicativo quando qualquer uma destas condições for verdadeira:

| Condição | Mensagem |
|---|---|
| `servico.status !== 'concluida'` (ainda `agendada`/`em_execucao`) | "Aguardando conclusão da instalação técnica. A aprovação só será liberada após o técnico fechar a vistoria presencial." |
| Veículo exige rastreador (FIPE≥30k carro / ≥9k moto / diesel) **E** não há `rastreadores` com `veiculo_id = veiculo.id` | "Veículo exige rastreador físico e nenhum está vinculado. Conclua a instalação técnica antes de aprovar." |
| Única evidência é vistoria com `modalidade='autovistoria'` (sem `servicos` técnico concluído) **E** veículo está acima da FIPE mínima | "Esta autovistoria é opcional e libera apenas Roubo & Furto. A aprovação final acontece após a instalação técnica do rastreador." |

O botão **Reprovar** continua disponível em todos os cenários (operação precisa poder devolver casos contaminados ao fluxo). O dialog "Solicitar Vistoria de Técnico" permanece só para sub-FIPE como hoje.

### 2. Reutilizar `veiculoSubFipe` + nova helper `exigeInstalacaoTecnica(veiculo)`

Centralizar a regra (carro ≥ 30k, moto ≥ 9k, diesel sempre) em uma única função para casar com a memória `[Tracker eligibility]` e o trigger `trg_guard_veiculo_ativo_exige_rastreador`. Já existe `veiculoSubFipe` em `useSolicitarVistoriaTecnico` — adicionar contraparte ou exportar inversa.

### 3. Carregar rastreador vinculado na query do detalhe

`useServicoDetalheAprovacao` (linha 45) hoje não traz rastreadores. Adicionar `.from('rastreadores').select('id').eq('veiculo_id', veiculo.id).limit(1)` paralelo para alimentar o guard.

### 4. Nada de mudanças em DB / edge / triggers

- **Não** rodar migration sobre os 5 fantasmas (decisão da diretoria mantida).
- **Não** alterar triggers nem `aprovar-proposta` (D1 já cobre casos novos).
- **Não** mexer nas filas — elas já filtram corretamente.

---

## 📦 Arquivos a editar

- `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` — query de rastreador + bloco de ações com guards e banners.
- `src/hooks/useSolicitarVistoriaTecnico.ts` (ou novo `src/lib/veiculo/exigeInstalacaoTecnica.ts`) — exportar helper `exigeInstalacaoTecnica(veiculo)` casando com a regra canônica.
- `mem://logic/operations/monitoramento-guard-aprovacao-sem-instalacao.md` — registrar a guarda de UI e por que existe (fantasmas pré-D1 + porta dos fundos via URL).
- `mem://index.md` — referência ao novo memo.

## ✅ Critério de aceite

Para **TIB8F32** (e os outros 4 fantasmas, se alguém abrir a URL):
- Tela carrega com banner amber explicando que a instalação técnica está pendente.
- Botão "Aprovar — Ativar Proteção 360" não aparece (ou fica `disabled` com tooltip).
- Botão "Reprovar" continua disponível.
- Após a instalação física concluir (`servicos.status='concluida'` + rastreador vinculado), o caso volta a ser aprovável normalmente — sem retrabalho operacional.

Para **casos novos** acima-FIPE com autovistoria opcional:
- Continuam aparecendo na fila apenas após instalação técnica concluída (comportamento atual mantido).
- Se alguém forçar a URL antes disso, o mesmo guard impede aprovação prematura.

## ❓ Antes de implementar

Confirma que esse é o caminho? Em particular: você quer **bloquear o botão completamente** (some) ou **disabled com tooltip** explicando o motivo? Eu sugiro bloquear + banner amber bem visível, mas a sua preferência manda.
