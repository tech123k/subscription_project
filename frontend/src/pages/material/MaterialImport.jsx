import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, XCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { materialAPI } from '../../services/api';
import Button from '../../components/ui/Button';

const MaterialImport = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      inputRef.current.files = e.dataTransfer.files;
      handleFile({ target: { files: [f] } });
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await materialAPI.import(formData);
      setResult(res);
      if (res.created > 0) {
        toast.success(`${res.created} material(s) imported successfully`);
      }
      if (res.errors?.length === 0 && res.created === 0) {
        toast.error('No materials were imported');
      }
    } catch (err) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setFile(null); setResult(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/materials')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Import Materials</h1>
          <p className="text-sm text-gray-500">Upload an Excel file to bulk-import materials</p>
        </div>
      </div>

      {/* Template download */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Download Template</p>
          <p className="text-xs text-gray-500 mt-0.5">Fill in the template and upload it below</p>
        </div>
        <button
          onClick={async () => {
            try {
              const blob = await materialAPI.template();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'material_template.xlsx'; a.click();
              URL.revokeObjectURL(url);
            } catch { toast.error('Download failed'); }
          }}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
        >
          <Download size={15} /> Template
        </button>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current.click()}
          className="card p-10 border-2 border-dashed border-gray-200 hover:border-primary-400 cursor-pointer transition-colors text-center"
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          {file ? (
            <div className="space-y-2">
              <FileSpreadsheet size={36} className="mx-auto text-green-600" />
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload size={36} className="mx-auto text-gray-300" />
              <p className="font-medium text-gray-700">Drop your Excel file here</p>
              <p className="text-xs text-gray-400">or click to browse — .xlsx / .xls only</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {file && !result && (
        <div className="flex gap-3">
          <Button variant="secondary" onClick={reset}>Remove File</Button>
          <Button icon={Upload} loading={loading} onClick={handleImport}>
            Import Now
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Imported</p>
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Errors</p>
                <p className="text-2xl font-bold text-red-600">{result.errors?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Errors list */}
          {result.errors?.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">Errors</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                    <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset}>Import Another File</Button>
            <Button onClick={() => navigate('/materials')}>View Materials</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialImport;
