import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, Upload, X, Loader2, MapPin } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';

interface Props {
  token: string;
  onComplete: () => void;
}

interface ArquivoItem {
  file: File;
  previewUrl: string | null;
}

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    city_district?: string;
    state?: string;
    state_code?: string;
  };
}

export default function EventoEtapa2BO({ token, onComplete }: Props) {
  const [arquivos, setArquivos] = useState<ArquivoItem[]>([]);
  const [numeroBO, setNumeroBO] = useState('');
  const [resumoBO, setResumoBO] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Address states
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [pontoReferencia, setPontoReferencia] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [sugestoes, setSugestoes] = useState<NominatimResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [enderecoSelecionado, setEnderecoSelecionado] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarEndereco = useCallback(async (query: string) => {
    if (query.length < 4) {
      setSugestoes([]);
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Brasil')}&format=json&addressdetails=1&limit=5&accept-language=pt-BR`
      );
      const data: NominatimResult[] = await res.json();
      setSugestoes(data);
    } catch {
      setSugestoes([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleRuaChange = (value: string) => {
    setRua(value);
    setEnderecoSelecionado(false);
    setBairro('');
    setCidade('');
    setUf('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarEndereco(value), 500);
  };

  const selecionarSugestao = (item: NominatimResult) => {
    const addr = item.address;
    setRua(addr.road || item.display_name.split(',')[0] || '');
    setBairro(addr.suburb || addr.neighbourhood || addr.city_district || '');
    setCidade(addr.city || addr.town || '');

    // Extract UF from state
    const estado = addr.state || '';
    const ufMap: Record<string, string> = {
      'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA',
      'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO',
      'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
      'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI',
      'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS',
      'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP',
      'Sergipe': 'SE', 'Tocantins': 'TO',
    };
    setUf(ufMap[estado] || estado);
    setEnderecoSelecionado(true);
    setSugestoes([]);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const addArquivo = (file: File) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setArquivos((prev) => [...prev, { file, previewUrl }]);
  };

  const removeArquivo = (idx: number) => {
    setArquivos((prev) => {
      if (prev[idx].previewUrl) URL.revokeObjectURL(prev[idx].previewUrl!);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(addArquivo);
    e.target.value = '';
  };

  const canSubmit = arquivos.length >= 1 && numeroBO.trim().length > 0 && rua.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('token', token);
      formData.append('etapa', '2');
      formData.append('dados', JSON.stringify({
        numero_bo: numeroBO.trim(),
        resumo_bo: resumoBO.trim(),
        endereco_rua: rua.trim(),
        endereco_numero: numero.trim(),
        endereco_bairro: bairro.trim(),
        endereco_cidade: cidade.trim(),
        endereco_uf: uf.trim(),
        endereco_ponto_referencia: pontoReferencia.trim(),
      }));
      arquivos.forEach((a, i) => formData.append(`arquivo${i}`, a.file));

      const { data, error } = await publicSupabase.functions.invoke('salvar-etapa-evento', {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('B.O. enviado com sucesso!');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar B.O.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Boletim de Ocorrência</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envie o B.O. registrado sobre o sinistro. Pode ser foto, PDF ou imagem digitalizada.
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Toque para enviar foto ou PDF do B.O.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Preview dos arquivos */}
      {arquivos.length > 0 && (
        <div className="space-y-2">
          {arquivos.map((arq, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
              {arq.previewUrl ? (
                <img src={arq.previewUrl} alt="" className="h-12 w-12 object-cover rounded" />
              ) : (
                <div className="h-12 w-12 flex items-center justify-center bg-muted rounded">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <span className="text-sm flex-1 truncate">{arq.file.name}</span>
              <button type="button" onClick={() => removeArquivo(idx)} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Campos B.O. */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="numero_bo">Número do B.O. *</Label>
          <Input
            id="numero_bo"
            placeholder="Ex: 123456/2026"
            value={numeroBO}
            onChange={(e) => setNumeroBO(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="resumo_bo">Resumo do B.O. (opcional)</Label>
          <Textarea
            id="resumo_bo"
            placeholder="Copie o relato do B.O. ou escreva um resumo..."
            value={resumoBO}
            onChange={(e) => setResumoBO(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      {/* Endereço do Evento */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Endereço do Evento</h3>
        </div>

        {/* Rua com autocomplete */}
        <div className="relative">
          <Label htmlFor="endereco_rua">Rua / Logradouro *</Label>
          <Input
            id="endereco_rua"
            placeholder="Digite o nome da rua..."
            value={rua}
            onChange={(e) => handleRuaChange(e.target.value)}
            autoComplete="off"
          />
          {buscando && (
            <div className="absolute right-3 top-[34px]">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {sugestoes.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {sugestoes.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
                  onClick={() => selecionarSugestao(item)}
                >
                  {item.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="endereco_bairro">Bairro</Label>
            <Input
              id="endereco_bairro"
              value={bairro}
              readOnly={enderecoSelecionado}
              onChange={(e) => !enderecoSelecionado && setBairro(e.target.value)}
              className={enderecoSelecionado ? 'bg-muted' : ''}
            />
          </div>
          <div>
            <Label htmlFor="endereco_cidade">Cidade / UF</Label>
            <Input
              id="endereco_cidade"
              value={cidade && uf ? `${cidade} / ${uf}` : cidade || ''}
              readOnly
              className="bg-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="endereco_numero">Número</Label>
            <Input
              id="endereco_numero"
              placeholder="Nº"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endereco_ref">Ponto de Referência</Label>
            <Input
              id="endereco_ref"
              placeholder="Próximo ao..."
              value={pontoReferencia}
              onChange={(e) => setPontoReferencia(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || saving}
        className="w-full"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          'Próxima Etapa'
        )}
      </Button>
    </div>
  );
}
