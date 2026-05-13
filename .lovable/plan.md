## Diagnóstico

A funcionalidade existe em `CotacaoFormDialog.tsx`, mas o **mínimo por tipo não é respeitado**. O hook que lê os limites (linhas 277–293) ainda usa a chave antiga `fipe_menor_limite_minimo` (única, sem distinção carro/moto). A tela `Redução de Cota` grava esse valor sincronizado com o **mínimo de Carros**, então:

- **Motos com FIPE entre R$ 9k e R$ 30k** ficam bloqueadas pelo guard `valorFipe <= fipeMenorLimiteMinimo` (linha 580) e o card nunca aparece.
- Carros funcionam por coincidência (a chave legada = carro).

## Correção

Em `src/components/cotacoes/CotacaoFormDialog.tsx`:

1. **Hook `config-fipe-menor-limites`** (linhas 277–293): incluir as novas chaves `fipe_menor_limite_minimo_carro` e `fipe_menor_limite_minimo_moto` no `select` e devolver `minimoCarro` / `minimoMoto` separados, com fallback para `fipe_menor_limite_minimo` (carro) e default 9000 (moto).

2. **`fipeMenorInfo`** (linha 580): substituir o guard único pelo mínimo do tipo:
   ```
   const minimoTipo = tipoVeiculoDetectado === 'moto' ? fipeMenorLimites.minimoMoto : fipeMenorLimites.minimoCarro;
   if (valorFipe <= minimoTipo) return null;
   ```
   Adicionar `fipeMenorLimites.minimoCarro/minimoMoto` às deps do `useMemo`.

3. **Mensagem de bloqueio por máximo** (linha 591): já está correta, mantém.

## Fora do escopo

- Zona obrigatória de rastreador (R$ 30k–R$ 35k) continua bloqueando a redução — é regra comercial preservada na memória `regra-1-porcento-bloqueios`.
- Não tocar na tela `/diretoria/reducao-cota` nem na edge de aprovação — já estão corretas.
- Não criar UI extra de "por que não apareceu"; o card permanece silencioso quando inelegível, como hoje.

## Verificação

Após aplicar, abrir cotação:
- Moto FIPE R$ 12k (entre 9k e 27k) → card "Elegível à Regra do 1%" aparece.
- Moto FIPE R$ 28k → card não aparece (acima do máximo moto).
- Carro FIPE R$ 50k → card aparece como hoje.
