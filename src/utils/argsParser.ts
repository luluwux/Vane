import { type AdvancedConfig, DEFAULT_ADVANCED_CONFIG } from '../store/engineStore';

const KNOWN_STRATEGIES = ['none', 'split', 'split2', 'disorder', 'fake', 'oob'];

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

  // Protocol & Ports (önce filtreler gelir)
  if (config.httpPorts) {
    args.push(`--wf-tcp=${config.httpPorts.replace(/\s+/g, '')}`);
  }
  if (config.quicUdpHandling) {
    args.push('--wf-udp=443');
  }

  // Strategy
  const strategyVal = config.desyncMethod === 'custom'
    ? (config.customDesyncMethod || 'split')
    : config.desyncMethod;

  if (strategyVal !== 'none') {
    args.push(`--dpi-desync=${strategyVal}`);

    if (config.anyProtocol) {
      args.push('--dpi-desync-any-protocol');
      args.push('--dpi-desync-cutoff=d3'); // Trash Flood Engellemesi
    }

    if (config.splitPosition > 0) {
      args.push(`--dpi-desync-split-pos=${config.splitPosition}`);
    }

    if (config.desyncRepeats > 1) {
      args.push(`--dpi-desync-repeats=${config.desyncRepeats}`);
    }

    if (config.desyncFooling.length > 0) {
      args.push(`--dpi-desync-fooling=${config.desyncFooling.join(',')}`);
    }

    if (config.autoTtl) {
      args.push('--dpi-desync-autottl');
    } else if (config.fakeTtl > 0) {
      args.push(`--dpi-desync-ttl=${config.fakeTtl}`);
    }
  }

  return args;
}
