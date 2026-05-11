# Diagnóstico

A tela `Cadastro › Associados › Detalhe › Dados Pessoais` exibe corretamente o que está no banco. Os campos vazios para MARCUS VINICIUS (placa LTB4J74) têm causas distintas — confirmado por consulta direta:

| Campo | Banco (`associados`) | Causa real |
|---|---|---|
| CNH Número | NULL | Cotação tem `cliente_cnh = '07064650202'`, mas `contrato-gerar` **só copia `cnh_validade`** para o associado |
| Categoria | NULL | Cotação tem `cliente_cnh_categoria = 'B'`, idem acima |
| Validade CNH | 2033-01-18 ✅ | Único campo que o `contrato-gerar` copia hoje |
| Sexo | NULL | OCR atual da CNH não extrai sexo; nenhum formulário coleta |
| Cadastro SGA | NULL | Coluna nunca é populada pelo `sga-hinova-sync` (só pela API externa) |
| Código Hinova | NULL | Sync SGA falhou (`veiculos.status_sga = 'erro_sincronizacao'`); a função já sabe popular o campo quando o sync conclui |

Ou seja: a UI está OK. Faltam 3 correções de **persistência** no backend.

# Plano de correção

## 1. `supabase/functions/contrato-gerar/index.ts` — copiar CNH completa

No bloco "10. Vincular associado ao contrato" (linhas 1244-1255), além de `cnh_validade`, copiar também:
- `associadoUpdate.cnh_numero = cotacao.cliente_cnh` (apenas se hoje estiver NULL no associado)
- `associadoUpdate.cnh_categoria = cotacao.cliente_cnh_categoria` (apenas se hoje estiver NULL)
- `associadoUpdate.sexo = cotacao.cliente_sexo` (apenas se hoje estiver NULL e o campo existir após etapa 3)

Regra "não sobrescrever" preserva edição manual posterior.

## 2. `supabase/functions/sga-hinova-sync/index.ts` — gravar `data_cadastro_sga`

Nos dois pontos onde já gravamos `codigo_hinova` (linhas 606-610 e 681-685), incluir:
- `data_cadastro_sga: new Date().toISOString().slice(0,10)` **somente se** o associado ainda estiver com `data_cadastro_sga = NULL` (preserva data original em re-syncs).

Isso resolve a coluna "Cadastro SGA" assim que o sync rodar com sucesso. Para o MARCUS, basta reprocessar a fila SGA depois (não faz parte deste plano — o veículo está em `erro_sincronizacao` por outra causa).

## 3. OCR de CNH passa a extrair `sexo`

Localizar o prompt/schema do OCR de CNH (em `supabase/functions/_shared/mistral-ocr.ts` ou no roteador `_shared/ocr-router.ts` — confirmar na implementação) e:
- Adicionar `sexo` (M/F) ao schema JSON solicitado ao modelo;
- Normalizar a resposta para `'M' | 'F'` (aceitando "Masculino"/"Feminino"/"M"/"F"); valores não reconhecidos viram `null`.
- No `EtapaDadosPessoaisDocumentos.tsx`, propagar `dadosExtraidos.sexo` no objeto enviado ao backend (junto com `cnh`/`cnh_categoria`).
- Adicionar coluna `cliente_sexo char(1)` em `cotacoes` via migration para servir de ponte cotação→associado.
- O campo `associados.sexo` já existe — só precisa ser preenchido pela etapa 1.

Sem UI de edição manual nesta entrega (foi pedido "extrair via OCR"). Caso o OCR venha ilegível, o campo continua NULL e a tela mostra "—" como hoje.

## Fora deste plano (conforme decidido)
- ❌ Backfill de associados antigos.
- ❌ Reprocessar SGA do MARCUS (problema separado de `erro_sincronizacao`).
- ❌ Campo manual de sexo no formulário.

## Validação
Após aplicar:
1. Gerar uma cotação nova, anexar CNH e gerar contrato → conferir `associados` recebe `cnh_numero`, `cnh_categoria`, `sexo`.
2. Disparar `sga-hinova-sync` num associado novo → conferir `data_cadastro_sga` preenchido.
3. Abrir o detalhe do associado e validar visualmente os 5 campos.
