/**
 * Lista de combustíveis — fonte única.
 * Usado como fallback quando a configuração do banco não está disponível.
 */
export const COMBUSTIVEIS_FALLBACK = [
  { value: 'flex', label: 'Flex (Gasolina/Etanol)' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'hibrido', label: 'Híbrido' },
  { value: 'gnv', label: 'GNV' },
];
