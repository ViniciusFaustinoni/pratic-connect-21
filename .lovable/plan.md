

# Plano: Ajustar Modal de Novo Chamado - Assistência 24h

## Problema Identificado

O modal atual do "Novo Chamado" de Assistência 24h:
1. Busca apenas por CPF ou placa
2. Não permite busca por nome do associado
3. Quando não encontra resultados, não oferece opção de entrada manual
4. Exige um associado e veículo cadastrados no sistema para abrir um chamado

## Solução Proposta

Modificar o modal para:
1. Adicionar busca por nome
2. Oferecer entrada manual de dados quando nenhum resultado for encontrado
3. Permitir abrir chamados com dados mínimos necessários

---

## Nova Estrutura do Modal

### Etapa 1: Busca (atual)

```
┌─────────────────────────────────────────────────────────────┐
│  Novo Chamado de Assistência                                │
│  Busque o associado por nome, CPF ou placa                  │
├─────────────────────────────────────────────────────────────┤
│  [🔍 Digite nome, CPF ou placa do veículo... ] [Buscar]     │
├─────────────────────────────────────────────────────────────┤
│  Resultados (N)                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 👤 MARCUS VINICIUS FAUSTINONI...  [ativo]          │    │
│  │ CPF: 124.936.497-37                                │    │
│  │ 📞 (21) 98224-4909                                 │    │
│  │ 🚗 LTB4J74                          [Selecionar]   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  -- OU se não encontrar resultados --                       │
│                                                             │
│  ⚠️ Nenhum associado encontrado                            │
│  [📝 Informar Dados Manualmente]                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Etapa 2: Dados do Chamado (com entrada manual)

Se o usuário escolher entrada manual, o formulário incluirá:

```
┌─────────────────────────────────────────────────────────────┐
│  Novo Chamado de Assistência                                │
│  Preencha os dados do chamado                               │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Modo Manual - Dados do Cliente                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Nome do Cliente *:      [_________________________]│    │
│  │ Telefone *:             [_________________________]│    │
│  │ Placa do Veículo:       [_________________________]│    │
│  │ Marca/Modelo:           [_________________________]│    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Dados do Chamado                                           │
│  Tipo de Serviço *:       [▼ Reboque/Guincho           ]    │
│  Descrição do Problema:   [___________________________]     │
│  Endereço de Origem *:    [___________________________]     │
│  Endereço de Destino:     [___________________________]     │
├─────────────────────────────────────────────────────────────┤
│                          [Cancelar] [Abrir Chamado]         │
└─────────────────────────────────────────────────────────────┘
```

---

## Alterações no Código

### Arquivo: `src/components/assistencia/NovoChamadoModal.tsx`

#### 1. Adicionar Estado para Modo Manual

```typescript
// Estado para modo manual
const [modoManual, setModoManual] = useState(false);
const [dadosManuais, setDadosManuais] = useState({
  nome_cliente: '',
  telefone_cliente: '',
  placa_veiculo: '',
  marca_modelo: '',
});
```

#### 2. Expandir Busca para Incluir Nome

Na função `buscarAssociado()`, adicionar busca por nome:

```typescript
// Buscar por Nome
const { data: porNome, error: errorNome } = await supabase
  .from('associados')
  .select(`
    id, nome, cpf, telefone, whatsapp, status,
    veiculos(id, placa, marca, modelo, ano_modelo)
  `)
  .ilike('nome', `%${termoBusca}%`)
  .eq('status', 'ativo')
  .limit(10);
