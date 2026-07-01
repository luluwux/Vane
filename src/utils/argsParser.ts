import { type AdvancedConfig, DEFAULT_ADVANCED_CONFIG } from '../store/engineStore';

const KNOWN_STRATEGIES = ['none', 'split', 'split2', 'disorder', 'fake', 'oob', 'syndata'];

/**
 * winws argüman dizisini AdvancedConfig objesine dönüştürür.
 * Tanınmayan arg'lar sessizce atlanır.
 */
export function parseArgsToConfig(args: string[]): AdvancedConfig {
  const config: AdvancedConfig = { ...DEFAULT_ADVANCED_CONFIG, desyncFooling: [] };

  for (const arg of args) {
    if (arg.startsWith('--dpi-desync=')) {
      const val = arg.split('=')[1];
      if (KNOWN_STRATEGIES.includes(val)) {
        config.desyncMethod = val;
      } else {
        config.desyncMethod = 'custom';
        config.customDesyncMethod = val;
      }
    } else if (arg.startsWith('--dpi-desync-http=')) {
      config.desyncHttp = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-https=')) {
      config.desyncHttps = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-quic=')) {
      config.desyncQuic = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-cutoff=')) {
      config.desyncCutoff = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-split-pos=')) {
      config.splitPosition = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--dpi-desync-repeats=')) {
      config.desyncRepeats = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--dpi-desync-fooling=')) {
      config.desyncFooling = arg.split('=')[1].split(',').map(s => s.trim());
    } else if (arg.startsWith('--dpi-desync-ttl=')) {
      config.fakeTtl = parseInt(arg.split('=')[1], 10);
      config.autoTtl = false;
    } else if (arg === '--dpi-desync-autottl') {
      config.autoTtl = true;
    } else if (arg.startsWith('--dpi-desync-ttl-ext=')) {
      config.fakeTtlExt = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--dpi-desync-split-http-req=')) {
      config.splitHttpReq = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-split-pos-http-req=')) {
      config.splitPosHttpReq = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--dpi-desync-split-tls=')) {
      config.splitTls = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-split-pos-tls=')) {
      config.splitPosTls = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--dpi-desync-fake-tls-sni=')) {
      config.fakeTlsSni = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-fake-http=')) {
      config.fakeHttpPayload = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-fake-tls=')) {
      config.fakeTlsPayload = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync-fake-quic=')) {
      config.fakeQuicPayload = arg.split('=')[1];
    } else if (arg.startsWith('--dpi-desync2=')) {
      config.desync2 = arg.split('=')[1];
    } else if (arg.startsWith('--tcp-window-size=')) {
      config.tcpWindowSize = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--ipset=')) {
      config.ipsetPath = arg.split('=')[1];
    } else if (arg.startsWith('--bind-addr=')) {
      config.bindInterface = arg.split('=')[1];
    } else if (arg.startsWith('--socks=')) {
      config.tpwsMode = true;
      config.bindInterface = arg.split('=')[1];
    } else if (arg.startsWith('--mss=')) {
      config.mssFix = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--wf-tcp=')) {
      config.httpPorts = arg.split('=')[1].replace(/,/g, ', ');
    } else if (arg.startsWith('--wf-udp=')) {
      config.quicUdpHandling = arg.includes('443');
    } else if (arg === '--dpi-desync-any-protocol') {
      config.anyProtocol = true;
    }
  }

  return config;
}

/**
 * AdvancedConfig objesini winws argüman dizisine dönüştürür.
 */
