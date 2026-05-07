import { useEffect, useState } from 'react';

/**
 * Cria um Object URL para um File/Blob e revoga automaticamente
 * no unmount ou quando o arquivo trocar. Evita vazamentos de memória
 * em celulares antigos ao manipular fotos no app de instalador.
 */
export function useObjectUrl(file: File | Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
    };
  }, [file]);

  return url;
}