```

#### 3. Adicionar Botão de Entrada Manual

Quando não houver resultados:

```typescript
{resultadosBusca.length === 0 && termoBusca.length >= 3 && !buscando && (
  <div className="text-center py-6 space-y-4">
    <div className="text-muted-foreground">
      <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>Nenhum associado encontrado</p>
      <p className="text-sm">Verifique os dados ou informe manualmente</p>
    </div>
    <Button 
      variant="outline" 
      onClick={() => {
        setModoManual(true);
        setEtapa('dados');
      }}
    >
      <Edit className="h-4 w-4 mr-2" />
      Informar Dados Manualmente
    </Button>
  </div>
)}
```

#### 4. Formulário de Dados Manuais

Na etapa 'dados', adicionar seção para dados manuais quando `modoManual === true`:

```typescript
{modoManual && (
  <Card className="border-amber-200 bg-amber-50/50">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        Entrada Manual de Dados
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="nome_cliente">Nome do Cliente *</Label>
          <Input
            id="nome_cliente"
            placeholder="Nome completo"
            value={dadosManuais.nome_cliente}
            onChange={(e) => setDadosManuais({...dadosManuais, nome_cliente: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="telefone_cliente">Telefone *</Label>
          <Input
            id="telefone_cliente"
            placeholder="(00) 00000-0000"
            value={dadosManuais.telefone_cliente}
            onChange={(e) => setDadosManuais({...dadosManuais, telefone_cliente: e.target.value})}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="placa_veiculo">Placa do Veículo</Label>
          <Input
            id="placa_veiculo"
            placeholder="ABC1D23"
            value={dadosManuais.placa_veiculo}
            onChange={(e) => setDadosManuais({...dadosManuais, placa_veiculo: e.target.value})}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="marca_modelo">Marca/Modelo</Label>
          <Input
            id="marca_modelo"
            placeholder="Ex: Toyota Corolla"
            value={dadosManuais.marca_modelo}
            onChange={(e) => setDadosManuais({...dadosManuais, marca_modelo: e.target.value})}
          />
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

#### 5. Ajustar Mutation para Dados Manuais

Modificar a mutation para salvar dados manuais no campo `descricao` ou em campos específicos se disponíveis:

```typescript
const { data, error } = await supabase
  .from('chamados_assistencia')
  .insert({
    protocolo,
    associado_id: modoManual ? null : associadoSelecionado!.id,
    veiculo_id: modoManual ? null : (veiculoSelecionado || null),
    tipo_servico: formData.tipo_servico,
    descricao: modoManual 
      ? `[CHAMADO MANUAL]\nCliente: ${dadosManuais.nome_cliente}\nTelefone: ${dadosManuais.telefone_cliente}\nVeículo: ${dadosManuais.placa_veiculo} - ${dadosManuais.marca_modelo}\n\n${formData.descricao || ''}`
      : (formData.descricao || null),
    origem_endereco: formData.origem_endereco,
    destino_endereco: formData.destino_endereco || null,
    canal: 'telefone',
    atendente_id: user.data.user?.id,
    status: 'aberto' as const,
  })
```

#### 6. Ajustar Validação do Formulário

```typescript
const isFormValid = () => {
  const baseValid = formData.tipo_servico && formData.origem_endereco.trim().length > 0;
  
  if (modoManual) {
    return baseValid && 
           dadosManuais.nome_cliente.trim().length > 0 && 
           dadosManuais.telefone_cliente.trim().length > 0;
  }
  
  return baseValid && associadoSelecionado && veiculoSelecionado;
};
```

---

## Verificação do Schema

Observação: O schema atual de `chamados_assistencia` tem `associado_id` como campo **obrigatório** (NOT NULL). 

Para permitir chamados manuais, será necessário:
- **Opção A**: Alterar o schema para tornar `associado_id` nullable
- **Opção B**: Criar um associado "placeholder" para chamados manuais
- **Opção C**: Armazenar dados manuais apenas na descrição (abordagem atual proposta)

A **Opção C** é a mais simples e não requer alterações no banco de dados.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/assistencia/NovoChamadoModal.tsx` | Adicionar modo manual, expandir busca para nome, UI de entrada manual |

---

## Resultado Esperado

1. A busca funcionará por **nome, CPF ou placa**
2. Quando não encontrar resultados, aparecerá um botão **"Informar Dados Manualmente"**
3. No modo manual, o operador poderá inserir:
   - Nome do Cliente
   - Telefone
   - Placa do Veículo (opcional)
   - Marca/Modelo (opcional)
4. Esses dados serão salvos na descrição do chamado para referência futura
5. O chamado poderá ser aberto mesmo sem associado cadastrado

