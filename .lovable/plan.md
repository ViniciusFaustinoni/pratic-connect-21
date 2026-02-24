

# Bifurcacao do Fluxo de Colisao: Com Reboque vs Sem Reboque

## Resumo

Reestruturar o fluxo pos-aprovacao de eventos de colisao em dois caminhos distintos baseados na pergunta "O veiculo consegue andar?", com nova ordem de etapas (cota e termo antes da regulagem), separacao entre regulagem e orcamento, e acoes contextuais na tela de analise.

---

## Fase 1: Migracao de Banco de Dados

Adicionar colunas na tabela `sinistros`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `destino_reboque_tipo` | TEXT | `'associado'` ou `'oficina'` |
| `destino_reboque_endereco` | TEXT | Endereco informado pelo associado |
| `destino_reboque_oficina_id` | UUID (FK oficinas) | Oficina credenciada escolhida |
| `assistencia_acionada_em` | TIMESTAMPTZ | Quando o reboque foi acionado |
| `agendamento_regulagem_data` | TIMESTAMPTZ | Data/hora da regulagem agendada |
| `agendamento_regulagem_local` | TEXT | Local da regulagem |
| `agendamento_regulagem_periodo` | TEXT | 'manha', 'tarde' ou horario |
| `agendamento_regulagem_obs` | TEXT | Observacoes do agendamento |
| `regulagem_parecer` | TEXT | Parecer tecnico do regulador |
| `regulagem_tipo_dano` | TEXT | 'parcial' ou 'perda_total' |
| `regulagem_concluida_em` | TIMESTAMPTZ | Quando a regulagem foi concluida |
| `orcamento_oficina_id` | UUID (FK oficinas) | Oficina do orcamento |
| `orcamento_valor_total` | NUMERIC | Valor do orcamento |
| `orcamento_detalhamento` | JSONB | Pecas + mao de obra |
| `orcamento_prazo_reparo` | TEXT | Prazo estimado |
| `orcamento_status` | TEXT | 'solicitado', 'recebido', 'aprovado', 'rejeitado' |
| `orcamento_data` | TIMESTAMPTZ | Data do orcamento |
| `agendamento_entrada_oficina_data` | TIMESTAMPTZ | Data para levar veiculo a oficina |
| `agendamento_entrada_oficina_obs` | TEXT | Observacoes |

O campo `necessita_reboque` (boolean) ja existe na tabela.

---

## Fase 2: Atualizar Tipos e Workflow (src/types/sinistros.ts)

### 2.1 Novos status

Adicionar ao tipo `StatusSinistro`:
- `aguardando_agendamento` (so caminho B)
- `aguardando_regulagem` (ambos caminhos)
- `aguardando_orcamento` (ambos caminhos)
- `aguardando_pecas` (ja existe como `aguardando_peca`)
- `aguardando_entrada_oficina` (so caminho B)
- `reparo_concluido` (ambos caminhos)
- `assistencia_acionada` (caminho A, intermediario)

### 2.2 Atualizar WORKFLOW_SINISTRO

Redefinir as transicoes pos-aprovacao para colisao:

```text
Caminho A (com reboque):
aprovado -> aguardando_cota -> aguardando_termo -> aguardando_regulagem
-> aguardando_orcamento -> aguardando_pecas -> em_reparo -> reparo_concluido

Caminho B (sem reboque):
aprovado -> aguardando_cota -> aguardando_termo -> aguardando_agendamento
-> aguardando_regulagem -> aguardando_orcamento -> aguardando_pecas
-> aguardando_entrada_oficina -> em_reparo -> reparo_concluido
```

As transicoes do WORKFLOW_SINISTRO serao atualizadas para refletir estes dois caminhos. Os status existentes que nao sao de colisao permanecem inalterados.

### 2.3 Labels e cores dos novos status

Adicionar entradas em `STATUS_SINISTRO_LABELS` e `STATUS_SINISTRO_COLORS`.

---

