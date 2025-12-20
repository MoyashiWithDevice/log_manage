import React, { useState, useEffect, useCallback } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import LogViewer from './components/LogViewer';
import LogListPage from './components/LogListPage';

// API requests are proxied through Vite dev server
const API_URL = '/api';

// Main Dashboard Page Component
function DashboardPage() {
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState("");

  const fetchHosts = useCallback(async () => {
    console.log('Fetching hosts from API...');
    try {
      const response = await axios.get(`${API_URL}/hosts`);
      console.log('API Response:', response.data);
      setHosts(response.data);
      if (response.data.length > 0) {
        console.log('Setting selected host to:', response.data[0]);
        setSelectedHost(response.data[0]);
      } else {
        console.warn('No hosts returned from API');
      }
    } catch (error) {
      console.error("Error fetching hosts:", error);
      console.error("Error details:", error.response || error.message);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchHosts();
  }, [fetchHosts]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-blue-500 selection:text-white">
      <nav className="bg-slate-800/50 backdrop-blur-md border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              SIEM Dashboard
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg blur opacity-30 group-hover:opacity-75 transition duration-200"></div>
              <div className="relative flex items-center bg-slate-800 rounded-lg p-1 pr-3 border border-slate-700">
                <span className="px-3 text-slate-400 text-sm font-medium">Host</span>
                <select
                  value={selectedHost}
                  onChange={(e) => setSelectedHost(e.target.value)}
                  className="bg-slate-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 border-none cursor-pointer hover:bg-slate-600 transition-colors min-w-[150px]"
                >
                  {hosts.map(host => (
                    <option key={host} value={host}>
                      {host.charAt(0).toUpperCase() + host.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <Dashboard selectedHost={selectedHost} />
        <LogViewer selectedHost={selectedHost} />
      </main>
    </div>
  );
}

function App() {
  return <RouterProvider router={router} />;
}

const router = createBrowserRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/logs/:host', element: <LogListPage /> },
]);

export default App;
