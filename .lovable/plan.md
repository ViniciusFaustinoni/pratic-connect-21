
# Plano: Melhorar Campo de Endereço na Manutenção

## Situação Atual

No modal `AgendarManutencaoModal`, quando o tipo "Rota" é selecionado, aparece apenas um campo de texto livre para endereço com um pequeno link "Usar endereço cadastrado do associado" abaixo.

## Solicitação do Usuário

1. Opção direta/proeminente para usar o **endereço cadastrado** do associado
2. Opção alternativa de informar **CEP com auto-complete** (ViaCEP)
3. Campo separado apenas para o **número** (já que CEP preenche o resto)

## Solução

Reestruturar a seção de endereço com duas opções claras via tabs ou radio buttons:

### Opção A: Usar Endereço Cadastrado
- Mostra o endereço já cadastrado do associado
- Apenas confirma e usa

### Opção B: Informar Outro Endereço
- Campo de CEP (8 dígitos) que dispara busca automática na ViaCEP
- Auto-preenche: logradouro, bairro, cidade, UF
- Campo de número obrigatório

---

## Alterações Técnicas

### Arquivo: `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx`

#### 1. Novos imports
```typescript
import { buscarCep } from '@/lib/cep';
import { Home, Edit } from 'lucide-react';
```

#### 2. Novos estados
```typescript
// Tipo de endereço selecionado
const [tipoEndereco, setTipoEndereco] = useState<'cadastrado' | 'outro'>('cadastrado');

// Campos para endereço alternativo
const [cep, setCep] = useState('');
const [logradouro, setLogradouro] = useState('');
const [numero, setNumero] = useState('');
const [bairro, setBairro] = useState('');
const [cidade, setCidade] = useState('');
const [uf, setUf] = useState('');
const [buscandoCep, setBuscandoCep] = useState(false);
```

#### 3. Verificar se tem endereço cadastrado
```typescript
const enderecoCadastrado = vistoria.logradouro
  ? `${vistoria.logradouro}, ${vistoria.numero || 'S/N'} - ${vistoria.bairro}, ${vistoria.cidade}/${vistoria.uf}`
  : null;
const temEnderecoCadastrado = !!vistoria.logradouro;
```

#### 4. Função para buscar CEP
```typescript
const handleCepChange = async (value: string) => {
  const cepLimpo = value.replace(/\D/g, '');
  // Formatar com máscara
  if (cepLimpo.length <= 5) {
    setCep(cepLimpo);
  } else {
    setCep(`${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5, 8)}`);
  }
  
  // Buscar quando completar 8 dígitos
  if (cepLimpo.length === 8) {
    setBuscandoCep(true);
    const endereco = await buscarCep(cepLimpo);
    if (endereco) {
      setLogradouro(endereco.logradouro);
      setBairro(endereco.bairro);
      setCidade(endereco.cidade);
      setUf(endereco.uf);
    }
    setBuscandoCep(false);
  }
};
```

#### 5. Nova UI quando localTipo === 'rota'
```tsx
{localTipo === 'rota' && (
  <div className="space-y-3">
    <Label>Endereço *</Label>
    
    {/* Seletor de tipo de endereço */}
    <RadioGroup
      value={tipoEndereco}
      onValueChange={(v) => setTipoEndereco(v as 'cadastrado' | 'outro')}
      className="space-y-2"
    >
      {/* Opção: Endereço Cadastrado */}
      {temEnderecoCadastrado && (
        <div className={cn(
          "flex items-start space-x-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
          tipoEndereco === 'cadastrado' ? "border-primary bg-primary/5" : "border-muted"
        )}>
          <RadioGroupItem value="cadastrado" id="end-cadastrado" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="end-cadastrado" className="font-medium cursor-pointer flex items-center gap-2">
              <Home className="h-4 w-4" />
              Endereço cadastrado
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              {enderecoCadastrado}
            </p>
          </div>
        </div>
      )}
      
      {/* Opção: Outro Endereço */}
      <div className={cn(
        "flex items-start space-x-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
        tipoEndereco === 'outro' ? "border-primary bg-primary/5" : "border-muted"
      )}>
        <RadioGroupItem value="outro" id="end-outro" className="mt-1" />
        <div className="flex-1">
          <Label htmlFor="end-outro" className="font-medium cursor-pointer flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Informar outro endereço
          </Label>
        </div>
      </div>
    </RadioGroup>
    
    {/* Campos de endereço alternativo */}
    {tipoEndereco === 'outro' && (
      <div className="space-y-3 pt-2 border-t">
        {/* CEP */}
        <div className="space-y-1">
          <Label className="text-sm">CEP</Label>
          <div className="relative">
            <Input
              placeholder="00000-000"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              maxLength={9}
              className="pr-10"
            />
            {buscandoCep && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        
        {/* Logradouro (auto-preenchido) */}
        {logradouro && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium">{logradouro}</p>
            <p className="text-muted-foreground">{bairro} - {cidade}/{uf}</p>
          </div>
        )}
        
        {/* Número */}
        <div className="space-y-1">
          <Label className="text-sm">Número *</Label>
          <Input
            placeholder="Número ou S/N"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="w-32"
          />
        </div>
      </div>
    )}
  </div>
)}
```

#### 6. Atualizar validação
```typescript
// Se rota, precisa de endereço válido
const enderecoValido = localTipo !== 'rota' || (
  tipoEndereco === 'cadastrado' 
    ? temEnderecoCadastrado 
    : (cep.replace(/\D/g, '').length === 8 && logradouro && numero)
);

const isValid = dataAgendada && periodo && profissionalId && enderecoValido;
```

#### 7. Atualizar submit
```typescript
// Montar endereço final
let enderecoFinal = '';
if (localTipo === 'rota') {
  if (tipoEndereco === 'cadastrado') {
    enderecoFinal = enderecoCadastrado || '';
  } else {
    enderecoFinal = `${logradouro}, ${numero} - ${bairro}, ${cidade}/${uf}`;
  }
}

// Passar para mutation
await agendarMutation.mutateAsync({
  // ... outros campos
  localEndereco: localTipo === 'rota' ? enderecoFinal : undefined,
});
```

#### 8. Resetar estados ao fechar
```typescript
useEffect(() => {
  if (!open) {
    // ... resets existentes
    setTipoEndereco('cadastrado');
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
  }
}, [open]);
```

---

## Resultado Esperado

Quando "Rota" é selecionado:

1. **Card destacado** mostra o endereço já cadastrado (se existir) com opção de seleção
2. **Opção alternativa** para informar outro endereço
3. Ao escolher "outro endereço":
   - Campo de CEP com auto-complete
   - Exibe logradouro/bairro/cidade preenchidos automaticamente
   - Campo separado para número
4. Validação garante que o endereço está completo antes de permitir agendamento