## Fase 3: Formulario de Abertura (NovoSinistroModal.tsx)

### 3.1 Substituir toggle de reboque por UI bifurcada

Quando `tipo === 'colisao'`, substituir o Switch simples por:

**Pergunta 1**: Dois cards selecionaveis grandes:
- "O veiculo consegue andar" (icone carro, borda verde)
- "O veiculo precisa de reboque" (icone caminhao, borda vermelha)

**Pergunta 2** (se "precisa de reboque"):
- "Associado tem local seguro" -> campo de endereco aparece
- "Nao tem local -- enviar para oficina" -> Select de oficinas credenciadas (usando `useOficinas({ status: 'ativo' })`)

### 3.2 Novos states

```
const [destinoReboqueTipo, setDestinoReboqueTipo] = useState<'associado' | 'oficina' | ''>('');
const [destinoReboqueEndereco, setDestinoReboqueEndereco] = useState('');
const [destinoReboqueOficinaId, setDestinoReboqueOficinaId] = useState('');
```

### 3.3 Atualizar insertData

Incluir os novos campos no objeto de insercao:
- `destino_reboque_tipo`
- `destino_reboque_endereco`
- `destino_reboque_oficina_id`

### 3.4 Atualizar criacao do chamado de reboque

Quando `necessitaReboque`, incluir o destino (endereco ou oficina) na descricao do chamado de assistencia.

---

## Fase 4: Tela de Analise (SinistroAnalise.tsx)

### 4.1 Badge de caminho

No header, apos o badge de status, adicionar:

- Se `tipo === 'colisao'` e `necessita_reboque === true`: Badge vermelho "COM REBOQUE"
- Se `tipo === 'colisao'` e `necessita_reboque === false`: Badge verde "SEM REBOQUE"

Se com reboque, exibir tambem: "Destino: [nome da oficina ou endereco]"

### 4.2 Card de informacoes de reboque

Novo card na coluna direita (visivel quando `necessita_reboque`):
- Titulo: "Assistencia 24h"
- Exibir: destino, tipo (oficina/associado), data do acionamento, protocolo do chamado
- Link para o chamado de assistencia vinculado

### 4.3 Acoes contextuais por status

Atualizar a secao de "Acoes" para renderizar botoes diferentes conforme o status do evento de colisao:

| Status | Acao Principal | Descricao |
|--------|----------------|-----------|
| `aprovado` | "Enviar Cobranca da Cota" | Aciona cobranca via Asaas |
| `aguardando_cota` | "Verificar Pagamento" + "Reenviar Link" | Polling + reenvio |
| `aguardando_termo` | "Enviar Termo" + "Reenviar Lembrete" | Envio via Autentique |
| `aguardando_agendamento` (B) | "Registrar Agendamento" | Modal com data/horario/local |
| `aguardando_regulagem` | "Atribuir Regulador" | Ja existe mecanismo similar |
| `aguardando_orcamento` | "Solicitar Orcamento" | Modal com selecao de oficina, dados da regulagem |
| `aguardando_pecas` | "Registrar Chegada de Pecas" | Marca pecas recebidas |
| `aguardando_entrada_oficina` (B) | "Confirmar Entrada na Oficina" | Registra que veiculo chegou |
| `em_reparo` | "Concluir Reparo" | Marca reparo como concluido |

### 4.4 Card "Dados da Regulagem"

Quando `regulagem_concluida_em` estiver preenchido, exibir card com:
- Parecer tecnico
- Tipo de dano (parcial/perda total)
- Data da conclusao
- Fotos do regulador (ja existentes)

### 4.5 Card "Orcamento"

Quando `orcamento_status` existir, exibir card com:
- Oficina responsavel
- Valor total
- Detalhamento
- Prazo estimado
- Status do orcamento (solicitado/recebido/aprovado/rejeitado)
- Botao para aprovar/rejeitar orcamento

---

## Fase 5: Modal de Agendamento de Regulagem

