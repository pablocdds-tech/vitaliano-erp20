import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Upload, Download, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ─── CSV Parser básico ──────────────────────────────────────────────────────
function detectSeparator(firstLine) {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs >= semicolons && tabs >= commas) return '\t';
  if (semicolons >= commas) return ';';
  return ',';
}

function splitLine(line, sep) {
  const values = [];
  let current = '';
  let inQuote = false;
  for (const char of line) {
    if (char === '"') { inQuote = !inQuote; }
    else if (char === sep && !inQuote) { values.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
    else { current += char; }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));
  return values;
}

function parseCSV(text) {
  // Remove BOM if present
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  const lines = cleaned.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [], separator: ',' };
  const sep = detectSeparator(lines[0]);
  const headers = splitLine(lines[0], sep);
  const rows = lines.slice(1).map(line => {
    const values = splitLine(line, sep);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
  return { headers, rows, separator: sep };
}

// ─── Configs por entidade ────────────────────────────────────────────────────
export const IMPORT_CONFIGS = {
  produto: {
    entity: 'Produto',
    label: 'Produtos',
    queryKeys: [['produtos'], ['estoques']],
    chaveField: 'codigo',
    chaveFallback: 'nome',
    campos: ['nome', 'codigo', 'unidade_medida', 'tipo', 'categoria_nome'],
    obrigatorios: ['nome'],
    templateHeader: 'nome,codigo,unidade_medida,tipo,categoria_nome',
    templateExemplo:
      'Farinha de Trigo,FAR001,kg,insumo,Farináceos\n' +
      'Açúcar Refinado,ACU001,kg,insumo,Açúcares\n' +
      'Copo 300ml,COP001,cx,embalagem,Embalagens',
    transformar: (row, { categorias = [] }) => {
      const cat = categorias.find(
        c => c.nome.toLowerCase() === (row.categoria_nome || '').trim().toLowerCase()
      );
      return {
        nome: row.nome?.trim(),
        codigo: row.codigo?.trim() || undefined,
        unidade_medida: row.unidade_medida?.trim() || 'un',
        tipo: row.tipo?.trim() || 'insumo',
        categoria_id: cat?.id || undefined,
        controla_estoque: true,
        status: 'ativo',
      };
    },
  },

  fornecedor: {
    entity: 'Fornecedor',
    label: 'Fornecedores',
    queryKeys: [['fornecedores']],
    chaveField: 'cnpj',
    chaveFallback: 'razao_social',
    campos: ['razao_social', 'nome_fantasia', 'cnpj', 'email', 'telefone', 'condicoes_pagamento'],
    obrigatorios: ['razao_social'],
    templateHeader: 'razao_social,nome_fantasia,cnpj,email,telefone,condicoes_pagamento',
    templateExemplo:
      'Distribuidora ABC Ltda,ABC Dist,12.345.678/0001-90,abc@email.com,(11)99999-9999,30/60/90\n' +
      'Fornecedor XYZ,,98.765.432/0001-10,xyz@email.com,(21)88888-8888,À vista',
    transformar: (row) => ({
      razao_social: row.razao_social?.trim(),
      nome_fantasia: row.nome_fantasia?.trim() || undefined,
      cnpj: row.cnpj?.trim() || undefined,
      contato: {
        email: row.email?.trim() || '',
        telefone: row.telefone?.trim() || '',
      },
      condicoes_pagamento: row.condicoes_pagamento?.trim() || undefined,
      status: 'ativo',
    }),
  },

  categoria: {
    entity: 'Categoria',
    label: 'Categorias',
    queryKeys: [['categorias']],
    chaveField: 'nome',
    chaveFallback: null,
    campos: ['nome', 'tipo', 'cor'],
    obrigatorios: ['nome'],
    templateHeader: 'nome,tipo,cor',
    templateExemplo:
      'Farináceos,insumo,#f59e0b\n' +
      'Bebidas,insumo,#3b82f6\n' +
      'Embalagens,embalagem,#8b5cf6',
    transformar: (row) => ({
      nome: row.nome?.trim(),
      tipo: row.tipo?.trim() || 'insumo',
      cor: row.cor?.trim() || '#3b82f6',
      status: 'ativo',
    }),
  },
};

// ─── Modal ───────────────────────────────────────────────────────────────────
export default function ImportarCSVModal({ open, onClose, config, extraData = {} }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [rows, setRows] = useState([]);
  const [erros, setErros] = useState([]);
  const [resultado, setResultado] = useState({ criados: 0, atualizados: 0, erros: 0 });
  const fileInputRef = useRef(null);

  const validRows = rows.filter(r => config.obrigatorios.every(c => r[c]?.trim()));

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setErros([]);
    onClose();
  };

  const downloadTemplate = () => {
    const csv = '\uFEFF' + config.templateHeader + '\n' + config.templateExemplo;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${config.entity.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { rows: parsed, headers, separator } = parseCSV(ev.target.result);
      const validationErrors = [];

      // Warn if header columns don't match expected
      const expected = config.campos;
      const missing = expected.filter(c => !headers.includes(c));
      if (missing.length > 0) {
        validationErrors.push({ row: 1, msg: `Colunas não encontradas no CSV: ${missing.join(', ')} (separador detectado: "${separator === '\t' ? 'TAB' : separator}")` });
      }

      parsed.forEach((row, idx) => {
        config.obrigatorios.forEach(campo => {
          if (!row[campo]?.trim()) {
            validationErrors.push({ row: idx + 2, msg: `Linha ${idx + 2}: campo "${campo}" obrigatório` });
          }
        });
      });
      setRows(parsed);
      setErros(validationErrors);
      setStep('preview');
    };
    // Try UTF-8 first; if garbled, user can re-upload with latin1 hint
    reader.readAsText(file, 'UTF-8');
    // reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleImportar = async () => {
    setStep('importing');
    let criados = 0, atualizados = 0, erros_count = 0;

    const existentes = await base44.entities[config.entity].list();
    const chaveMap = new Map();
    existentes.forEach(item => {
      const chave = item[config.chaveField]?.trim?.()?.toLowerCase();
      const fallback = config.chaveFallback ? item[config.chaveFallback]?.trim?.()?.toLowerCase() : null;
      if (chave) chaveMap.set(chave, item);
      if (fallback && !chave) chaveMap.set(fallback, item);
    });

    for (const row of validRows) {
      const data = config.transformar(row, extraData);
      const chaveVal = row[config.chaveField]?.trim?.()?.toLowerCase();
      const fallbackVal = config.chaveFallback ? row[config.chaveFallback]?.trim?.()?.toLowerCase() : null;
      const existing = (chaveVal ? chaveMap.get(chaveVal) : null)
        || (fallbackVal ? chaveMap.get(fallbackVal) : null);

      if (existing) {
        await base44.entities[config.entity].update(existing.id, data);
        atualizados++;
      } else {
        const created = await base44.entities[config.entity].create(data);
        const newChave = created[config.chaveField]?.trim?.()?.toLowerCase();
        if (newChave) chaveMap.set(newChave, created);
        criados++;
      }
    }

    // Invalidate relevant caches
    config.queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

    setResultado({ criados, atualizados, erros: erros_count });
    setStep('done');
    toast.success(`Importação concluída: ${criados} criados, ${atualizados} atualizados`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Importar {config.label} via CSV</DialogTitle>
        </DialogHeader>

        {/* STEP: upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Como usar</p>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>Baixe o template CSV, preencha com seus dados e faça upload.</li>
                <li>Obrigatórios: <strong>{config.obrigatorios.join(', ')}</strong></li>
                <li>
                  Idempotente: registros existentes são <strong>atualizados</strong> pela
                  chave <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{config.chaveField}</code>
                  {config.chaveFallback && ` (fallback: ${config.chaveFallback})`}
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="w-4 h-4" /> Baixar Template CSV
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" /> Selecionar Arquivo CSV
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        )}

        {/* STEP: preview */}
        {step === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {rows.length} linha(s) encontradas — {validRows.length} válidas
              </p>
              {erros.length > 0 && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {erros.length} problemas
                </span>
              )}
            </div>

            {erros.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 max-h-20 overflow-y-auto">
                {erros.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">{e.msg}</p>
                ))}
                {erros.length > 5 && (
                  <p className="text-xs text-amber-500 mt-1">...e mais {erros.length - 5} avisos</p>
                )}
              </div>
            )}

            <div className="border rounded-lg overflow-auto max-h-56">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2 text-left text-slate-500">#</th>
                    {config.campos.map(c => (
                      <th key={c} className="p-2 text-left font-medium text-slate-600 whitespace-nowrap">
                        {c}{config.obrigatorios.includes(c) ? ' *' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((row, i) => {
                    const isInvalid = config.obrigatorios.some(c => !row[c]?.trim());
                    return (
                      <tr key={i} className={`border-b last:border-0 ${isInvalid ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                        <td className="p-2 text-slate-400">{i + 2}</td>
                        {config.campos.map(c => (
                          <td key={c} className={`p-2 max-w-[120px] truncate ${
                            config.obrigatorios.includes(c) && !row[c]?.trim()
                              ? 'text-red-500 font-medium'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {row[c] || <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 15 && (
                <p className="text-xs text-slate-400 p-2 text-center">
                  ...e mais {rows.length - 15} linhas (preview limitado)
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP: importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-600 dark:text-slate-400">
              Importando {validRows.length} registros... não feche esta janela.
            </p>
          </div>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <p className="text-lg font-semibold text-slate-800 dark:text-white">Importação Concluída!</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <p className="text-2xl font-bold text-emerald-600">{resultado.criados}</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Criados</p>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-2xl font-bold text-blue-600">{resultado.atualizados}</p>
                <p className="text-xs text-blue-700 dark:text-blue-400">Atualizados</p>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-2xl font-bold text-slate-500">{resultado.erros}</p>
                <p className="text-xs text-slate-500">Ignorados</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handleImportar} disabled={validRows.length === 0}>
                Importar {validRows.length} Registro{validRows.length !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}