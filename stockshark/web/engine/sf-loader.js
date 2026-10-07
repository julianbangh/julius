// Starts a Stockfish WebAssembly build inside this worker from bytes the page has already
// downloaded, so the engine makes no network request of its own. The page posts
// { wasm: ArrayBuffer, script: 'stockfish-19-single.js' } once, then plain UCI strings.
self.onmessage = function (e) {
  var d = e.data;
  if (!d || !d.wasm || !d.script) return;
  var bytes = d.wasm;
  var realFetch = self.fetch.bind(self);
  // The engine reads its wasm location from this worker's URL hash (#stockshark-wasm).
  self.fetch = function (url, opts) {
    if (String(url).indexOf('stockshark-wasm') !== -1) {
      return Promise.resolve(new Response(bytes, { headers: { 'content-type': 'application/wasm' } }));
    }
    return realFetch(url, opts);
  };
  self.onmessage = null;
  importScripts(d.script);
};