Criar componente `AgendarRegulagemModal.tsx`:
- Campo: Data agendada (date picker)
- Campo: Periodo (manha/tarde) ou horario especifico
- Campo: Local (endereco onde o veiculo esta)
- Campo: Observacoes
- Salvar nos campos `agendamento_regulagem_*` do sinistro
- Registrar historico
- Avancar status para `aguardando_regulagem`

---

## Fase 6: Modal de Solicitar Orcamento (expandir existente)

O `SolicitarOrcamentoDialog.tsx` ja existe. Expandir para incluir:
- Selecao de oficina (pode ser diferente da oficina do reboque)
- Exibir dados da regulagem (fotos, pecas, parecer) como referencia
- Campos para registrar orcamento recebido (valor, detalhamento, prazo)
- Status do orcamento
- Salvar nos campos `orcamento_*` do sinistro

---

## Fase 7: Modal de Registrar Entrada na Oficina

Criar componente `RegistrarEntradaOficinaModal.tsx` (caminho B):
- Campo: Data de entrada
- Campo: Observacoes
- Salvar e avancar status para `em_reparo`

---

## Fase 8: Atualizar statusConfig em todas as telas

Atualizar os mappings de status/labels/cores nos seguintes arquivos:
- `SinistroDetalhe.tsx` (statusConfig, linhas 74-112)
- `SinistroAnalise.tsx` (statusConfig, linhas 85-97)
- `SinistroTimeline.tsx` (statusConfig)
- `AtualizarStatusModal.tsx` (usa WORKFLOW_SINISTRO - atualizado automaticamente)
- `EventosPreAnalise.tsx` (nao muda - so status pre-analise)
- `SinistrosList.tsx` (adicionar novos status aos filtros)

---

## Fase 9: Stepper do Evento Publico (EventoStepper + EventoColisao)

O fluxo publico do associado (via link) ja funciona com 4 etapas (Vistoria, BO, Agendamento, Pagamento). Este fluxo NAO muda - ele continua sendo o processo de documentacao pre-analise. As mudancas deste plano sao todas no fluxo POS-APROVACAO, que e gerenciado internamente pelo analista.

---

## Resumo de Arquivos Afetados

| Arquivo | Tipo de Alteracao |
|---------|-------------------|
| Migration SQL (nova) | ALTER TABLE sinistros ADD COLUMN (18 colunas) |
| `src/types/sinistros.ts` | Novos status, labels, cores, workflow |
| `src/components/eventos/NovoSinistroModal.tsx` | UI bifurcada para colisao |
| `src/pages/eventos/SinistroAnalise.tsx` | Badge, cards, acoes contextuais |
| `src/pages/eventos/SinistroDetalhe.tsx` | statusConfig atualizado |
| `src/components/eventos/SinistroTimeline.tsx` | statusConfig atualizado |
| `src/components/eventos/AgendarRegulagemModal.tsx` | NOVO componente |
| `src/components/sinistros/RegistrarEntradaOficinaModal.tsx` | NOVO componente |
| `src/components/sinistros/SolicitarOrcamentoDialog.tsx` | Expandido |

## O que NAO muda

- Fluxos de roubo, furto, incendio, fenomeno natural, vidros
- Logica de sindicancia, analise interna, juridico
- Fluxo publico do associado (link de auto-vistoria)
- Documentacao obrigatoria
- Calculo de cota de coparticipacao
- Integracao com Autentique (termo)
- Integracao com Asaas (pagamento)

---

## Ordem de Implementacao Sugerida

Dada a complexidade, sugere-se dividir em 3 a 4 mensagens:

1. **Migration + Types**: Schema do banco + tipos/workflow TypeScript
2. **NovoSinistroModal**: UI bifurcada na abertura do evento
3. **SinistroAnalise (parte 1)**: Badges, cards informativos, modais novos
4. **SinistroAnalise (parte 2)**: Acoes contextuais por status, statusConfig em todas as telas

