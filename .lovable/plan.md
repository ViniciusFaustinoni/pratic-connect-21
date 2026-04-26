## Contexto da revisão

O fluxo descrito **já existe em ~80%**. Após varredura completa do código, identifiquei apenas **3 ajustes** a fazer (o resto está conforme sua especificação).

### O que JÁ está OK (não vamos mexer)
- Botão do link de vistoria aparece na cotação (`VistoriaLinkBlock` no `CotacaoDetalhesModal`).
- Etapa de fotos pública (qualquer pessoa, sem login).
- Aprovação no monitoramento (aba "Aprovar Fotos") + reprovação com motivo.
- Botão "Realizar Fotos" some após aprovação; botão "Realizar Instalação" só acende após `fotos_aprovadas_em`.
- Login do técnico com auto-atribuição via `/vistoria/:token/assumir-instalacao`.
- Aviso "Instalação já atribuída" (sem redirecionar para login) quando outro técnico já assumiu.

---

## Ajustes a implementar

### 1. Gerar o link no agendamento (não só no aprovar-proposta)

Hoje o `gerar-link-vistoria-publica` só é chamado dentro de `aprovar-proposta` (após o financeiro aprovar). Pelo seu requisito, o link deve nascer **quando o associado conclui o agendamento**.

**Onde vou tocar:**
- `supabase/functions/agendar-vistoria-completa/index.ts` — adicionar chamada idempotente a `gerar-link-vistoria-publica` ao final, com `instalacao_id` recém-criado/existente.
- `supabase/functions/agendar-vistoria-presencial/index.ts` — mesma adição.
- Manter a chamada existente em `aprovar-proposta` (idempotente — se já existir, não duplica).

Resultado: assim que o associado finaliza o agendamento (com ou sem auto-vistoria), o link já está disponível na cotação.

### 2. Fork do analista de cadastro pós-instalação (sem auto-vistoria)

Conforme sua resposta:
- **COM auto-vistoria** → analista de cadastro **já aprovou antes**, então ao concluir a instalação ativa o veículo e envia ao SGA. *(comportamento atual em `aplicar-conclusao-vistoria` já segue essa linha)*
- **SEM auto-vistoria** → ao concluir a instalação, o caso deve ir para a **fila do analista de cadastro** primeiro. Só após aprovação do analista é que ativa e envia ao SGA.

**Onde vou tocar:**
- `supabase/functions/concluir-etapa-instalacao-publica/index.ts` (ou no `aplicar-conclusao-vistoria` que ele chama): detectar se a cotação tem auto-vistoria aprovada. Se **não tiver**, marcar a instalação com status `aguardando_analise_cadastral` e **não** disparar `sga-hinova-sync` ainda.
- `aprovar-cadastro-analista` (ou função equivalente que o analista já usa hoje): ao aprovar, disparar a ativação + envio ao SGA que hoje roda dentro de `aplicar-conclusao-vistoria`.
- Tela do analista de cadastro: garantir que a nova instalação aparece na fila dele (vou primeiro inspecionar a tela existente e só ajustar o filtro se necessário).

### 3. Ajuste fino do `VistoriaLinkBlock` na cotação

Hoje o bloco mostra status só de "Fotos" e "Instalação". Para refletir o gating real:
- Adicionar um terceiro estado visual entre fotos e instalação: **"Aprovação do monitoramento"** (com badge "Pendente" / "Aprovada" / "Reprovada").
- Adicionar um quarto estado para o fluxo sem auto-vistoria: **"Análise cadastral"** (só aparece quando aplicável).

Essas mudanças deixam o vendedor enxergando exatamente em que etapa o caso está parado, sem precisar abrir o monitoramento.

---

## Detalhes técnicos (resumo)

```text
Agendamento (presencial OU completa)
        │
        ├─ cria instalação
        ├─ chama gerar-link-vistoria-publica  ← NOVO
        │
        ▼
Link público disponível na cotação
        │
        ├─ Etapa 1: Fotos (qualquer pessoa)
        ▼
Monitoramento aprova fotos
        │
        ▼
Botão "Realizar Instalação" liberado
        │
        ├─ login técnico → assumir-instalacao-vistoria-link
        ▼
Etapa 2: Instalação concluída
        │
        ├─ auto-vistoria aprovada antes? ─── SIM ──► Ativa veículo + SGA
        │                                  
        └────────────────── NÃO ──► Fila Analista de Cadastro  ← NOVO FORK
                                              │
                                              ▼
                                    Analista aprova
                                              │
                                              ▼
                                    Ativa veículo + SGA
```

**Garantias:**
- Idempotência: `gerar-link-vistoria-publica` já trata duplicação por `instalacao_id`, então chamar nos dois pontos (agendamento + aprovar-proposta) é seguro.
- Trava server-side: `assumir-instalacao-vistoria-link` continuará rejeitando atribuição se `fotos_aprovadas_em` for null (defesa em profundidade contra burla do frontend).
- Nenhuma migração de schema necessária — colunas `fotos_aprovadas_em`, `tecnico_atribuido_id`, etc. já existem.

## Validação após implementação

Vou executar como diretor:
1. Criar uma cotação nova → completar o agendamento (sem auto-vistoria) → confirmar que o link aparece imediatamente na cotação.
2. Abrir o link público → enviar fotos → conferir na aba "Aprovar Fotos" do monitoramento.
3. Aprovar as fotos → confirmar que o botão "Realizar Instalação" acende.
4. Logar como técnico via link → confirmar auto-atribuição.
5. Concluir instalação → confirmar que cai na fila do analista de cadastro (e **não** vai direto ao SGA).
6. Aprovar como analista de cadastro → confirmar ativação e envio ao SGA.
7. Repetir o fluxo COM auto-vistoria e confirmar que pula direto para SGA.
