## Objetivo

Eliminar a opção manual "Inclusão de Veículo" do menu Outras Entradas e transformar a inclusão de veículo em um processo **automático e silencioso**, disparado quando a IA reconhecer no OCR da CNH (link público) um CPF que já corresponde a um associado existente (local ou no SGA). Além disso, garantir que toda substituição inative o veículo antigo no SGA.

## 1. Remover entrada manual "Inclusão de Veículo"

- `src/components/vendas/OutrasEntradasMenu.tsx`
  - Remover o card/opção `'inclusao'` do array `ENTRADAS`.
  - Remover o tipo `'inclusao'` da union `EntradaTipo`, o `useQuery` `associado-inclusao-check`, o bloco de UI condicional (`selectedTipo === 'inclusao'`) e o branch `else if (selectedTipo === 'inclusao')` do `handleProsseguir`.
  - Manter apenas: substituição de placa, troca de titularidade, migração.
- Não tocar em `useOutrosProcessos.ts` (registros antigos com `tipo_entrada='inclusao_veiculo'` continuam visíveis no histórico).

## 2. Auto‑detecção de associado via OCR da CNH (link público)

Hoje o OCR já roda em `src/pages/public/CotacaoPublicaCompleta.tsx::handleUploadDocumento` (linhas 349‑469) para `crlv`, `cnh_frente|cnh_verso` e `comprovante`, e o `document-ocr` já extrai `cpf` da CNH com validação dos dígitos verificadores.

Mudanças (somente no caminho `tipoSchema === 'cnh'`):

1. Após `sucessoOcr`, ler `dados.cpf`. Se válido (`validateCPF` no client) e diferente do CPF já gravado na cotação, chamar uma nova edge function:

   - **`detectar-associado-por-cpf`** (nova, pública/anon, com `verify_jwt = false`)
     - Body: `{ cotacao_id, cpf }`.
     - Passos:
       1. `select` em `associados` por CPF normalizado.
       2. Se não encontrado localmente → `sga-buscar-associado-completo` (já existe) com `buscar_por='cpf'`. Se vier 200 e veículos, importa snapshot mínimo via `importar-associado-sga` (já existe) e cria/atualiza o associado local.
       3. **Guarda anti‑sequestro** (memória `no-cross-owner-vehicle-reuse`): comparar `associado.nome` com `cotacao.solicitante_nome`. Se divergir além de tolerância (Levenshtein/normalização de acentos), retornar `{ match: false, motivo: 'nome_divergente' }` — **sem** vincular.
       4. Se nome bate, fazer `update` em `cotacoes`:
          - `associado_id = <id>`
          - `tipo_entrada = 'inclusao_veiculo'`
          - `dados_extras = jsonb_set(coalesce(dados_extras,'{}'), '{auto_inclusao}', '{"detectado_em":"<ts>","origem":"ocr_cnh","sga_codigo_associado":"..."}')`
          - Copiar PII (telefone, email, endereço) do associado para a cotação se o solicitante já tiver confirmado o nome correspondente.
       5. Retornar `{ match: true, associado_id, nome, sga_codigo_associado }`.
     - Resposta sempre 200 com `{ match: boolean, motivo?: string }` (nunca lançar erro pro front quebrar UX).

2. No `CotacaoPublicaCompleta.tsx`, ao receber `{ match: true }`:
   - Adicionar estado `inclusaoDetectada: { nome: string } | null`.
   - Disparar `refetch()` da cotação.
   - **Não** mostrar toast/modal/diálogo — apenas seta o estado.

3. Renderizar **badge fixo** no topo:
   - Novo componente `src/components/cotacao-publica/BadgeInclusaoVeiculo.tsx`:
     - `position: fixed; top: 0; right: 0` (responsivo: `top-2 right-2 sm:top-4 sm:right-4`), `z-50`, `bg-primary text-primary-foreground`, ícone `CarFront` + texto `INCLUSÃO DE VEÍCULO` + nome do associado em fonte menor.
     - Tokens semânticos do design system, sem cor hardcoded.
   - Renderizar dentro do layout do `CotacaoPublicaCompleta` quando `cotacao.tipo_entrada === 'inclusao_veiculo'` (cobre tanto a detecção atual quanto reload de sessão).

