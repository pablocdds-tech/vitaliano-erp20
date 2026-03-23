import React from 'react';
import { format, parseISO } from 'date-fns';

export default function RelatorioPontoTabela({ dias, funcNome, mesLabel }) {
  return (
    <div className="bg-white dark:bg-slate-900 border rounded-lg overflow-x-auto">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">{funcNome} — {mesLabel}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 text-left">
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Dia</th>
            <th className="px-3 py-2 font-medium text-center">Entrada</th>
            <th className="px-3 py-2 font-medium text-center">Saída Intervalo</th>
            <th className="px-3 py-2 font-medium text-center">Volta Intervalo</th>
            <th className="px-3 py-2 font-medium text-center">Saída</th>
            <th className="px-3 py-2 font-medium text-center">Total</th>
            <th className="px-3 py-2 font-medium text-center text-purple-600">Noturno</th>
          </tr>
        </thead>
        <tbody>
          {dias.map(d => {
            const isWeekend = ['sáb', 'dom'].includes(d.diaSemana);
            return (
              <tr
                key={d.data}
                className={`border-t ${!d.temRegistro ? 'text-muted-foreground' : ''} ${isWeekend && !d.temRegistro ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}
              >
                <td className="px-3 py-1.5">{format(parseISO(d.data), 'dd/MM')}</td>
                <td className="px-3 py-1.5 capitalize">{d.diaSemana}</td>
                <td className="px-3 py-1.5 text-center">{d.entrada}</td>
                <td className="px-3 py-1.5 text-center">{d.saidaAlmoco}</td>
                <td className="px-3 py-1.5 text-center">{d.voltaAlmoco}</td>
                <td className="px-3 py-1.5 text-center">{d.saida}</td>
                <td className="px-3 py-1.5 text-center font-medium">{d.temRegistro ? d.totalFormatado : '-'}</td>
                <td className="px-3 py-1.5 text-center font-medium text-purple-600">
                  {d.noturnos > 0 ? d.noturnoFormatado : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}