import { FastifyRequest } from "fastify";

export default function getSessionId(req: FastifyRequest) {
  const cookies = req.headers.cookie;
  const [, sessionId] = cookies!.split(/[;=]/g);
  return sessionId;
}
