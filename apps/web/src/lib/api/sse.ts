/**
 * Minimal text/event-stream reader for fetch() response bodies.
 */

/**
 * Yields the `data:` payload of each server-sent event, in order.
 * Multi-line data is joined with "\n"; events without data (comments, keep-alives) are skipped.
 */
export async function* readEventData(body: NonNullable<Response["body"]>): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value.replace(/\r\n/g, "\n");

    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) yield data;
    }
  }
}
