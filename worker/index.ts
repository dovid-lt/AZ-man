export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, time: new Date().toISOString() });
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // לא אמור להגיע לכאן (run_worker_first מוגבל ל-/api/*), אבל ליתר ביטחון:
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
