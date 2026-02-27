export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ message: "Hello from the API" });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
