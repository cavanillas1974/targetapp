// 🎨 COMPONENTE MEJORADO: Smart Diff Approval Screen

import React, { useState, useMemo } from 'react';
import { ImportAuditData, AuditEntry, AuditStatus, FinalDecision } from '../types/auditTypes';
import { ImportAuditProcessor } from '../utils/importAuditProcessor';

interface SmartDiffApprovalScreenProps {
    auditData: ImportAuditData;
    onApprove: (approvedData: ImportAuditData) => void;
    onCancel: () => void;
}

export const DataAuditScreen: React.FC<SmartDiffApprovalScreenProps> = ({
    auditData,
    onApprove,
    onCancel
}) => {
    const [data, setData] = useState<ImportAuditData>(auditData);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        highConfidence: false,
        autoCorrected: true,
        needsAttention: true
    });

    // 🎯 CLASIFICACIÓN INTELIGENTE POR CONFIANZA
    const smartGroups = useMemo(() => {
        const highConfidence: AuditEntry[] = [];
        const autoCorrected: AuditEntry[] = [];
        const needsAttention: AuditEntry[] = [];

        data.entries.forEach(entry => {
            const confidence = entry.processed.confidence_score || 0;
            const hasChanges =
                entry.original.nombre !== entry.processed.nombre_normalizado ||
                entry.original.direccion !== entry.processed.direccion_normalizada;

            const isCriticalError = [
                AuditStatus.NO_ENCONTRADO_EN_MAPS,
                AuditStatus.DIRECCION_INCOMPLETA,
                AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES,
                AuditStatus.CP_INVALIDO
            ].includes(entry.status);

            const isDuplicate = entry.duplicateInfo !== undefined;

            // Clasificación automática
            if (isCriticalError || isDuplicate || confidence < 0.6) {
                needsAttention.push(entry);
                // No auto-aprobar
            } else if (confidence >= 0.85 && !hasChanges) {
                highConfidence.push(entry);
                // Auto-aprobar
                entry.status_final = FinalDecision.SE_QUEDA;
            } else if (confidence >= 0.60 && hasChanges) {
                autoCorrected.push(entry);
                // Auto-aprobar pero mostrar cambios
                entry.status_final = FinalDecision.SE_QUEDA;
            } else {
                needsAttention.push(entry);
            }
        });

        return { highConfidence, autoCorrected, needsAttention };
    }, [data.entries]);

    // Detectar tipo de corrección
    const detectCorrections = (entry: AuditEntry): string[] => {
        const corrections: string[] = [];
        const orig = entry.original;
        const proc = entry.processed;

        if (orig.nombre !== proc.nombre_normalizado) {
            if (orig.nombre.toUpperCase() === proc.nombre_normalizado) {
                corrections.push('Formato mayúsculas');
            } else {
                corrections.push(`Ortografía/typo en nombre`);
            }
        }

        if (orig.direccion !== proc.direccion_normalizada) {
            if (proc.direccion_normalizada.includes('AV.') || proc.direccion_normalizada.includes('AVENIDA')) {
                corrections.push('Abreviación expandida (AV → Avenida)');
            }
            corrections.push('Formato de dirección normalizado');
        }

        if (orig.cp !== proc.cp_normalizado) {
            corrections.push('Código postal limpiado');
        }

        return corrections;
    };

    // Handlers
    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleApproveGroup = (group: 'autoCorrected' | 'needsAttention', entries: AuditEntry[]) => {
        setData(prev => ({
            ...prev,
            entries: prev.entries.map(e => {
                if (entries.some(entry => entry.row_uid === e.row_uid)) {
                    return { ...e, status_final: FinalDecision.SE_QUEDA };
                }
                return e;
            })
        }));
    };

    const handleRejectEntry = (row_uid: string) => {
        setData(prev => ({
            ...prev,
            entries: prev.entries.map(e =>
                e.row_uid === row_uid
                    ? { ...e, status_final: FinalDecision.SE_EXCLUYE, status: AuditStatus.EXCLUIDO_POR_USUARIO }
                    : e
            )
        }));
    };

    const handleFinalApproval = () => {
        const summary = ImportAuditProcessor.generateSummary(data.entries);
        onApprove({
            ...data,
            summary,
            isApproved: true,
            approvalTimestamp: new Date().toISOString()
        });
    };

    const pendingCount = data.entries.filter(e =>
        e.status_final === FinalDecision.PENDIENTE ||
        e.status_final === FinalDecision.SE_FUSIONA
    ).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-5xl font-black text-slate-900 mb-3 flex items-center gap-4">
                    🔍 Comparación Inteligente de Importación
                </h1>
                <div className="flex items-center gap-4 text-lg">
                    <span className="font-bold text-slate-600">
                        {data.entries.length} tiendas procesadas
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-green-600">
                        {smartGroups.highConfidence.length + smartGroups.autoCorrected.length} aprobadas automáticamente
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="font-bold text-orange-600">
                        {smartGroups.needsAttention.length} requieren revisión
                    </span>
                </div>
            </div>

            {/* 🟢 ALTA CONFIANZA */}
            <div className="bg-white rounded-3xl shadow-lg mb-6 overflow-hidden border-2 border-green-500">
                <div
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 cursor-pointer flex items-center justify-between"
                    onClick={() => toggleSection('highConfidence')}
                >
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">🟢</span>
                        <div>
                            <h2 className="text-2xl font-black">
                                ALTA CONFIANZA ({smartGroups.highConfidence.length} tiendas)
                            </h2>
                            <p className="text-green-100 text-sm mt-1">
                                Auto-aprobadas • Geocodificación exitosa (&gt;85% confianza)
                            </p>
                        </div>
                    </div>
                    <button className="text-3xl">
                        {expandedSections.highConfidence ? '▼' : '▶'}
                    </button>
                </div>

                {expandedSections.highConfidence && (
                    <div className="p-6 bg-green-50">
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {smartGroups.highConfidence.slice(0, 10).map((entry, i) => (
                                <div key={entry.row_uid} className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-900">{i + 1}. {entry.processed.nombre_normalizado}</p>
                                            <p className="text-sm text-slate-600">{entry.processed.direccion_normalizada}, {entry.processed.ciudad_normalizada}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                                                ✓ {Math.round(entry.processed.confidence_score * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {smartGroups.highConfidence.length > 10 && (
                                <p className="text-center text-slate-500 font-semibold pt-4">
                                    ... y {smartGroups.highConfidence.length - 10} más
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 🟡 CORREGIDAS AUTOMÁTICAMENTE */}
            {smartGroups.autoCorrected.length > 0 && (
                <div className="bg-white rounded-3xl shadow-lg mb-6 overflow-hidden border-2 border-yellow-500">
                    <div
                        className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white p-6 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleSection('autoCorrected')}
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">🟡</span>
                            <div>
                                <h2 className="text-2xl font-black">
                                    CORREGIDAS AUTOMÁTICAMENTE ({smartGroups.autoCorrected.length} tiendas)
                                </h2>
                                <p className="text-yellow-100 text-sm mt-1">
                                    Revisá los cambios aplicados • Ortografía, formato y normalización
                                </p>
                            </div>
                        </div>
                        <button className="text-3xl">
                            {expandedSections.autoCorrected ? '▼' : '▶'}
                        </button>
                    </div>

                    {expandedSections.autoCorrected && (
                        <div className="p-6 bg-yellow-50">
                            <div className="space-y-6">
                                {smartGroups.autoCorrected.map((entry, i) => {
                                    const corrections = detectCorrections(entry);
                                    return (
                                        <div key={entry.row_uid} className="bg-white rounded-2xl shadow-md overflow-hidden border border-yellow-300">
                                            <div className="p-6">
                                                <div className="flex items-start justify-between mb-4">
                                                    <h3 className="text-lg font-black text-slate-900">
                                                        #{i + 1} {entry.original.nombre} → {entry.processed.nombre_normalizado}
                                                    </h3>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleApproveGroup('autoCorrected', [entry])}
                                                            className="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectEntry(entry.row_uid)}
                                                            className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* DIFF TABLE */}
                                                <div className="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-500 uppercase mb-3">Original (Excel)</p>
                                                        <div className="space-y-2 text-sm">
                                                            <p className="font-mono text-slate-700">{entry.original.nombre}</p>
                                                            <p className="text-slate-600">{entry.original.direccion}</p>
                                                            <p className="text-slate-600">{entry.original.cp}</p>
                                                            <p className="text-slate-600">{entry.original.ciudad}, {entry.original.estado}</p>
                                                            <p className="text-slate-400 text-xs">Sin coordenadas</p>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-green-700 uppercase mb-3">Geocoding Corregido</p>
                                                        <div className="space-y-2 text-sm">
                                                            <p className="font-mono text-slate-900 font-bold">{entry.processed.nombre_normalizado}</p>
                                                            <p className="text-slate-700">{entry.processed.direccion_normalizada}</p>
                                                            <p className="text-slate-700">{entry.processed.cp_normalizado}</p>
                                                            <p className="text-slate-700">{entry.processed.ciudad_normalizada}, {entry.processed.estado_normalizado}</p>
                                                            {entry.processed.lat && entry.processed.lng && (
                                                                <p className="text-green-600 font-mono text-xs">
                                                                    📍 {entry.processed.lat.toFixed(6)}, {entry.processed.lng.toFixed(6)}
                                                                </p>
                                                            )}
                                                            {entry.processed.place_id && (
                                                                <p className="text-blue-600 text-xs">✓ Place ID: {entry.processed.place_id.slice(0, 20)}...</p>
                                                            )}
                                                            <p className="text-green-700 font-bold text-xs">
                                                                🎯 Confianza: {Math.round(entry.processed.confidence_score * 100)}%
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Corrections list */}
                                                {corrections.length > 0 && (
                                                    <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-200">
                                                        <p className="text-xs font-bold text-blue-700 mb-2">💡 Correcciones aplicadas:</p>
                                                        <ul className="text-xs text-blue-600 space-y-1">
                                                            {corrections.map((corr, idx) => (
                                                                <li key={idx}>• {corr}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-6 flex justify-center gap-4">
                                <button
                                    onClick={() => handleApproveGroup('autoCorrected', smartGroups.autoCorrected)}
                                    className="px-8 py-4 bg-green-600 text-white font-black text-lg rounded-xl hover:bg-green-700 shadow-lg"
                                >
                                    ✓ APROBAR TODAS LAS CORRECCIONES
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 🔴 REQUIEREN ATENCIÓN */}
            {smartGroups.needsAttention.length > 0 && (
                <div className="bg-white rounded-3xl shadow-lg mb-6 overflow-hidden border-2 border-red-500">
                    <div
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white p-6 cursor-pointer flex items-center justify-between"
                        onClick={() => toggleSection('needsAttention')}
                    >
                        <div className="flex items-center gap-4">
                            <span className="text-4xl">🔴</span>
                            <div>
                                <h2 className="text-2xl font-black">
                                    REQUIEREN ATENCIÓN ({smartGroups.needsAttention.length} tiendas)
                                </h2>
                                <p className="text-red-100 text-sm mt-1">
                                    Errores críticos, duplicados o baja confianza • Decisión requerida
                                </p>
                            </div>
                        </div>
                        <button className="text-3xl">
                            {expandedSections.needsAttention ? '▼' : '▶'}
                        </button>
                    </div>

                    {expandedSections.needsAttention && (
                        <div className="p-6 bg-red-50">
                            <div className="space-y-4">
                                {smartGroups.needsAttention.map((entry, i) => (
                                    <div key={entry.row_uid} className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-500">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <input type="checkbox" className="w-5 h-5" />
                                                    <h3 className="font-bold text-slate-900">
                                                        {entry.original.nombre}
                                                    </h3>
                                                    <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-700 rounded-full">
                                                        {entry.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 mb-2">{entry.explicacion_humana}</p>
                                                {entry.recomendacion_correccion !== 'Ninguna acción requerida.' && (
                                                    <p className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2 font-semibold">
                                                        💡 {entry.recomendacion_correccion}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApproveGroup('needsAttention', [entry])}
                                                    className="px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600"
                                                >
                                                    ✓ Aprobar
                                                </button>
                                                <button
                                                    onClick={() => handleRejectEntry(entry.row_uid)}
                                                    className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600"
                                                >
                                                    ✕ Excluir
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer de acción */}
            <div className="bg-white rounded-3xl shadow-2xl p-8 flex items-center justify-between sticky bottom-4">
                <button
                    onClick={onCancel}
                    className="px-8 py-4 bg-slate-200 text-slate-700 font-black text-lg rounded-xl hover:bg-slate-300"
                >
                    ← CANCELAR
                </button>

                <div className="text-center">
                    {pendingCount > 0 && (
                        <p className="text-red-600 font-bold mb-3">
                            ⚠️ {pendingCount} tiendas pendientes de decisión
                        </p>
                    )}
                    <button
                        onClick={handleFinalApproval}
                        disabled={pendingCount > 0}
                        className={`px-12 py-4 font-black text-white text-xl rounded-xl shadow-lg ${pendingCount === 0
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gray-400 cursor-not-allowed'
                            }`}
                    >
                        ✅ APROBAR Y CONTINUAR
                    </button>
                    {pendingCount === 0 && (
                        <p className="text-green-600 text-sm mt-2 font-semibold">
                            Todas las tiendas han sido revisadas
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
