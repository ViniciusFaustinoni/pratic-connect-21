## ERRO 11 — Refatorar `aprovar-proposta` em funções nomeadas

### Situação atual

`supabase/functions/aprovar-proposta/index.ts` tem **1.267 linhas**, todas dentro de um único `serve(async (req) => {...})`. O handler concentra 13 responsabilidades em sequência:

| # | Trecho | Linhas aprox. | O que faz |
|---|---|---|---|
| 1 | Parse + fetch contrato | 41–65 | valida payload, busca contrato + associado |
| 2 | Desvio Troca de Titularidade | 67–170 | early-return delegando para `aprovar-troca-cadastro` |
| 3 | Plano tem R/F? | 173–186 | regex `/roubo\|furto/i` em coberturas |
| 4 | Idempotência (já ativo) | 188–196 | early-return |
| 5 | Gate sub-etapa 1 (documentos aprovados) | 198–214 | 409 `documentos_nao_aprovados` |
| 6 | Gate situação financeira SGA | 217–247 | 409 `inadimplencia_sga_pendente` |
| 7 | Gate caminho público completo | 268–384 | 409 `caminho_publico_incompleto` |
| 8 | Marca `cadastro_aprovado=true` no contrato | 386–414 | + idempotência por CAS |
| 9 | Carga paralela (instalação concluída, veículos, config, update associado) | 416–471 | |
| 10 | Loop por veículo (RPC rastreador, criar instalação, autovistoria antecipada R/F, sub-FIPE) | 473–987 | **bloco monstro de ~515 linhas** |
| 11 | Guards anti-limbo (sem agendamento / sem instalação física) | 989–1073 | 409 com rollback do `cadastro_aprovado` |
| 12 | Aguardar instalação OU chamar `ativar-associado` | 1075–1142 | |
| 13 | Histórico + documentos + fila SGA | 1144–1232 | |

`jsonResponse` e `precisaRastreador` já são funções top-level. O resto é tudo escopo local do handler — qualquer leitura exige carregar contexto de 1.000 linhas para entender o ponto que está sendo alterado.

### Correção — extração para helpers nomeados no mesmo arquivo

**Diretriz:** *zero* mudança de comportamento. Apenas recortar trechos do handler em funções top-level `async function` declaradas acima do `serve()`. Cada função recebe o `supabase` client (e o `corsHeaders`) por parâmetro. Nada de mudar ordem, regras, condicionais ou retornos.

Estrutura final do arquivo:

```text
supabase/functions/aprovar-proposta/index.ts
├─ imports + constantes (FIPE_MINIMO_*, corsHeaders)
├─ jsonResponse() — já existe
├─ precisaRastreador() — já existe
│
├─ // === Carregamento ===
├─ buscarContrato(supabase, contrato_id)
├─ checarPlanoTemRouboFurto(supabase, plano_id)
├─ carregarContextoParalelo(supabase, { contrato_id, associado_id, veiculo_id, aprovado_por, agora })
│       → { instalacaoConcluida, veiculos, fipeMinCarro, fipeMinMoto }
│
├─ // === Desvio Troca ===
├─ tratarTrocaTitularidade(supabase, contrato, aprovado_por, agora)
│       → { delegado: true, response } | null
│
├─ // === Gates ===
├─ gateDocumentosAprovados(contrato)                   → Response | null
├─ gateSituacaoFinanceiraSGA(supabase, contrato_id)    → Response | null
├─ gateCaminhoPublicoCompleto(supabase, { contrato_id, cotacao_id, veiculo_id, aprovado_por })
│       → Response | null
│
├─ // === Mutações principais ===
├─ registrarAprovacaoCadastral(supabase, contrato_id, aprovado_por, agora)
│       → { ok: boolean, jaAprovadoResponse?: Response }
├─ atualizarVeiculoComDocs(supabase, veiculo_id, { renavam, chassi, motor })
│
├─ // === Loop por veículo (extraído como processador único) ===
├─ processarVeiculoAprovado(supabase, {
│       veiculo, contrato, associadoId, planoTemRouboFurto,
│       jaTemInstalacaoConcluida, instalacaoConcluida, aprovado_por, agora
│    })
│       → { precisouRastreador, criouProtecao360SemRastreador, veiculoPrincipal? }
│   // este é o atual corpo do `for (const veiculo of veiculos)` (linhas 478–987)
│   // mantém TODA a lógica interna (autovistoria antecipada, sub-FIPE,
│   // notificações, etc.) intacta — só recorta o escopo.
│
├─ // === Guards finais ===
├─ guardAntiLimboPosProcessamento(supabase, {
│       contrato, jaTemInstalacaoConcluida, algumPrecisouRastreador, aprovado_por
│    })
│       → Response | null
│
├─ // === Ativação / aguardo ===
├─ checarVistoriaJaAprovada(supabase, { cotacao_id, veiculo_id })   → boolean
├─ aguardarOuAtivar(supabase, {
│       contrato_id, associadoId, deveAguardarInstalacao,
│       algumPrecisouRastreador, aprovado_por, planoTemRouboFurto,
│       jaTemInstalacaoConcluida, motivoDecisaoSga
│    })
│
├─ // === Pós-aprovação ===
├─ gravarHistoricoEDocumentos(supabase, {
│       associadoId, contrato_id, cotacao_id, aprovado_por, agora, mensagemHistorico
│    })
├─ enfileirarSGA(supabase, {
│       associadoId, veiculoIdDoContrato, deveAguardarInstalacao,
│       aprovado_por, motivoDecisaoSga
│    })
│
└─ serve(async (req) => { ... })   // handler enxuto, ~80 linhas, chama os helpers em ordem
```

