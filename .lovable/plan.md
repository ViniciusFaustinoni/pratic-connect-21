

# Corrigir 4 Gaps de Alta Gravidade no Fluxo de Sinistros

## Resumo dos 4 Gaps

1. **Vidros sem validacao de carencia/limite** -- Nao verifica 120 dias de carencia nem limite de 1 uso por peca a cada 12 meses
2. **Inadimplencia bloqueia sinistro** -- Hoje retorna erro 400 e impede a criacao; deveria registrar alerta e permitir
3. **Vidros sem fluxo simplificado** -- O `CardVidrosDetalhe.tsx` existe mas nao ha automacao de etapas (2 passos, sem oficina, sem vistoria)
4. **Roubo exige chaves indevidamente** -- O tipo `roubo` lista `chaves` como obrigatorio; chaves so se aplica a `furto`

---

## Gap 1: Validacao de Carencia 120d e Limite 12 Meses para Vidros

**Arquivo:** `supabase/functions/criar-sinistro/index.ts`

Apos a validacao de cobertura (secao 4.2, ~linha 345), adicionar bloco especifico para `tipo_sinistro === 'vidros'`:

1. **Carencia 120 dias**: Buscar `contratos.data_ativacao` do associado. Se `hoje - data_ativacao < 120 dias`, retornar erro:
   - `"Beneficio de vidros possui carencia de 120 dias. Disponivel a partir de DD/MM/YYYY."`

2. **Limite 1 uso por peca a cada 12 meses**: Buscar sinistros anteriores do mesmo veiculo com `tipo = 'vidros'` nos ultimos 12 meses. Se existir sinistro com a mesma `peca_danificada` (campo do payload), retornar erro:
   - `"Ja existe um sinistro de vidros para [peca] nos ultimos 12 meses (protocolo SIN-XXXX). Limite: 1 utilizacao por peca a cada 12 meses."`

**Dados necessarios:**
- Buscar contrato ativo do associado: `contratos` onde `associado_id` e `status = 'ativo'`, campo `data_ativacao`
- Buscar sinistros de vidro anteriores: `sinistros` onde `veiculo_id`, `tipo = 'vidros'`, `created_at > 12 meses atras`, `status NOT IN ('cancelado', 'negado')`

**Adicionar campo ao payload:** `peca_danificada` (opcional, string) na interface `CriarSinistroRequest`

---

## Gap 2: Inadimplencia Registra Alerta em Vez de Bloquear

**Arquivo:** `supabase/functions/criar-sinistro/index.ts`

Na secao 4.3 (linhas 382-392), onde verifica `statusData.dados?.adimplente === false`:

**Antes (bloqueia):**
```
if (statusData.dados?.adimplente === false) {
  return new Response(... error 400 ...)
}
```

**Depois (registra alerta, continua):**
```
let alertaInadimplente = false;
if (statusData.dados?.adimplente === false) {
  alertaInadimplente = true;
  console.warn('[criar-sinistro] Cliente inadimplente - sinistro sera criado com alerta');
}
```

Propagar `alertaInadimplente` para:
- Campo `alerta_inadimplente: true` no INSERT do sinistro (novo campo, precisa migration)
- Texto no historico: `"⚠️ ALERTA: Associado com pendencias financeiras no momento da comunicacao"`
- Notificacao para analistas incluir aviso de inadimplencia
- Email com destaque amarelo sobre a situacao financeira

**Migracao necessaria:**
- `ALTER TABLE sinistros ADD COLUMN alerta_inadimplente boolean DEFAULT false;`

---

## Gap 3: Fluxo Simplificado de Vidros (2 Etapas, sem Oficina)

**Arquivo:** `supabase/functions/criar-sinistro/index.ts`

Apos criar o sinistro (secao 6), adicionar logica especifica para vidros:

