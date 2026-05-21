
## Diagnóstico — por que o termo da FERNANDA veio com tantos "—"

O termo de filiação é gerado a partir do template editável **"Proposta de Filiação" (código `AF1`)** salvo em `documento_templates`, renderizado pela engine `supabase/functions/_shared/template-utils.ts → substituirVariaveis`. Cada variável `{{...}}` sem valor é trocada por `'—'`.

Comparando o PDF (CTR-20260521162553-HMCZ80) com o banco:

| Campo no termo | O que apareceu | Causa real |
|---|---|---|
| **Combustível** | "—" | `veiculos.combustivel = NULL` e `cotacoes.veiculo_combustivel = NULL`. **Existe `cotacoes.combustivel = 'gasolina'`** (campo legado) que o mapeamento **não consulta** como fallback. |
| **Código FIPE** | "—" | `cotacoes.codigo_fipe = NULL`. O plate-lookup/FIPE deveria ter gravado e não gravou. Não há fallback no mapeamento. |
| **Câmbio / Portas** | "—" | Moto não tem. O template imprime as linhas mesmo assim (o supressor por tipo de veículo existe só no template HTML interno antigo, **não** no template `AF1` do banco). |
| **CNH / Validade / Categoria** | "—" | `associados.cnh_numero/validade/categoria = NULL`. Caso real (0KM, mototaxista sem CNH cadastrada). O template insiste em imprimir a linha. |
| **Renavam / Complemento** | "—" | 0KM (renavam ainda não existe) e endereço sem complemento. Casos legítimos onde a linha não devia aparecer. |

Resumindo: **um pedaço é bug de dados/fallback** (combustível, FIPE) e **outro pedaço é template inflexível** (renderiza linhas vazias em vez de ocultá-las).

---

## O que vai mudar

### 1) Mapeamento de dados (`supabase/functions/_shared/termo-afiliacao-utils.ts`)

Estender a hierarquia de fallback para nunca depender de um único campo:

- `combustivel`: `contrato.veiculo_combustivel → veiculoDB.combustivel → veiculo.veiculo_combustivel → cotacao.combustivel (legado) → ''`
- `codigo_fipe`: `contrato.codigo_fipe → veiculoDB.codigo_fipe → cotacao.codigo_fipe → ''`
- `cliente.cnh / cnh_validade / cnh_categoria`: passar a herdar de `associado.cnh_numero/validade/categoria` quando os campos do contrato estiverem vazios.
- `cliente.estado_civil` e `cliente.profissao`: fallback para `associado.*`.

`mapearDadosParaTemplate` precisa receber `cotacao` como argumento extra (hoje só recebe `lead`, `associado`, `veiculoDB`). Ajustar todos os call-sites em `autentique-create`, `autentique-create-by-token`, `contrato-gerar` e `enviar-termo-filiacao-whatsapp`.

### 2) Engine de substituição (`supabase/functions/_shared/template-utils.ts`)

Adicionar **supressão automática de linhas/células opcionais vazias** após a substituição:

- Para um conjunto canônico de variáveis marcadas como "opcionais" (`veiculo.cambio`, `veiculo.portas`, `veiculo.renavam`, `veiculo.codigo_fipe`, `associado.cnh`, `associado.cnh_validade`, `associado.cnh_categoria`, `associado.complemento`, `associado.profissao`, `associado.telefone_secundario`, `indicador.*`), introduzir uma sentinela interna `__OPCIONAL_VAZIO__` quando o valor for vazio.
- Depois da substituição, varrer o HTML e remover qualquer `<tr>…__OPCIONAL_VAZIO__…</tr>` (e `<p>…</p>` para campos não tabulares) usando regex restrita a essa sentinela — sem afetar campos obrigatórios que continuam saindo como "—".
- Suprimir Câmbio e Portas quando `veiculo.tipo` for moto/motocicleta/triciclo/ciclomotor.
- Suprimir Renavam quando `veiculo.placa = ZERO QUILÔMETRO` (já tem o aditivo 0KM logo abaixo).

### 3) Template `AF1` no banco (Configurações › Documentos)

Editar o conteúdo via UI em `/documentos/templates` → "Proposta de Filiação":

- Reagrupar o bloco DADOS DO ASSOCIADO: linha "Endereço completo" única (logradouro + número + complemento) em vez de 3 linhas separadas. Complemento só aparece se preenchido (pelo mecanismo acima).
- Bloco CNH vira sub-tabela única "CNH" com Validade e Categoria na mesma linha; some inteira se não houver CNH.
- Veículo: Câmbio e Portas movidos para a **mesma linha**, ambos somem quando moto.
- Código FIPE pareado com Valor FIPE (mesma linha).
- Renavam pareado com Chassi (mesma linha); some quando 0KM.

Isso reduz "ruído" do termo e, combinado com a supressão, garante que vazios deixem de aparecer.

### 4) Gravação dos dados na origem (`supabase/functions/contrato-gerar`)

Para não depender só do fallback de leitura:

- Ao criar/atualizar o contrato, gravar `contratos.veiculo_combustivel` a partir do melhor disponível (cotação ou veículo).
- Ao criar/atualizar `veiculos`, propagar `combustivel` e `codigo_fipe` vindos da cotação se a tabela `veiculos` estiver com esses campos NULL.

Esse passo é defensivo — corrige a fonte para que termos **futuros** já saiam preenchidos mesmo sem fallback.

### 5) Validação

- Regerar o termo da FERNANDA (CTR-20260521162553-HMCZ80) com a nova engine apontando para os dados atuais. Esperado: "Combustível: Gasolina", "Renavam/Câmbio/Portas" sumidos, "CNH" sumido (vazio no banco), "Cód. FIPE" continua "—" enquanto a cotação não tiver o código (mas a linha some quando vazio).
- Testar com um contrato de carro acima da FIPE (mantém Câmbio + Portas + Renavam visíveis) e um 0KM moto (esconde tudo isso).
- Rodar `vitest` em `cadastro/escopoAnaliseCadastro.test.ts` e teste novo de supressão para a engine.

---

## Detalhes técnicos (para devs)

- **Arquivos editados:**
  - `supabase/functions/_shared/termo-afiliacao-utils.ts` (assinatura + fallbacks)
  - `supabase/functions/_shared/template-utils.ts` (sentinela `__OPCIONAL_VAZIO__`, supressão por tipo de veículo e 0KM)
  - `supabase/functions/autentique-create/index.ts`, `autentique-create-by-token/index.ts`, `contrato-gerar/index.ts`, `_shared/enviar-termo-filiacao-whatsapp.ts` (passar `cotacao` para `mapearDadosParaTemplate`)
  - `supabase/functions/contrato-gerar/index.ts` (gravar combustível/codigo_fipe em contrato + veículo quando ausentes)
- **Dados (via tabela `documento_templates`, código `AF1`):** UPDATE do `conteudo` com o HTML reagrupado.
- **Sem alteração de schema.**
- **Memória a atualizar:** criar leaf `mem://logic/documents/termo-filiacao-supressao-opcionais` com a regra "campos opcionais marcados como vazios são removidos do termo; combustível e código FIPE têm cadeia de fallback `contrato → veículo → cotação`".
