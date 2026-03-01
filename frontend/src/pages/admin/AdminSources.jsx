import React, { useState, useEffect } from 'react';
import {
    getAllSources,
    createSource,
    updateSource,
    deleteSource,
    toggleSourceStatus,
    testSources,
    getTargetRoles,
    addTargetRole,
    toggleTargetRole,
    deleteTargetRole,
    runFullScraping
} from '../../api/scrapingSources';
import { Plus, Play, Trash2, Edit, Activity, ToggleLeft, ToggleRight, X, Save } from 'lucide-react';

const AdminSources = () => {
    const [sources, setSources] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newRoleName, setNewRoleName] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSource, setEditingSource] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'api',
        endpoint: '',
        method: 'GET',
        headers: '{}',
        params: '{}',
        is_active: true
    });

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [sourcesRes, rolesRes] = await Promise.all([
                getAllSources(),
                getTargetRoles()
            ]);
            setSources(sourcesRes.data || sourcesRes || []);
            setRoles(rolesRes || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTestAll = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testSources();
            setTestResult(result);
        } catch (error) {
            setTestResult({
                success: false,
                output: error.response?.data?.output || error.message || "Unknown error occurred"
            });
        } finally {
            setTesting(false);
        }
    };

    const handleRunScraping = async () => {
        if (!window.confirm("Start full background scraping? This may take a while.")) return;
        try {
            await runFullScraping();
            alert("Background scraping has started successfully.");
        } catch (error) {
            console.error(error);
            alert("Failed to start scraping.");
        }
    };

    const handleAddRole = async (e) => {
        e.preventDefault();
        if (!newRoleName.trim()) return;
        try {
            const result = await addTargetRole({ name: newRoleName.trim(), is_active: true });
            setRoles([...roles, result.data || result]);
            setNewRoleName('');
        } catch (error) {
            console.error(error);
            alert("Failed to add role");
        }
    };

    const handleToggleRole = async (id) => {
        try {
            const result = await toggleTargetRole(id);
            const updated = result.data || result;
            setRoles(roles.map(r => r.id === id ? updated : r));
        } catch (error) {
            console.error(error);
            alert("Failed to toggle role");
        }
    };

    const handleDeleteRole = async (id) => {
        if (!window.confirm("Are you sure you want to delete this role?")) return;
        try {
            await deleteTargetRole(id);
            setRoles(roles.filter(r => r.id !== id));
        } catch (error) {
            console.error(error);
            alert("Failed to delete role");
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const response = await toggleSourceStatus(id);
            const updated = response.data || response;
            setSources(sources.map(s => s.id === id ? updated : s));
        } catch (error) {
            console.error(error);
            alert("Failed to toggle status");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this source?")) return;
        try {
            await deleteSource(id);
            setSources(sources.filter(s => s.id !== id));
        } catch (error) {
            console.error(error);
            alert("Failed to delete source");
        }
    };

    const handleOpenModal = (source = null) => {
        if (source) {
            setEditingSource(source);
            setFormData({
                name: source.name,
                type: source.type,
                endpoint: source.endpoint,
                method: source.method,
                headers: JSON.stringify(source.headers || {}, null, 2),
                params: JSON.stringify(source.params || {}, null, 2),
                is_active: source.is_active
            });
        } else {
            setEditingSource(null);
            setFormData({
                name: '',
                type: 'api',
                endpoint: '',
                method: 'GET',
                headers: '{}',
                params: '{}',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                headers: JSON.parse(formData.headers),
                params: JSON.parse(formData.params)
            };

            if (editingSource) {
                const response = await updateSource(editingSource.id, payload);
                const updated = response.data || response;
                setSources(sources.map(s => s.id === updated.id ? updated : s));
            } else {
                const response = await createSource(payload);
                const created = response.data || response;
                setSources([...sources, created]);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Save error:", error);
            alert("Failed to save source. Check console for details (likely JSON parse error).");
        }
    };

    const getTypeColor = (type) => {
        return type === 'api' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-purple-100 text-purple-800';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Activity className="w-6 h-6 text-indigo-600" />
                    Scraping Sources
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={handleRunScraping}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        <Play className="w-4 h-4 fill-white" />
                        Run Full Scraping
                    </button>
                    <button
                        onClick={handleTestAll}
                        disabled={testing}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors ${
                            testing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-sm'
                        }`}
                    >
                        <Activity className="w-4 h-4" />
                        {testing ? 'Running Tests...' : 'Test All Sources'}
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Source
                    </button>
                </div>
            </div>

            {/* Test Results Output */}
            {testResult && (
                <div className={`mb-8 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-x-auto max-h-96 border ${
                    testResult.success 
                        ? 'bg-gray-900 text-green-400 border-gray-800' 
                        : 'bg-gray-900 text-red-400 border-red-900'
                }`}>
                    {testResult.output}
                </div>
            )}

            {/* Sources Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="p-4 border-b">Method</th>
                            <th className="p-4 border-b">Name</th>
                            <th className="p-4 border-b">Type</th>
                            <th className="p-4 border-b">Endpoint</th>
                            <th className="p-4 border-b text-center">Status</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">Loading sources...</td></tr>
                        ) : sources.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500">No scraping sources found.</td></tr>
                        ) : (
                            sources.map(source => (
                                <tr key={source.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold ${
                                            source.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {source.method}
                                        </span>
                                    </td>
                                    <td className="p-4 font-medium text-gray-900">{source.name}</td>
                                    <td className="p-4">
                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(source.type)}`}>
                                            {source.type.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm max-w-xs truncate font-mono" title={source.endpoint}>
                                        {source.endpoint}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => handleToggleStatus(source.id)}
                                            className={`transition-colors ${source.is_active ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-gray-500'}`}
                                            title="Toggle Status"
                                        >
                                            {source.is_active 
                                                ? <ToggleRight className="w-8 h-8" /> 
                                                : <ToggleLeft className="w-8 h-8" />
                                            }
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleOpenModal(source)}
                                                className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(source.id)}
                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Target Job Roles Section */}
            <div className="mt-12 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            Target Job Roles
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Manage the dynamically tracked professions. Active roles are prioritized in scraping.</p>
                    </div>
                    <form onSubmit={handleAddRole} className="flex gap-2">
                        <input
                            type="text"
                            value={newRoleName}
                            onChange={(e) => setNewRoleName(e.target.value)}
                            placeholder="e.g. Lawyer, Backend Dev"
                            className="w-64 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                        />
                        <button
                            type="submit"
                            disabled={!newRoleName.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Add Role
                        </button>
                    </form>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="p-4 border-b">Role Name</th>
                            <th className="p-4 border-b text-center">Status</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="3" className="p-8 text-center text-gray-500">Loading roles...</td></tr>
                        ) : roles.length === 0 ? (
                            <tr><td colSpan="3" className="p-8 text-center text-gray-500">No target roles defined.</td></tr>
                        ) : (
                            roles.map(role => (
                                <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-gray-900">{role.name}</td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => handleToggleRole(role.id)}
                                            className={`transition-colors ${role.is_active ? 'text-green-500 hover:text-green-600' : 'text-gray-400 hover:text-gray-500'}`}
                                            title="Toggle Status"
                                        >
                                            {role.is_active 
                                                ? <ToggleRight className="w-8 h-8" /> 
                                                : <ToggleLeft className="w-8 h-8" />
                                            }
                                        </button>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleDeleteRole(role.id)}
                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-block"
                                            title="Delete Role"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
                                <h2 className="text-xl font-bold text-gray-800">
                                    {editingSource ? 'Edit Source' : 'Add New Source'}
                                </h2>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                            placeholder="e.g. Wuzzuf Laravel Jobs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <select
                                            value={formData.type}
                                            onChange={e => setFormData({...formData, type: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="api">API</option>
                                            <option value="html">HTML</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                                    <input
                                        type="url"
                                        required
                                        value={formData.endpoint}
                                        onChange={e => setFormData({...formData, endpoint: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                                        placeholder="https://api.example.com/v1/jobs..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                                        <select
                                            value={formData.method}
                                            onChange={e => setFormData({...formData, method: e.target.value})}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={e => setFormData({...formData, is_active: e.target.checked})}
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                            />
                                            <span className="text-sm font-medium text-gray-700">Active</span>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Headers (JSON)
                                    </label>
                                    <textarea
                                        rows="3"
                                        value={formData.headers}
                                        onChange={e => setFormData({...formData, headers: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                        placeholder='{"Authorization": "Bearer token"}'
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Params (JSON)
                                    </label>
                                    <textarea
                                        rows="3"
                                        value={formData.params}
                                        onChange={e => setFormData({...formData, params: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                        placeholder='{"q": "developer"}'
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-2 font-medium"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Source
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSources;
