
## Melhorias na Validação Automática do Chassi via IA

### Resumo

Implementar duas melhorias na validação de chassi já existente:
1. **Alertar cliente na autovistoria** quando o chassi divergir ou estiver ilegível
2. **Destacar diferenças caractere por caractere** na tela de análise para o analista de cadastro

### Estado Atual

O sistema já possui:
- Edge Function `chassi-ocr` funcionando e extraindo chassi via IA
- Hook `useUploadFotoAutovistoria` retornando `chassiValidacao` com resultado
- Card de validação na `AnaliseVistoria.tsx` mostrando resultado (confere/diverge/ilegível)

**Problema identificado**: O resultado do OCR do chassi é retornado no hook, mas **não está sendo exibido para o cliente** durante a autovistoria, diferente do odômetro que mostra toast de sucesso.

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/associado/Autovistoria.tsx` | Adicionar estado e exibir feedback visual quando chassi é validado |
| `src/pages/cadastro/AnaliseVistoria.tsx` | Adicionar componente que destaca diferenças caractere por caractere |

---

### Detalhes de Implementação

#### 1. Alertar Cliente na Autovistoria

No componente `Autovistoria.tsx`, adicionar lógica similar ao tratamento do odômetro:

```typescript
// Estado para armazenar resultado do chassi
const [chassiResultado, setChassiResultado] = useState<{
  chassi: string | null;
  validacao: 'confere' | 'diverge' | 'ilegivel' | null;
  confianca: number;
} | null>(null);

// No handleFileChange, após o upload:
if (fotoAtual.id === 'chassi' && result.chassiValidacao) {
  setChassiResultado(result.chassiValidacao);
  
  if (result.chassiValidacao.validacao === 'confere') {
    toast.success('Chassi validado automaticamente!');
  } else if (result.chassiValidacao.validacao === 'diverge') {
    toast.error('⚠️ Atenção: O chassi da foto não confere com o cadastro!', {
      duration: 8000,
      description: 'Verifique se a foto está correta.',
    });
  } else if (result.chassiValidacao.validacao === 'ilegivel') {
    toast.warning('Não foi possível ler o chassi na foto.', {
      duration: 5000,
      description: 'Tente tirar uma nova foto com melhor iluminação.',
    });
  }
}
```

Na tela de conclusão, exibir card visual similar ao do KM:

```text
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Chassi Validado                                             │
│  O número do chassi confere com o cadastro.                    │
│  Confiança: 95%                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ❌ Chassi Divergente                                           │
│  O número da foto não confere com o cadastro.                  │
│  Confiança: 92%                                                 │
│  ⚠️ Verifique a foto antes de continuar.                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Chassi Ilegível                                             │
│  Não foi possível ler o chassi na foto.                        │
│  💡 Tente uma foto com melhor iluminação.                      │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Destacar Diferenças Caractere por Caractere na Análise

Na página `AnaliseVistoria.tsx`, criar função utilitária para comparar e destacar diferenças:

```typescript
// Função para renderizar chassi com diferenças destacadas
function renderChassiComparado(chassiCadastro: string, chassiOCR: string) {
  const maxLen = Math.max(chassiCadastro.length, chassiOCR.length);
  const caracteres: JSX.Element[] = [];
  
  for (let i = 0; i < maxLen; i++) {
    const charCadastro = chassiCadastro[i] || '';
    const charOCR = chassiOCR[i] || '';
    const diferente = charCadastro.toUpperCase() !== charOCR.toUpperCase();
    
    caracteres.push(
      <span 
        key={i} 
        className={diferente 
          ? 'bg-red-200 dark:bg-red-900 text-red-700 dark:text-red-300 font-bold px-0.5 rounded' 
          : ''
        }
      >
        {charOCR || '?'}
      </span>
    );
  }
  
  return <span className="font-mono">{caracteres}</span>;
}
```

Resultado visual na interface do analista:

```text
┌─────────────────────────────────────────────────────────────────┐
│  🔍 VALIDAÇÃO DO CHASSI (IA)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Chassi do CRLV (cadastro):                                    │
│  9BWZZZ377VT004251                                              │
│                                                                 │
│  Chassi da Foto (OCR):                                         │
│  9BWZZZ377VT00425[2]   ← caractere diferente destacado em vermelho
│                      ↑                                          │
│  Confiança: 92%                                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ❌ CHASSI DIVERGENTE                                     │ │
│  │  Diferença no caractere 17: esperado "1", encontrado "2" │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Melhorias adicionais no card:
- Mostrar posição exata da(s) diferença(s)
- Usar cores diferentes para caracteres que conferem vs divergem
- Mostrar contagem de caracteres diferentes

---

### Fluxo Visual

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ FLUXO DE FEEDBACK AO CLIENTE                                                 │
└──────────────────────────────────────────────────────────────────────────────┘

     CLIENTE                              SISTEMA                    RESULTADO
         │                                   │                           │
         │ 1. Tira foto do chassi            │                           │
         │ ─────────────────────────────────>│                           │
         │                                   │                           │
         │                       2. Upload + OCR                         │
         │                       ─────────────>                          │
         │                                   │                           │
         │ 3. Recebe feedback imediato:      │                           │
         │    ✅ Toast verde: "Chassi OK"    │                           │
         │    ❌ Toast vermelho: "Diverge"   │                           │
         │    ⚠️ Toast amarelo: "Ilegível"  │                           │
         │ <─────────────────────────────────│                           │
         │                                   │                           │
         │ 4. Na conclusão, vê card          │                           │
         │    com resultado visual           │                           │
         │                                   │                           │
         v                                   v                           v

┌──────────────────────────────────────────────────────────────────────────────┐
│ FLUXO DE ANÁLISE COM DESTAQUE                                                │
└──────────────────────────────────────────────────────────────────────────────┘

     ANALISTA                             SISTEMA
         │                                   │
         │ 1. Abre análise da vistoria       │
         │ ─────────────────────────────────>│
         │                                   │
         │ 2. Vê card de Validação Chassi    │
         │    com caracteres destacados      │
         │ <─────────────────────────────────│
         │                                   │
         │    CRLV: 9BWZZZ377VT004251       │
         │    Foto: 9BWZZZ377VT00425[2]     │
         │                            ↑      │
         │         Diferença em vermelho    │
         │                                   │
         v                                   v
```

---

### Considerações Técnicas

1. **Performance**: A comparação de caracteres é feita no frontend, não requer chamada adicional ao backend

2. **Casos especiais tratados**:
   - Chassi do cadastro vazio (não compara)
   - Chassi da foto ilegível (mostra "—")
   - Tamanhos diferentes (destaca caracteres faltantes)

3. **UX Mobile**: Cards e toasts funcionam bem em telas pequenas, usando cores claras para indicar status

4. **Acessibilidade**: Cores complementadas com ícones (✅❌⚠️) para usuários daltônicos
