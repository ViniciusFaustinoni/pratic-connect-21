# Sub-FIPE: 3 vias de vistoria + decisão de rastreador na atribuição

Aplica-se SÓ a sub-FIPE (carro <30k / moto <9k, não-Diesel). Acima-FIPE, Diesel, Troca de Titularidade e Substituição ficam intocados.

## 1. Link público — chooser de 3 vias

Arquivo: `src/components/cotacao-publica/EtapaVistoria.tsx`

Hoje, quando `subFipe=true`, o componente pula direto para `modo='autovistoria'` (vistoria completa pelo celular). Vai virar um chooser dedicado sub-FIPE com 3 cards:

- **Via 1 — Vistoria Completa pelo celular**
  - Reusa o caminho atual (`AutovistoriaCotacao` com `fotosOverride={getFotosVistoriaSubFipe(...)}`).
  - Aviso no card: *"Se aprovada, você fica com a proteção completa."*
  - Encerra no celular, sem presencial.

- **Via 2 — Roubo e Furto pelo celular**
  - Renderiza `AutovistoriaCotacao` com o roteiro ENXUTO de R&F já existente (motor + chassi + vídeo 360°, mesmo que acima-FIPE). Marca a via na cotação.
  - Aviso no card: *"Assim que suas fotos forem aprovadas, você fica com proteção contra roubo e furto. Para ter a proteção completa, é necessário concluir a vistoria presencial com o técnico (na base ou na rota)."*
  - Ao concluir as fotos, força a próxima sub-etapa: escolher Base ou Rota (reusa `EscolhaBase` + `AgendamentoBase` e `AgendamentoCotacao` que já existem no componente).

- **Via 3 — Sem fotos**
  - Pula autovistoria, vai direto para escolher Base ou Rota.
  - Aviso no card: *"Você não terá nenhuma proteção até concluir a vistoria presencial com o técnico (na base ou na rota)."*

Acima-FIPE continua com o chooser atual (Autovistoria opcional / técnico / base), nada muda.

**Persistência da via escolhida**: gravar em `cotacoes.dados_extras.via_vistoria_sub_fipe` (`'completa_celular' | 'rf_celular' | 'sem_fotos'`) no momento da escolha — única fonte para o backend saber qual proteção liberar e se há presencial pendente.

## 2. aprovar-proposta — efeito da via na proteção

Arquivo: `supabase/functions/aprovar-proposta/index.ts`

Hoje sub-FIPE com autovistoria libera direto. Passa a respeitar a via:

| Via | Após aprovação do Cadastro | Após presencial |
|---|---|---|
| 1 — Completa celular | Proteção completa | n/a |
| 2 — R&F celular | Só Roubo & Furto | Completa |
| 3 — Sem fotos | Sem proteção | Completa |

Implementação: o edge lê `via_vistoria_sub_fipe`, e quando for Via 2 ou Via 3 cria/mantém o serviço presencial agendado (`vistoria_entrada`, `dispensa_rastreador=true` por padrão) já criado no link, sem ativar cobertura completa antes do presencial. Para Via 2, ativa apenas as flags de R&F; Via 3 mantém tudo suspenso até o presencial concluir.

`criar-instalacao-pos-pagamento` segue criando o serviço presencial quando o associado agenda; o que muda é só o cálculo de cobertura no aprovar-proposta.

## 3. Monitoramento — pergunta obrigatória na atribuição

Arquivos:
- `src/components/monitoramento/AtribuirVistoriadorModal.tsx` (atribuição técnico interno)
- `src/components/monitoramento/AtribuicaoManualTab.tsx` (lista/popover de atribuição)
- Hook de prestador externo (já existente)

Para serviços presenciais oriundos das vias 2 e 3 sub-FIPE, o coordenador passa a ver no modal de atribuição um bloco novo:

> **Este veículo vai necessitar de rastreador?**  
> ( ) Não — técnico executa apenas a vistoria completa  
> ( ) Sim — atendimento ganha a etapa de instalação e vínculo do rastreador

Regras:
- Botão "Atribuir" fica desabilitado enquanto a pergunta não tem resposta.
- A resposta é gravada com `respondido_por` (profile) e `respondido_em` (timestamp).
- Pode ser alterada até a atribuição ser efetivada; depois fica congelada.
- Via 1 (sem presencial) NÃO mostra a pergunta.
- Acima-FIPE NÃO mostra a pergunta.

Persistência: nova coluna `servicos.requer_rastreador_sub_fipe` (`boolean | null`) + `servicos.requer_rastreador_decidido_por` (uuid) + `servicos.requer_rastreador_decidido_em` (timestamptz). `null` = não respondido; `true/false` = decisão registrada.

## 4. Efeito da resposta no atendimento

