
# Correcao: Checklist com itens NOK criticos bloqueia progresso na instalacao

## Diagnostico

A logica de criticidade dos itens do checklist esta definida assim:

**Itens criticos** (`critico: true`): veiculo_confere, placa_confere, chassi_confere (moto)
**Itens condicionais** (`critico: false`): condicoes_veiculo, local_seguro, **bateria_ok**, eletrica_ok, cliente_ciente

Bateria e um item **condicional** (nao critico). O problema nao e com bateria especificamente -- e que quando qualquer item **critico** e marcado como NOK, o botao "Ha condicao de continuar" e **completamente escondido** (linha 1872: `{!temCritico && ...}`), impedindo o instalador de prosseguir para fotos, assinatura e decisao final.

O fluxo de manutencao (`ExecutarManutencao.tsx`) ja funciona corretamente: **sempre** mostra o botao "Sim, continuar para resultado", independente de criticidade.

## Correcao

### Arquivo: `src/pages/instalador/InstaladorChecklist.tsx` (linhas 1871-1896)

Remover a condicao `{!temCritico && (...)}` que esconde o botao de continuar. O botao deve estar **sempre visivel**, com texto adaptado:

- **Sem criticos**: "Ha condicao de continuar" (amber)
- **Com criticos**: "Prosseguir mesmo assim" (amber, com aviso de que "Aprovado" estara bloqueado na etapa final)

O botao "Nao ha condicao - Encerrar" continua disponivel em ambos os cenarios.

A logica da etapa 5 (decisao final) ja bloqueia "Aprovado" quando ha itens NOK, entao a seguranca do fluxo esta garantida -- o dialog serve apenas como alerta, nao como bloqueio.

### Resultado

```
Dialog com criticos (ANTES):
  [Nao ha condicao - Encerrar]
  [Revisar checklist]

Dialog com criticos (DEPOIS):
  [Prosseguir mesmo assim]        (amber)
  [Nao ha condicao - Encerrar]    (destructive)
  [Revisar checklist]             (outline)
```

Nenhuma migration necessaria. Apenas 1 arquivo editado.
