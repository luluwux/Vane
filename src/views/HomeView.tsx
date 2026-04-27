import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEngineStore } from '../store/engineStore';
import { Shield, RefreshCw, Wifi, Activity, Plus, X, Download } from 'lucide-react';
import styles from './HomeView.module.css';

type UnlistenFn = () => void;

export function HomeView() {
  const {
    status,
    refreshPresets,
    presets,
    activePresetId,
    dnsProviders,
    selectedDnsId,
    healthCheckTargets,
    setHealthCheckTargets,
  } = useEngineStore();

  const isRunning = status.variant === 'running';
  const activePreset = presets.find((p) => p.id === activePresetId);
  const presetLabel = activePreset?.label ?? activePresetId ?? 'Default';

  const activeDns = selectedDnsId === 'custom'
    ? 'Custom DNS'
    : (dnsProviders.find(d => d.id === selectedDnsId)?.name || 'Default');

  const [geoData, setGeoData] = useState<{
    query: string;
    isp: string | null;
    org: string | null;
    city: string | null;
    country: string | null;
    status?: string;
  }>({
    query: 'Checking...',
    isp: null,
    org: null,
    city: null,
    country: null,
  });

  // Güncelleme bildirim state'i
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string | null } | null>(null);
  const [sysInfo, setSysInfo] = useState({ device_model: 'Windows Desktop', os: 'windows' });
  const [showIp, setShowIp] = useState(false);

  // Auto-Start state
  const [isElevated, setIsElevated] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);

  // Remote presets state
  const [remoteStatus, setRemoteStatus] = useState<'idle' | 'syncing' | 'offline' | 'updated'>('idle');

  // Health check targets state
  const [newTarget, setNewTarget] = useState('');

  const handleAddTarget = () => {
    let t = newTarget.trim().toLowerCase();
    if (!t) return;
    
    // Automatically strip extra spaces and common bad inputs
    t = t.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');

    if (healthCheckTargets.includes(t)) {
      setNewTarget('');
      return; // prevent duplicate
    }
    
    setHealthCheckTargets([...healthCheckTargets, t]);
    setNewTarget('');
  };

  const geoFetched = useRef(false);

  useEffect(() => {
    refreshPresets();

    if (!geoFetched.current) {
      geoFetched.current = true;

      fetch('https://ipwho.is/')
        .then((res) => res.json())
        .then((data) => {
          // ipwho.is başarısız döndüğünde success: false olur
          if (data.success === false) {
            setGeoData({ query: 'Unavailable', isp: null, org: null, city: null, country: null });
          } else {
            setGeoData({
              query: data.ip ?? 'N/A',
              isp: data.connection?.isp || null,
              org: data.connection?.org || null,
              city: data.city || null,
              country: data.country || null,
            });
          }
        })
        .catch(() => setGeoData({ query: 'Error', isp: null, org: null, city: null, country: null }));

      invoke<{ device_model: string; os: string }>('get_system_info')
        .then((info) => setSysInfo(info))
        .catch(() => { });

      // Açılışta güncelleme kontrolü (tek seferlik, kullanıcıyı bloklamaz)
      invoke<{ version: string; body: string | null } | null>('check_for_updates')
        .then((info) => {
          if (info) setUpdateInfo(info);
        })
        .catch(() => { /* sessizce geç */ });
    }

    // Query auto-start status and privilege level
    invoke<boolean>('check_is_elevated').then(setIsElevated).catch(() => { });
    invoke<boolean>('get_autostart_status').then(setAutostartEnabled).catch(() => { });

    // Proper cleanup: collect unlisten functions and call them on unmount.
    // Using a cleanup array instead of .then() prevents dangling listeners on
    // early unmount or promise rejection.
    const cleanupFns: UnlistenFn[] = [];
    let active = true;

    const addListener = async <T,>(event: string, handler: (payload: T) => void) => {
      const unlisten = await listen<T>(event, (e) => handler(e.payload));
      if (!active) {
        unlisten(); // component already unmounted before promise resolved
      } else {
        cleanupFns.push(unlisten);
      }
    };

    addListener('remote_presets_updated', () => {
      setRemoteStatus('updated');
      refreshPresets();
      setTimeout(() => setRemoteStatus('idle'), 3000);
    });

    addListener('remote_presets_offline', () => {
      setRemoteStatus('offline');
    });

    return () => {
      active = false;
      cleanupFns.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutostartToggle = async () => {
    if (!isElevated || autostartLoading) return;
    setAutostartLoading(true);
    setAutostartError(null);
    try {
      await invoke('set_autostart', { enabled: !autostartEnabled });
      setAutostartEnabled(!autostartEnabled);
    } catch (e) {
      setAutostartError(String(e));
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleManualSync = async () => {
    setRemoteStatus('syncing');
    try {
      await invoke('refresh_remote_presets');
      refreshPresets();
      setRemoteStatus('idle');
    } catch {
      setRemoteStatus('offline');
    }
  };

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleInstallUpdate = async () => {
    try {
      await invoke('install_update');
    } catch (e) {
      console.error('Failed to install update:', e);
    }
  };

  return (
    <div className={styles.view}>
      {/* ─── Güncelleme Bildirim Banner'ı ─────────────────────────── */}
      {updateInfo && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 8,
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 4,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a5b4fc' }}>
            <Download size={12} />
            New version available: <strong style={{ color: '#c7d2fe' }}>v{updateInfo.version}</strong>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleInstallUpdate}
              style={{
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 5,
                border: 'none',
                cursor: 'pointer',
                background: 'rgba(99,102,241,0.35)',
                color: '#c7d2fe',
                transition: 'all 0.15s',
              }}
            >
              Update
            </button>
            <button
              onClick={() => setUpdateInfo(null)}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={styles.infoCard}
      >
        <h3 className={styles.cardTitle}>Connectivity information</h3>
        <div className={styles.infoRow}>
          <span>Connection:</span>
          <span className={isRunning ? styles.activeText : styles.inactiveText}>
            {isRunning ? '● Active' : '○ Inactive'}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span>Preset:</span>
          <span>{presetLabel}</span>
        </div>
        <div className={styles.infoRow}>
          <span>ISP name:</span>
          <span className={styles.truncate} style={{ color: geoData.isp ? undefined : 'rgba(255,255,255,0.3)', fontStyle: geoData.isp ? undefined : 'italic' }}>
            {geoData.isp ?? 'N/A'}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span>Org:</span>
          <span className={styles.truncate} style={{ color: geoData.org ? undefined : 'rgba(255,255,255,0.3)', fontStyle: geoData.org ? undefined : 'italic' }}>
            {geoData.org ?? 'N/A'}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span>Location:</span>
          <span style={{ color: (geoData.city || geoData.country) ? undefined : 'rgba(255,255,255,0.3)', fontStyle: (geoData.city || geoData.country) ? undefined : 'italic' }}>
            {(geoData.city && geoData.country)
              ? `${geoData.city}, ${geoData.country}`
              : (geoData.city || geoData.country || 'N/A')}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span>Active DNS:</span>
          <span>{activeDns}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className={styles.infoCard}
      >
        <h3 className={styles.cardTitle}>Your device</h3>
        <div className={styles.infoRow}>
          <span>Public IP:</span>
          <span
            className={`${styles.ipText} ${!showIp ? styles.blurredText : ''}`}
            onClick={() => setShowIp(!showIp)}
          >
            {geoData.query}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span>Timezone:</span>
          <span>{timezone}</span>
        </div>
        <div className={styles.infoRow}>
          <span>OS:</span>
          <span style={{ textTransform: 'capitalize' }}>{sysInfo.os}</span>
        </div>
        <div className={styles.divider} />
      </motion.div>

      {/* ─── Auto-Start ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className={styles.infoCard}
      >
        <h3 className={styles.cardTitle}>System</h3>

        <div className={styles.infoRow} style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {!isElevated && <Shield size={12} style={{ color: '#f59e0b' }} />}
            Launch at startup
          </span>
          <button
            onClick={handleAutostartToggle}
            disabled={!isElevated || autostartLoading}
            style={{
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 5,
              border: 'none',
              cursor: isElevated ? 'pointer' : 'not-allowed',
              background: autostartEnabled
                ? 'rgba(59,130,246,0.25)'
                : 'rgba(255,255,255,0.08)',
              color: autostartEnabled ? '#60a5fa' : 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s',
              opacity: !isElevated ? 0.5 : 1,
            }}
            title={!isElevated ? 'Requires administrator privileges' : undefined}
          >
            {autostartLoading ? '...' : autostartEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {!isElevated && (
          <p style={{ fontSize: 10, color: '#f59e0b', margin: '4px 0 0', lineHeight: 1.4 }}>
            🛡️ Run Vane as Administrator to enable auto-start.
          </p>
        )}

        {autostartError && (
          <p style={{ fontSize: 10, color: '#ef4444', margin: '4px 0 0' }}>
            {autostartError}
          </p>
        )}

        <div className={styles.divider} />

        {/* Remote Presets Sync */}
        <div className={styles.infoRow} style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Wifi size={12} style={{
              color: remoteStatus === 'offline' ? '#f59e0b'
                : remoteStatus === 'updated' ? '#22c55e'
                : 'rgba(255,255,255,0.5)'
            }} />
            Remote presets
          </span>
          <button
            onClick={handleManualSync}
            disabled={remoteStatus === 'syncing'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 10px',
              fontSize: 11,
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)',
              transition: 'all 0.15s',
            }}
          >
            <RefreshCw
              size={10}
              style={remoteStatus === 'syncing'
                ? { animation: 'spin 0.8s linear infinite' }
                : undefined}
            />
            {remoteStatus === 'offline' ? 'Offline'
              : remoteStatus === 'updated' ? 'Updated!'
              : remoteStatus === 'syncing' ? 'Syncing'
              : 'Sync'}
          </button>
        </div>

        <div className={styles.divider} />

        {/* Health Check Targets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600 }}>
            <Activity size={12} style={{ color: '#8b5cf6' }} />
            Health Check Targets
          </span>
          <p style={{ fontSize: 10, color: '#888', margin: 0 }}>
            Checks connectivity. Maximum 3 targets can be added.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {healthCheckTargets.map((target, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.04)',
                padding: '4px 8px',
                borderRadius: 4,
                fontSize: 11
              }}>
                <span style={{ color: '#ccc' }}>{target}</span>
                <button
                  onClick={() => {
                    if (healthCheckTargets.length <= 1) {
                      setHealthCheckTargets(['discord.com']);
                      return;
                    }
                    setHealthCheckTargets(healthCheckTargets.filter((_, i) => i !== idx));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2
                  }}
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {healthCheckTargets.length < 3 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="e.g. youtube.com"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTarget();
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    color: '#fff',
                    padding: '4px 8px',
                    fontSize: 11,
                    outline: 'none'
                  }}
                />
                <button
                  onClick={handleAddTarget}
                  disabled={!newTarget.trim()}
                  style={{
                    background: 'rgba(59,130,246,0.25)',
                    color: '#60a5fa',
                    border: 'none',
                    borderRadius: 4,
                    padding: '0 8px',
                    cursor: newTarget.trim() ? 'pointer' : 'not-allowed',
                    opacity: newTarget.trim() ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}