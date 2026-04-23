import { useEffect, useState, useRef } from 'react';
import { buscarCep } from '@/lib/cep';

export interface EnderecoForm {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const VAZIO: EnderecoForm = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

function normalizar(parcial?: Partial<EnderecoForm>): EnderecoForm {
  return {
    cep: parcial?.cep || '',
    logradouro: parcial?.logradouro || '',
    numero: parcial?.numero || '',
    complemento: parcial?.complemento || '',
    bairro: parcial?.bairro || '',
    cidade: parcial?.cidade || '',
    estado: parcial?.estado || '',
  };
}

function temCepValido(e: EnderecoForm) {
  return (e.cep || '').replace(/\D/g, '').length === 8;
}

function faltamCamposEndereco(e: EnderecoForm) {
  return !e.logradouro || !e.bairro || !e.cidade || !e.estado;
}

/**
 * Hook que mantém o estado do endereço, recebe um `enderecoInicial` (cotação/contrato/associado)
 * e enriquece automaticamente via ViaCEP quando o CEP é válido mas faltam campos.
 *
 * - Reage a mudanças do `enderecoInicial` (não só no mount).
 * - Nunca sobrescreve campos já preenchidos (preserva edição manual).
 * - Expõe flags `enriquecendo`, `enriquecido` e `faltaInfo` para feedback visual.
 */
export function useEnriquecerEndereco(enderecoInicial?: Partial<EnderecoForm>) {
  const [endereco, setEndereco] = useState<EnderecoForm>(() => normalizar(enderecoInicial));
  const [enriquecendo, setEnriquecendo] = useState(false);
  const [enriquecido, setEnriquecido] = useState(false);
  const cepsTentadosRef = useRef<Set<string>>(new Set());
  const inicialAplicadoRef = useRef(false);

  // Aplicar enderecoInicial quando ele chegar/mudar — só preenche o que está vazio
  useEffect(() => {
    if (!enderecoInicial) return;
    const normalizado = normalizar(enderecoInicial);
    // se tudo do inicial está vazio, não faz nada
    const temAlgo =
      normalizado.cep ||
      normalizado.logradouro ||
      normalizado.bairro ||
      normalizado.cidade ||
      normalizado.estado;
    if (!temAlgo) return;

    setEndereco((prev) => ({
      cep: prev.cep || normalizado.cep,
      logradouro: prev.logradouro || normalizado.logradouro,
      numero: prev.numero || normalizado.numero,
      complemento: prev.complemento || normalizado.complemento,
      bairro: prev.bairro || normalizado.bairro,
      cidade: prev.cidade || normalizado.cidade,
      estado: prev.estado || normalizado.estado,
    }));
    inicialAplicadoRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enderecoInicial?.cep,
    enderecoInicial?.logradouro,
    enderecoInicial?.numero,
    enderecoInicial?.complemento,
    enderecoInicial?.bairro,
    enderecoInicial?.cidade,
    enderecoInicial?.estado,
  ]);

  // Auto-enriquecer via ViaCEP quando há CEP válido e faltam campos
  useEffect(() => {
    if (!temCepValido(endereco)) return;
    if (!faltamCamposEndereco(endereco)) return;

    const cepLimpo = endereco.cep.replace(/\D/g, '');
    if (cepsTentadosRef.current.has(cepLimpo)) return;
    cepsTentadosRef.current.add(cepLimpo);

    let cancelado = false;
    setEnriquecendo(true);
    buscarCep(cepLimpo)
      .then((via) => {
        if (cancelado || !via) return;
        setEndereco((prev) => {
          const novo = {
            ...prev,
            logradouro: prev.logradouro || via.logradouro || '',
            bairro: prev.bairro || via.bairro || '',
            cidade: prev.cidade || via.cidade || '',
            estado: prev.estado || via.uf || '',
          };
          // só marca como enriquecido se algo realmente mudou
          if (
            novo.logradouro !== prev.logradouro ||
            novo.bairro !== prev.bairro ||
            novo.cidade !== prev.cidade ||
            novo.estado !== prev.estado
          ) {
            setEnriquecido(true);
          }
          return novo;
        });
      })
      .finally(() => {
        if (!cancelado) setEnriquecendo(false);
      });

    return () => {
      cancelado = true;
    };
  }, [endereco.cep, endereco.logradouro, endereco.bairro, endereco.cidade, endereco.estado]);

  const faltaInfo =
    !temCepValido(endereco) || !endereco.bairro || !endereco.cidade || !endereco.estado;

  // Endereço veio com algo do inicial (para mostrar banner de "pré-preenchido")
  const veioPrePreenchido =
    !!enderecoInicial &&
    Object.values(normalizar(enderecoInicial)).some((v) => v && v.trim().length > 0);

  return {
    endereco,
    setEndereco,
    enriquecendo,
    enriquecido,
    faltaInfo,
    veioPrePreenchido,
  };
}

export { VAZIO as ENDERECO_VAZIO };
