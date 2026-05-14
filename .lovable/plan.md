## Contexto

Na autovistoria pública (`AutovistoriaCotacao.tsx`), quando o OCR retorna `legivel=false` ou `match=false`, o fluxo:
- mostra toast vermelho ("Placa ilegível…" / "Placa não confere…");
- impede o avanço automático para a próxima foto (`bloqueadoPorPlaca = true`);
- mantém o badge vermelho "Placa ilegível — refaça a foto.".

Resultado: o associado fica preso quando a placa é peça avulsa/fora do carro (caso real desta cotação de teste — chassi gravado em peça mostrando "9BD341ACW SYA23685", sem placa Mercosul visível).

A foto em si **já é enviada e gravada** (o bloqueio é só de avanço/UI).

## Cotação alvo

- Número: `COT-20260514-182523494-563`
- ID: `1b0b711f-2fec-42c6-973b-93afb4836d0f`

## Mudança proposta (mínima, escopo de exceção)

Arquivo único: `src/components/cotacao-publica/AutovistoriaCotacao.tsx`

1. Adicionar constante `COTACOES_TESTE_BYPASS_OCR_PLACA` no topo do arquivo:
   ```ts
   // EXCEÇÃO TEMPORÁRIA — apenas para testes pontuais autorizados.
   // Não replicar este padrão; em produção a validação de placa é obrigatória.
   const COTACOES_TESTE_BYPASS_OCR_PLACA = new Set<string>([
     '1b0b711f-2fec-42c6-973b-93afb4836d0f', // COT-20260514-182523494-563
   ]);
   ```

2. Dentro de `handleCapturarFoto`, no bloco do OCR de placa (linhas ~236–253), envolver o bloqueio:
   ```ts
   const bypassOcrPlaca = COTACOES_TESTE_BYPASS_OCR_PLACA.has(cotacaoId);
   if (result.placaOcr) {
     setPlacaOcrPorFoto((prev) => ({ ...prev, [fotoAtual.id]: result.placaOcr! }));
     if (bypassOcrPlaca) {
       setPlacaMismatch(null);
       // não bloqueia; segue o fluxo normalmente
     } else if (result.placaOcr.skipped) {
       // 0KM ou sem placa real — não valida
     } else if (!result.placaOcr.legivel) { ... bloqueadoPorPlaca = true; }
     ...
   }
   ```

3. Ajustar o badge visual (linhas ~479–495) para que, quando `bypassOcrPlaca`, mostre apenas a leitura sem cor destrutiva (ou simplesmente não renderizar quando `!match`/`!legivel`).

## Fora de escopo

- Nenhuma mudança em edge function, banco, OCR engine, ou demais cotações.
- Validação de placa permanece **obrigatória** para todas as outras cotações (memória `mem://logic/operations/autovistoria-2-fotos-video-360` e padrão atual mantidos).
- Após o teste, basta esvaziar o `Set` (ou removê-lo) para reverter.

## Validação

1. Reabrir COT-20260514-182523494-563, capturar a foto frontal mesmo com placa ilegível → deve avançar para o chassi sem toast de erro.
2. Abrir outra cotação qualquer → comportamento permanece o atual (bloqueio quando placa não confere).