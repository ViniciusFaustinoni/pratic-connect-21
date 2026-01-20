import { Map } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function InstaladorMapa() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 space-y-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Map className="h-5 w-5 text-blue-400" />
          Mapa
        </h1>

        <Card className="border-slate-700 bg-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Map className="h-16 w-16 text-slate-600" />
            <h3 className="mt-4 text-lg font-semibold text-white">Em breve</h3>
            <p className="mt-1 text-center text-sm text-slate-400">
              O mapa com suas instalações estará disponível em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
