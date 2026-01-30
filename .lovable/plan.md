
## Plano: Permitir Sinistro de Roubo/Furto para Cobertura Parcial

### Problema Identificado

A Edge Function `criar-sinistro` está bloqueando sinistros para veículos com `status: 'instalacao_pendente'`, porém o associado tem `cobertura_roubo_furto: true`, o que deveria permitir criar sinistros de **roubo e furto**.

**Dados do caso:**
- Veículo: LTB4J74
- `cobertura_roubo_furto`: true
- `cobertura_total`: false
- `status`: instalacao_pendente

**Log do erro:**
```
[criar-sinistro] Veículo não está ativo: instalacao_pendente
```

### Solução

#### 1. Modificar `supabase/functions/criar-sinistro/index.ts`

**Alteração na validação de status do veículo (~linha 289-310):**

Substituir a validação rígida por uma que considera a cobertura:

```typescript
// Buscar informações de cobertura do veículo
const { data: veiculo, error: veicError } = await supabaseAdmin
  .from('veiculos')
  .select('id, placa, marca, modelo, ano_modelo, cor, status, cobertura_roubo_furto, cobertura_total')
  .eq('id', payload.veiculo_id)
  .eq('associado_id', associado.id)
  .single();

// ... após validar que veículo existe ...

// NOVA LÓGICA: Verificar se tipo de sinistro é permitido pela cobertura
const isRouboOuFurto = ['roubo', 'furto'].includes(payload.tipo_sinistro);
const temCoberturaRouboFurto = veiculo.cobertura_roubo_furto === true;
const temCoberturaTotal = veiculo.cobertura_total === true;

// Determinar se pode criar este tipo de sinistro
let podecriar = false;
let alertaRecemAtivado = false;

if (veiculo.status === 'ativo' && temCoberturaTotal) {
  // Cobertura total ativa: pode criar qualquer tipo
  podecriar = true;
} else if (temCoberturaRouboFurto && isRouboOuFurto) {
  // Cobertura parcial: só pode roubo/furto
  podecriar = true;
  // Flag de alerta especial se rastreador não instalado
  if (veiculo.status === 'instalacao_pendente' || !temCoberturaTotal) {
    alertaRecemAtivado = true;
    console.log('[criar-sinistro] ⚠️ Sinistro de roubo/furto SEM rastreador instalado - alerta ativado');
  }
} else if (veiculo.status !== 'ativo') {
  // Veículo inativo sem cobertura adequada
  const statusLabels = { /* ... */ };
  return new Response(JSON.stringify({ 
    success: false, 
    error: `Não é possível registrar sinistro: veículo ${statusLabels[veiculo.status]}` 
  }), { status: 400, ... });
} else if (!isRouboOuFurto && !temCoberturaTotal) {
  // Tentando criar sinistro que requer cobertura total
  return new Response(JSON.stringify({ 
    success: false, 
    error: 'Sua cobertura atual permite apenas sinistros de roubo e furto. Aguarde a instalação do rastreador para cobertura total.' 
  }), { status: 400, ... });
}

// Ao inserir o sinistro, adicionar flag de alerta:
const { data: sinistro } = await supabaseAdmin
  .from('sinistros')
  .insert({
    // ... campos existentes ...
    alerta_recem_ativado: alertaRecemAtivado,
  })
```

#### 2. Adicionar Coluna `alerta_recem_ativado` na Tabela `sinistros`

```sql
ALTER TABLE sinistros 
ADD COLUMN IF NOT EXISTS alerta_recem_ativado BOOLEAN DEFAULT false;

COMMENT ON COLUMN sinistros.alerta_recem_ativado IS 
'Indica se o sinistro foi aberto por associado recém-ativado (sem rastreador instalado). Requer análise especial.';
```

#### 3. Exibir Badge de Alerta no Painel (Detalhes do Sinistro)

Modificar `src/pages/sinistros/SinistroDetalhes.tsx` para mostrar badge de alerta:

```typescript
{sinistro.alerta_recem_ativado && (
  <Alert className="bg-amber-50 border-amber-200">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    <AlertTitle className="text-amber-800">Alerta: Associado Recém-Ativado</AlertTitle>
    <AlertDescription className="text-amber-700">
      Este sinistro foi comunicado por associado que ainda não possui rastreador instalado. 
      Cobertura ativa apenas para roubo e furto. Requer análise especial.
    </AlertDescription>
  </Alert>
)}
```

#### 4. Mostrar Badge na Lista de Sinistros

Modificar `src/pages/sinistros/Sinistros.tsx` para exibir indicador visual:

```typescript
{sinistro.alerta_recem_ativado && (
  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
    <AlertTriangle className="h-3 w-3 mr-1" />
    Recém-ativado
  </Badge>
)}
```

### Fluxo Esperado

```text
Associado com cobertura_roubo_furto = true
Veículo status = instalacao_pendente
          |
          v
    Abre sinistro tipo "roubo"
          |
          v
    Edge Function valida:
    - temCoberturaRouboFurto? SIM ✓
    - isRouboOuFurto? SIM ✓
          |
          v
    Cria sinistro com:
    - alerta_recem_ativado = true
          |
          v
    No painel, sinistro aparece com:
    ⚠️ Badge "Associado Recém-Ativado"
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/criar-sinistro/index.ts` | Nova lógica de validação baseada em cobertura |
| Migração SQL | Adicionar coluna `alerta_recem_ativado` |
| `src/pages/sinistros/SinistroDetalhes.tsx` | Exibir alerta visual |
| `src/pages/sinistros/Sinistros.tsx` | Badge na listagem |
| `src/pages/app/AppSinistros.tsx` | Badge na listagem do app |

### Resumo Técnico

1. **Validação por Cobertura**: Em vez de bloquear por `veiculo.status`, validar pela combinação de `cobertura_roubo_furto` + `tipo_sinistro`
2. **Flag de Alerta**: Nova coluna `alerta_recem_ativado` para sinalizar casos que requerem atenção especial
3. **Visual no Painel**: Badge amarelo de alerta para fácil identificação pela equipe de análise