Esqueleto-alvo do `serve()`:

```ts
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const supabase = createClient(...);
  try {
    const { contrato_id, aprovado_por, veiculo_renavam, veiculo_chassi, veiculo_numero_motor } = await req.json();
    if (!contrato_id || !aprovado_por) throw new Error('contrato_id e aprovado_por são obrigatórios');

    const agora = new Date().toISOString();
    const contrato = await buscarContrato(supabase, contrato_id);

    // Desvio troca de titularidade (early-return)
    const troca = await tratarTrocaTitularidade(supabase, contrato, aprovado_por, agora);
    if (troca) return troca.response;

    const planoTemRouboFurto = await checarPlanoTemRouboFurto(supabase, contrato.plano_id);

    // Idempotência + status
    if (contrato.status === 'ativo') return jsonResponse({ success: true, jaAprovado: true, ... });
    if (contrato.status !== 'assinado') throw new Error(...);

    // Gates
    const r1 = gateDocumentosAprovados(contrato);                                     if (r1) return r1;
    const r2 = await gateSituacaoFinanceiraSGA(supabase, contrato_id);                if (r2) return r2;
    const r3 = await gateCaminhoPublicoCompleto(supabase, { ... });                   if (r3) return r3;

    // Marca cadastro_aprovado
    const aprov = await registrarAprovacaoCadastral(supabase, contrato_id, aprovado_por, agora);
    if (aprov.jaAprovadoResponse) return aprov.jaAprovadoResponse;

    // Carga paralela
    const { instalacaoConcluida, veiculos } = await carregarContextoParalelo(supabase, {...});
    if (veiculo_renavam || veiculo_chassi || veiculo_numero_motor) {
      await atualizarVeiculoComDocs(supabase, contrato.veiculo_id, { ... });
    }

    // Loop
    let algumPrecisouRastreador = false;
    let algumProtecao360SemRastreador = false;
    for (const veiculo of veiculos) {
      const r = await processarVeiculoAprovado(supabase, { veiculo, contrato, ... });
      algumPrecisouRastreador ||= r.precisouRastreador;
      algumProtecao360SemRastreador ||= r.criouProtecao360SemRastreador;
    }

    // Guard pós-processamento
    const g = await guardAntiLimboPosProcessamento(supabase, { contrato, jaTemInstalacaoConcluida: !!instalacaoConcluida, algumPrecisouRastreador, aprovado_por });
    if (g) return g;

    const deveAguardarInstalacao = !instalacaoConcluida || !algumPrecisouRastreador;
    const autovistoriaAprovada = await checarVistoriaJaAprovada(supabase, {...});
    await aguardarOuAtivar(supabase, { ... });

    const mensagemHistorico = montarMensagem(...);  // helper puro (sem I/O)
    await gravarHistoricoEDocumentos(supabase, { ..., mensagemHistorico });
    await enfileirarSGA(supabase, { ... });

    return jsonResponse({ success: true, contratoId: contrato_id, associadoId: contrato.associado_id, mensagem: mensagemHistorico });
  } catch (error) {
    // tratamento atual com translateDbError
  }
});
```

### Regras inegociáveis durante a refatoração

1. **Zero alteração de regra de negócio.** Toda condicional, ordem de chamada, status string, `correlation_id`, `enqueue_integration`, mensagem de log e payload de auditoria permanece **byte a byte** igual. Diff comportamental = bug.
2. **Mensagens de log** preservam o mesmo prefixo `[aprovar-proposta]` e o mesmo texto exato — para não quebrar buscas em `edge_function_logs`.
3. **Códigos de erro HTTP** (`documentos_nao_aprovados`, `inadimplencia_sga_pendente`, `caminho_publico_incompleto`, `sem_agendamento`, `sem_vistoria_materializada`, `instalacao_nao_agendada`) e seus status (409) ficam idênticos — o front depende deles via `toastErroEdge`.
4. **Trigger / RPC names** (`fn_veiculo_precisa_rastreador`, `enqueue_integration`, `ativar-associado` URL) e correlation_ids (`sga:hinova:${id}:pendente`/`:ativo`) intocados.
5. **Não criar arquivos novos.** Tudo no mesmo `index.ts` (memo do usuário). A estrutura pode usar comentários `// ===` como separadores visuais.
6. **`@ts-nocheck`** continua no topo (igual hoje) — o objetivo é só legibilidade.
7. **Não tocar em `precisaRastreador`** (não é chamada — está deprecada pela RPC, mantida por documentação inline).

### Verificação pós-refatoração

1. Diff de tamanho do handler (`serve()` deve cair de ~1.220 linhas para ~100).
2. `grep` por strings críticas confirma preservação: `correlation_id`, `caminho_publico_incompleto`, `sem_agendamento`, `instalacao_nao_agendada`, `fn_veiculo_precisa_rastreador`, `ativar-associado`.
3. Deploy + chamada de teste com um contrato canônico via `curl_edge_functions` (caso conhecido sem efeito colateral), comparando shape de resposta com o último log antes do refactor.
4. Tail dos `edge_function_logs` para confirmar que as linhas de log esperadas (gate documentos, gate SGA, gate caminho, GUARD ANTI-LIMBO, Concluído) continuam aparecendo na mesma ordem.

### Risco

- **Baixo** se a refatoração for cirúrgica (recorte puro).
- **Alto** se forem feitas micro-otimizações no caminho. *Nenhuma melhoria de lógica nesta tarefa* — fica para issue separada.

### Arquivos tocados

- `supabase/functions/aprovar-proposta/index.ts` — único arquivo (reorganização interna).
