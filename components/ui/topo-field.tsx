import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

type TopoFieldMode = "dark" | "light";

export type TopoFieldProps = {
  mode?: TopoFieldMode | "auto";
  speed?: number;
  length?: number;
  density?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function readAutomaticMode(): TopoFieldMode {
  if (typeof document === "undefined" || typeof window === "undefined") return "dark";
  const root = document.documentElement;
  const declared = root.dataset.scheme ?? root.dataset.theme;
  if (declared === "light" || declared === "dark") return declared;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useAutomaticMode(enabled: boolean) {
  const [autoMode, setAutoMode] = useState<TopoFieldMode>(readAutomaticMode);

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof window === "undefined") return undefined;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setAutoMode(readAutomaticMode());
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-scheme", "data-theme"] });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [enabled]);

  return autoMode;
}

function buildTopoSource(mode: TopoFieldMode, length: number, density: number) {
  const background = mode === "light" ? "vec3(0.97, 0.98, 0.97)" : "vec3(0.0, 0.0, 0.0)";
  const lineColor = "vec3(0.45, 0.90, 0.65)";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Topo Field</title>
</head>
<body style="margin:0;background:transparent;overflow:hidden;">
  <canvas id="topo-canvas" style="position:fixed;inset:0;width:100%;height:100%;"></canvas>
  <script>
    const canvas = document.getElementById('topo-canvas');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });

    if (gl) {
      const vsSource = \`
        attribute vec2 a_position;
        void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
      \`;

      const fsSource = \`
        precision highp float;
        uniform vec2 u_resolution;
        uniform float u_time;

        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float snoise(vec2 v){
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          vec2 st = gl_FragCoord.xy / u_resolution.xy;
          st.x *= u_resolution.x / u_resolution.y;

          float noiseScale = ${length.toFixed(3)} * 1.4;
          vec2 noisePos = st * noiseScale + vec2(u_time * 0.015, u_time * 0.025);
          float n = snoise(noisePos) * 0.5 + 0.5;

          float numBands = ${density.toFixed(3)} * 10.0;
          float bandVal = n * numBands;
          float triangleWave = abs(fract(bandVal) - 0.5) * 2.0;
          float topoLines = smoothstep(0.02, 0.00, triangleWave) * 0.45;

          vec3 color = ${background};
          color += ${lineColor} * topoLines;

          gl_FragColor = vec4(color, 1.0);
        }
      \`;

      function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      }

      const program = gl.createProgram();
      gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
      gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
      gl.linkProgram(program);
      gl.useProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      const positionLocation = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      const timeLocation = gl.getUniformLocation(program, "u_time");

      function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }

      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      let startTime = performance.now();
      function render(time) {
        gl.uniform1f(timeLocation, (time - startTime) * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    }
  </script>
</body>
</html>`;
}

export default function TopoField({
  mode = "dark",
  speed = 1,
  length = 1,
  density = 1,
  opacity = 1,
  className,
  style,
}: TopoFieldProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const automaticMode = useAutomaticMode(mode === "auto");
  const resolvedMode: TopoFieldMode =
    mode === "auto" ? automaticMode : mode === "light" ? "light" : "dark";

  const safeSpeed = clamp(speed, 0, 3);
  const safeLength = clamp(length, 0.35, 2.5);
  const safeDensity = clamp(density, 0.25, 2.5);
  const safeOpacity = clamp(opacity, 0.05, 1);

  const source = useMemo(
    () => buildTopoSource(resolvedMode, safeLength, safeDensity),
    [resolvedMode, safeLength, safeDensity]
  );

  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    // Speed is baked into the source for this implementation, so only opacity is live.
    frame.postMessage({ type: "threeui-controls", controls: { speed: safeSpeed, opacity: safeOpacity } }, "*");
  }, [safeSpeed, safeOpacity, source]);

  return (
    <iframe
      ref={iframeRef}
      suppressHydrationWarning
      className={className}
      title="Topo Field"
      srcDoc={source}
      sandbox="allow-scripts"
      loading="eager"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        borderWidth: 0,
        borderStyle: "none",
        backgroundColor: "transparent",
        ...style,
      }}
    />
  );
}