# Re-auditoria E2E dos Fluxos de Cotação

Vou rodar uma auditoria **real** (não só leitura de código) dos 4 fluxos contra o manual que você reapresentou, usando a conta `admin@teste.com` e cruzando 3 camadas: **código + banco + execução no preview**.

## Metodologia (aplicada a cada fluxo)

Para cada fluxo executo o mesmo ciclo:

1. **Trace de código** — mapeio o caminho real desde o ponto de entrada até `ativar-associado` e listo cada gate (trigger, edge function, hook).
2. **Sonda de banco** — consulto `cotacoes`, `contratos`, `vistorias`, `servicos`, `instalacoes`, `agendamentos_base` e `solicitacoes_*` em registros recentes para confirmar que os estados intermediários batem com a regra.
3. **Execução no preview** — entro no sistema como diretor, crio uma cotação de teste, percorro o link público e observo a fila correta em cada etapa (Cadastro → Monitoramento → Ativos).
4. **Veredito** — para cada item da regra: ✅ conforme, ⚠️ conforme com ressalva, ou ❌ divergente. Divergências viram cards de correção propostos (não aplicados nesta rodada).

## Escopo de cada fluxo

### Fluxo 1 — Cotação Comum (8 etapas)
Verifico em ordem:
- (1) Link público respeita FIPE: redireciona para autovistoria 2-fotos+vídeo OU agendamento de instalação conforme valor + tipo de veículo.
- (2) Cadastro recebe com snapshot SGA (existência + situação financeira) — testo um CPF que existe no SGA com débito.
- (3) Aprovar Cadastro gera serviço de campo; se pediu doc, link público volta para etapa de docs.
- (4) Monitoramento vê o serviço.
- (5) Atribuição funciona (técnico interno OU prestador).
- (6) Vistoria executa (mock conclusão).
- (7) Monitoramento aprova final → `ativar-associado`.
- (8) Some das filas, aparece em Associados+Veículos, situação SGA = PENDENTE (3) — confirmo via API SGA log.

### Fluxo 2 — Troca de Titularidade
Foco no sintoma que você relatou: **"sistema erra e a solicitação é aprovada pelo Cadastro direto, sem chegar no painel"**.
- Reproduzo: assino termo do antigo associado → acesso link do novo → faço autovistoria.
- Confirmo em banco: `solicitacao.status` permanece `aguardando_cadastro` (não pula para `liberada_para_assinatura` ou `aguardando_monitoramento` sem clique humano).
- Verifico que `aprovar-troca-cadastro` exige clique manual em `/cadastro/aprovacoes-troca`.
- Testo decisão do Monitoramento: aprovar direto vs. pedir vistoria (fotos / fotos+instalação) → link público vira agendamento → vistoria volta para fila do Monitoramento.
- Botão "Solicitar manutenção de rastreador" presente na tela de aprovação.
- Cron `cron-expirar-trocas-titularidade` cancela à meia-noite e invalida link antigo.

### Fluxo 3 — Sub-FIPE (abaixo do mínimo p/ rastreador)
- Cotação com FIPE abaixo do mínimo: link público mostra plano sem rastreador → docs → assinatura → pagamento → **autovistoria 31 ou 15 fotos** (mesma estrutura do técnico).
- Vai pro Cadastro → ao aprovar libera R/F (`cobertura_roubo_furto=true`) e promove `vistoria_entrada` para `concluida`.
- Vai pro Monitoramento → tela mostra botão "Solicitar vistoria de fotos" + opção "Aprovar direto sem vistoria".
- Se pedir vistoria: link público atualiza para agendamento, gera `instalacoes(dispensa_rastreador=true)` → técnico só tira fotos (sem instalação) → volta pra fila do Monitoramento → aprovação final → `ativar-associado` → SGA.

### Fluxo 4 — Substituição
- Modal "Outras entradas" → Substituição pede placa primeiro.
- Consulta SGA (`useBuscaPlaca` + `criar-solicitacao-substituicao` snapshot).
- Bloqueia se houver débito vinculado àquele veículo (não só ao associado).
- Termo de cancelamento (Autentique facial) → após assinado, botão "Criar Nova Cotação" abre cotador padrão pré-preenchido.
- Cotação segue idêntica à comum mas com `tipo_entrada='substituicao_placa'` — passa pelas 8 etapas do Fluxo 1.
- `efetivar-substituicao` ao final inativa veículo antigo no SGA (situação 2).

## Entregável desta rodada

Um único relatório consolidado por fluxo com:
- Tabela de itens da regra × veredito × evidência (linha de código / id de registro / screenshot do preview).
- Lista priorizada de divergências encontradas (se houver) com proposta de correção pontual — você decide quais aplico em rodadas seguintes.

## Detalhes técnicos

- **Sem mudanças de código nesta rodada** — é auditoria pura. Qualquer fix vira tarefa separada após sua aprovação.
- **Dados de teste** — uso CPFs/placas fictícios; quando precisar de associado real do SGA, te peço autorização antes.
- **Ordem de execução**: Fluxo 1 → 2 → 3 → 4 (mesma ordem do manual).
- **Tempo estimado**: ~4 rodadas (uma por fluxo) já que cada uma exige interação no preview + consultas de banco.

## Premissas / pontos de confirmação

- Posso usar a conta `admin@teste.com` para criar cotações de teste reais (que ficarão no banco e podem precisar ser limpas depois).
- Se a auditoria detectar que o problema relatado em Troca já está corrigido em código mas reapareceu por dado legado, sinalizo para você decidir se rodamos uma migração de reconciliação.
