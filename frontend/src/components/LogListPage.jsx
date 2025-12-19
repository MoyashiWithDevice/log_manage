import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// API requests are proxied through Vite dev server
const API_URL = '/api';

const LogListPage = () => {
    const { host } = useParams();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [hosts, setHosts] = useState([]);
    const [selectedHost, setSelectedHost] = useState(host || '');
    const observerRef = useRef(null);
    const loadingRef = useRef(null);

    // Filtering states
    const [filterLevel, setFilterLevel] = useState("ALL");
    const [filterProcess, setFilterProcess] = useState("");
    const [filterService, setFilterService] = useState("");
    const [filterMessage, setFilterMessage] = useState("");

    // Sorting states
    const [sortField, setSortField] = useState("");
    const [sortDirection, setSortDirection] = useState("asc");

    const BATCH_SIZE = 50;

    // Fetch hosts on mount
    useEffect(() => {
        const fetchHosts = async () => {
            try {
                const response = await axios.get(`${API_URL}/hosts`);
                setHosts(response.data);
                if (!host && response.data.length > 0) {
                    setSelectedHost(response.data[0]);
                }
            } catch (error) {
                console.error("Error fetching hosts:", error);
            }
        };
        fetchHosts();
    }, [host]);

    // Update selectedHost when URL param changes
    useEffect(() => {
        if (host) {
            setSelectedHost(host);
        }
    }, [host]);

    // Fetch logs
    const fetchLogs = useCallback(async (reset = false) => {
        if (!selectedHost || loading) return;
        if (!reset && !hasMore) return;

        setLoading(true);
        const currentOffset = reset ? 0 : offset;

        try {
            const response = await axios.get(
                `${API_URL}/logs/${selectedHost}?limit=${BATCH_SIZE}&offset=${currentOffset}`
            );

            const newLogs = response.data;

            if (reset) {
                setLogs(newLogs);
                setOffset(BATCH_SIZE);
            } else {
                setLogs(prev => [...prev, ...newLogs]);
                setOffset(prev => prev + BATCH_SIZE);
            }

            // If we got fewer logs than requested, there are no more
            if (newLogs.length < BATCH_SIZE) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedHost, offset, hasMore, loading]);

    // Reset and fetch when host changes
    useEffect(() => {
        if (selectedHost) {
            setLogs([]);
            setOffset(0);
            setHasMore(true);
            fetchLogs(true);
        }
    }, [selectedHost]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    fetchLogs(false);
                }
            },
            { threshold: 0.1 }
        );

        observerRef.current = observer;

        if (loadingRef.current) {
            observer.observe(loadingRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [fetchLogs, hasMore, loading]);

    // Handle host change from dropdown
    const handleHostChange = (newHost) => {
        setSelectedHost(newHost);
        navigate(`/logs/${newHost}`);
    };

    const formatHostName = (hostName) => {
        return hostName
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '-';

        try {
            if (timestamp.includes('T')) {
                const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
                if (match) {
                    return `${match[1]} ${match[2]}`;
                }
            }

            const syslogMatch = timestamp.match(/^(\d{4})\s+([A-Z][a-z]{2})\s+(\d+)\s+(\d{2}:\d{2}:\d{2})/);
            if (syslogMatch) {
                const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthNum = monthNames.indexOf(syslogMatch[2]);
                const month = monthNum > 0 ? String(monthNum).padStart(2, '0') : '??';
                const day = syslogMatch[3].padStart(2, '0');
                return `${syslogMatch[1]}-${month}-${day} ${syslogMatch[4]}`;
            }

            if (timestamp.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/)) {
                return timestamp.substring(0, 19);
            }

            return timestamp;
        } catch (e) {
            return timestamp;
        }
    };

    const filteredLogs = useMemo(() => {
        let result = logs.filter(log => {
            const matchLevel = filterLevel === "ALL" || log.level === filterLevel;
            const matchProcess = log.process.toLowerCase().includes(filterProcess.toLowerCase());
            const matchService = (log.service || "").toLowerCase().includes(filterService.toLowerCase());
            const matchMessage = log.message.toLowerCase().includes(filterMessage.toLowerCase());
            return matchLevel && matchProcess && matchService && matchMessage;
        });

        if (sortField) {
            result.sort((a, b) => {
                let aVal = a[sortField] || '';
                let bVal = b[sortField] || '';
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
                if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [logs, filterLevel, filterProcess, filterService, filterMessage, sortField, sortDirection]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
            {/* Navigation */}
            <nav className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                                SIEM Dashboard
                            </h1>
                        </Link>
                        <span className="text-slate-500 mx-2">/</span>
                        <span className="text-slate-300 font-medium">全ログ一覧</span>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link
                            to="/"
                            className="text-slate-400 hover:text-white transition-colors text-sm flex items-center"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            ダッシュボードに戻る
                        </Link>
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-30 group-hover:opacity-75 transition duration-200"></div>
                            <div className="relative flex items-center bg-slate-800 rounded-lg p-1 pr-3 border border-slate-700">
                                <span className="px-3 text-slate-400 text-sm font-medium">Host</span>
                                <select
                                    value={selectedHost}
                                    onChange={(e) => handleHostChange(e.target.value)}
                                    className="bg-slate-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border-none cursor-pointer hover:bg-slate-600 transition-colors min-w-[150px]"
                                >
                                    {hosts.map(h => (
                                        <option key={h} value={h}>
                                            {h.charAt(0).toUpperCase() + h.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="container mx-auto px-6 py-8">
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl shadow-lg overflow-hidden">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center">
                                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {formatHostName(selectedHost)} - 全ログ一覧
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                {filteredLogs.length}件表示中
                            </p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="p-4 bg-slate-800/30 border-b border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Level</label>
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ALL">All Levels</option>
                                <option value="INFO">INFO</option>
                                <option value="WARN">WARN</option>
                                <option value="ERROR">ERROR</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Process</label>
                            <input
                                type="text"
                                placeholder="Filter by process..."
                                value={filterProcess}
                                onChange={(e) => setFilterProcess(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Service</label>
                            <input
                                type="text"
                                placeholder="Filter by service..."
                                value={filterService}
                                onChange={(e) => setFilterService(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Message</label>
                            <input
                                type="text"
                                placeholder="Search message content..."
                                value={filterMessage}
                                onChange={(e) => setFilterMessage(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                            />
                        </div>
                    </div>

                    {/* Log Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead className="bg-slate-900/50">
                                <tr>
                                    <th onClick={() => handleSort('timestamp')} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none">
                                        <div className="flex items-center space-x-1">
                                            <span>Time</span>
                                            {sortField === 'timestamp' && <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('level')} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none">
                                        <div className="flex items-center space-x-1">
                                            <span>Level</span>
                                            {sortField === 'level' && <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('service')} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none">
                                        <div className="flex items-center space-x-1">
                                            <span>Service</span>
                                            {sortField === 'service' && <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('process')} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none">
                                        <div className="flex items-center space-x-1">
                                            <span>Process</span>
                                            {sortField === 'process' && <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('message')} className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors select-none">
                                        <div className="flex items-center space-x-1">
                                            <span>Message</span>
                                            {sortField === 'message' && <span className="text-blue-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-slate-800/20 divide-y divide-slate-700">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log, index) => (
                                        <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">{formatTimestamp(log.timestamp)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.level === 'ERROR' ? 'bg-red-900/50 text-red-300 border border-red-700' : log.level === 'WARN' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' : 'bg-green-900/50 text-green-300 border border-green-700'}`}>
                                                    {log.level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{log.service}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">{log.process}</td>
                                            <td className="px-6 py-4 text-sm text-slate-400 font-mono break-all">{log.message}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                            {loading ? 'Loading...' : 'No logs found matching your filters.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Loading indicator / Infinite scroll trigger */}
                    <div
                        ref={loadingRef}
                        className="px-6 py-8 flex justify-center items-center border-t border-slate-700"
                    >
                        {loading ? (
                            <div className="flex items-center space-x-3">
                                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-slate-400 text-sm">loading...</span>
                            </div>
                        ) : hasMore ? (
                            <span className="text-slate-500 text-sm">↓ more</span>
                        ) : (
                            <span className="text-slate-500 text-sm">load complete</span>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default LogListPage;
