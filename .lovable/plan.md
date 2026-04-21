

## Detalhe de serviço em monitoramento — equiparar à visão completa do cadastro + filtros precisos de jornada

### Por que ainda não está nesse formato (resposta direta)

O modal atual `ServicoDetailModal` (`src/components/servicos-campo/ServicoDetailModal.tsx`) foi construído como uma "ficha do serviço" — mostra só dados da vistoria/instalação em si: agendamento, cliente resumido, veículo, endereço, rastreador e timeline. Foi entregue assim em iteração focada na operação de campo. **Não foi integrado** ao `AssociadoDetalhe` (`src/pages/cadastro/AssociadoDetalhe.tsx`), que já reúne fotos da vistoria, documentos aprovados, cobranças, contrato, histórico e situação. O componente `AssociadoDetalhe` **já aceita `associadoId` + `isModal` como props** (já é usado assim em `Associados.tsx`), então a base para essa unificação visual existe — só não foi aplicada em monitoramento.

Sobre os filtros: a aba "Serviços" hoje filtra por **tipo, status, origem do técnico, cidade, UF e busca livre**. Não tem filtro por **fase da jornada do associado** (ex.: "documentos aprovados aguardando agendamento", "vistoria reprovada aguardando reagendamento", "instalação concluída aguardando ativação"). E em vendas/cotações o filtro é por **status técnico da cotação**, não por **fase comercial percebida** (rascunho ≠ esperando assinatura ≠ esperando pagamento ≠ aguardando vistoria).

### O que vou fazer

#### Parte 1 — Detalhe do serviço com visão completa do associado

No modal `ServicoDetailModal` atual, **acrescentar** (não substituir) acesso à ficha completa, em duas camadas:

**a) Tabs novas dentro do próprio modal**, alimentadas pelos hooks que o `AssociadoDetalhe` já usa, sem duplicar código:
- **"Documentos"** → `useDocumentosPorAssociado(associadoId)` + `useDocumentosCotacao(cotacaoId)`. Lista CNH, CRLV, comprovante, contrato com badge de status (aprovado / em análise / reprovado) e link para preview do arquivo (mesmo `<Dialog>` de imagem/PDF já usado).
- **"Fotos da vistoria"** → `useFotosVistoriaUnificada({ contratoId, cotacaoId })` agrupadas por categoria (`agruparFotosPorCategoria`). Já é o mesmo hook usado em `InstalacaoDetalhe.tsx` linhas 73-87.
- **"Financeiro"** → `useResumoFinanceiroAssociado(id)` + `useCobrancasAssociado(id)`. Mostra adimplência, próxima cobrança e últimas 5 cobranças.
- **"Histórico do associado"** → `useAssociadoHistoricoCompleto(id)`. Linha do tempo unificada: cotação → contrato → vistoria/instalação → ativação → cobranças → sinistros → reagendamentos.

**b) Botão "Abrir ficha completa do associado"** no header do modal, ao lado de WhatsApp/Maps. Abre um segundo `Dialog` (largo, full-height) renderizando `<AssociadoDetalhe associadoId={associadoId} isModal onClose={...} />` — exatamente o mesmo componente do cadastro, sem duplicar UI. Para casos onde o monitoramento precisa de tudo (suspender, editar contatos, ver veículos paralelos, sinistros, etc.), o usuário tem a ficha integral sem sair do contexto.

A ficha rápida (resumo, cliente & veículo, endereço, rastreador, retirada, histórico) **continua igual** — só ganha as 4 tabs novas e o botão de ficha completa.

#### Parte 2 — Filtro por **Fase da Jornada** em monitoramento

Adicionar em `ServicosFilters.tsx` um novo `Select` "Fase da Jornada" com opções derivadas do estado real do associado + serviço (computadas em `useServicosCampoUnificado`):

