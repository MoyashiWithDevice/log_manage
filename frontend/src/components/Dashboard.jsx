import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

// API requests are proxied through Vite dev server
const API_URL = '/api';

const Dashboard = ({ selectedHost }) => {
    const [stats, setStats] = useState(null);
    const [timeRange, setTimeRange] = useState("all");

    const fetchStats = useCallback(async () => {
        if (!selectedHost) return;
        try {
            const response = await axios.get(`${API_URL}/stats/${selectedHost}?time_range=${timeRange}`);
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, [selectedHost, timeRange]);

    useEffect(() => {
        if (selectedHost) {
            fetchStats();
        }
    }, [fetchStats]);

    const formatHostName = (host) => {
        // Capitalize first letter and replace underscores/hyphens with spaces
        return host
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getTimeRangeLabel = (range) => {
        switch (range) {
            case "1h": return "過去1時間";
            case "1d": return "過去1日";
            case "1w": return "過去1週間";
            case "1m": return "過去1か月";
            case "all": return "全期間";
            default: return "選択期間";
        }
    };

    if (!selectedHost) return <div className="p-4 text-gray-500">Select a host to view statistics.</div>;
    if (!stats) return <div className="p-4">Loading stats...</div>;

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    // Get filtered values for the cards - use filtered values if available, otherwise show 0 for time-filtered data
    const filteredTotal = stats.filtered_total !== undefined ? stats.filtered_total : stats.total;
    // If filtered_levels exists but is empty, that means no logs in the time range, so show 0s
    const filteredLevels = stats.filtered_levels !== undefined ? stats.filtered_levels : stats.levels;

    // Custom Tooltip for Time-Series Chart
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-blue-500/30 rounded-lg shadow-2xl shadow-blue-500/20 p-4 transition-all duration-200 animate-in fade-in-0 zoom-in-95">
                    <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-700/50">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">{label}</p>
                    </div>
                    <div className="space-y-2">
                        {payload.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between space-x-4 group">
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-3 h-3 rounded-sm transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: entry.color }}
                                    ></div>
                                    <span className="text-sm font-medium text-slate-200">{entry.name}</span>
                                </div>
                                <span className="text-sm font-bold text-white tabular-nums">{entry.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-700/50">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">Total</span>
                            <span className="text-sm font-bold text-blue-400 tabular-nums">
                                {payload.reduce((sum, entry) => sum + entry.value, 0)}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Host Info Badge */}
            <div className="flex items-center space-x-3 bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-lg px-4 py-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
                <div className="flex-1">
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Monitoring Host</span>
                    <h2 className="text-lg font-bold text-white">{formatHostName(selectedHost)}</h2>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-green-400 font-medium">Active</span>
                </div>
            </div>

            {/* Metric Cards with Period Filter */}
            <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        ログ統計サマリー
                        <span className="ml-2 text-sm font-normal text-slate-400">({getTimeRangeLabel(timeRange)})</span>
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                        </div>
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Logs</h3>
                        <p className="text-4xl font-bold text-white mt-2">{filteredTotal.toLocaleString()}</p>
                        <div className="mt-4 flex items-center text-sm text-blue-400">
                            <span className="flex items-center">
                                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                {getTimeRangeLabel(timeRange)}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        </div>
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Errors</h3>
                        <p className="text-4xl font-bold text-white mt-2">{(filteredLevels['ERROR'] || 0).toLocaleString()}</p>
                        <div className="mt-4 flex items-center text-sm text-red-400">
                            <span className="flex items-center">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                {getTimeRangeLabel(timeRange)}
                            </span>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-16 h-16 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        </div>
                        <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Warnings</h3>
                        <p className="text-4xl font-bold text-white mt-2">{(filteredLevels['WARN'] || 0).toLocaleString()}</p>
                        <div className="mt-4 flex items-center text-sm text-yellow-400">
                            <span className="flex items-center">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                                {getTimeRangeLabel(timeRange)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-300 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        期間を選択
                    </h3>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setTimeRange("1h")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timeRange === "1h"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            1時間
                        </button>
                        <button
                            onClick={() => setTimeRange("1d")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timeRange === "1d"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            1日
                        </button>
                        <button
                            onClick={() => setTimeRange("1w")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timeRange === "1w"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            1週間
                        </button>
                        <button
                            onClick={() => setTimeRange("1m")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timeRange === "1m"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            1か月
                        </button>
                        <button
                            onClick={() => setTimeRange("all")}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${timeRange === "all"
                                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                }`}
                        >
                            全期間
                        </button>
                    </div>
                </div>
            </div>

            {/* Combined Log Level Trend Chart */}
            {stats.time_series && stats.time_series.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            ログレベル推移（統合グラフ）
                        </h3>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-sm text-slate-300">ERROR: <span className="font-bold text-red-400">{(filteredLevels['ERROR'] || 0).toLocaleString()}</span></span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                                <span className="text-sm text-slate-300">WARNING: <span className="font-bold text-yellow-400">{(filteredLevels['WARN'] || 0).toLocaleString()}</span></span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-sm text-slate-300">INFO: <span className="font-bold text-green-400">{(filteredLevels['INFO'] || 0).toLocaleString()}</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.time_series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorWarn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorInfo" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                <XAxis
                                    dataKey="time"
                                    stroke="#94a3b8"
                                    tick={{ fontSize: 11 }}
                                    interval="preserveStartEnd"
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                <Area type="monotone" dataKey="ERROR" stroke="#EF4444" fill="url(#colorError)" strokeWidth={2} name="ERROR" />
                                <Area type="monotone" dataKey="WARN" stroke="#F59E0B" fill="url(#colorWarn)" strokeWidth={2} name="WARNING" />
                                <Area type="monotone" dataKey="INFO" stroke="#10B981" fill="url(#colorInfo)" strokeWidth={2} name="INFO" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
