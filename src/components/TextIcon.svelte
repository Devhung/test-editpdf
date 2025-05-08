<script>
  export let size = 19;
  export let color = "currentColor";
  export let alt = "Text";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  fill={color}
  viewBox="0 0 24 24"
  {alt}
  aria-label={alt}
>
  <path
    fill-rule="evenodd"
    d="M12 5v14h4v1H7v-1h4V5H5v3H4V4h15v4h-1V5z"
    clip-rule="evenodd"
  />
</svg>
