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
  if (
    window.ReactNativeWebView &&
    typeof window.ReactNativeWebView.postMessage === "function"
  ) {
    return "react-native-webview";
  } else if (window.parent && window.parent !== window) {
    return "iframe";
  }
  return "browser";
}

// Specific environment checks
export function isReactNativeWebView() {
  return (
    window.ReactNativeWebView &&
    typeof window.ReactNativeWebView.postMessage === "function"
  );
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
    case "react-native-webview":
      // Đang chạy trong WebView của React Native
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
      break;

    case "iframe":
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
      throw new Error("Invalid date");
    }

    const pad = (num) => String(num).padStart(2, "0");

    // Get date components in the correct timezone
    const year = targetDate.getFullYear();
    const month = pad(targetDate.getMonth() + 1);
    const day = pad(targetDate.getDate());
    const hours24 = targetDate.getHours();
    const hours12 = hours24 % 12 || 12;
    const minutes = pad(targetDate.getMinutes());
    const seconds = pad(targetDate.getSeconds());
    const ampm = hours24 >= 12 ? "PM" : "AM";

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const monthNamesShort = monthNames.map(month => month.substring(0, 3));

    // First handle special date formats
    let result = format;

    // Handle month formats in specific order
    if (result.includes('MMMM')) {
      result = result.replace(/MMMM/g, monthNames[targetDate.getMonth()]);
    } else if (result.includes('MMM')) {
      result = result.replace(/MMM/g, monthNamesShort[targetDate.getMonth()]);
    }

    // Then handle the rest of the formats
    const tokens = [
      // Year - both YYYY and yyyy
      { token: "YYYY", value: year, pattern: /(?<![\d])(YYYY|yyyy)(?![\d])/g },

      // Month - numeric (MM)
      { token: "MM", value: month, pattern: /(?<![:M])(MM|mm)(?![:M])/g },

      // Day - double digits (DD/dd)
      { token: "DD", value: day, pattern: /(?<![\d:])(DD|dd)(?![\d:])/g },

      // Day - single digit with spaces (D/d)
      { token: "D", value: targetDate.getDate(), pattern: /(?<=^|\s)[Dd](?=\s|$|[^Dd\d:])/g },

      // Hours - 24h format (HH)
      { token: "HH", value: pad(hours24), pattern: /(?<![\d])HH(?=:)/g },

      // Hours - 12h format (hh)
      { token: "hh", value: pad(hours12), pattern: /(?<![\d])hh(?=:)/g },

      // Minutes - only after colon
      { token: "mm", value: minutes, pattern: /(?<=:)(mm|MM)(?![\d])/g },

      // Seconds
      { token: "ss", value: seconds, pattern: /(?<=:)(ss|SS)(?![\d])/g },

      // AM/PM markers
      { token: "A", value: ampm.toUpperCase(), pattern: /(A|PM|AM)(?![\w])/g },
      { token: "a", value: ampm.toLowerCase(), pattern: /(a|pm|am)(?![\w])/g }
    ];

    // Apply remaining tokens
    tokens.forEach(({ token, value, pattern }) => {
      result = result.replace(pattern, value);
    });

    return result;
  } catch (error) {
    console.error("Date formatting error:", error);
    return date; // Return original date if formatting fails
  }
}
