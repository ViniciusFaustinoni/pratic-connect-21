

## Plano: Destacar texto do contrato no email — maior, caixa alta, branco, pulsante

### Alteração

**Arquivo: `src/components/cotacao-publica/EtapaAssinaturaContrato.tsx`** — linhas 774-781

Trocar o bloco atual:
```tsx
<div className="text-center py-4 px-3">
  <div className="inline-flex items-center gap-2 mb-2">
    <Mail className="h-6 w-6 text-primary animate-bounce" />
  </div>
  <p className="text-2xl md:text-3xl font-bold text-primary leading-tight">
    Seu contrato está no seu e-mail para assinatura!
  </p>
</div>
```

Por:
```tsx
<div className="text-center py-6 px-4 bg-primary rounded-xl">
  <div className="inline-flex items-center gap-2 mb-3">
    <Mail className="h-8 w-8 text-white animate-bounce" />
  </div>
  <p className="text-3xl md:text-4xl font-extrabold text-white uppercase leading-tight animate-pulse">
    SEU CONTRATO ESTÁ NO SEU E-MAIL PARA ASSINATURA!
  </p>
</div>
```

- **Maior**: `text-3xl md:text-4xl` + `font-extrabold`
- **Caixa alta**: `uppercase` + texto em maiúsculas
- **Branco**: `text-white` sobre fundo `bg-primary`
- **Pulsante**: `animate-pulse` no texto

