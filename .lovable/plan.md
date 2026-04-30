## Contexto

No SGA/Hinova **não existe "plano"** — existe **grupo de produto**. O grupo já contém todos os produtos (coberturas + benefícios) configurados lá no painel do Hinova. Para vincular tudo a um veículo, basta enviar `codigo_grupo_produto` no `/veiculo/cadastrar`.

A edge function atual está fazendo errado:
1. Inventa um campo `codigo_plano` que não existe na doc oficial
2. Tenta montar `produtos: [...]` lendo `codigo_sga` das nossas coberturas/benefícios — isso é desnecessário e errado
3. Quando o plano não tem código → manda pelado e a Hinova só vincula compulsórios

Resultado: veículo chega no Hinova sem nenhuma cobertura/benefício do grupo correto.

---

## Mudanças

### 1. Edge function `sga-hinova-sync` — corrigir o payload

**Remover:**
- Bloco que monta `produtos: []` lendo `planos_beneficios` + `planos_coberturas` + `codigo_sga` dos itens (linhas ~451–462)
- Variável `produtos` e seu envio no `ctxV` (linha 727)
- Envio do campo `codigo_plano` (linha 724)

**Adicionar:**
- Ler `planos.codigo_sga_plano` e enviar como **`codigo_grupo_produto`** (campo oficial da doc)
- Se `codigo_sga_plano` estiver NULL/vazio → **abortar** com erro claro `plano_sem_codigo_grupo_sga` (mesmo padrão do `codigo_fipe ausente` que já existe), em vez de mandar pelado e cair no default da conta
- Atualizar `setStatusSga` para `erro_sincronizacao` e `upsertQueue` com motivo amigável: *"Plano '{nome}' não tem código de grupo SGA configurado. Cadastre o grupo no painel Hinova e preencha o código no plano antes de reprocessar."*

**Manter intacto:** toda a lógica de associado, vendedor, FIPE, mapeamentos de cor/combustível/tipo, fotos, valores de mensalidade/adesão.

### 2. Helper `buildVeiculoPayload` — trocar campo de saída

Onde hoje sai `codigo_plano`, passar a sair `codigo_grupo_produto`. Remover qualquer referência ao array `produtos`.

### 3. UI — renomear o campo no formulário do plano

Arquivo do form de edição de plano (componente em `src/components/admin/planos/`):
- Label: `"Código SGA do Plano (Hinova)"` → **`"Código do Grupo de Produto (SGA/Hinova)"`**
- Helper text: `"Código do plano no painel Hinova..."` → **`"Código do GRUPO no painel Hinova. O grupo já contém todas as coberturas e benefícios configurados lá. Sem este código, o veículo não será vinculado e a sincronização será bloqueada com erro plano_sem_codigo_grupo_sga."`**

A coluna do banco continua se chamando `codigo_sga_plano` (não vale o churn de migration só pelo nome).

### 4. Função `cron-sga-retry` e fila de erros

Verificar se a fila de retry trata o novo motivo `plano_sem_codigo_grupo_sga` da mesma forma que `vendedor_sem_codigo_sga` (não tenta retry automático, espera intervenção humana). Se não tratar, adicionar.

### 5. Memória do projeto

Atualizar `mem://features/integrations/sga-hinova-sync-and-pre-check-v3`:
- Documentar que `planos.codigo_sga_plano` = `codigo_grupo_produto` da Hinova
- Que **não** se envia array `produtos[]` (o grupo já resolve)
- Que `coberturas.codigo_sga` e `benefits.codigo_sga` **não são mais lidos** pela sync (mas os campos continuam no banco, podem ser usados em relatórios futuros)

---

## O que NÃO vou mexer

- ❌ Não vou remover as colunas `codigo_sga` de `coberturas` e `benefits` (você pediu pra deixar).
- ❌ Não vou popular `codigo_sga_plano` nas 23 variantes do Select Basic — você vai cadastrar cada grupo no Hinova primeiro e depois preencher um a um aqui (ou me passa o mapa pronto e eu rodo um UPDATE).
- ❌ Não vou mexer em `cron-sga-health-check`, `sga-buscar-associado-completo`, `sga-listar-catalogo` etc. — eles não enviam veículo.

---

## Como você vai testar depois

1. Garante que o "Select Basic" base (id `cfe38797…`) está com `codigo_sga_plano = 40` ✅ (já está).
2. Pega um contrato de teste vinculado a esse plano e dispara a sync.
3. Confere em `sga_sync_logs` que o `request_payload` agora tem `codigo_grupo_produto: 40` e **não tem mais** `codigo_plano` nem `produtos`.
4. Confere no painel Hinova que o veículo apareceu com todos os produtos do grupo 40 vinculados.
5. Pega um contrato de teste vinculado a uma variante sem código (ex: "Select Basic - SP") e tenta sincronizar — deve **bloquear** com a mensagem amigável, em vez de mandar pelado.

---

## Detalhes técnicos (para referência)

**Arquivo:** `supabase/functions/sga-hinova-sync/index.ts`

Trecho atual problemático (linhas 436–468 e 724–727):
```ts
const produtos: Array<{ codigo_produto: number }> = [];
if (contrato?.plano_id) {
  const { data: planoRow } = await supabase.from('planos')
    .select('id, nome, codigo_sga_plano, valor_adesao')...
  // ... monta array produtos lendo planos_beneficios + planos_coberturas
}
// ...
codigo_plano: codigoPlanoSga,
produtos: produtos.length > 0 ? produtos : undefined,
```

Vai virar (simplificado):
```ts
let codigoGrupoProduto: number | undefined;
if (contrato?.plano_id) {
  const { data: planoRow } = await supabase.from('planos')
    .select('id, nome, codigo_sga_plano, valor_adesao')
    .eq('id', contrato.plano_id).maybeSingle();
  const cg = planoRow?.codigo_sga_plano ? Number.parseInt(planoRow.codigo_sga_plano, 10) : NaN;
  if (Number.isFinite(cg) && cg > 0) {
    codigoGrupoProduto = cg;
    valorMensalidade = ...;
    valorAdesao = ...;
  } else {
    // ABORTA — bloqueio claro
    const motivo = `Plano '${planoRow?.nome}' não tem código de grupo SGA. Cadastre o grupo no Hinova e preencha o código antes de reprocessar.`;
    await logSync(_vid, _aid, 'resolver_grupo_sga', 'error', {...}, null, motivo);
    await setStatusSga(_vid, 'erro_sincronizacao');
    await upsertQueue(_vid, _aid, 'plano_sem_codigo_grupo_sga', motivo, codigoAssociadoHinova);
    return;
  }
}
// no payload:
codigo_grupo_produto: codigoGrupoProduto,
// (sem `produtos`, sem `codigo_plano`)
```

Posso executar?