export function serializeConfigToArgs(config: AdvancedConfig): string[] {
  const args: string[] = [];

  // Protocol & Ports (sadece TPWS modu kapalıyken geçerli)
  if (!config.tpwsMode) {
    if (config.httpPorts) {
      args.push(`--wf-tcp=${config.httpPorts.replace(/\s+/g, '')}`);
    }
    if (config.quicUdpHandling) {
      args.push('--wf-udp=443');
    }
  } else {
    // tpws socks proxy modu
    args.push(`--socks=${config.bindInterface || '127.0.0.1:1080'}`);
  }

  if (config.bindInterface && !config.tpwsMode) {
    args.push(`--bind-addr=${config.bindInterface}`);
  }

  if (config.ipsetPath) {
    args.push(`--ipset=${config.ipsetPath}`);
  }

  if (config.tcpWindowSize > 0) {
    args.push(`--tcp-window-size=${config.tcpWindowSize}`);
  }

  if (config.mssFix > 0) {
    args.push(`--mss=${config.mssFix}`);
  }

  // Strategy
  const strategyVal = config.desyncMethod === 'custom'
    ? (config.customDesyncMethod || 'split')
    : config.desyncMethod;

  if (strategyVal !== 'none') {
    args.push(`--dpi-desync=${strategyVal}`);

    if (config.anyProtocol) {
      args.push('--dpi-desync-any-protocol');
    }

    if (config.desyncCutoff) {
      args.push(`--dpi-desync-cutoff=${config.desyncCutoff}`);
    }

    // Protokol bazlı stratejiler
    if (config.desyncHttp && config.desyncHttp !== 'none') {
      args.push(`--dpi-desync-http=${config.desyncHttp}`);
    }
    if (config.desyncHttps && config.desyncHttps !== 'none') {
      args.push(`--dpi-desync-https=${config.desyncHttps}`);
    }
    if (config.desyncQuic && config.desyncQuic !== 'none') {
      args.push(`--dpi-desync-quic=${config.desyncQuic}`);
    }

    // İkinci aşama desync
    if (config.desync2 && config.desync2 !== 'none') {
      args.push(`--dpi-desync2=${config.desync2}`);
    }

    // Bölme (split) konumları
    if (config.splitPosition > 0) {
      args.push(`--dpi-desync-split-pos=${config.splitPosition}`);
    }
    if (config.splitHttpReq && config.splitHttpReq !== 'none') {
      args.push(`--dpi-desync-split-http-req=${config.splitHttpReq}`);
    }
    if (config.splitPosHttpReq > 0) {
      args.push(`--dpi-desync-split-pos-http-req=${config.splitPosHttpReq}`);
    }
    if (config.splitTls && config.splitTls !== 'none') {
      args.push(`--dpi-desync-split-tls=${config.splitTls}`);
    }
    if (config.splitPosTls > 0) {
      args.push(`--dpi-desync-split-pos-tls=${config.splitPosTls}`);
    }

    // Tekrar ve Evasion Fooling
    if (config.desyncRepeats > 1) {
      args.push(`--dpi-desync-repeats=${config.desyncRepeats}`);
    }
    if (config.desyncFooling.length > 0) {
      args.push(`--dpi-desync-fooling=${config.desyncFooling.join(',')}`);
    }

    // TTL Evasion
    if (config.autoTtl) {
      args.push('--dpi-desync-autottl');
    } else if (config.fakeTtl > 0) {
      args.push(`--dpi-desync-ttl=${config.fakeTtl}`);
    }
    if (config.fakeTtlExt > 0) {
      args.push(`--dpi-desync-ttl-ext=${config.fakeTtlExt}`);
    }

    // Özel payload ve SNI'lar
    if (config.fakeTlsSni) {
      args.push(`--dpi-desync-fake-tls-sni=${config.fakeTlsSni}`);
    }
    if (config.fakeHttpPayload) {
      args.push(`--dpi-desync-fake-http=${config.fakeHttpPayload}`);
    }
    if (config.fakeTlsPayload) {
      args.push(`--dpi-desync-fake-tls=${config.fakeTlsPayload}`);
    }
    if (config.fakeQuicPayload) {
      args.push(`--dpi-desync-fake-quic=${config.fakeQuicPayload}`);
    }
  }

  return args;
}
