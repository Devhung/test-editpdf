export function ggID() {
  let id = 0;
  return function genId() {
    return id++;
  };
}
export function timeout(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
export const noop = () => {};

// Check running environment
export function checkEnvironment() {
  if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
    return 'react-native-webview';
  } else if (window.parent && window.parent !== window) {
    return 'iframe';
  }
  return 'browser';
}

// Specific environment checks
export function isReactNativeWebView() {
  return window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function';
}

export function isIframe() {
  return window.parent && window.parent !== window;
}

export function isBrowser() {
  return !isReactNativeWebView() && !isIframe();
}

export function sendMessageToApp(data) {
  const environment = checkEnvironment();

  switch (environment) {
    case 'react-native-webview':
      // Đang chạy trong WebView của React Native
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
      break;

    case 'iframe':
      // Đang chạy trong iframe (có thể dùng trong HTML embed)
      window.parent.postMessage(data, "*");
      break;

    default:
      // Chạy trên trình duyệt trực tiếp (localhost, Chrome, vv.)
      console.log("DEBUG (Browser):", data);
  }
}

export function formatDate(date, format) {
  try {
    // Parse the stored ISO date string
    const targetDate = new Date(date);

    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date');
    }

    const pad = (num) => String(num).padStart(2, '0');

    // Get date components in the correct timezone
    const year = targetDate.getFullYear();
    const month = pad(targetDate.getMonth() + 1);
    const day = pad(targetDate.getDate());
    const hours24 = targetDate.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = pad(targetDate.getMinutes());
    const ampm = hours24 >= 12 ? 'PM' : 'AM';

    // Format the date according to the pattern
    const formatDateTime = (pattern) => {
      if (typeof pattern !== 'string') {
        console.error('Invalid pattern input:', pattern);
        return '';
      }

      let result = pattern
        .replace('YYYY', year)
        .replace('yyyy', year)
        .replace('MM', month)
        .replace('dd', day)
        .replace('DD', day)
        .replace('HH', pad(hours24))
        .replace('hh', pad(hours12))
        .replace('mm', minutes)
        .replace('a', ampm.toLowerCase())
        .replace('A', ampm.toUpperCase());

      return result;
    };

    return formatDateTime(format);
  } catch (error) {
    console.error('Date formatting error:', error);
    return text; // Return original text if formatting fails
  }
}