## 3. Fluxo público continua o mesmo

Nenhuma mudança nas etapas (escolha de plano, termo de filiação, documentos, vistoria, pagamento). O `tipo_entrada='inclusao_veiculo'` apenas faz com que o `contrato-gerar` (já existente) anexe o novo veículo ao mesmo `associado_id`, sem criar duplicata. Confirmar que `contrato-gerar` já trata `tipo_entrada='inclusao_veiculo'` reaproveitando o associado — se não tratar, adicionar branch que pula a criação de associado novo.

## 4. Inativação do veículo antigo no SGA (substituição)

Hoje `supabase/functions/efetivar-substituicao/index.ts` (Step 1) só seta `veiculos.ativo=false` localmente. Adicionar:

- **Novo helper** `supabase/functions/_shared/sga-veiculo-situacao.ts` exportando `alterarSituacaoVeiculoSGA(supabase, codigo_veiculo, codigo_situacao)` que faz `GET ${apiUrl}/veiculo/alterar-situacao-para/${codigo_situacao}/${codigo_veiculo}` via `hinovaFetch` (mesmo padrão das outras funções SGA).
- **Em `efetivar-substituicao` (Step 1‑bis, novo, após inativação local)**:
  - Buscar `veiculo_antigo.codigo_veiculo_sga`.
  - Chamar `alterarSituacaoVeiculoSGA(supabase, codigo, 2)` (situação **2 = inativo**, conforme escolha do usuário).
  - Logar resultado em `results` como step não‑crítico (falha não bloqueia substituição; aparece em log).
- **Webhook de cancelamento** (mesma função): se a função efetivar termina com sucesso e o veículo antigo tem `codigo_veiculo_sga`, garantir o disparo idempotente (checar `dados_extras.sga_inativacao_feita` para não repetir).

## 5. Memória

Atualizar `mem://index.md` adicionando uma referência:
- `[Inclusão automática por CNH](mem://logic/sales/inclusao-automatica-cnh-ocr)` — Sem entrada manual; auto‑detecta associado via CPF da CNH no link público; badge fixa "INCLUSÃO DE VEÍCULO"; bloqueio anti‑sequestro pelo nome.
- `[SGA inativar veículo substituído](mem://logic/operations/sga-inativar-veiculo-substituido)` — `efetivar-substituicao` chama `veiculo/alterar-situacao-para/2/:codigo` para o veículo antigo (não bloqueante).

## Detalhes técnicos

```text
Fluxo OCR CNH:
upload CNH → document-ocr → cpf válido?
  └── sim → detectar-associado-por-cpf (anon)
        ├── local hit → guard nome → update cotacao (tipo_entrada=inclusao_veiculo)
        ├── SGA hit  → importar-associado-sga → guard nome → update cotacao
        └── miss / nome divergente → no-op silencioso
  └── refetch → BadgeInclusaoVeiculo aparece fixa no topo
```

**Arquivos a criar**
- `supabase/functions/detectar-associado-por-cpf/index.ts`
- `supabase/functions/_shared/sga-veiculo-situacao.ts`
- `src/components/cotacao-publica/BadgeInclusaoVeiculo.tsx`

**Arquivos a editar**
- `src/components/vendas/OutrasEntradasMenu.tsx` (remoção da opção "Inclusão de Veículo")
- `src/pages/public/CotacaoPublicaCompleta.tsx` (chamada à detecção + render do badge)
- `supabase/functions/efetivar-substituicao/index.ts` (chamada SGA inativar)
- `supabase/functions/contrato-gerar/index.ts` (apenas se não reusa associado em `tipo_entrada='inclusao_veiculo'` — verificar antes)
- `mem://index.md` (referências novas)

## Fora de escopo
- Reescrever histórico de cotações antigas marcadas como `inclusao_veiculo` manual.
- Detectar inclusão por CRLV/comprovante (apenas CNH, conforme escolha).
- Sobrescrever cota quando nome diverge — permanece bloqueado pela regra atual.
- Mudar etapas do link público.