- Aguardando documentos
- Documentos em análise
- Documentos aprovados — sem agendamento
- Agendado — aguardando data
- Em rota / em execução
- Concluído — aguardando análise
- Concluído — aguardando ativação do rastreador (regra 48h já existe — `mem://logic/operations/suspensao-cobertura-48h`)
- Reprovado / com ressalvas — aguardando reagendamento
- Não compareceu — pendente de novo contato
- Cancelado / suspenso

Esses estados são calculados no hook a partir de campos já existentes (`status` do serviço, `documentos.status`, `rastreador.status_ativacao`, `analisado_em`, `motivo_reprovacao`, `nao_compareceu_em`).

#### Parte 3 — Filtro por **Etapa Comercial** em vendas/cotações

Em `src/pages/vendas/Cotacoes.tsx`, adicionar `Select` "Etapa do funil" (sem mexer no filtro de status técnico atual). Etapas mapeadas a partir de `status` + `status_contratacao` + presença de contrato/assinatura/pagamento:

- Rascunho (consultor montando)
- Enviada — aguardando cliente abrir
- Cliente escolhendo plano
- Plano escolhido — aguardando dados
- Dados preenchidos — aguardando documentos
- Documentos enviados — em análise
- Aguardando assinatura (Autentique enviado)
- Assinada — aguardando pagamento
- Paga — aguardando vistoria/instalação
- Convertida em associado
- Perdida / expirada

Reaproveita os campos `status_contratacao` que já são usados em `useFunilCotacao.ts` (linhas 124-132) — só faltava expor como filtro na listagem.

### Entregáveis técnicos

| Arquivo | Mudança |
|---|---|
| `src/components/servicos-campo/ServicoDetailModal.tsx` | + 4 tabs (Documentos, Fotos, Financeiro, Histórico) + botão "Ficha completa" |
| `src/components/servicos-campo/AssociadoFichaCompletaDialog.tsx` (novo) | Wrapper que abre `AssociadoDetalhe` em dialog |
| `src/hooks/useServicosCampoUnificado.ts` | + cálculo `faseJornada` por serviço + filtro |
| `src/components/servicos-campo/ServicosFilters.tsx` | + select "Fase da Jornada" |
| `src/pages/vendas/Cotacoes.tsx` | + select "Etapa do funil" |
| `src/hooks/useCotacao.ts` (ou hook auxiliar) | + cálculo `etapaFunil` por cotação |

### Critérios de aceitação

1. Ao clicar em qualquer linha de `/monitoramento/vistorias-instalacoes-mon`, o modal abre com as tabs antigas + **Documentos / Fotos / Financeiro / Histórico** funcionando.
2. Documentos aprovados, em análise e reprovados aparecem com badge correto; clique abre preview.
3. Fotos da instalação/vistoria aparecem agrupadas por categoria, idênticas ao que aparece em `InstalacaoDetalhe`.
4. Botão "Ficha completa do associado" abre a tela `AssociadoDetalhe` integral em modal sobre o modal atual, sem reload de página.
5. Em "Serviços", o novo filtro "Fase da Jornada" recorta corretamente cada estado descrito acima e combina com os filtros existentes (AND).
6. Em "Cotações" (`/vendas/cotacoes`), o novo filtro "Etapa do funil" mostra exatamente em que ponto comercial cada cotação está.
7. Nada do comportamento atual quebra: quem usa o modal só pra ver agendamento/endereço continua tendo a aba Resumo aberta por padrão.

### Fora de escopo

- Refatorar `AssociadoDetalhe` em si (continua como está; só passamos a abri-lo embutido).
- Ações de escrita novas no modal (suspender/cancelar/editar contatos vão pela ficha completa, que já tem isso).
- Unificar rotas `/monitoramento/...` com `/cadastro/associados/...` — o usuário pediu **visualização equivalente**, não fusão de rotas.
- Filtros adicionais por valor financeiro / faixa de adimplência (posso fazer em iteração futura se quiser).

