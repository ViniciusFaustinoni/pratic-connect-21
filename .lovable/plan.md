

## Plano: Incluir cláusula de depreciação no termo de filiação

### Contexto

O termo é gerado em dois locais:
1. **Edge function** (`supabase/functions/_shared/termo-afiliacao-template.ts`) — usado pela Autentique para assinatura digital
2. **React** (`src/components/cadastro/TermoFiliacaoTemplate.tsx`) — preview/PDF local

Nenhum dos dois menciona regras de depreciação. A `VeiculoData` no edge function só tem `leilao` e `uso_aplicativo` como flags; as demais (placa_vermelha, ex_taxi, etc.) não são passadas.

### Alterações

**1. `supabase/functions/_shared/termo-afiliacao-utils.ts`**
- Expandir `VeiculoData` com todas as flags de depreciação: `flag_placa_vermelha`, `flag_ex_taxi`, `flag_taxi_ativo`, `flag_chassi_remarcado`, `flag_ex_ressarcido`, `flag_avarias_vistoria` (todas boolean opcionais)
- Expandir `TermoAfiliacaoData` com campo opcional `regrasDepreciacao` (array de `{flag, label, percentual, adicional}`)
- Atualizar `mapearDadosParaTemplate` para popular as novas flags a partir do contrato/veículo
- Nova função `buscarRegrasDepreciacao(supabase)` que lê a chave `regras_depreciacao` da tabela `configuracoes`

**2. `supabase/functions/_shared/termo-afiliacao-template.ts`**
- Na seção 3 (Plano e Coberturas), após as coberturas e antes do rastreador, inserir condicional:
  - Se o veículo tiver alguma flag de depreciação ativa, gerar parágrafo com o percentual e motivo lido de `regrasDepreciacao`
  - Se `flag_avarias_vistoria` ativa, incluir linha adicional do abatimento composto
  - Se `uso_aplicativo` + flag de depreciação, incluir aviso de que cobertura 100% FIPE APP não se aplica (reg. 10.4.4)
- Lógica: identificar a flag ativa com maior percentual entre as concorrentes (mesma lógica do `IniciarIndenizacaoModal`)

**3. `supabase/functions/autentique-create/index.ts` e `autentique-create-by-token/index.ts`**
- Chamar `buscarRegrasDepreciacao` e incluir no `templateData`
- Buscar flags do veículo vinculado ao contrato (query veículos pelo `veiculo_id` do contrato)

**4. `src/components/cadastro/TermoFiliacaoTemplate.tsx`**
- Usar `useConfiguracaoJson('regras_depreciacao')` para buscar regras
- Após a seção 3 (coberturas), adicionar bloco condicional com mesma lógica
- Verificar flags via props `dados.veiculo` (precisará de novas props)

**5. `src/types/termo-filiacao.ts`**
- Adicionar flags de depreciação opcionais à interface `VeiculoData`: `flagPlacaVermelha?`, `flagExTaxi?`, `flagTaxiAtivo?`, `flagChassiRemarcado?`, `flagLeilao?`, `flagExRessarcido?`, `flagAvariaVistoria?`

### Parágrafo gerado (exemplo)

```html
<div class="highlight-box" style="border-left: 3px solid #d97706;">
  <strong>CONDIÇÃO ESPECIAL DE RESSARCIMENTO:</strong>
  <p>Em caso de ressarcimento integral (perda total), o valor FIPE de referência 
  será reduzido em <strong>30%</strong> em razão da condição do veículo 
  (<strong>Veículo de leilão</strong>), conforme regulamento item 10.4.2.</p>
  
  <!-- Se avarias -->
  <p>Adicionalmente, será aplicado abatimento de <strong>20%</strong> sobre o valor 
  já depreciado, em razão de avarias pré-existentes registradas na vistoria.</p>
  
  <!-- Se APP + deságio -->
  <p>A cobertura de 100% da tabela FIPE prevista para veículos de uso por aplicativo 
  <strong>não se aplica</strong> a este veículo em razão da categoria de depreciação, 
  conforme regulamento item 10.4.4.</p>
</div>
```

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/_shared/termo-afiliacao-utils.ts` | Novas flags em VeiculoData, buscarRegrasDepreciacao(), regrasDepreciacao em TermoAfiliacaoData |
| `supabase/functions/_shared/termo-afiliacao-template.ts` | Bloco condicional de depreciação na seção 3 |
| `supabase/functions/autentique-create/index.ts` | Buscar regras e flags do veículo |
| `supabase/functions/autentique-create-by-token/index.ts` | Idem |
| `src/types/termo-filiacao.ts` | Flags opcionais em VeiculoData |
| `src/components/cadastro/TermoFiliacaoTemplate.tsx` | Bloco condicional com useConfiguracaoJson |

