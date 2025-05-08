<script>
  export let size = 19; // default size
  export let color = "currentColor"; // default color
  export let alt = "Person";
</script>

<svg
  {alt}
  width={size}
  height={size}
  xmlns="http://www.w3.org/2000/svg"
  fill={color}
  viewBox="0 0 24 24"
  aria-label={alt}
>
  <path d="M12 3a5 5 0 0 1 2.424 9.374 8 8 0 0 1 5.572 7.377L20 20v1h-1v-1l-.004-.24a7 7 0 0 0-13.992 0L5 20v1H4v-1l.004-.25a8 8 0 0 1 5.573-7.376A5 5 0 0 1 12 3m0 1a4 4 0 1 0 0 8 4 4 0 0 0 0-8" />
</svg>
