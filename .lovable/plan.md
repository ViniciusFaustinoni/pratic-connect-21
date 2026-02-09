

# Plano: Corrigir Protecao do Veiculo, RG/Sexo e Documentos

## Problema 1: Veiculo mostra "Cobertura Total Ativa" mesmo cancelado

**Causa raiz:** A funcao `processar-pos-retirada` atualiza o veiculo para `status = 'cancelado'` mas nunca reseta os campos `cobertura_total` e `cobertura_roubo_furto`. O componente `BadgeCoberturaCompact` so verifica esses booleans, sem considerar o status do veiculo.

**Dados atuais no banco:**
```text
veiculo.status = 'cancelado'
veiculo.cobertura_total = true  (deveria ser false)
veiculo.cobertura_roubo_furto = true  (deveria ser false)
```

**Correcoes:**

1. **Edge Function `processar-pos-retirada`**: Ao inativar veiculos, tambem resetar `cobertura_total = false` e `cobertura_roubo_furto = false`

2. **Componente `BadgeCoberturaCompact`**: Adicionar verificacao do status do veiculo — se `status === 'cancelado'` ou `status === 'inativo'`, nao mostrar badge de protecao ativa

3. **Migration SQL**: Corrigir dados existentes no banco:
```sql
UPDATE veiculos SET cobertura_total = false, cobertura_roubo_furto = false
WHERE status IN ('cancelado', 'inativo');
```

---

## Problema 2: RG e Sexo vazios nos detalhes

**Causa raiz:** Os campos `rg` e `sexo` estao `NULL` no banco de dados. A interface mostra corretamente "—" para campos vazios. O problema e que o fluxo de cadastro via cotacao (OCR da CNH) extrai esses dados mas nao os persiste na tabela `associados`.

**Correcao:**

Verificar e atualizar o fluxo `contrato-gerar` (Edge Function) para incluir `rg` e `sexo` ao criar/atualizar o associado a partir dos dados da cotacao. Os campos ja existem na cotacao (`cotacoes.rg` e `cotacoes.sexo` ou dados extraidos do OCR da CNH).

**Verificacao adicional:** Consultar se a tabela `cotacoes` tem esses dados para o associado atual, para confirmar se o problema e na geracao ou na captura.

---

## Problema 3: Documentos com campos vazios

**Causa raiz:** A aba de documentos mostra "—" na coluna "Veiculo" para documentos vindos da tabela `contratos_documentos` porque o mapeamento (`fonte: 'cotacao'`) define `veiculo: null` fixo. Esses documentos (CNH, CRLV, Comprovante de Residencia) vem da cotacao e nao tem vinculo direto com veiculo.

**Correcoes:**

1. Para documentos pessoais (CNH, comprovante_residencia), a coluna veiculo deve mostrar "Pessoal" em vez de "—"
2. Para CRLV que tem vinculo com veiculo na cotacao, buscar a placa do veiculo vinculado

---

## Arquivos a Alterar

| Arquivo | Alteracao |
|---------|----------|
| `supabase/functions/processar-pos-retirada/index.ts` | Resetar `cobertura_total` e `cobertura_roubo_furto` ao cancelar veiculo |
| `src/components/veiculos/BadgeCobertura.tsx` | Aceitar prop `veiculoStatus` e nao mostrar cobertura se cancelado/inativo |
| `src/pages/cadastro/Associados.tsx` | Passar `veiculoStatus` ao `BadgeCoberturaCompact` |
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Mapear tipo de documento pessoal vs veiculo na coluna "Veiculo" |
| Migration SQL | Corrigir veiculos cancelados que ainda tem cobertura ativa |

### Sobre RG e Sexo
Os campos estao vazios no banco de dados — nao e um bug de exibicao. Sera necessario verificar se o fluxo de OCR/cotacao captura esses dados e os persiste. Se a cotacao tiver os dados, o `contrato-gerar` sera atualizado para inclui-los. Caso contrario, e uma lacuna no formulario de cadastro que precisara ser preenchida manualmente.

