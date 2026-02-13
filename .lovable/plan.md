
# Correcoes de Sinistro Aprovado + Botao "Enviar para Oficina"

## Problemas Identificados

1. **ERRO 1 e 2 - Botoes de analise aparecem em sinistro ja aprovado**: A tela de analise e a lista de sinistros nao verificam se o status ja e `aprovado` ou `em_analise` apos aprovacao
2. **ERRO 3 - Termo nao enviado (Autentique)**: A edge function `autentique-evento-create` falha com erro `column veiculos_1.categoria does not exist` - o campo `categoria` nao existe na tabela `veiculos`
3. **Novo botao "Enviar para Oficina"**: Sinistros aprovados devem mostrar botao para criar OS vinculada

## Alteracoes

| Arquivo | Descricao |
|---|---|
| `supabase/functions/autentique-evento-create/index.ts` | Remover `categoria` da query de veiculos (campo nao existe na tabela) |
| `src/pages/eventos/SinistrosList.tsx` | Substituir botao "Analisar" por "Enviar para Oficina" quando status = `em_analise` (aprovado pela diretoria); manter "Analisar" apenas para `comunicado` |
| `src/pages/eventos/SinistroAnalise.tsx` | Quando status ja e `em_analise` ou `aprovado`, ocultar botoes de aprovar/reprovar e mostrar mensagem de status ou botao "Enviar para Oficina" |
| `src/components/sinistros/EnviarParaOficinaDialog.tsx` (NOVO) | Dialog para selecionar oficina e tipo de reparo, criando OS automaticamente |

## Detalhes tecnicos

### 1. Fix autentique-evento-create (Erro 3)

Na linha 59, remover `categoria` da query:

```
// De:
veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor, chassi, renavam, valor_fipe, codigo_fipe, combustivel, categoria)

// Para:
veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor, chassi, renavam, valor_fipe, codigo_fipe, combustivel)
```

Tambem remover qualquer referencia a `categoria` no mapeamento de variaveis do template (se houver).

### 2. SinistrosList.tsx - Botao condicional na coluna Acoes

Linha 430: Alterar a logica para:
- Status `comunicado`: Botao "Analisar" (como hoje)
- Status `em_analise`: Botao "Enviar para Oficina" (icone `Wrench`)
- Outros status: Sem botao de acao especial

```typescript
{isDiretor && sinistro.status === 'comunicado' && (
  <Button size="icon" onClick={() => navigate(`/eventos/sinistros/${sinistro.id}/analisar`)}>
    <ClipboardCheck className="h-4 w-4" />
  </Button>
)}
{isDiretor && sinistro.status === 'em_analise' && (
  <Button size="icon" variant="outline" onClick={() => abrirEnviarOficina(sinistro)}>
    <Wrench className="h-4 w-4" />
  </Button>
)}
```

### 3. SinistroAnalise.tsx - Bloquear acoes apos aprovacao

Na secao de Acoes (linha 520), adicionar verificacao de status:

```typescript
if (sinistro.status === 'em_analise' || sinistro.status === 'aprovado' || sinistro.status === 'em_reparo') {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
        <CheckCircle /> Sinistro aprovado
      </div>
      <Button onClick={() => setShowEnviarOficina(true)}>
        <Wrench /> Enviar para Oficina
      </Button>
    </div>
  );
}
```

### 4. EnviarParaOficinaDialog.tsx (novo componente)

Dialog com:
- Select de oficinas (busca da tabela `oficinas`)
- Campo de tipo de reparo (texto ou select)
- Campo de observacoes
- Ao confirmar:
  1. Insere na tabela `ordens_servico` com `sinistro_id`, `oficina_id`, `veiculo_id`, `associado_id`, status `aguardando_orcamento`
  2. Atualiza sinistro para status `em_reparo`
  3. Registra historico em `sinistro_historico`
  4. Registra historico em `ordens_servico_historico`
  5. Toast de sucesso e redireciona para a OS criada

Segue o mesmo padrao de `NovaOSModal.tsx` para a insercao:

```typescript
const { data, error } = await supabase
  .from('ordens_servico')
  .insert({
    numero: '', // trigger gera automaticamente
    sinistro_id: sinistro.id,
    oficina_id: selectedOficinaId,
    veiculo_id: sinistro.veiculo_id,
    associado_id: sinistro.associado_id,
    data_entrada: format(new Date(), 'yyyy-MM-dd'),
    observacoes: observacoes,
    status: 'aguardando_orcamento',
    criado_por: user?.id,
  })
  .select()
  .single();
```
