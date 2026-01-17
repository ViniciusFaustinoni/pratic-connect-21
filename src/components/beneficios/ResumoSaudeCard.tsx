import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, HelpCircle, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ResumoSaudeCardProps {
  superavit: number;
  equilibrio: number;
  prejuizo: number;
  semDados: number;
  isLoading?: boolean;
}

export function ResumoSaudeCard({
  superavit,
  equilibrio,
  prejuizo,
  semDados,
  isLoading = false
}: ResumoSaudeCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Resumo de Saúde Financeira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-around py-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const total = superavit + equilibrio + prejuizo + semDados;
  
  const items = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Superávit',
      count: superavit,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30'
    },
    {
      icon: <Minus className="w-5 h-5" />,
      label: 'Equilíbrio',
      count: equilibrio,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/30'
    },
    {
      icon: <TrendingDown className="w-5 h-5" />,
      label: 'Prejuízo',
      count: prejuizo,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30'
    },
    {
      icon: <HelpCircle className="w-5 h-5" />,
      label: 'Sem dados',
      count: semDados,
      color: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/30'
    }
  ];
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Resumo de Saúde Financeira
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {total} benefícios analisados
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((item) => (
            <div
              key={item.label}
              className={`flex flex-col items-center justify-center p-4 rounded-lg ${item.bgColor}`}
            >
              <div className={`flex items-center gap-1.5 ${item.color}`}>
                {item.icon}
                <span className="text-2xl font-bold">{item.count}</span>
              </div>
              <span className={`text-sm ${item.color}`}>{item.label}</span>
            </div>
          ))}
        </div>
        
        {prejuizo > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              <strong>Atenção:</strong> {prejuizo} benefício(s) com preço abaixo do custo real
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ResumoSaudeCard;
