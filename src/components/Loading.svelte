<script>
  export let text = "loading";
  export let size = "default"; // tiny, small, default, large
  export let showText = true;
  export let color = "blue"; // blue, white, gray, green, red, yellow, custom
  export let customColor = ""; // Cho phép truyền mã màu tùy chỉnh
  export let fullscreen = false; // Thêm option để hiển thị fullscreen

  const colorConfig = {
    blue: {
      border: "#3B82F6",
      text: "text-blue-600",
      bg: "bg-blue-50"
    },
    white: {
      border: "#FFFFFF",
      text: "text-white",
      bg: "bg-white/10"
    },
    gray: {
      border: "#6B7280",
      text: "text-gray-600",
      bg: "bg-gray-50"
    },
    green: {
      border: "#10B981",
      text: "text-green-600",
      bg: "bg-green-50"
    },
    red: {
      border: "#EF4444",
      text: "text-red-600",
      bg: "bg-red-50"
    },
    yellow: {
      border: "#F59E0B",
      text: "text-yellow-600",
      bg: "bg-yellow-50"
    },
    custom: {
      border: customColor,
      text: "text-gray-600",
      bg: "bg-gray-50"
    }
  };

  const sizeConfig = {
    tiny: {
      spinner: "16px",
      border: "1px",
      inner: "12px",
      margin: "2px",
      text: "text-xs",
      padding: "p-2",
      container: "w-16 h-16"
    },
    small: {
      spinner: "32px",
      border: "2px",
      inner: "24px",
      margin: "4px",
      text: "text-sm",
      padding: "p-3",
      container: "w-24 h-24"
    },
    default: {
      spinner: "64px",
      border: "2px",
      inner: "51px",
      margin: "6px",
      text: "text-base",
      padding: "p-4",
      container: "w-32 h-32"
    },
    large: {
      spinner: "80px",
      border: "3px",
      inner: "64px",
      margin: "8px",
      text: "text-xl",
      padding: "p-5",
      container: "w-40 h-40"
    }
  };

  $: config = sizeConfig[size] || sizeConfig.default;
  $: currentColor = colorConfig[color] || colorConfig.blue;
  $: if (color === 'custom' && customColor) {
    currentColor = { border: customColor, text: "text-gray-600", bg: "bg-gray-50" };
  }
</script>

{#if fullscreen}
  <div class="fixed inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] z-50">
    <div class="loading-container {config.padding} {currentColor.bg} rounded-lg shadow-lg">
      <div class="loading-spinner" style="width: {config.spinner}; height: {config.spinner}">
        <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
        <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
        <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
        <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
      </div>
      {#if showText}
        <span class="font-normal {config.text} {currentColor.text} mt-2">
          {text}
        </span>
      {/if}
    </div>
  </div>
{:else}
  <div class="loading-container {config.padding} {currentColor.bg} rounded-lg shadow-sm">
    <div class="loading-spinner" style="width: {config.spinner}; height: {config.spinner}">
      <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
      <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
      <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
      <div style="width: {config.inner}; height: {config.inner}; margin: {config.margin}; border-width: {config.border}; border-color: {currentColor.border} transparent transparent transparent;"></div>
    </div>
    {#if showText}
      <span class="font-normal {config.text} {currentColor.text} mt-2">
        {text}
      </span>
    {/if}
  </div>
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #a3aebea8;
    min-width: 10rem;
    min-height: 10rem;
  }

  .loading-spinner {
    display: inline-block;
    position: relative;
  }

  .loading-spinner div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    border-style: solid;
    border-radius: 50%;
    animation: loading-spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }

  .loading-spinner div:nth-child(1) {
    animation-delay: -0.45s;
  }

  .loading-spinner div:nth-child(2) {
    animation-delay: -0.3s;
  }

  .loading-spinner div:nth-child(3) {
    animation-delay: -0.15s;
  }

  @keyframes loading-spinner {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
