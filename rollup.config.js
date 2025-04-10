import svelte from "rollup-plugin-svelte";
import open from "open";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
import { terser } from "rollup-plugin-terser";
import sveltePreprocess from "svelte-preprocess";
import copy from "rollup-plugin-copy";
import cleaner from 'rollup-plugin-cleaner';

const production = !process.env.ROLLUP_WATCH;
const timestamp = new Date().getTime();

export default {
  input: "src/main.js",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    file: `build/bundle.${timestamp}.js`,
  },
  plugins: [
    svelte({
      preprocess: sveltePreprocess({ postcss: true }),
      // enable run-time checks when not in production
      dev: !production,
      // we'll extract any component CSS out into
      // a separate file - better for performance
      css: (css) => {
        css.write(`build/bundle.${timestamp}.css`);
      },
    }),

    // Copy public files to build directory
    copy({
      targets: [
        { src: "public/*", dest: "build" },
        { src: "public/assets/*", dest: "build/assets" },
        {
          src: "public/index.html",
          dest: "build",
          transform: (contents) => {
            return contents
              .toString()
              .replace("/build/bundle.css", `bundle.${timestamp}.css`)
              .replace("/build/bundle.js", `bundle.${timestamp}.js`);
          },
        },
      ],
    }),

    resolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs(),
    !production && serve(),
    !production && livereload("build"),
    production && terser(),
    cleaner({
      targets: ["./build/"],
    }),
  ],
  watch: {
    clearScreen: false,
  },
};

function serve() {
  let started = false;

  return {
    writeBundle() {
      if (!started) {
        started = true;

        require("child_process").spawn("yarn", ["start", "--dev"], {
          stdio: ["ignore", "inherit", "inherit"],
          shell: true,
        });
        open("http://localhost:5000");
      }
    },
  };
}