```
if (payload.tipo_sinistro === 'vidros') {
  // Vidros pula direto para "em_analise" (nao precisa vistoria presencial)
  await supabaseAdmin.from('sinistros').update({ 
    status: 'em_analise',
    fluxo_simplificado: true 
  }).eq('id', sinistro.id);
}
```

**Novo campo na migration:** `fluxo_simplificado boolean DEFAULT false`

**Arquivo:** `src/components/sinistros/CardVidrosDetalhe.tsx`

Expandir o componente para incluir as 2 etapas do fluxo:

- **Etapa 1 -- Analise da peca** (status: `em_analise`):
  - Selecionar peca danificada (se nao veio no payload)
  - Escolher opcao: "Via Auto Center Credenciado" ou "Reembolso"
  - Se B.O. necessario (tentativa furto/roubo), marcar obrigatoriedade
  - Botao "Aprovar Reparo" que muda status para `aprovado`

- **Etapa 2 -- Conclusao** (status: `aprovado`):
  - Via Auto Center: registrar valor total, calcular 60% Pratic / 40% Associado, gerar conta a pagar para auto center
  - Reembolso: upload da NF, calcular 60%, gerar conta a pagar para associado
  - Botao "Concluir Sinistro" que muda status para `concluido`

**Arquivo:** `src/pages/eventos/SinistroDetalhe.tsx`

Ajustar a pagina de detalhe para, quando `tipo === 'vidros'`, esconder secoes irrelevantes (oficina, vistoria presencial, cotacao de pecas) e mostrar apenas o `CardVidrosDetalhe` com o fluxo de 2 etapas.

---

## Gap 4: Diferenciar Documentos de Roubo vs Furto

**Arquivo:** `supabase/functions/criar-sinistro/index.ts`

Na constante `DOCUMENTOS_OBRIGATORIOS` (linhas 30-41):

**Roubo (remover chaves):**
```
roubo: [
  { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
  { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
  { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
  // REMOVIDO: chaves -- roubo nao exige declaracao de chaves
],
```

**Furto (manter chaves):**
```
furto: [
  { tipo: 'cnh', nome: 'CNH do Condutor', obrigatorio: true },
  { tipo: 'crlv', nome: 'CRLV do Veículo', obrigatorio: true },
  { tipo: 'bo', nome: 'Boletim de Ocorrência', obrigatorio: true },
  { tipo: 'chaves', nome: 'Declaração das Chaves', obrigatorio: true },
],
```

Justificativa: No roubo, o condutor estava presente e entregou as chaves sob coacao; no furto, o veiculo foi levado sem presenca do condutor, entao precisa comprovar a posse das chaves.

---

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| Migracao SQL | Adicionar `alerta_inadimplente` e `fluxo_simplificado` na tabela `sinistros` |
| `supabase/functions/criar-sinistro/index.ts` | Gaps 1, 2, 3 e 4 |
| `src/components/sinistros/CardVidrosDetalhe.tsx` | Gap 3: fluxo de 2 etapas com automacao |
| `src/pages/eventos/SinistroDetalhe.tsx` | Gap 3: esconder secoes irrelevantes para vidros |
| `src/integrations/supabase/types.ts` | Novos campos do sinistro |

## Detalhes Tecnicos

- A validacao de carencia usa `contratos.data_ativacao` (ja existente) comparada com `new Date()`
- O limite de 12 meses busca `sinistros` com `tipo = 'vidros'` e `peca_danificada` igual, excluindo status `cancelado`/`negado`
- O campo `peca_danificada` ja existe na tabela `sinistros` (usado pelo `CardVidrosDetalhe`)
- A flag `alerta_inadimplente` e gravada no sinistro para rastreabilidade; a decisao de negar/aprovar fica com o analista
- O fluxo simplificado nao gera OS de oficina nem vistoria presencial -- tudo e resolvido via auto center de vidros ou reembolso
- Deploy necessario da edge function `criar-sinistro` apos alteracoes

