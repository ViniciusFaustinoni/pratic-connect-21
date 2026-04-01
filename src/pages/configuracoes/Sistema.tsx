import { useState } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface VehicleResult {
  placa: string;
  chassi: string;
  renavam: string;
  marca: string;
  modelo: string;
  marca_modelo: string;
  ano: string;
  cor: string;
  combustivel: string;
  municipio: string;
  uf: string;
  motor: string;
  potencia: string;
  cilindradas: string;
  tipo_veiculo: string;
  categoria: string;
  procedencia: string;
  numero_portas: string;
  cambio: string;
}

interface FipeResult {
  codigo: string;
  valor: number;
  mesReferencia: string;
}

interface LookupResult {
  success: boolean;
  vehicleData?: VehicleResult;
  fipeData?: FipeResult | null;
  error?: string;
}

function InfoItem({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

export default function Sistema() {
  const [saving, setSaving] = useState(false);
  const { hasPerm } = usePermissions();
  const [config, setConfig] = useState({
    itensPorPagina: '20',
    formatoData: 'dd/MM/yyyy',
    notificacoesSom: true,
    autoLogout: '30',
  });

  // Consulta de placa
  const [placa, setPlaca] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState('');

  const handlePlacaChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
    if (cleaned.length >= 4 && /^[A-Z]{3}[0-9]/.test(cleaned) && !/[A-Z]/.test(cleaned[4] || '')) {
      setPlaca(`${cleaned.slice(0, 3)}-${cleaned.slice(3)}`);
    } else {
      setPlaca(cleaned);
    }
    setLookupError('');
    setLookupResult(null);
  };

  const handleLookup = async () => {
    const raw = placa.replace(/[^A-Za-z0-9]/g, '');
    if (raw.length < 7) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('plate-lookup', {
        body: { placa: raw },
      });
      if (error) throw new Error(error.message);
      if (data?.success) {
        setLookupResult(data);
      } else {
        setLookupError(data?.error || 'Veículo não encontrado');
      }
    } catch (err: any) {
      setLookupError(err.message || 'Erro ao consultar placa');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Configurações salvas!');
    setSaving(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const v = lookupResult?.vehicleData;
  const f = lookupResult?.fipeData;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sistema</h1>
        <p className="text-sm text-muted-foreground">Preferências gerais do sistema</p>
      </div>

      {/* Consulta de Placa - apenas analista de cadastro */}
      {hasPerm('canManageCadastro') && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              Consulta de Veículo por Placa
            </CardTitle>
            <CardDescription>Consulte informações completas de um veículo pela placa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-xs">
                <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ABC1234 ou ABC1D23"
                  value={placa}
                  onChange={(e) => handlePlacaChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  className="pl-10 uppercase font-mono text-lg tracking-wider"
                  maxLength={8}
                  disabled={lookupLoading}
                />
              </div>
              <Button onClick={handleLookup} disabled={lookupLoading || placa.replace(/[^A-Za-z0-9]/g, '').length < 7}>
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Consultar
              </Button>
            </div>

            {lookupError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lookupError}</AlertDescription>
              </Alert>
            )}

            {v && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold">Veículo Encontrado</span>
                  <Badge variant="outline" className="font-mono text-base ml-auto">{v.placa}</Badge>
                </div>

                {/* Identificação */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Identificação</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Placa" value={v.placa} />
                    <InfoItem label="Chassi" value={v.chassi} />
                    <InfoItem label="Renavam" value={v.renavam} />
                  </div>
                </div>

                {/* Veículo */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Veículo</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Marca" value={v.marca} />
                    <InfoItem label="Modelo" value={v.modelo} />
                    <InfoItem label="Ano" value={v.ano} />
                    <InfoItem label="Cor" value={v.cor} />
                    <InfoItem label="Tipo" value={v.tipo_veiculo} />
                    <InfoItem label="Nº Portas" value={v.numero_portas} />
                  </div>
                </div>

                {/* Mecânica */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mecânica</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Motor" value={v.motor} />
                    <InfoItem label="Potência" value={v.potencia} />
                    <InfoItem label="Cilindradas" value={v.cilindradas} />
                    <InfoItem label="Combustível" value={v.combustivel} />
                    <InfoItem label="Câmbio" value={v.cambio} />
                  </div>
                </div>

                {/* Registro */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Registro</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoItem label="Município" value={v.municipio} />
                    <InfoItem label="UF" value={v.uf} />
                    <InfoItem label="Categoria" value={v.categoria} />
                    <InfoItem label="Procedência" value={v.procedencia} />
                  </div>
                </div>

                {/* FIPE */}
                {f && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">FIPE</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <InfoItem label="Código FIPE" value={f.codigo} />
                      <div>
                        <p className="text-xs text-muted-foreground">Valor FIPE</p>
                        <p className="font-bold text-primary text-lg">{formatCurrency(f.valor)}</p>
                      </div>
                      <InfoItem label="Referência" value={f.mesReferencia} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preferências */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Itens por página</Label>
              <Select value={config.itensPorPagina} onValueChange={(v) => setConfig({ ...config, itensPorPagina: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 itens</SelectItem>
                  <SelectItem value="20">20 itens</SelectItem>
                  <SelectItem value="50">50 itens</SelectItem>
                  <SelectItem value="100">100 itens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Formato de data</Label>
              <Select value={config.formatoData} onValueChange={(v) => setConfig({ ...config, formatoData: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/AAAA</SelectItem>
                  <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Logout automático</Label>
              <Select value={config.autoLogout} onValueChange={(v) => setConfig({ ...config, autoLogout: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="0">Nunca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
            <div>
              <p className="font-medium">Som de notificações</p>
              <p className="text-sm text-muted-foreground">Tocar som ao receber notificações</p>
            </div>
            <Switch
              checked={config.notificacoesSom}
              onCheckedChange={(v) => setConfig({ ...config, notificacoesSom: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
