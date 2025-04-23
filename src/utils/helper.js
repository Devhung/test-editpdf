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

export function sendMessageToApp(data) {
  if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
    // Đang chạy trong WebView của React Native
    window.ReactNativeWebView.postMessage(data);
  } else if (window.parent && window.parent !== window) {
    // Đang chạy trong iframe (có thể dùng trong HTML embed)
    window.parent.postMessage(data, "*");
  } else {
    // Chạy trên trình duyệt trực tiếp (localhost, Chrome, vv.)
    console.log("DEBUG (Browser):", data);
  }
}
