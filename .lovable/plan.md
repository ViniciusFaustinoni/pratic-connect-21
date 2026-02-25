

# Centralizar Texto do Header na Capa do PDF Comparativo

## Problema

No header da capa do PDF comparativo, os textos "PRATICCAR", "Proteção Veicular" e "COMPARATIVO DE PLANOS" estão alinhados à esquerda (logo à esquerda do logo). O esperado é que fiquem centralizados na página.

## Solução

No arquivo `src/lib/gerarPdfCotacao.ts`, nas linhas 896-910, alterar as 3 chamadas `doc.text(...)` para usar alinhamento centralizado, substituindo o `titleX` por `pageWidth / 2` e passando a opção `{ align: 'center' }`.

## Detalhes Técnicos

### Arquivo: `src/lib/gerarPdfCotacao.ts`

Linhas 900, 905 e 910 -- trocar de:

```
doc.text('PRATICCAR', titleX, 18);
doc.text('Proteção Veicular', titleX, 27);
doc.text('COMPARATIVO DE PLANOS', titleX, 38);
```

Para:

```
doc.text('PRATICCAR', pageWidth / 2, 18, { align: 'center' });
doc.text('Proteção Veicular', pageWidth / 2, 27, { align: 'center' });
doc.text('COMPARATIVO DE PLANOS', pageWidth / 2, 38, { align: 'center' });
```

A variável `titleX` e a lógica condicional com a logo podem ser mantidas (não causam problema), mas não serão mais usadas nessas 3 linhas. Apenas o posicionamento do texto muda -- a logo permanece à esquerda.

