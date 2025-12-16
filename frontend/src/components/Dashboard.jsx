import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = ({ selectedHost }) => {
    const [stats, setStats] = useState(null);
    const [timeRange, setTimeRange] = useState("1h");

    useEffect(() => {
        if (selectedHost) {
            fetchStats();
        }
    }, [selectedHost, timeRange]);

    const fetchStats = async () => {
        try {
            const response = await axios.get(`http://localhost:8000/stats/${selectedHost}?time_range=${timeRange}`);
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    };

    const formatHostName = (host) => {
        // Capitalize first letter and replace underscores/hyphens with spaces
        return host
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    if (!selectedHost) return <div className="p-4 text-gray-500">Select a host to view statistics.</div>;
    if (!stats) return <div className="p-4">Loading stats...</div>;

    const data = Object.keys(stats.levels).map(key => ({
        name: key,
        value: stats.levels[key]
    }));

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>
                    </div>
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Logs</h3>
                    <p className="text-4xl font-bold text-white mt-2">{stats.total.toLocaleString()}</p>
                    <div className="mt-4 flex items-center text-sm text-blue-400">
                        <span className="flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Active Monitoring
                        </span>
                    </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Errors</h3>
                    <p className="text-4xl font-bold text-white mt-2">{(stats.levels['ERROR'] || 0).toLocaleString()}</p>
                    <div className="mt-4 flex items-center text-sm text-red-400">
                        <span className="flex items-center">
                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                            Critical Events
                        </span>
                    </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-16 h-16 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </div>
                    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Warnings</h3>
                    <p className="text-4xl font-bold text-white mt-2">{(stats.levels['WARN'] || 0).toLocaleString()}</p>
                    <div className="mt-4 flex items-center text-sm text-yellow-400">
                        <span className="flex items-center">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                            Attention Needed
                        </span>
                    </div>
                </div>
            </div>

            {/* Time-Series Chart */}
            {stats.time_series && stats.time_series.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 p-6 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                            Log Level Trends Over Time
                        </h3>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setTimeRange("1h")}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === "1h"
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    }`}
                            >
                                1 Hour
                            </button>
                            <button
                                onClick={() => setTimeRange("1d")}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === "1d"
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    }`}
                            >
                                1 Day
                            </button>
                            <button
                                onClick={() => setTimeRange("1w")}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === "1w"
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                                    }`}
                            >
                                1 Week
                            </button>
                        </div>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.time_series} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                                <Bar dataKey="INFO" stackId="a" fill="#10B981" barSize={8} />
                                <Bar dataKey="WARN" stackId="a" fill="#F59E0B" barSize={8} />
                                <Bar dataKey="ERROR" stackId="a" fill="#EF4444" barSize={8} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
