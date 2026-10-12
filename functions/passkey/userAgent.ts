/** A human-readable description of the device a request came from. */
export interface DeviceDescription {
  deviceName: string; // e.g. "iPhone · Safari"
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  os: string;
  browser: string;
}

const MAX_UA_LENGTH = 512;

/**
 * Deliberately small user-agent parser: enough to tell a user "iPhone · Safari"
 * vs "Windows · Chrome" when they review their devices. Informational only —
 * never used for any security decision.
 */
export function describeDevice(userAgent: string | undefined): DeviceDescription {
  const ua = (userAgent || '').slice(0, MAX_UA_LENGTH);
  if (!ua) return { deviceName: 'Unknown device', deviceType: 'unknown', os: 'Unknown', browser: 'Unknown' };

  const os =
    /iPhone/.test(ua) ? 'iPhone' :
    /iPad/.test(ua) ? 'iPad' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Macintosh|Mac OS X/.test(ua) ? 'Mac' :
    /CrOS/.test(ua) ? 'ChromeOS' :
    /Linux/.test(ua) ? 'Linux' : 'Unknown';

  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /SamsungBrowser/.test(ua) ? 'Samsung Internet' :
    /Firefox\/|FxiOS/.test(ua) ? 'Firefox' :
    /CriOS|Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Browser';

  const deviceType: DeviceDescription['deviceType'] =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablet' :
    /Mobi|iPhone|Android/.test(ua) ? 'mobile' :
    os === 'Unknown' ? 'unknown' : 'desktop';

  return { deviceName: `${os} · ${browser}`, deviceType, os, browser };
}
