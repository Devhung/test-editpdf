<script>
  export let text = "loading";
</script>

<div class="loading-container">
  <div class="loading-spinner">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>
  <span class="font-normal text-base md:text-xl text-gray-600 mt-4">
    {text}
  </span>
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .loading-spinner {
    display: inline-block;
    position: relative;
    width: 64px;
    height: 64px;
  }

  .loading-spinner div {
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: 51px;
    height: 51px;
    margin: 6px;
    border: 2px solid #3B82F6;
    border-radius: 50%;
    animation: loading-spinner 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: #3B82F6 transparent transparent transparent;
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