# Abrir detalhes da cobrança em modal

## Mudança

Hoje, clicar em "Ver detalhes" no menu da lista de cobranças navega para a rota `/financeiro/cobrancas/:id` (página inteira). Vamos transformar isso em um modal sobre a lista, mantendo a rota como fallback (links externos / refresh continuam funcionando).

## Arquivos alterados

### 1. `src/pages/financeiro/CobrancaDetalhe.tsx` — refatoração mínima

Aceitar `id` via prop opcional (além do `:id` da rota) e flag `embedded` para ocultar o botão "Voltar":

```tsx
interface CobrancaDetalheProps {
  cobrancaId?: string;   // prioridade sobre params
  embedded?: boolean;    // oculta "Voltar" no modo modal
}

export default function CobrancaDetalhe({ cobrancaId, embedded }: Props = {}) {
  const params = useParams<{ id: string }>();
  const id = cobrancaId ?? params.id;
  // ...resto idêntico
}
```

E envolver os 2 botões "Voltar" existentes em `{!embedded && ...}`.

### 2. `src/components/cobranca/CobrancaDetalheModal.tsx` — novo wrapper

Componente leve (~25 linhas) que abre um Dialog grande (`max-w-5xl`, `max-h-[90vh] overflow-y-auto`) e renderiza `<CobrancaDetalhe cobrancaId={id} embedded />` quando `open=true`.

### 3. `src/pages/financeiro/CobrancasList.tsx` — trocar navegação por abertura de modal

- Adicionar estado: `const [detalheId, setDetalheId] = useState<string | null>(null)`
- Trocar `onClick={() => navigate(`/financeiro/cobrancas/${cobranca.id}`)}` por `onClick={() => setDetalheId(cobranca.id)}`
- Renderizar `<CobrancaDetalheModal id={detalheId} open={!!detalheId} onOpenChange={o => !o && setDetalheId(null)} />` ao final do componente

### 4. Rota `/financeiro/cobrancas/:id` — preservada

Continua funcionando como página standalone (acesso por URL direta, compartilhamento de link, refresh). Sem mudança em `App.tsx`.

## Comportamento esperado

- Clique em "Ver detalhes" → modal abre por cima da lista, sem mudar a URL
- Botões internos ("Cancelar", "Segunda Via", "Reenviar PDF", etc.) continuam funcionando idênticos dentro do modal
- Fechar o modal (ESC, clique fora ou X) volta para a lista no mesmo scroll
- Cache do React Query é compartilhado: dados aparecem instantaneamente se já vistos
- URL `/financeiro/cobrancas/abc-123` direto no navegador continua exibindo a página inteira normalmente

## Riscos

Baixos. A lógica do componente não muda — só ganha 2 props opcionais com defaults seguros. Botão "Voltar" oculto no modo modal evita ação confusa (não há para onde voltar dentro de um Dialog).
