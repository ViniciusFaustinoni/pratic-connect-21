
# Criar OS Automaticamente ao Marcar Pecas como Recebidas

## Situacao Atual

Quando o analista atribui fornecedores (oficina + auto centers), o sistema cria a OS imediatamente e muda o status para `em_reparo`. Porem, com o fluxo de pecas, a OS nao deveria ser criada nesse momento -- as pecas ainda nao chegaram.

## Novo Fluxo

```text
Evento aprovado + cota paga
       |
       v
Atribuir Fornecedores (escolhe oficina + auto centers)
  -> Salva oficina_id no sinistro
  -> Envia cotacoes aos auto centers
  -> Status: pecas_em_cotacao (NAO cria OS)
       |
       v
Cotacao aprovada pelo analista
       |
       v
Analista clica "Marcar Pecas como Recebidas"
  -> Chama edge function gerar-os-cotacao-aprovada
  -> OS criada automaticamente para a oficina ja atribuida
  -> Status: em_reparo
  -> WhatsApp ao associado
```

## Alteracoes

### Arquivo 1: `src/components/sinistros/AtribuirFornecedoresDialog.tsx`

**Remover criacao de OS** (linhas 172-214):
- Remover insert em `ordens_servico`, historico de OS e historico de sinistro com status `em_reparo`
- Substituir por: update do sinistro com `oficina_id` e status `pecas_em_cotacao`
- Registrar historico: "Fornecedores atribuidos. Oficina: {nome}. Aguardando cotacao de pecas."
- Manter toda a logica de envio de cotacoes e WhatsApp para auto centers e oficina

### Arquivo 2: `src/pages/eventos/SinistroAnalise.tsx`

**Alterar botao "Marcar Pecas como Recebidas"** (linhas 1376-1413):
- Apos atualizar status para `em_reparo` (em vez de `pronto_para_oficina`)
- Chamar a edge function `gerar-os-cotacao-aprovada` passando `sinistro_id` e `cotacao_id` da cotacao aprovada
- A edge function ja cria a OS com a `oficina_id` do sinistro, insere itens (pecas da cotacao + servicos da vistoria), registra historico e envia WhatsApp
- Exibir toast de sucesso com numero da OS

**Remover bloco "Pronto para oficina"** (linhas 1424-1441):
- Esse bloco intermediario com botao "Enviar para Oficina" nao e mais necessario, pois a OS e criada automaticamente ao marcar pecas recebidas

**Ajustar botao extra na toolbar** (linha 1654):
- Remover o botao "Enviar para Oficina" da toolbar inferior, pois o fluxo agora e automatico

### Arquivo 3: `supabase/functions/gerar-os-cotacao-aprovada/index.ts`

**Garantir que oficina_id do sinistro e usado**:
- A edge function ja busca `sinistro.oficina_id` e usa na criacao da OS -- apenas verificar se nao esta nulo e retornar erro claro caso esteja

## Detalhes tecnicos

### AtribuirFornecedoresDialog - Nova logica de submit

Em vez de criar OS, apenas salvar oficina e mudar status:

```typescript
// Salvar oficina_id e mudar status para pecas_em_cotacao
await supabase
  .from('sinistros')
  .update({
    oficina_id: oficinaId,
    status: 'pecas_em_cotacao',
    updated_at: new Date().toISOString(),
  })
  .eq('id', sinistro.id);

// Registrar historico
await supabase.from('sinistro_historico').insert({
  sinistro_id: sinistro.id,
  status_anterior: sinistro.status,
  status_novo: 'pecas_em_cotacao',
  observacao: `Fornecedores atribuidos. Oficina: ${nomeOficina}. Pecas em cotacao.`,
  usuario_id: profile?.id,
});
```

### Marcar Pecas como Recebidas - Criacao automatica de OS

```typescript
// Chamar edge function para criar OS
const { data: osData, error: osErr } = await supabase.functions.invoke(
  'gerar-os-cotacao-aprovada',
  { body: { sinistro_id: sinistro.id, cotacao_id: cotacaoAprovada.id } }
);
if (osErr) throw osErr;

// Atualizar status para em_reparo
await supabase.from('sinistros')
  .update({ status: 'em_reparo', updated_at: new Date().toISOString() })
  .eq('id', sinistro.id);

toast.success(`Pecas recebidas! OS ${osData?.os_numero || ''} criada automaticamente.`);
```

| Arquivo | Alteracao |
|---|---|
| `src/components/sinistros/AtribuirFornecedoresDialog.tsx` | Remover criacao de OS; salvar oficina_id no sinistro e status pecas_em_cotacao |
| `src/pages/eventos/SinistroAnalise.tsx` | Marcar pecas recebidas agora chama gerar-os-cotacao-aprovada e vai direto para em_reparo; remover bloco intermediario pronto_para_oficina e botao extra Enviar para Oficina |
| `supabase/functions/gerar-os-cotacao-aprovada/index.ts` | Adicionar validacao se oficina_id esta presente no sinistro |
