

## Diagnóstico

O componente `VideoCapture` (`src/components/instalador/VideoCapture.tsx`) **já implementa live preview correto** (`getUserMedia` + `<video srcObject autoPlay muted playsInline>` nas linhas 67-69 e 214-220). Funciona bem em Safari, Chrome e WebView Android.

**Por que o usuário não vê o preview:** o screenshot mostra "WA Business" no topo — está dentro do **navegador in-app do WhatsApp Business no iOS** (WKWebView restrito da Meta). Esse navegador embutido **bloqueia ou não renderiza `getUserMedia` corretamente**: ou a permissão é negada silenciosamente, ou o stream é obtido mas o `<video srcObject>` fica preto. Resultado: o usuário clica em "Gravar Vídeo", o iOS abre a câmera nativa em tela cheia (via fallback do `<input capture>` em alguns casos, ou nada acontece), grava sem feedback visual customizado, e só vê o resultado depois de parar.

Isso é uma limitação conhecida e **intencional** dos in-app browsers de Meta (WhatsApp/Instagram/Facebook) — não tem como burlar do lado do código. A solução padrão da indústria é **detectar o in-app browser e forçar abertura no Safari/Chrome**.

## Solução em 2 partes

### Parte 1 — Garantir que o liveview funcione bem onde é possível (Safari/Chrome reais)

O componente atual já está correto. Pequenos hardenings preventivos no `VideoCapture.tsx`:
- Definir `videoPreviewRef.current.muted = true` programaticamente antes do `play()` (alguns iOS Safari ignoram o atributo JSX e bloqueiam autoplay com áudio).
- `await videoPreviewRef.current.play()` com tratamento — capturar `NotAllowedError` e exibir botão "Tocar preview" como último fallback.
- Adicionar `style={{ transform: 'scaleX(1)' }}` e `controls={false}` explícitos para evitar overlay nativo do iOS sobrepondo o HUD.

### Parte 2 — Detectar in-app browser do WhatsApp/Instagram/Facebook e bloquear gravação inline

Criar `src/lib/detectInAppBrowser.ts`:
```ts
export function detectInAppBrowser(): 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | null {
  const ua = navigator.userAgent || '';
  if (/WhatsApp/i.test(ua)) return 'whatsapp';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
  if (/TikTok|musical_ly/i.test(ua)) return 'tiktok';
  return null;
}
```

No `VideoCapture.tsx`, antes da tela inicial de gravação:
- Se `detectInAppBrowser()` retornar algo, mostrar um **bloco de aviso bem visível** no lugar do botão "Gravar Vídeo":
  - Ícone + título: "Abra no navegador para gravar"
  - Texto: *"Você está no navegador interno do WhatsApp, que não permite ver a câmera enquanto grava. Toque no menu (⋯) acima e escolha **Abrir no Safari** (iPhone) ou **Abrir no Chrome** (Android)."*
  - Botão secundário: "Copiar link" (`navigator.clipboard.writeText(window.location.href)` + toast).
  - Botão terciário (fallback degradado): "Gravar mesmo assim (sem preview ao vivo)" — usa o `<input type="file" accept="video/*" capture="environment">` nativo, que sempre funciona, embora sem HUD customizado.

Isso resolve o problema de UX para 99% dos casos: o usuário vai ser orientado a abrir no Safari/Chrome (onde o liveview já funciona), e quem insistir tem o fallback nativo do iOS que pelo menos abre a câmera do sistema com preview pleno.

### Parte 3 — Aplicar o mesmo aviso na tela `AutovistoriaCotacao.tsx`

O fluxo público de cotação é onde o link chega via WhatsApp e o usuário abre dentro do in-app browser. Adicionar um banner persistente no topo da `AutovistoriaCotacao` (e também em `CotacaoPublicaCompleta`) avisando antes mesmo de chegar na etapa de gravação:

> "📱 Para uma melhor experiência ao gravar o vídeo, abra este link no Safari (iPhone) ou Chrome (Android)." + botão "Copiar link"

Só aparece se `detectInAppBrowser() !== null`.

## Arquivos a editar/criar

- **criar** `src/lib/detectInAppBrowser.ts`
- **editar** `src/components/instalador/VideoCapture.tsx` — pequeno hardening do preview + bloco de aviso/fallback in-app
- **editar** `src/components/cotacao-publica/AutovistoriaCotacao.tsx` — banner no topo
- **editar** `src/pages/public/CotacaoPublicaCompleta.tsx` — banner no topo (mesma vistoria pública)

## Validação

1. Abrir o link da cotação no **Safari do iPhone**: clicar em "Gravar Vídeo" → deve aparecer o preview ao vivo com o HUD (timer + botão parar) e a câmera traseira em tempo real.
2. Abrir o **mesmo link dentro do WhatsApp Business**: deve aparecer o aviso amarelo com instruções de abrir no Safari + botão "Copiar link" + opção de fallback.
3. Usar o fallback "Gravar mesmo assim" no WhatsApp in-app: deve abrir a câmera nativa do iOS, gravar e retornar o vídeo.
4. Testar em Chrome Android: liveview funciona normalmente.

## Observação importante

O liveview **já está implementado e funcional** no código — o problema do usuário é exclusivamente o navegador onde ele está abrindo o link. A correção aqui é principalmente sobre **detectar e orientar**, não sobre "implementar liveview" do zero.

