## Diagnóstico — o sistema respeita o endpoint?

Conferi `supabase/functions/sga-hinova-sync/index.ts` (cadastro de veículo, linhas 700–770) e `supabase/functions/_shared/hinova-payloads.ts` (`buildVeiculoPayload`).

### Já está conforme a doc oficial `/veiculo/cadastrar`
Todos esses campos já são enviados corretamente, com nomes idênticos à doc:
`codigo_associado`, `codigo_voluntario`, `codigo_conta` (quando configurado), `codigo_cooperativa`, `codigo_situacao`, `codigo_grupo_produto`, `placa`, `chassi`, `renavam`, `ano_fabricacao`, `ano_modelo`, `codigo_fipe`, `valor_fipe`, `kilometragem`, `numero_motor`, `dia_vencimento`, `codigo_tipo_veiculo`, `codigo_combustivel`, `codigo_cor`, `valor_fixo` (mensalidade), `valor_adesao`, `data_contrato`.

Confirmado também:
- **Não** mandamos mais `produtos[]` nem o campo inventado `codigo_plano` — o grupo já vincula tudo
- **Não** mandamos vídeo hoje (a sync só usa `documentos`, `contratos_documentos`, `vistoria_fotos` — varredura no banco mostrou 0 arquivos `.mp4/.webm/.mov`)

### Vídeo — proteção que falta
Apesar de hoje não haver vídeo no banco, **não existe filtro defensivo** em `buildFotosPayload`. Se um dia algum upload de `.mp4` cair em `documentos.arquivo_url`, ele seria enviado. Vou adicionar guard por extensão e content-type.

### Campos da doc que poderíamos enviar e hoje não enviamos
Cruzando o schema da tabela `veiculos` com a doc:

| Campo doc | Origem no banco | Status hoje |
|---|---|---|
| `codigo_categoria_veiculo` | `veiculos.flag_taxi_ativo`, `flag_placa_vermelha`, `flag_leilao`, `flag_ex_taxi` (via mapeamento `hinova_mapeamentos` tipo `categoria_veiculo`) | **não enviado** |
| `valor_fipe_protegido` | `veiculos.valor_fipe_protegido` | **não enviado** |
| `porcentagem_fipe_protegido` | `planos.percentual_desagio` (quando há deságio 70/75%) | **não enviado** |
| `observacao` | gerada: `"Cadastro via Pratic Connect — contrato {numero|id}"` | **não enviado** |
| Endereço correspondência (`logradouro`, `numero`, `bairro`, `cidade`, `estado`, `cep`) | endereço do associado (mesmo do `/associado/cadastrar`) | opcional na doc — hoje omitimos (Hinova herda do associado). Manter omitido. |
| `cilindrada`, `quantidade_portas`, `quantidade_passageiros`, `cambio` | **não temos no schema** | manter omitido |
| `codigo_forma_pagamento_adesao`, `codigo_tipo_envio_boleto`, `codigo_tipo_adesao`, `codigo_tabela_avaliacao` | poderiam vir de `integracoes_credenciais` (defaults da conta) | manter omitido (default da regional) |
| `numero_nota`, `data_emissao_nota` | poderia vir de `contratos_documentos` tipo `nota_fiscal_veiculo` (só zero-km) | manter omitido (raro e exige parsing) |

---

## Mudanças propostas

### 1. `supabase/functions/_shared/hinova-payloads.ts`

**Em `VeiculoCtx`**, adicionar:
- `codigo_categoria_veiculo?: number`
- `valor_fipe_protegido?: number`
- `porcentagem_fipe_protegido?: number`
- `observacao?: string`

**Em `buildVeiculoPayload`**, anexar esses 4 campos ao payload quando vierem definidos (mesmo padrão dos demais opcionais).

**Em `buildFotosPayload`**, adicionar guard que descarta vídeos:
- regex de extensão: `/\.(mp4|m4v|mov|webm|avi|mkv|3gp|hevc)(\?|$)/i` na `arquivo_url`
- além do alias de tipo, ignorar tipos contendo `video` ou `audio`
- novo array de retorno: `descartadasVideo: string[]` (logado como `enviar_fotos_descarte`)

### 2. `supabase/functions/sga-hinova-sync/index.ts`

Antes de montar `ctxV` (perto da linha 715), resolver os novos campos:

