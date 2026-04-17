

## Diagnóstico

Usuário reabriu o tema de **liveview na auto-vistoria**. A imagem mostra o navegador "WA Business" (WhatsApp in-app) — o mesmo problema de antes. Mas como ele insiste que "ainda não é possível", preciso reinvestigar o componente atual e garantir que:

1. O `VideoCapture` realmente esteja sendo usado na rota de auto-vistoria pública (`/cotacao/:token` ou similar).
2. O liveview funcione **mesmo dentro do WA Business** quando possível, ou que tenhamos um caminho de saída claro (abrir no navegador externo).

Preciso ler:
- O componente `VideoCapture.tsx` (estado atual do liveview)
- Onde ele é montado na auto-vistoria pública
- Se já existe detecção de in-app browser

Vou propor um plano focado em: **(a) garantir liveview nativo via `getUserMedia` quando o browser suporta**, **(b) detectar in-app browsers e oferecer botão "Abrir no navegador" com link copiável**, **(c) fallback para `<input capture>` apenas como última opção**.

