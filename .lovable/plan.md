

# Plano de Correcao e Finalizacao - Modulo Marketing

## 1. Corrigir Build Errors - LandingPageFormModal.tsx

### Problema Identificado
O componente `LandingPageFormModal.tsx` utiliza a variavel `ativo` e a funcao `setAtivo` em varios lugares, mas o state nao foi declarado.

### Correcao Necessaria

**Arquivo:** `src/components/marketing/LandingPageFormModal.tsx`

**Linha 41 - Adicionar state faltante:**
```typescript
const [campanhaId, setCampanhaId] = useState('');
const [ativo, setAtivo] = useState(true);  // <-- ADICIONAR
```

**Interface - Adicionar campo ativo:**
```typescript
interface LandingPage {
  id: string;
  nome: string;
  slug: string;
  url: string;
  descricao?: string;
  titulo_seo?: string;
  descricao_seo?: string;
  status: string;
  ativo?: boolean;  // <-- ADICIONAR
  campanha_id?: string;
}
```

---

## 2. Registrar Novas Rotas - App.tsx

### Novas Paginas Criadas
As seguintes paginas foram criadas mas ainda nao estao registradas no roteador:

| Pagina | Rota |
|--------|------|
| `LandingPages` | `/marketing/landing-pages` |
| `Materiais` | `/marketing/materiais` |
| `ComunicacaoMassa` | `/marketing/comunicacao` |
| `RedesSociais` | `/marketing/redes-sociais` |

### Alteracoes no App.tsx

**1. Adicionar imports (apos linha 174):**
```typescript
import LandingPages from "./pages/marketing/LandingPages";
import Materiais from "./pages/marketing/Materiais";
import ComunicacaoMassa from "./pages/marketing/ComunicacaoMassa";
import RedesSociais from "./pages/marketing/RedesSociais";
```

**2. Adicionar rotas (apos linha 450):**
```typescript
<Route path="/marketing/landing-pages" element={<LandingPages />} />
<Route path="/marketing/materiais" element={<Materiais />} />
<Route path="/marketing/comunicacao" element={<ComunicacaoMassa />} />
<Route path="/marketing/redes-sociais" element={<RedesSociais />} />
```

---

## 3. Resumo das Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/components/marketing/LandingPageFormModal.tsx` | Correcao | Adicionar state `ativo` e campo na interface |
| `src/App.tsx` | Adicao | Importar e registrar 4 novas rotas |

---

## Resultado Esperado

Apos as correcoes:
- Build sem erros
- Novas paginas acessiveis via navegacao:
  - `/marketing/landing-pages` - Gestao de Landing Pages
  - `/marketing/materiais` - Biblioteca de Materiais
  - `/marketing/comunicacao` - Campanhas de Email/WhatsApp/SMS
  - `/marketing/redes-sociais` - Dashboard Redes Sociais