- **Não** (caminho padrão): atendimento segue como vistoria-só-fotos exatamente como hoje em `solicitar-vistoria-tecnico-sub-fipe`/fluxo presencial sub-FIPE — `instalacoes.dispensa_rastreador=true`, técnico executa as 31/15 fotos, fim.
- **Sim** (exceção): no momento da atribuição, o serviço é promovido para incluir a etapa de instalação e vínculo de rastreador (mesma etapa que o técnico já executa em acima-FIPE). Em termos de dados: `instalacoes.dispensa_rastreador=false` e a execução do técnico passa a exigir IMEI/vínculo no final, reusando o caminho que já existe.

**Limite duro** (item 7 do briefing): nada além disso muda. `veiculos.categoria`, plano, cobrança, cobertura e enquadramento permanecem sub-FIPE. Os guards atuais (`trg_guard_veiculo_ativo_exige_rastreador`, `trg_guard_dispensa_rastreador_coerente`) precisam de ajuste para aceitar o caso "sub-FIPE com rastreador por exceção": sub-FIPE com rastreador vinculado por essa decisão passa pelo guard sem ser reclassificado como acima-FIPE. Plano dedicado "sub-FIPE com rastreador" fica para entrega futura.

## 5. Fora do escopo

- Obrigatoriedade de rastreador em sub-FIPE (continua opcional/exceção).
- Cobrança e plano (sem recálculo, sem nova taxa de adesão — reusa o que o consultor já definiu).
- Troca de titularidade, Substituição, Diesel, acima-FIPE.
- Plano dedicado de "sub-FIPE com rastreador".

## 6. Detalhes técnicos

**Frontend**
- `EtapaVistoria.tsx`: novo branch `subFipe===true` com chooser de 3 cards; cada card grava `via_vistoria_sub_fipe` em `cotacoes.dados_extras` antes de avançar; Via 2 sequencia autovistoria-R&F → escolha Base/Rota; Via 3 sequencia direto Base/Rota; copiar literalmente os avisos de proteção do item 4 do briefing.
- `AtribuirVistoriadorModal.tsx` + popover de atribuição manual: novo `RequerRastreadorRadioGroup` exibido quando `servico.origem_sub_fipe===true && servico.via_vistoria !== 'completa_celular'`; bloqueia submit enquanto `requer_rastreador_sub_fipe===null`.
- Telas do técnico (`ExecutarVistoriaCompleta` e similares) já leem `instalacoes.dispensa_rastreador` — sem mudança extra além de garantir que o caso "Sim" pede IMEI.

**Backend / DB**
- Migration: colunas em `servicos` (`requer_rastreador_sub_fipe`, `requer_rastreador_decidido_por`, `requer_rastreador_decidido_em`).
- Migration: ajustar guards de rastreador para reconhecer "sub-FIPE com rastreador por exceção" (flag derivada de `servicos.requer_rastreador_sub_fipe=true` no contrato/veículo).
- `aprovar-proposta`: ler `via_vistoria_sub_fipe`; ativar flags de cobertura conforme tabela do passo 2.
- `solicitar-vistoria-tecnico-sub-fipe`: continua usado por Via 2/3 vindas do agendamento; quando a atribuição responder "Sim", reaproveita o caminho de instalação técnica (toggle do `dispensa_rastreador` no momento da atribuição).

**Memórias afetadas (atualizar no fim da entrega)**
- `mem://logic/operations/autovistoria-dois-usos` → agora são 3 vias sub-FIPE.
- `mem://logic/operations/cadastro-escopo-canonico` → cadastro avalia Via 1 (completa) e Via 2 (R&F) no celular; Via 3 não tem o que avaliar além de docs.
- `mem://logic/operations/sub-fipe-nao-anuncia-protecao-ativada-pre-monitoramento` → cobertura agora depende de via + etapa.

## 7. Validação

1. Cotação carro sub-FIPE (<30k) → abrir link público → ver os 3 cards com os avisos exatos.
2. Via 1: completar fotos → aprovar Cadastro → conferir proteção completa, sem serviço presencial criado.
3. Via 2: completar R&F → aprovar Cadastro → conferir R&F ativo, completa suspensa → escolher Base/Rota → serviço cai no Monitoramento → modal de atribuição exige a pergunta.
4. Via 3: pular fotos → escolher Base/Rota → conferir aviso "sem proteção" → atribuição exige pergunta.
5. Pergunta: tentar atribuir sem responder → bloqueado; "Não" → técnico executa só fotos; "Sim" → técnico recebe etapa de instalação/vínculo do rastreador; veículo permanece sub-FIPE no enquadramento, plano, cobrança.
6. Smoke acima-FIPE e Troca: nada mudou nem no link nem no Monitoramento.
