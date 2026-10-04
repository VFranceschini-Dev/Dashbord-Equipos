import { useState, useEffect } from 'react';
import { ExternalServer } from '../types';
import * as db from '../services/localDatabase';
import { v4 as uuidv4 } from 'uuid';
import {
  Server, Plus, Edit2, Trash2, X, Save, Wifi, WifiOff,
  AlertCircle, CheckCircle, RefreshCw, Shield, Globe, Clock
} from 'lucide-react';

export default function ServerConfig() {
  const [servers, setServers] = useState<ExternalServer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ serverId: string; success: boolean; message: string } | null>(null);

  const emptyForm: Omit<ExternalServer, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '',
    type: 'meshcentral',
    url: 'https://mesh.donnet.com.ar',
    username: '',
    password: '',
    autoSync: false,
    syncInterval: 5,
    status: 'inactive',
    notes: '',
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = () => {
    setServers(db.getServers());
  };

  const handleSubmit = () => {
    if (!form.name || !form.url || !form.username || !form.password) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    const now = new Date().toISOString();
    
    if (editingId) {
      const existing = db.getServerById(editingId);
      if (existing) {
        db.saveServer({
          ...existing,
          ...form,
          updatedAt: now,
        });
      }
    } else {
      db.saveServer({
        id: uuidv4(),
        ...form,
        createdAt: now,
        updatedAt: now,
      });
    }

    resetForm();
    loadServers();
  };

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (server: ExternalServer) => {
    const { id, createdAt, updatedAt, ...rest } = server;
    setForm(rest);
    setEditingId(id);
    setShowForm(true);
  };

  const handleTestConnection = async (server: ExternalServer) => {
    setTestResult({ serverId: server.id, success: false, message: 'Probando conexión...' });
    
    // Simular prueba de conexión
    setTimeout(() => {
      const success = Math.random() > 0.3; // Simulación
      setTestResult({
        serverId: server.id,
        success,
        message: success 
          ? 'Conexión exitosa' 
          : 'No se pudo conectar. Verifique las credenciales.',
      });
      
      // Actualizar estado del servidor
      db.saveServer({
        ...server,
        status: success ? 'active' : 'error',
        updatedAt: new Date().toISOString(),
      });
      loadServers();
    }, 1500);
  };

  const handleDelete = (id: string) => {
    db.deleteServer(id);
    setDeleteConfirm(null);
    loadServers();
  };

  const getStatusIcon = (status: ExternalServer['status']) => {
    switch (status) {
      case 'active':
        return <Wifi className="w-4 h-4 text-emerald-600" />;
      case 'inactive':
        return <WifiOff className="w-4 h-4 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: ExternalServer['status']) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusLabel = (status: ExternalServer['status']) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'inactive': return 'Inactivo';
      case 'error': return 'Error';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <Server size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configuración de Servidores</h1>
              <p className="text-sm text-slate-300">Gestione conexiones a servidores externos</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/20"
          >
            <Plus size={18} />
            Nuevo Servidor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Total Servidores</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{servers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Activos</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {servers.filter(s => s.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-slate-400">Con Error</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {servers.filter(s => s.status === 'error').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-4">
        {servers.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 border border-gray-200 dark:border-slate-700 text-center">
            <Server className="w-16 h-16 mx-auto text-gray-300 dark:text-slate-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-300 mb-2">
              No hay servidores configurados
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Comience agregando un servidor externo para sincronizar datos
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Agregar Primer Servidor
            </button>
          </div>
        ) : (
          servers.map(server => (
            <div
              key={server.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                    <Server size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {server.name}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(server.status)}`}>
                        {getStatusIcon(server.status)}
                        {getStatusLabel(server.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                        <Globe size={14} />
                        <span className="font-mono">{server.url}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                        <Shield size={14} />
                        <span>Usuario: {server.username}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                        <RefreshCw size={14} />
                        <span>
                          {server.autoSync 
                            ? `Sync automática cada ${server.syncInterval} min`
                            : 'Sync manual'}
                        </span>
                      </div>
                      {server.lastSync && (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-slate-400">
                          <Clock size={14} />
                          <span>Última sync: {new Date(server.lastSync).toLocaleString('es-AR')}</span>
                        </div>
                      )}
                    </div>
                    {server.notes && (
                      <p className="mt-2 text-sm text-gray-500 dark:text-slate-500 italic">
                        {server.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTestConnection(server)}
                    disabled={testResult?.serverId === server.id}
                    className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Probar conexión"
                  >
                    <RefreshCw size={18} className={testResult?.serverId === server.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => startEdit(server)}
                    className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(server.id)}
                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Test Result */}
              {testResult?.serverId === server.id && (
                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                }`}>
                  {testResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? 'Editar Servidor' : 'Nuevo Servidor'}
              </h3>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={20} className="text-gray-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nombre del Servidor *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                    placeholder="Ej: MeshCentral Principal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Tipo de Servidor *
                  </label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value as ExternalServer['type'] })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                  >
                    <option value="meshcentral">MeshCentral</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  URL del Servidor *
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                  placeholder="https://mesh.donnet.com.ar"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Usuario *
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Contraseña *
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <input
                  type="checkbox"
                  id="autoSync"
                  checked={form.autoSync}
                  onChange={e => setForm({ ...form, autoSync: e.target.checked })}
                  className="rounded border-gray-300 dark:border-slate-600"
                />
                <label htmlFor="autoSync" className="text-sm text-gray-700 dark:text-slate-300">
                  Sincronización automática
                </label>
              </div>

              {form.autoSync && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Intervalo de sincronización (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.syncInterval}
                    onChange={e => setForm({ ...form, syncInterval: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Estado
                </label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as ExternalServer['status'] })}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="error">Error</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Notas
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white resize-none"
                  placeholder="Notas adicionales sobre este servidor..."
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium"
              >
                <Save size={16} />
                {editingId ? 'Guardar Cambios' : 'Agregar Servidor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              ¿Eliminar servidor?
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
              Esta acción eliminará el servidor y todos sus datos sincronizados. No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
