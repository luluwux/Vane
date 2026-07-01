import { useState, useEffect, useRef } from 'react';
import { LogViewer } from '../components/LogViewer/LogViewer';
import { useEngineStore } from '../store/engineStore';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { Activity, Radio } from 'lucide-react';
import { translations } from '../utils/translations';
import { motion } from 'framer-motion';
import styles from './LogView.module.css';

export function LogView() {
  const { logs, clearLogs, language } = useEngineStore();
  const t = translations[language];

  // DNS Activity Graph State
  const [dnsData, setDnsData] = useState<number[]>(new Array(30).fill(0));
  const dnsCountRef = useRef(0);

  // Internet Speed Graph State
  const [netData, setNetData] = useState<number[]>(new Array(30).fill(0));
  const prevNetBytesRef = useRef<{ rx: number; tx: number } | null>(null);

  useEffect(() => {
    // 1. Setup DNS Activity listener
    let active = true;
    let dnsUnlisten: (() => void) | null = null;

    const setupDnsListener = async () => {
      try {
        const unlisten = await listen('dns_activity', () => {
          if (active) dnsCountRef.current += 1;
        });
        dnsUnlisten = unlisten;
      } catch (err) {
        console.error('Failed to listen to dns_activity:', err);
      }
    };
    setupDnsListener();

    // 2. Setup 1-second interval for DNS and Internet speed
    const fetchStats = async () => {
      try {
        const bytes = await invoke<[number, number]>('get_network_stats');
        const [rx, tx] = bytes;

        let currentSpeed = 0;
        if (prevNetBytesRef.current !== null) {
          const diffRx = rx - prevNetBytesRef.current.rx;
          const diffTx = tx - prevNetBytesRef.current.tx;
          // Prevent negative/overflow speed if adapter resets
          currentSpeed = Math.max(0, diffRx + diffTx);
        }
        prevNetBytesRef.current = { rx, tx };

        if (active) {
          // Update internet speed data
          setNetData((prev) => [...prev.slice(1), currentSpeed]);

          // Update DNS queries data
          setDnsData((prev) => {
            const next = [...prev.slice(1), dnsCountRef.current];
            dnsCountRef.current = 0; // reset
            return next;
          });
        }
      } catch (err) {
        console.error('Failed to fetch network stats:', err);
      }
    };

    // Run first sample immediately
    fetchStats();

    const interval = setInterval(fetchStats, 1000);

    return () => {
      active = false;
      clearInterval(interval);
      if (dnsUnlisten) dnsUnlisten();
    };
  }, []);

  // Helpers to format graphs
  const renderChart = (data: number[], color: string, gradId: string, isSpeed: boolean) => {
    const width = 230;
    const height = 64;
    const padding = 4;
    const maxVal = Math.max(...data, isSpeed ? 1024 * 50 : 5);

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - (val / maxVal) * (height - padding * 2) - padding;
      return { x, y };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    return (
      <div className={styles.chartWrapper}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
    return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const currentDnsSpeed = dnsData[dnsData.length - 1];
  const currentNetSpeed = netData[netData.length - 1];

  return (
    <div className={styles.view}>
      {/* Real-time graphs section */}
      <div className={styles.chartsGrid}>
        {/* DNS Queries Graph */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={styles.chartCard}
        >
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleRow}>
              <Activity size={14} className={styles.dnsIcon} />
              <span>{t.dnsForwarderTraffic}</span>
            </div>
            <span className={styles.dnsValue}>{currentDnsSpeed} Q/s</span>
          </div>
          {renderChart(dnsData, '#5c7cfa', 'dnsGrad', false)}
        </motion.div>

        {/* Network Speed Graph */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={styles.chartCard}
        >
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleRow}>
              <Radio size={14} className={styles.netIcon} />
              <span>{t.networkSpeed}</span>
            </div>
            <span className={styles.netValue}>{formatSpeed(currentNetSpeed)}</span>
          </div>
          {renderChart(netData, '#10b981', 'netGrad', true)}
        </motion.div>
      </div>

      <div className={styles.viewerContainer}>
        <LogViewer logs={logs} onClear={clearLogs} />
      </div>
    </div>
  );
}
