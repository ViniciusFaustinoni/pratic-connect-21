# Tornar canônica a regra "Cadastro avalia só docs + autovistoria enxuta"

## Regra (canônica, definitiva)

Cadastro avalia exclusivamente:
1. **Documentos** (sempre).
2. **Autovistoria ENXUTA acima FIPE** (opcional — 2 fotos `motor`+`chassi` + vídeo 360°) — único caso que libera R/F antecipado.

Cadastro **NUNCA** avalia fotos em:
- Vistoria presencial técnica (base/rota/prestador/fit).
- Autovistoria COMPLETA sub-FIPE (31/15 fotos).
- Troca de titularidade (vistoria dispensada na janela).

Nesses casos: Cadastro aprova só docs → Monitoramento decide vistoria e aprova final.

## Camadas de defesa (para garantir SEMPRE)

### 1. Helper único — fonte da verdade (UI)
Criar `src/lib/cadastro/escopoAnaliseCadastro.ts` com a função:
```ts
export function resolverEscopoAnaliseCadastro(proposta): {
  isAutovistoria: boolean;
  isAutovistoriaEnxutaAcimaFipe: boolean;   // único caso que Cadastro avalia fotos
  isAutovistoriaCompletaSubFipe: boolean;   // → Monitoramento
  isVistoriaPresencialTecnica: boolean;     // → Monitoramento
  cadastroAvaliaFotos: boolean;
  aprovarApenasDocumentos: boolean;
  aguardandoMonitoramentoVistoria: boolean;
}
```
Refatorar `PropostaAnalise.tsx` para consumir esse helper (remove a lógica inline). Qualquer outra tela do Cadastro (lista de pendentes, dashboards) que precisar dessa decisão importa do mesmo arquivo.

### 2. Guarda de regressão no helper
Adicionar testes (`escopoAnaliseCadastro.test.ts`) cobrindo os 5 cenários:
- Autovistoria enxuta acima FIPE → `cadastroAvaliaFotos=true`
- Autovistoria completa sub-FIPE → `aguardandoMonitoramentoVistoria=true`, fotos=false
- Presencial base → idem
- Presencial cliente → idem
- Plano sem R/F → `aprovarApenasDocumentos=true`

### 3. Guarda no edge `aprovar-proposta` (backend)
Acrescentar ao início da edge:
- Se `vistoria.modalidade='autovistoria'` E `fotos.count ≥ 15` (sub-FIPE) → não aceitar `liberar_roubo_furto=true`; só aprovar docs e marcar `cadastro_aprovado=true` (Monitoramento decide vistoria).
- Se `vistoria.modalidade='presencial'` → idem (Cadastro nunca decide fotos).

(Não muda comportamento atual — só blinda contra chamadas manuais futuras que tentem pular a regra.)

### 4. Memória canônica
Atualizar `mem://logic/operations/vistoria-sem-rastreador-flow` e criar nova:
`mem://logic/operations/cadastro-escopo-canonico` — referenciada no Core do índice como rule one-liner:

> Core: Cadastro avalia SÓ documentos + autovistoria ENXUTA acima FIPE. Fotos de autovistoria sub-FIPE/presencial técnica vão direto ao Monitoramento.

## Verificação
- RJK2I25 (presencial base): stepper "Docs → Aprovação Final", banner azul, botão "Aprovar documentação (Monitoramento finaliza)".
- LMX5A90 e demais sub-FIPE: idem.
- Cotação acima FIPE com autovistoria enxuta: botão "Liberar Cobertura R/F" mantido.
- Plano sem R/F: banner verde existente preservado.

## Fora de escopo
- Tela do Monitoramento, triggers de promoção, edges de SGA/Hinova, fluxos de instalação/prestador.

## Técnico — arquivos tocados
- `src/lib/cadastro/escopoAnaliseCadastro.ts` (novo)
- `src/lib/cadastro/escopoAnaliseCadastro.test.ts` (novo)
- `src/pages/cadastro/PropostaAnalise.tsx` (consumir helper)
- `supabase/functions/aprovar-proposta/index.ts` (guarda backend)
- `mem://logic/operations/cadastro-escopo-canonico` (nova memória) + atualizar índice + atualizar `vistoria-sem-rastreador-flow`

## Memória a registrar (após aprovação)
`mem://logic/operations/cadastro-escopo-canonico`:
> Cadastro avalia APENAS: (1) documentos sempre, (2) autovistoria enxuta acima FIPE (opcional, libera R/F). NUNCA avalia: autovistoria completa sub-FIPE, vistoria presencial técnica (base/rota/prestador), troca de titularidade. Fonte única: `resolverEscopoAnaliseCadastro()`. Guarda backend em `aprovar-proposta` bloqueia liberação de R/F fora do caso enxuto.
