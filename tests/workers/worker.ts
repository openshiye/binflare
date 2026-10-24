export default {
  async fetch(): Promise<Response> {
    return new Response('worker test fixture')
  },
}
