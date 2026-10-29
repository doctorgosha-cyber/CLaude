// render-blocking: parsed before body, burns ~900 ms on the main thread
const t=performance.now();while(performance.now()-t<900){}
window.__ready=true;
