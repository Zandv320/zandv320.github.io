/* Eldoria – a small performance readout for testing on real devices: open the game with ?perf in the address, or
   switch it on in the settings ('eldoria.perf' in localStorage).
   Once per second it shows the frames drawn, the slowest frame (the stutter), the time the main thread and the GPU
   spent per frame (the GPU only where the browser can measure it), the draw calls, the render size and the
   graphics chip. */

/** Returns null unless it is wanted (see above); otherwise {begin(), end()} to wrap around each drawn frame. */
export function createPerfOverlay(renderer) {
  let isWanted = /[?&]perf\b/.test(location.search);
  try {
    isWanted = isWanted || localStorage.getItem("eldoria.perf") === "1";
  } catch (e) {}
  if (!isWanted) {
    return null;
  }
  const gl = renderer.getContext();
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const chip = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "unknown GPU";

  const panel = document.createElement("pre");
  Object.assign(panel.style, {
    position: "fixed",
    left: "4px",
    right: "4px",
    top: "calc(env(safe-area-inset-top) + 4px)",
    zIndex: 100,
    margin: 0,
    padding: "4px 8px",
    background: "rgba(0, 0, 0, 0.75)",
    color: "#9f9",
    font: "11px/1.35 monospace",
    pointerEvents: "none",
    whiteSpace: "pre-wrap",
  });
  document.body.appendChild(panel);

  const pending = []; /* GPU timer queries waiting for their result */
  let query = null;
  let frameStart = 0;
  let lastFrameAt = 0;
  let windowStart = performance.now();
  let frames = 0;
  let worstGap = 0;
  let cpuTotal = 0;
  let gpuTotal = 0;
  let gpuCount = 0;

  function begin() {
    frameStart = performance.now();
    if (timer && !query) {
      query = gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    }
  }

  function end() {
    const time = performance.now();
    cpuTotal += time - frameStart;
    if (query) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      pending.push(query);
      query = null;
    }
    while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const done = pending.shift();
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
        gpuTotal += gl.getQueryParameter(done, gl.QUERY_RESULT) / 1e6;
        gpuCount++;
      }
      gl.deleteQuery(done);
    }
    if (lastFrameAt) {
      worstGap = Math.max(worstGap, time - lastFrameAt);
    }
    lastFrameAt = time;
    frames++;
    if (time - windowStart >= 1000) {
      const seconds = (time - windowStart) / 1000;
      panel.textContent = [
        `${Math.round(frames / seconds)} fps  slowest ${worstGap.toFixed(0)} ms`,
        `cpu ${(cpuTotal / frames).toFixed(1)} ms  gpu ${
          gpuCount ? (gpuTotal / gpuCount).toFixed(1) + " ms" : "n/a"
        }  calls ${renderer.info.render.calls}`,
        `${renderer.domElement.width}×${renderer.domElement.height} @${renderer.getPixelRatio()}  ${chip}`,
      ].join("\n");
      windowStart = time;
      frames = 0;
      worstGap = 0;
      cpuTotal = 0;
      gpuTotal = 0;
      gpuCount = 0;
    }
  }

  return { begin, end };
}