```ts
// Categoria do veículo (táxi, leilão, placa vermelha, ex-táxi)
let categoriaLocal: string | null = null;
if (veiculo.flag_taxi_ativo) categoriaLocal = 'taxi';
else if (veiculo.flag_leilao) categoriaLocal = 'leilao';
else if (veiculo.flag_placa_vermelha) categoriaLocal = 'placa_vermelha';
else if (veiculo.flag_ex_taxi) categoriaLocal = 'ex_taxi';
const codigoCategoriaVeiculo = categoriaLocal
  ? getMap('categoria_veiculo', categoriaLocal) ?? undefined
  : undefined;

// Valor protegido + % deságio do plano
const valorFipeProtegido = veiculo.valor_fipe_protegido != null
  ? Number(veiculo.valor_fipe_protegido) : undefined;

let porcentagemFipeProtegido: number | undefined;
if (contrato?.plano_id) {
  const { data: planoDes } = await supabase.from('planos')
    .select('percentual_desagio').eq('id', contrato.plano_id).maybeSingle();
  if (planoDes?.percentual_desagio != null) {
    porcentagemFipeProtegido = Number(planoDes.percentual_desagio);
  }
}

// Observação rastreável
const { data: contratoNum } = contrato
  ? await supabase.from('contratos').select('numero').eq('veiculo_id', _vid).maybeSingle()
  : { data: null };
const observacao = `Cadastro via Pratic Connect — contrato ${contratoNum?.numero ?? _vid}`;
```

E acrescentar no `ctxV`:
```ts
codigo_categoria_veiculo: codigoCategoriaVeiculo,
valor_fipe_protegido: valorFipeProtegido,
porcentagem_fipe_protegido: porcentagemFipeProtegido,
observacao,
```

### 3. Remover qualquer risco de vídeo nas fotos

Na seção 7 (linhas 822–887), depois do `buildFotosPayload`, logar `descartadasVideo` (se houver) com `action: 'enviar_fotos_descarte'`. Nenhuma mudança de comportamento na sync — só garante que vídeos nunca vão pra `cadastrar_fotos`.

### 4. Mapeamentos de categoria de veículo

Inserir (via migration) registros em `hinova_mapeamentos` para `tipo='categoria_veiculo'` com pelo menos:
- `taxi` → código Hinova de Táxi
- `leilao` → código Hinova de Leilão
- `placa_vermelha` → código Hinova de Aluguel/Especial
- `ex_taxi` → código Hinova de Ex-Táxi (ou mesmo de Táxi se a Hinova não diferencia)

Como **não tenho os códigos certos da sua conta Hinova**, vou criar a migration apenas com `INSERT ... ON CONFLICT DO NOTHING` da estrutura, deixando `codigo_hinova` em `NULL` e `ativo=false`. Você preenche via UI de mapeamentos ou eu rodo um UPDATE quando você me passar os códigos.

> Sem mapeamento configurado, `codigo_categoria_veiculo` simplesmente não vai no payload (omitido). Não bloqueia envio.

### 5. Memória do projeto

Atualizar `mem://features/integrations/sga-hinova-sync-and-pre-check-v3` documentando:
- Vídeo é explicitamente bloqueado em `buildFotosPayload`
- Novos 4 campos opcionais enviados (`codigo_categoria_veiculo`, `valor_fipe_protegido`, `porcentagem_fipe_protegido`, `observacao`)

---

## O que NÃO vou mexer

- Endereço de correspondência (Hinova herda do associado — enviar de novo só duplica)
- `cilindrada`, `quantidade_portas`, `quantidade_passageiros`, `cambio` (não temos no schema)
- `numero_nota` / `data_emissao_nota` (não temos extração estruturada)
- Defaults bancários (`codigo_forma_pagamento_adesao`, `codigo_tipo_envio_boleto`) — seguem default da regional
- Lógica de fotos (vistoria, contrato, avatar) — só adiciono o filtro de vídeo

## Como testar depois

1. Cotação com Select Basic + valor protegido + % deságio → conferir `request_payload` em `sga_sync_logs` action `cadastrar_veiculo`: deve ter `valor_fipe_protegido`, `porcentagem_fipe_protegido`, `observacao`.
2. Veículo táxi (`flag_taxi_ativo=true`) com mapeamento configurado → `codigo_categoria_veiculo` presente.
3. Veículo táxi sem mapeamento → campo omitido, sync segue normal.
4. Inserir manualmente (no Supabase) um `vistoria_fotos` com `arquivo_url` `.mp4` e rodar sync → log `enviar_fotos_descarte` mostra a foto em `descartadasVideo`, e o lote enviado à Hinova não inclui ela.

Posso executar?