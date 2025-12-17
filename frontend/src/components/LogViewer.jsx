import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';

// API requests are proxied through Vite dev server
const API_URL = '/api';

const LogViewer = ({ selectedHost }) => {
    const [logs, setLogs] = useState([]);
    const [analysis, setAnalysis] = useState("");
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [analysisError, setAnalysisError] = useState("");
    const [translatedAnalysis, setTranslatedAnalysis] = useState("");
    const [loadingTranslation, setLoadingTranslation] = useState(false);
    const analysisRef = useRef(null);

    // Filtering states
    const [filterLevel, setFilterLevel] = useState("ALL");
    const [filterProcess, setFilterProcess] = useState("");
    const [filterService, setFilterService] = useState("");
    const [filterMessage, setFilterMessage] = useState("");

    // Sorting states
    const [sortField, setSortField] = useState("");
    const [sortDirection, setSortDirection] = useState("asc");

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (selectedHost) {
            fetchLogs();
            setAnalysis("");
            setAnalysisError("");
            setTranslatedAnalysis("");
            setFilterLevel("ALL");
            setFilterLevel("ALL");
            setFilterProcess("");
            setFilterService("");
            setFilterMessage("");
            setCurrentPage(1);
            setSortField("");
        }
    }, [selectedHost]);

    const fetchLogs = async () => {
        try {
            const response = await axios.get(`${API_URL}/logs/${selectedHost}?limit=50`);
            setLogs(response.data);
        } catch (error) {
            console.error("Error fetching logs:", error);
        }
    };

    const handleAnalyze = async () => {
        if (loadingAnalysis) return;

        setLoadingAnalysis(true);
        setAnalysis("");
        setAnalysisError("");
        setTranslatedAnalysis("");

        try {
            const logLines = filteredLogs.slice(0, 50).map(l => l.raw);
            const response = await axios.post(`${API_URL}/analyze`, { logs: logLines });
            setAnalysis(response.data.analysis);
        } catch (error) {
            console.error("Error analyzing logs:", error);
            const errorMsg = error.response?.data?.detail || error.message || "Error analyzing logs.";
            setAnalysisError(errorMsg);
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const handleTranslate = async () => {
        if (loadingTranslation || !analysis) return;

        setLoadingTranslation(true);
        try {
            const response = await axios.post(`${API_URL}/translate`, { text: analysis });
            setTranslatedAnalysis(response.data.translated_text);
        } catch (error) {
            console.error("Error translating:", error);
            const errorMsg = error.response?.data?.detail || error.message || "翻訳エラー";
            setAnalysisError(errorMsg);
        } finally {
            setLoadingTranslation(false);
        }
    };

    const handleExportPDF = async () => {
        if (!analysis && !translatedAnalysis) {
            alert('分析結果が見つかりません');
            return;
        }

        try {
            console.log('Starting Markdown-formatted PDF generation...');

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            const maxWidth = pageWidth - (margin * 2);
            let yPosition = margin;

            // Title
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('SIEM Analysis Report', margin, yPosition);
            yPosition += 10;

            // Timestamp
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const timestamp = new Date().toLocaleString('ja-JP');
            pdf.text(`Generated: ${timestamp}`, margin, yPosition);
            yPosition += 10;

            // Separator
            pdf.setDrawColor(200, 200, 200);
            pdf.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 8;

            // Parse and format Markdown content
            const content = translatedAnalysis || analysis;
            const lines = content.split('\n');

            for (let line of lines) {
                // Check if we need a new page
                if (yPosition > pageHeight - 20) {
                    pdf.addPage();
                    yPosition = margin;
                }

                // Heading 1: # Text
                if (line.startsWith('# ')) {
                    pdf.setFontSize(16);
                    pdf.setFont('helvetica', 'bold');
                    const text = line.substring(2);
                    pdf.text(text, margin, yPosition);
                    yPosition += 10;
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                }
                // Heading 2: ## Text
                else if (line.startsWith('## ')) {
                    pdf.setFontSize(14);
                    pdf.setFont('helvetica', 'bold');
                    const text = line.substring(3);
                    pdf.text(text, margin, yPosition);
                    yPosition += 8;
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                }
                // Heading 3: ### Text
                else if (line.startsWith('### ')) {
                    pdf.setFontSize(12);
                    pdf.setFont('helvetica', 'bold');
                    const text = line.substring(4);
                    pdf.text(text, margin, yPosition);
                    yPosition += 7;
                    pdf.setFontSize(11);
                    pdf.setFont('helvetica', 'normal');
                }
                // Bullet list: - or * or +
                else if (line.match(/^[\s]*[-*+]\s+/)) {
                    const indent = (line.match(/^[\s]*/)[0].length / 2) * 5;
                    const text = line.replace(/^[\s]*[-*+]\s+/, '• ');
                    const splitLines = pdf.splitTextToSize(text, maxWidth - indent - 5);

                    for (let i = 0; i < splitLines.length; i++) {
                        if (yPosition > pageHeight - 20) {
                            pdf.addPage();
                            yPosition = margin;
                        }
                        pdf.text(splitLines[i], margin + indent, yPosition);
                        yPosition += 6;
                    }
                }
                // Numbered list: 1. 2. etc
                else if (line.match(/^[\s]*\d+\.\s+/)) {
                    const indent = (line.match(/^[\s]*/)[0].length / 2) * 5;
                    const splitLines = pdf.splitTextToSize(line.trim(), maxWidth - indent - 5);

                    for (let i = 0; i < splitLines.length; i++) {
                        if (yPosition > pageHeight - 20) {
                            pdf.addPage();
                            yPosition = margin;
                        }
                        pdf.text(splitLines[i], margin + indent, yPosition);
                        yPosition += 6;
                    }
                }
                // Code block
                else if (line.startsWith('```')) {
                    // Skip code fence lines
                    yPosition += 2;
                }
                // Empty line
                else if (line.trim() === '') {
                    yPosition += 4;
                }
                // Regular text
                else {
                    // Handle bold text **text**
                    let processedLine = line;
                    const hasBold = processedLine.includes('**');

                    if (hasBold) {
                        // Simple handling: just remove ** markers
                        processedLine = processedLine.replace(/\*\*/g, '');
                    }

                    const splitLines = pdf.splitTextToSize(processedLine, maxWidth);

                    for (let i = 0; i < splitLines.length; i++) {
                        if (yPosition > pageHeight - 20) {
                            pdf.addPage();
                            yPosition = margin;
                        }

                        if (hasBold) {
                            pdf.setFont('helvetica', 'bold');
                        }

                        pdf.text(splitLines[i], margin, yPosition);

                        if (hasBold) {
                            pdf.setFont('helvetica', 'normal');
                        }

                        yPosition += 6;
                    }
                }
            }

            // Footer
            const pageCount = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(128, 128, 128);
                pdf.text(
                    `Page ${i} of ${pageCount}`,
                    pageWidth / 2,
                    pageHeight - 10,
                    { align: 'center' }
                );
            }

            // Generate filename with timestamp
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const filename = `SIEM-Analysis-Report-${year}${month}${day}-${hours}${minutes}${seconds}.pdf`;

            console.log('Saving PDF with filename:', filename);
            pdf.save(filename);
            console.log('PDF saved successfully');

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert(`PDF生成エラー: ${error.message || '不明なエラー'}`);
            setAnalysisError(`PDF生成エラー: ${error.message || '不明なエラー'}`);
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

    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredLogs, currentPage]);

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    if (!selectedHost) return null;

    return (
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-white flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    System Logs
                </h3>
                <button
                    onClick={handleAnalyze}
                    disabled={loadingAnalysis || filteredLogs.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium py-2 px-6 rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 flex items-center"
                >
                    {loadingAnalysis ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Analyze with AI
                        </>
                    )}
                </button>
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

            {analysis && (
                <div ref={analysisRef} className="p-6 bg-blue-900/20 border-b border-blue-500/30">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="ml-3 w-full">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium text-blue-300">AI Analysis Result</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleExportPDF}
                                        className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 rounded transition-colors flex items-center gap-1.5"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        PDF出力
                                    </button>
                                    <button
                                        onClick={handleTranslate}
                                        disabled={loadingTranslation}
                                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        {loadingTranslation ? (
                                            <>
                                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                翻訳中...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                                </svg>
                                                日本語で表示
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div className="mt-2 text-sm text-blue-200 prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {translatedAnalysis || analysis}
                                </ReactMarkdown>
                            </div>
                            {translatedAnalysis && (
                                <div className="mt-3 pt-3 border-t border-blue-500/30">
                                    <p className="text-xs text-blue-300/70 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        DeepLで翻訳済み
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {analysisError && (
                <div className="p-6 bg-red-900/20 border-b border-red-500/30">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="ml-3 w-full">
                            <h3 className="text-sm font-medium text-red-300">AI Analysis Error</h3>
                            <div className="mt-2 text-sm text-red-200">
                                {analysisError}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                        {paginatedLogs.length > 0 ? (
                            paginatedLogs.map((log, index) => (
                                <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">{log.timestamp}</td>
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
                                    No logs found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {filteredLogs.length > 0 && (
                <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between bg-slate-900/30">
                    <div className="text-sm text-slate-400">
                        Showing <span className="font-medium text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-white">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> of <span className="font-medium text-white">{filteredLogs.length}</span> results
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border border-slate-600 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 border border-slate-600 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LogViewer;
